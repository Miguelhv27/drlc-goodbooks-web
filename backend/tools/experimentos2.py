"""
experimentos2.py - Arnes de scale sweep standalone (T7, spec S11).

Reutiliza el modulo tools/experimentos.py (T5) por import: mismo load_data()
con cache de prepare() en el temp del sistema, mismo train_tt() con early
stopping (patience 2, max 10 epocas, tau=0.05) y mismo build_S() del baseline.
Aqui se anaden los knobs de escala max_users / dim / batch por EXPERIMENTO y,
desde la ronda final de micro-tuning, un knob opcional lr (learning_rate del
Adam): experimentos.py esta congelado como evidencia T5 y su train_tt() fija
Adam(1e-3), asi que el passthrough envuelve SOLO la construccion del optimizador
durante esa llamada (sin tocar el modulo importado).

Comparabilidad (S11): dentro de un mismo regimen (max_users) todas las configs
comparten la salida de prepare() via el pickle del cache, keyed por
(data, thr, min_pos, max_users, seed) - identico a experimentos.py, por lo que
el regimen de 15k reutiliza el MISMO pickle de la evidencia T5. Ojo: la muestra
de 3000 eval-users se sortea del user-space propio de cada regimen (semilla 42),
asi que las comparaciones ENTRE regimenes son indicativas; las intrarregimen
son estrictas.

Seleccion SIEMPRE por val NDCG@10 (positivos = val, se enmascara solo train);
el test NDCG@10/Recall@10 se reporta solo post-decision (S9: nunca elegir
sobre test). Semilla fija 42.

Uso (una corrida por invocacion):
    python tools/experimentos2.py --exp full --tower id
    python tools/experimentos2.py --exp full_b4096 --tower meta
    python tools/experimentos2.py --exp full_d128 --tower id
    python tools/experimentos2.py --exp d128@15k  --tower id
    python tools/experimentos2.py --exp b4096@15k --tower id
    python tools/experimentos2.py --exp es_ref15k --tower id|meta
    python tools/experimentos2.py --exp d32 --tower id
    python tools/experimentos2.py --exp lr3e4 --tower meta
    python tools/experimentos2.py --exp lr1e4 --tower id
    python tools/experimentos2.py --exp pop_full
    python tools/experimentos2.py --exp knn_full

Imprime una linea JSON compacta y la agrega a tools/experimentos2_results.json.
Los scratch (cache de prepare y similitudes) van al temp del sistema, no al repo.
"""
import argparse, json, os, sys, time
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

import numpy as np
import scipy.sparse as sp

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import experimentos as ex1  # noqa: E402  (inserta ROOT y trae pipeline)
import pipeline as pl       # noqa: E402

RESULTS = HERE / "experimentos2_results.json"
SEED = 42

# kind=tt -> two-tower con ES activo (patience 2, max 10 epocas, tau 0.05).
# kind=pop/knn -> baselines numpy/scipy sobre el MISMO data y evaluate() del
# regimen correspondiente (S11: comparacion justa en full-user data).
EXPERIMENTS = {
    "full":        dict(kind="tt",  max_users=0,     dim=64,  batch=2048),
    "full_b4096":  dict(kind="tt",  max_users=0,     dim=64,  batch=4096),
    "full_d128":   dict(kind="tt",  max_users=0,     dim=128, batch=2048),
    "d128@15k":    dict(kind="tt",  max_users=15000, dim=128, batch=2048),
    "b4096@15k":   dict(kind="tt",  max_users=15000, dim=64,  batch=4096),
    # referencia ES recalculada dentro de este arnes (mismo pickle 15k de T5)
    # para comparar manzanas con manzanas sin tocar experimentos_results.json.
    "es_ref15k":   dict(kind="tt",  max_users=15000, dim=64,  batch=2048),
    # Ronda final de micro-tuning en el MISMO regimen 15k (controles estrictos
    # es_ref15k: id val 0.04816 / meta val 0.05339). lr = learning_rate Adam
    # (default del pipeline 1e-3); d32 reutiliza el knob dim existente.
    "d32":         dict(kind="tt",  max_users=15000, dim=32,  batch=2048),
    "lr3e4":       dict(kind="tt",  max_users=15000, dim=64,  batch=2048, lr=3e-4),
    "lr1e4":       dict(kind="tt",  max_users=15000, dim=64,  batch=2048, lr=1e-4),
    "pop_full":    dict(kind="pop", max_users=0),
    "knn_full":    dict(kind="knn", max_users=0),
}


def main():
    # stdout linea a linea: los prints de train_tt() aterrizan en el log del
    # Start-Process aunque el stdout este redirigido a archivo.
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass

    p = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    p.add_argument("--exp", required=True, choices=sorted(EXPERIMENTS))
    p.add_argument("--tower", default="id", choices=["id", "meta"],
                   help="variante two-tower (se aplica solo a --exp kind=tt)")
    args = p.parse_args()
    cfg = EXPERIMENTS[args.exp]

    a = ex1.base_args()  # defaults identicos al pipeline canonico (seed 42)
    a.max_users = cfg["max_users"]
    a.dim = cfg.get("dim", a.dim)
    a.batch = cfg.get("batch", a.batch)

    t0 = time.time()
    D = ex1.load_data(a)  # cache por regimen: same (data,thr,min_pos,max_users,seed)
    zero = sp.csr_matrix((D["n_users"], D["n_items"]), dtype=np.float32)
    hist, best_epoch, epochs_run = None, 0, 0

    if cfg["kind"] == "tt":
        lr = cfg.get("lr")
        params = dict(max_users=a.max_users, dim=a.dim, batch=a.batch,
                      tau=0.05, early_stop=True, patience=2, max_epochs=10,
                      logq=a.logq, seed=SEED, tower=args.tower)
        if lr is not None:
            params["lr"] = lr

        def run_tt():
            return ex1.train_tt(D, a, f"{args.exp}:{args.tower}", tau=0.05,
                                epochs=5, early_stop=True, patience=2,
                                max_epochs=10, tower=args.tower)

        if lr is None:
            U, E, hist, best_epoch = run_tt()
        else:
            # Passthrough minimo: train_tt() construye Adam(1e-3, weight_decay=...)
            # en su interior; se sustituye tf.keras.optimizers.Adam SOLO durante
            # la llamada (la posicion 1 pasa a ser lr) y se restaura despues.
            import tensorflow as tf
            Adam = tf.keras.optimizers.Adam
            tf.keras.optimizers.Adam = lambda *pos, **kw: Adam(lr, **kw)
            try:
                U, E, hist, best_epoch = run_tt()
            finally:
                tf.keras.optimizers.Adam = Adam
        epochs_run = len(hist["loss"])
        score_fn = lambda ub: U[ub] @ E.T
        kind, tower_tag = "tt", args.tower
    else:
        kind = cfg["kind"]
        tower_tag = "popularidad" if kind == "pop" else "item_knn"
        params = dict(max_users=a.max_users, seed=SEED, tower=tower_tag)
        if kind == "pop":
            popc = np.asarray(D["train"].sum(0)).ravel().astype(np.float32)
            score_fn = lambda ub: np.tile(popc, (len(ub), 1))
        else:
            S = ex1.build_S(D, D["train"])  # cache f32 en temp, keyed por nnz
            train = D["train"]
            score_fn = lambda ub: train[ub].toarray() @ S

    # Decision: val NDCG@10 (positivos = val, se enmascara solo train).
    vm = pl.evaluate(score_fn, D["train"], zero, D["val"], D["eval_users"])
    # Referencia post-decision (canonica: se enmascara train+val, positivos = test).
    tm = pl.evaluate(score_fn, D["train"], D["val"], D["test"], D["eval_users"])

    # Hechos del regimen para la caveat de comparabilidad entre escalas.
    test_pool = int(np.count_nonzero(np.asarray(D["test"].sum(1)).ravel() > 0))

    entry = dict(exp=args.exp, kind=kind, tower=tower_tag, seed=SEED, params=params,
                 utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                 minutes=round((time.time() - t0) / 60, 2),
                 epochs_run=epochs_run, best_epoch=best_epoch,
                 user_space=int(D["n_users"]), n_items=int(D["n_items"]),
                 n_train_pairs=int(D["pairs"][0].size),
                 test_pool=test_pool, n_eval_users=int(len(D["eval_users"])),
                 val={k: round(v, 5) for k, v in vm.items()},
                 test={k: round(v, 5) for k, v in tm.items()})
    if hist is not None:
        entry["history"] = {k: [round(x, 4) for x in v] for k, v in hist.items()}

    prev = []
    if RESULTS.exists():
        try:
            prev = json.loads(RESULTS.read_text(encoding="utf-8"))
        except Exception:
            prev = []
    prev.append(entry)
    tmp = RESULTS.with_suffix(".tmp")
    tmp.write_text(json.dumps(prev, indent=1) + "\n", encoding="utf-8")
    os.replace(tmp, RESULTS)
    print(json.dumps(dict(entry, val_ndcg10=vm["ndcg@10"], val_recall10=vm["recall@10"],
                          test_ndcg10=tm["ndcg@10"], test_recall10=tm["recall@10"]),
                     default=float))


if __name__ == "__main__":
    main()
