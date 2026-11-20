"""gen_data.py — Extrae del pipeline de DRLC los datos que consume el sitio React.

Corrida con la MISMA semilla y configuracion que `pipeline.py` (seed=42, dim=64,
batch=2048, tau=0.05, logq=1, epochs=5, max_users=15000), asi que los numeros del
sitio son los mismos de `artifacts/results.json`, no una reimplementacion.

Salidas (web/public/data/):
  summary.json  config/eda/metricas/historia/arquitectura/representaciones
  books.json    metadatos por indice de libro (incluye isbn13 para portadas)
  genres.json   conteo de generos (proxy desde tags)
  pca_<model>_<stage>.json  puntos PCA del scatter inicial vs final
  neighbors.json  10 vecinos mas cercanos por libro (top 500 por ratings)
  demo.json     usuarios de ejemplo con train/test/refs por modelo (ampliada)
  popular.json  top libros por numero de valoraciones (carrusel)

Uso:
  python tools/gen_data.py                       # regenera todo (requiere data/ y TensorFlow)
  python tools/gen_data.py --skip-train          # sin reentrenar: reusa artifacts existentes
  python tools/gen_data.py --demo-users 30
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import types
from pathlib import Path

import numpy as np
import pandas as pd
import scipy.sparse as sp
from sklearn.preprocessing import normalize

ROOT = Path(__file__).resolve().parents[1]  # web/


def _find_run() -> Path:
    """Repo del pipeline: override por env/flag o buscado en los niveles de arriba."""
    cand = [os.environ.get("DRLC_RUN")]
    base = ROOT
    for up in (2, 1, 3, 4):
        try:
            cand.append(str(base.parents[up - 1] / "goodbooks-recommender"))
        except IndexError:
            pass
    for c in cand:
        if c and (Path(c) / "artifacts" / "results.json").exists():
            return Path(c)
    return Path(cand[1] if cand[1] else ".")


RUN = _find_run()
ART = RUN / "artifacts"
KS = (5, 10, 20)
MODEL_ORDER = ["popularidad", "item_knn", "contenido", "dos_torres_id", "dos_torres_meta"]
TOWERS = ("dos_torres_id", "dos_torres_meta")


def log(msg: str) -> None:
    print(f"[gen_data] {msg}", flush=True)


def paths_or_die(a) -> None:
    for p in (a.results, a.items, a.embeddings, a.demo):
        if not p.exists():
            sys.exit(f"Falta {p}. Corre primero `python pipeline.py` en {RUN} o usa --retrain.")


def load_artifacts(a):
    res = json.load(open(a.results, encoding="utf-8"))
    items = pd.read_csv(a.items)
    z = np.load(a.embeddings)
    embs = {k: z[k].astype(np.float32) for k in z.files}
    demo = json.load(open(a.demo, encoding="utf-8"))
    return res, items, embs, demo


# ---------------------------------------------------------------- portadas
def isbn13_str(v) -> str | None:
    """isbn13 viene como float en el CSV -> 9780439023480.0 -> '9780439023480'."""
    if pd.isna(v):
        return None
    s = format(int(round(float(v))), "013d")
    return s


# ---------------------------------------------------------------- demo ampliada
def build_extended_demo(a, cfg):
    """Reentrena con la semilla original y produce demo para N usuarios.

    Reutiliza pipeline.prepare/train_two_tower tal cual: misma data, mismos
    hiperparametros, misma semilla -> mismas metricas que results.json.
    """
    sys.path.insert(0, str(RUN))
    import pipeline  # noqa: E402
    import tensorflow as tf  # noqa: E402

    args = types.SimpleNamespace(**{k: v for k, v in cfg.items()})
    args.data = str(RUN / "data")
    eda, books, T, train, val, test, pos = pipeline.prepare(args)
    n_users, n_items = train.shape
    rng = np.random.default_rng(args.seed)
    cand = np.where(np.asarray(test.sum(1)).ravel() > 0)[0]
    eval_users = np.sort(rng.choice(cand, min(args.eval_users, len(cand)), replace=False))

    popc = np.asarray(train.sum(0)).ravel().astype(np.float32)
    Xn = normalize(train.tocsc(), axis=0)
    S = (Xn.T @ Xn).toarray().astype(np.float32)
    np.fill_diagonal(S, 0)
    Td = T.toarray()
    scorers = {
        "popularidad": lambda u: np.tile(popc, (len(u), 1)),
        "item_knn": lambda u: train[u].toarray() @ S,
        "contenido": lambda u: normalize(np.asarray((train[u] @ T).todense())) @ Td.T,
    }

    tr = pos[pos.split == "train"]
    va = pos[pos.split == "val"]
    pairs = (tr.u.values.astype("int32"), tr.i.values.astype("int32"))
    vpairs = (va.u.values.astype("int32"), va.i.values.astype("int32"))

    embs = {}
    hist = {}
    for name, feats in (("dos_torres_id", None), ("dos_torres_meta", Td)):
        log(f"entrenando {name} ...")
        U, U0, E0, E1, h = pipeline.train_two_tower(name, n_users, n_items, pairs, vpairs, args, feats)
        embs[name] = (U, E0, E1)
        hist[name] = h
        scorers[name] = (lambda U_, E_: (lambda u: U_[u] @ E_.T))(U, E1)

    # Control de integridad: las metricas reentrenadas deben casar con results.json
    metrics = {m: pipeline.evaluate(f, train, val, test, eval_users) for m, f in scorers.items()}
    ref = json.load(open(a.results, encoding="utf-8"))["metrics"]
    worst = max(
        abs(metrics[m]["ndcg@10"] - ref[m]["ndcg@10"]) for m in MODEL_ORDER
    )
    log(f"NDCG@10 reentrenado vs artifacts: max diff = {worst:.6f}")
    if worst > 5e-3:
        sys.exit("La corrida no reproduce results.json; aborta para no publicar numeros distintos.")

    order_by_idx = books.sort_values("book_id").reset_index(drop=True)
    title = order_by_idx.title.to_numpy(dtype=object)

    picks = rng.choice(eval_users, min(a.demo_users, len(eval_users)), replace=False)
    demo = []
    for u in picks:
        seen = (train[[u]] + val[[u]]).toarray().ravel() > 0
        liked = np.where(train[u].toarray().ravel() > 0)[0]
        row = {
            "u": int(u),
            "liked": [int(i) for i in liked[:8]],
            "held_out": [int(i) for i in test[u].indices[:12]],
            "recs": {},
        }
        hid = set(row["held_out"])
        for m in MODEL_ORDER:
            s = scorers[m](np.array([u])).astype(np.float32)[0]
            s[seen] = -np.inf
            top = [int(i) for i in np.argsort(-s)[: a.demo_k]]
            row["recs"][m] = top
        row["n_test"] = int(test[u].sum())
        demo.append(row)
    log(f"demo: {len(demo)} usuarios x {a.demo_k} recomendaciones")

    # PCA + vecinos con los embeddings recien entrenados (igual que pipeline.main)
    from sklearn.decomposition import PCA
    items_pca = order_by_idx[["book_id", "title", "authors", "genre", "ratings_count", "average_rating"]].copy()
    npz = {}
    for name in TOWERS:
        _, E0, E1 = embs[name]
        for tag, E in (("init", E0), ("final", E1)):
            xy = PCA(2, random_state=0).fit_transform(E)
            items_pca[f"{name}_{tag}_x"], items_pca[f"{name}_{tag}_y"] = xy[:, 0], xy[:, 1]
            npz[f"{name}_{tag}"] = E.astype(np.float16)
    return demo, dict(metrics=metrics, repr_hist=hist), npz, items_pca


# ---------------------------------------------------------------- secciones
def _rounded(obj):
    """Copia `obj` redondeando floats a 6 decimales; preserva ints/bool/str/None."""
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, float):
        return round(obj, 6)
    if isinstance(obj, dict):
        return {k: _rounded(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_rounded(v) for v in obj]
    return obj


def write_summary(a, res, out_dir: Path) -> None:
    eda, cfg = res["eda"], res["config"]
    met, rep, hist, arch = res["metrics"], res["repr"], res["history"], res.get("arch", {})
    ks_present = sorted({int(k.split("@")[1]) for m in met for k in met[m]})
    # repr: SOLO los estadisticos escalares (silhouette/purity) para retro-compatibilidad.
    # bridge / user_repr / user_knn son dicts/listas anidados y se hornean aparte.
    repr_scalar = {m: {k: round(float(v), 6) for k, v in rep[m].items()
                       if isinstance(v, (int, float)) and not isinstance(v, bool)} for m in rep}
    bridge = {m: {"init": _rounded(rep[m].get("bridge_init")),
                  "final": _rounded(rep[m].get("bridge_final"))} for m in rep}
    user_repr = {m: {"init": _rounded(rep[m].get("user_repr", {}).get("init")),
                     "final": _rounded(rep[m].get("user_repr", {}).get("final")),
                     "knn": _rounded(rep[m].get("user_knn"))} for m in rep}
    seed_runs = _rounded(res.get("seed_runs", []))
    summary = {
        "run": {
            "minutes": res.get("minutes"),
            "n_eval_users": res.get("n_eval_users"),
            "model_order": [m for m in MODEL_ORDER if m in met],
            "model_names": res["model_names"],
            "ks": ks_present,
            "generated_from": "goodbooks-recommender/artifacts (seed 42)",
        },
        "config": {k: cfg.get(k) for k in ["thr", "min_pos", "max_users", "eval_users", "dim", "epochs", "batch", "tau", "logq", "seed", "seeds", "tf_version"]},
        "eda": eda,
        "metrics": {m: {k: round(float(v), 6) for k, v in met[m].items()} for m in met},
        "repr": repr_scalar,
        "history": {m: {"loss": [round(float(x), 6) for x in hist[m]["loss"]],
                        "val_loss": [round(float(x), 6) for x in hist[m]["val_loss"]]} for m in hist},
        "arch": arch,
        # --- rubric-alignment T1 (S1/S2/S4/S5): campos nuevos, aditivos ---
        "bridge": bridge,
        "user_repr": user_repr,
        "seed_runs": seed_runs,
        "tf_version": cfg.get("tf_version"),
    }
    (out_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False), encoding="utf-8")
    log(f"summary.json {len(json.dumps(summary)) / 1024:.0f} KiB")


def write_books(a, res, out_dir: Path) -> None:
    """books.json: arreglo indexado por indice interno de libro (orden de book_id)."""
    b = pd.read_csv(RUN / "data" / "books.csv")
    if a.items.exists():
        items = pd.read_csv(a.items)
        order = items.book_id.tolist()
        b = b.set_index("book_id").loc[order].reset_index()
    else:
        b = b.sort_values("book_id").reset_index(drop=True)

    gr = {}
    if (RUN / "data" / "book_tags.csv").exists():
        pass  # genero ya viene de items.csv / results por tags; no se recalcula aqui

    books = []
    for _, r in b.iterrows():
        books.append({
            "t": str(r.title),
            "a": str(r.authors),
            "g": str(r.genre) if "genre" in b.columns and pd.notna(r.get("genre")) else "otro",
            "rc": int(r.ratings_count),
            "ar": round(float(r.average_rating), 2),
            "y": None if pd.isna(r.original_publication_year) else int(r.original_publication_year),
            "is": isbn13_str(r.isbn13),
            "gr": int(r.goodreads_book_id),
        })
    (out_dir / "books.json").write_text(json.dumps(books, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    log(f"books.json {len(books)} libros, {len(json.dumps(books)) / 1024:.0f} KiB")


def write_genres(a, res, out_dir: Path) -> None:
    gc = res["eda"]["genre_counts"]
    order = [k for k, _ in sorted(gc.items(), key=lambda kv: -kv[1])]
    (out_dir / "genres.json").write_text(
        json.dumps({"order": order, "counts": {k: int(gc[k]) for k in order}}, ensure_ascii=False),
        encoding="utf-8")
    log(f"genres.json {len(order)} generos")


def write_pca(a, items, out_dir: Path, n_per_genre=2500, seed=0) -> None:
    """Misma muestra que la app Streamlit: top-14 generos, sample(min(2500, n))."""
    topg = items[items.genre != "otro"].genre.value_counts().index[:14]
    pool = items[items.genre.isin(topg)]
    samp = pool.sample(min(n_per_genre, len(pool)), random_state=seed)
    for m in TOWERS:
        for tag in ("init", "final"):
            pts = [
                {"i": int(idx), "x": round(float(r[f"{m}_{tag}_x"]), 4), "y": round(float(r[f"{m}_{tag}_y"]), 4), "g": r.genre}
                for idx, r in samp.iterrows()
            ]
            name = f"pca_{m}_{tag}.json"
            (out_dir / name).write_text(json.dumps(pts, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            log(f"{name} {len(pts)} puntos")


def write_neighbors(a, items, embs, out_dir: Path, pool_size=500, k=10) -> None:
    pool = items.sort_values("ratings_count", ascending=False).head(pool_size)
    idxs = pool.index.tolist()
    labels = items.genre.to_numpy(dtype=object)
    out = {"pool": [int(i) for i in idxs], "k": k, "nn": {}}
    for m in TOWERS:
        for tag in ("init", "final"):
            E = embs[f"{m}_{tag}"]
            E = E / (np.linalg.norm(E, axis=1, keepdims=True) + 1e-9)
            Ep = E[idxs]
            sim = Ep @ E.T
            np.fill_diagonal(sim, -np.inf)
            nn = np.argsort(-sim, axis=1)[:, :k]
            out["nn"][f"{m}_{tag}"] = {str(int(i)): [int(j) for j in row] for i, row in zip(idxs, nn)}
            purity = float(np.mean([
                (labels[row] == labels[i]).mean() for i, row in zip(idxs, nn) if labels[i] != "otro"
            ]))
            log(f"neighbors {m}_{tag}: pureza local en el pool = {purity:.3f}")
    (out_dir / "neighbors.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    log(f"neighbors.json {len(out['pool'])} libros fuente")


def write_demo(a, demo, out_dir: Path) -> None:
    (out_dir / "demo.json").write_text(json.dumps(demo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    log(f"demo.json {len(demo)} usuarios")


def write_popular(a, res, out_dir: Path, n=60) -> None:
    items = pd.read_csv(a.items)
    top = items.sort_values("ratings_count", ascending=False).head(n)
    payload = [{"i": int(i), "rc": int(r.ratings_count), "ar": round(float(r.average_rating), 2)} for i, r in top.iterrows()]
    (out_dir / "popular.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    log(f"popular.json {len(payload)} libros")


def main() -> None:
    global RUN, ART
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=str(ROOT / "public" / "data"))
    p.add_argument("--results", default=None)
    p.add_argument("--items", default=None)
    p.add_argument("--embeddings", default=None)
    p.add_argument("--demo", default=None)
    p.add_argument("--demo-users", type=int, default=30)
    p.add_argument("--demo-k", type=int, default=12)
    p.add_argument("--retrain", action="store_true", help="reentrena para ampliar la demo (necesita TensorFlow y data/)")
    p.add_argument("--skip-pca", action="store_true")
    p.add_argument("--run", default=None, help="ruta del repo goodbooks-recommender (por defecto se autodetecta)")
    a = p.parse_args()

    if a.run:
        RUN = Path(a.run)
        ART = RUN / "artifacts"
    log(f"pipeline repo: {RUN}")

    for k, dflt in (("results", ART / "results.json"), ("items", ART / "items.csv"),
                    ("embeddings", ART / "embeddings.npz"), ("demo", ART / "demo.json")):
        setattr(a, k, Path(getattr(a, k) or dflt))
    out_dir = Path(a.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    res, items, embs, demo = None, None, None, None
    if a.retrain:
        cfg = json.load(open(a.results, encoding="utf-8"))["config"] if a.results.exists() else None
        if cfg is None:
            sys.exit("Necesito artifacts/results.json para copiar la configuracion.")
        demo, extra, npz, items_pca = build_extended_demo(a, cfg)
        res = json.load(open(a.results, encoding="utf-8"))
        res["metrics"] = extra["metrics"]
        res["history"] = extra["repr_hist"]
        items = items_pca
        embs = {k: v.astype(np.float32) for k, v in npz.items()}
        # no pisa results.json original: lo que se hornea es solo para el sitio
    else:
        paths_or_die(a)
        res, items, embs, demo = load_artifacts(a)

    write_summary(a, res, out_dir)
    write_books(a, res, out_dir)
    write_genres(a, res, out_dir)
    write_popular(a, res, out_dir)
    if not a.skip_pca:
        write_pca(a, items, out_dir)
        write_neighbors(a, items, embs, out_dir)
    write_demo(a, demo, out_dir)
    log("listo -> " + str(out_dir))


if __name__ == "__main__":
    main()
