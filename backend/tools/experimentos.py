"""
experimentos.py - Arnes de tuning standalone (T5, specs S9/S10).

Importa funciones de pipeline.py (prepare, evaluate, KS) sin modificarlo:
pipeline.py, app.py, tests/ y artifacts/ quedan intactos. Cada invocacion
corre UNA corrida: un two-tower con knobs o un item-kNN numpy/scipy.
Seleccion de hiperparametros SIEMPRE por val NDCG@10 (positivos = val,
se enmascara solo train); el test NDCG@10 se reporta solo como referencia
post-decision (S9: nunca elegir sobre test). Semilla fija 42.

Uso:
    python tools/experimentos.py --exp base
    python tools/experimentos.py --exp es_tau10_drop_neg [--tower id|meta]
    python tools/experimentos.py --exp knn_topk500_shrink10

Imprime una linea JSON compacta y la agrega a tools/experimentos_results.json.
Los scratch (cache de prepare y similitudes) van al temp del sistema, no al repo.
"""
import argparse, hashlib, json, os, pickle, sys, tempfile, time
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

import numpy as np
import scipy.sparse as sp
from sklearn.preprocessing import normalize

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
import pipeline as pl  # noqa: E402

HERE = Path(__file__).resolve().parent
RESULTS = HERE / "experimentos_results.json"
CACHE_DIR = Path(tempfile.gettempdir()) / "goodbooks_experimentos_cache"
SEED = 42

EXPERIMENTS = {
    # two-tower (τ por defecto del pipeline = 0.05; ES: patience 2, max 10 epocas,
    # se conservan los pesos del mejor val NDCG@10)
    "base":                dict(kind="tt", tau=0.05, epochs=5),
    "es":                  dict(kind="tt", tau=0.05, early_stop=True),
    "es_tau10":            dict(kind="tt", tau=0.10, early_stop=True),
    "es_tau10_drop":       dict(kind="tt", tau=0.10, early_stop=True, dropout=0.2),
    "es_tau10_drop_neg":   dict(kind="tt", tau=0.10, early_stop=True, dropout=0.2, extra_negs=2048),
    "es_tau10_drop_neg_wd":dict(kind="tt", tau=0.10, early_stop=True, dropout=0.2, extra_negs=2048, weight_decay=1e-5),
    "es_tau15_drop_neg":   dict(kind="tt", tau=0.15, early_stop=True, dropout=0.2, extra_negs=2048),
    # item-kNN (numpy/scipy puros, sobre las similitudes coseno del baseline)
    "knn_base":              dict(kind="knn"),
    "knn_topk100":           dict(kind="knn", topk=100),
    "knn_topk500":           dict(kind="knn", topk=500),
    "knn_shrink10":          dict(kind="knn", shrink=10.0),
    "knn_shrink50":          dict(kind="knn", shrink=50.0),
    "knn_topk500_shrink10":  dict(kind="knn", topk=500, shrink=10.0),
}


def base_args():
    # Defaults identicos a pipeline.main() para seed 42 (canonica).
    return argparse.Namespace(
        data=str(ROOT / "data"), out="artifacts", thr=4, min_pos=5,
        max_users=15000, eval_users=3000, dim=64, epochs=5, batch=2048,
        tau=0.05, logq=1, seed=SEED)


def _hash(*parts):
    return hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()[:16]


def load_data(a):
    """prepare() de pipeline con cache en temp del sistema (mismo resultado,
    keyed por los args que lo determinan)."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    f = CACHE_DIR / f"prep_{_hash(a.data, a.thr, a.min_pos, a.max_users, a.seed)}.pkl"
    if f.exists():
        with open(f, "rb") as fh:
            return pickle.load(fh)
    eda, books, T, train, val, test, pos = pl.prepare(a)
    n_users, n_items = train.shape
    rng = np.random.default_rng(a.seed)  # mismo draw que run_pipeline para eval_users
    cand = np.where(np.asarray(test.sum(1)).ravel() > 0)[0]
    eval_users = np.sort(rng.choice(cand, min(a.eval_users, len(cand)), replace=False))
    tr = pos[pos.split == "train"]; va = pos[pos.split == "val"]
    D = dict(
        n_users=n_users, n_items=n_items, train=train, val=val, test=test,
        eval_users=eval_users,
        pairs=(tr.u.values.astype("int32"), tr.i.values.astype("int32")),
        vpairs=(va.u.values.astype("int32"), va.i.values.astype("int32")),
        Td=T.toarray().astype(np.float32),
    )
    with open(f, "wb") as fh:
        pickle.dump(D, fh, protocol=4)
    return D


# ------------------------------------------------------------------ TWO-TOWER
def train_tt(D, a, name, tau=0.05, epochs=5, dropout=0.0, extra_negs=0,
             weight_decay=0.0, early_stop=False, patience=2, max_epochs=10,
             tower="id"):
    """Copia de pipeline.train_two_tower con knobs (S10). Con dropout=0,
    extra_negs=0, weight_decay=None y early_stop=False reproduce el grafo y
    el orden de datos canonicos (comparaciones apples-to-apples)."""
    import tensorflow as tf
    tf.keras.utils.set_random_seed(a.seed)
    L = tf.keras.layers
    l2 = lambda x: tf.math.l2_normalize(x, axis=-1)
    n_users, n_items = D["n_users"], D["n_items"]
    pairs, vpairs = D["pairs"], D["vpairs"]

    # Correccion logQ sobre los negativos in-batch (igual al pipeline).
    logq = None
    if a.logq:
        c = np.bincount(pairs[1], minlength=n_items).astype(np.float32) + 1.0
        logq = tf.constant(np.log(c / c.sum()).astype(np.float32))

    def mlp(x, tag):
        x = L.Dense(a.dim * 2, activation="relu", name=f"{tag}_h")(x)
        if dropout:
            x = L.Dropout(dropout, name=f"{tag}_dh")(x)
        x = L.Dense(a.dim, name=f"{tag}_o")(x)
        if dropout:
            x = L.Dropout(dropout, name=f"{tag}_do")(x)
        return L.Lambda(l2)(x)

    u_in = tf.keras.Input(shape=(), dtype="int32")
    user_model = tf.keras.Model(u_in, mlp(L.Embedding(n_users, a.dim)(u_in), "u"))

    i_in = tf.keras.Input(shape=(), dtype="int32")
    x = L.Embedding(n_items, a.dim)(i_in)
    if tower == "meta":  # ID + tags fijos proyectados (identico al pipeline)
        F = tf.keras.initializers.Constant(D["Td"])
        fx = L.Embedding(n_items, D["Td"].shape[1], embeddings_initializer=F, trainable=False)(i_in)
        x = L.Concatenate()([x, L.Dense(a.dim, activation="relu")(fx)])
    item_model = tf.keras.Model(i_in, mlp(x, "i"))

    opt = tf.keras.optimizers.Adam(1e-3, weight_decay=(weight_decay or None))
    tv = user_model.trainable_variables + item_model.trainable_variables

    def loss_fn(u, i, neg, training):
        ue = user_model(u, training=training)
        logits = tf.matmul(ue, item_model(i, training=training),
                           transpose_b=True) / tau  # negativos in-batch
        if logq is not None:
            logits = logits - tf.gather(logq, i)[None, :]
        if neg is not None:
            # +E negativos uniformes globales por batch: Q es constante sobre
            # ellos => sin correccion logQ; el bloque in-batch conserva la suya.
            ne = item_model(neg, training=training)
            logits = tf.concat([logits, tf.matmul(ue, ne, transpose_b=True) / tau], axis=1)
        return tf.reduce_mean(tf.nn.sparse_softmax_cross_entropy_with_logits(
            labels=tf.range(tf.shape(u)[0]), logits=logits))

    @tf.function
    def step(u, i):
        with tf.GradientTape() as tape:
            loss = loss_fn(u, i, None, True)
        opt.apply_gradients(zip(tape.gradient(loss, tv), tv))
        return loss

    @tf.function
    def step_neg(u, i, neg):
        with tf.GradientTape() as tape:
            loss = loss_fn(u, i, neg, True)
        opt.apply_gradients(zip(tape.gradient(loss, tv), tv))
        return loss

    @tf.function
    def eval_loss(u, i):
        return loss_fn(u, i, None, False)

    ds_base = (tf.data.Dataset.from_tensor_slices((pairs[0], pairs[1]))
               .shuffle(500_000, seed=a.seed).batch(a.batch, drop_remainder=True).prefetch(2))
    vds = tf.data.Dataset.from_tensor_slices((vpairs[0], vpairs[1])).batch(a.batch, drop_remainder=True).take(30)
    n_batches = pairs[0].size // a.batch
    rng = np.random.default_rng(a.seed)

    all_u = np.arange(n_users, dtype="int32")
    all_i = np.arange(n_items, dtype="int32")
    zero = sp.csr_matrix((n_users, n_items), dtype=np.float32)

    def val_ndcg10():
        U = user_model.predict(all_u, batch_size=4096, verbose=0)
        E = item_model.predict(all_i, batch_size=4096, verbose=0)
        m = pl.evaluate(lambda ub: U[ub] @ E.T, D["train"], zero, D["val"], D["eval_users"])
        return m["ndcg@10"]

    hist = {"loss": [], "val_loss": [], "val_ndcg@10": []}
    total = max_epochs if early_stop else epochs
    best = (-np.inf, None, 0)
    wait = 0
    for ep in range(total):
        if extra_negs:
            negs = rng.integers(0, n_items, size=(n_batches, extra_negs)).astype("int32")
            nds = tf.data.Dataset.from_tensor_slices(negs)  # 1 fila de E ids por step
            tr = [float(step_neg(b[0][0], b[0][1], b[1])) for b in zip(ds_base, nds)]
        else:
            tr = [float(step(u, i)) for u, i in ds_base]
        va = [float(eval_loss(u, i)) for u, i in vds]
        hist["loss"].append(float(np.mean(tr))); hist["val_loss"].append(float(np.mean(va)))
        line = f"[{name}] epoca {ep + 1}/{total} loss={hist['loss'][-1]:.3f} val={hist['val_loss'][-1]:.3f}"
        if early_stop:
            nd = val_ndcg10()
            hist["val_ndcg@10"].append(nd)
            line += f" val_ndcg@10={nd:.4f}"
            if nd > best[0]:
                best = (nd, (user_model.get_weights(), item_model.get_weights()), ep + 1)
                wait = 0
            else:
                wait += 1
        print(line)
        if early_stop and wait >= patience:
            print(f"[{name}] early stop en epoca {ep + 1} (mejor epoca {best[2]}, val_ndcg@10={best[0]:.4f})")
            break
    if early_stop and best[1] is not None:
        user_model.set_weights(best[1][0]); item_model.set_weights(best[1][1])

    U = user_model.predict(all_u, batch_size=4096, verbose=0)
    E = item_model.predict(all_i, batch_size=4096, verbose=0)
    return U, E, hist, best[2]


# ------------------------------------------------------------------- ITEM-KNN
def build_S(D, train, shrink=0.0, topk=0):
    """Similitudes coseno del baseline item_knn (Xn.T @ Xn, diagonal 0) con
    knobs de regularizacion CF: shrinkage sim/(sim+lambda) y top-k vecinos."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    f = CACHE_DIR / f"S_{_hash(D['n_users'], D['n_items'], train.nnz)}.f32"
    n = train.shape[1]
    if f.exists():
        S = np.fromfile(f, dtype=np.float32).reshape(n, n)
    else:
        Xn = normalize(train.tocsc(), axis=0)
        S = (Xn.T @ Xn).toarray().astype(np.float32)
        np.fill_diagonal(S, 0)
        S.tofile(f)
    if shrink > 0:
        S = S / (S + np.float32(shrink))  # ceros quedan ceros
    if topk:
        Sk = np.zeros_like(S)
        part = np.argpartition(-S, topk, axis=1)[:, :topk]
        np.put_along_axis(Sk, part, np.take_along_axis(S, part, 1), axis=1)
        S = Sk
    return S


# ---------------------------------------------------------------------- MAIN
def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    p.add_argument("--exp", required=True, choices=sorted(EXPERIMENTS))
    p.add_argument("--tower", default="id", choices=["id", "meta"],
                   help="variante two-tower (se aplica solo a --exp kind=tt)")
    args = p.parse_args()
    cfg = EXPERIMENTS[args.exp]
    a = base_args()
    t0 = time.time()
    D = load_data(a)
    zero = sp.csr_matrix((D["n_users"], D["n_items"]), dtype=np.float32)
    params, hist, best_epoch, epochs_run = {}, None, 0, 0

    if cfg["kind"] == "tt":
        params = dict(tau=cfg.get("tau", a.tau), epochs=cfg.get("epochs", a.epochs),
                      dropout=cfg.get("dropout", 0.0), extra_negs=cfg.get("extra_negs", 0),
                      weight_decay=cfg.get("weight_decay", 0.0),
                      early_stop=cfg.get("early_stop", False), patience=2,
                      dim=a.dim, batch=a.batch, logq=a.logq, tower=args.tower)
        U, E, hist, best_epoch = train_tt(
            D, a, args.exp, tau=params["tau"], epochs=params["epochs"],
            dropout=params["dropout"], extra_negs=params["extra_negs"],
            weight_decay=params["weight_decay"], early_stop=params["early_stop"],
            max_epochs=10, tower=args.tower)
        epochs_run = len(hist["loss"])
        score_fn = lambda ub: U[ub] @ E.T
    else:
        params = dict(topk=cfg.get("topk", 0), shrink=cfg.get("shrink", 0.0),
                      tower="item_knn")
        S = build_S(D, D["train"], shrink=params["shrink"], topk=params["topk"])
        train = D["train"]
        score_fn = lambda ub: train[ub].toarray() @ S

    # Decision: val NDCG@10 (positivos = val, se enmascara solo train).
    vm = pl.evaluate(score_fn, D["train"], zero, D["val"], D["eval_users"])
    # Referencia post-decision (canonica: se enmascara train+val, positivos = test).
    tm = pl.evaluate(score_fn, D["train"], D["val"], D["test"], D["eval_users"])

    entry = dict(exp=args.exp, kind=cfg["kind"], seed=SEED, params=params,
                 utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                 minutes=round((time.time() - t0) / 60, 2),
                 epochs_run=epochs_run, best_epoch=best_epoch,
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
                          test_ndcg10=tm["ndcg@10"]), default=float))


if __name__ == "__main__":
    main()
