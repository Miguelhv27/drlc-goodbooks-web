"""
pipeline.py - Entregable 2 (DRLC) - Goodbooks-10k
Prepara datos, entrena baselines + dos torres (solo ID / ID + tags),
evalua y guarda todo en ./artifacts para que lo lea app.py.

Uso:
    python pipeline.py --data data --epochs 10 --patience 2 --max_users 15000
    (--max_users 0 usa todos los usuarios)
    --epochs es el MAXIMO de epocas de las dos torres: con --patience >= 1
    (default 2) corre early stopping sobre NDCG@10 de validacion y restaura
    los pesos de la mejor epoca (evidencia T5: tools/experimentos.py).
    --patience 0 desactiva el early stopping y entrena exactamente
    --epochs epocas.
"""
import argparse, json, re, time
from pathlib import Path
import numpy as np, pandas as pd, scipy.sparse as sp
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import normalize

GENRES = ["fantasy", "science-fiction", "romance", "mystery", "young-adult",
          "historical-fiction", "horror", "non-fiction", "classics", "thriller",
          "childrens", "biography", "graphic-novels", "poetry"]
NOISE = re.compile(r"read|own|shelf|library|favou?rite|wish|buy|kindle|e-?book|audio|default|"
                   r"book-?club|^\d|my-books|borrowed|abandoned|dnf|series|bought")
KS = (5, 10, 20)
MODELS = {"popularidad": "Popularidad", "item_knn": "Similitud entre libros",
          "contenido": "Basado en contenido (tags)", "dos_torres_id": "Dos torres (solo ID)",
          "dos_torres_meta": "Dos torres (ID + tags)"}


# ------------------------------------------------------------------ DATOS

def prepare(a):
    d = Path(a.data)

    # ---- Cargar datos y preservar el orden original de las valoraciones
    ratings = pd.read_csv(d / "ratings.csv")
    ratings["_order"] = np.arange(len(ratings))
    ratings = ratings.drop_duplicates(["user_id", "book_id"])

    books = pd.read_csv(d / "books.csv").sort_values("book_id").reset_index(drop=True)
    bt, tags = pd.read_csv(d / "book_tags.csv"), pd.read_csv(d / "tags.csv")

    n_items = len(books)
    item_of = {b: i for i, b in enumerate(books.book_id)}

    # ---- EDA sobre el dataset 
    per_user = ratings.groupby("user_id").size()
    per_book = ratings.groupby("book_id").size()
    bc = np.sort(per_book.values)[::-1]

    eda = {
        "n_users": int(ratings.user_id.nunique()),
        "n_books": int(n_items),
        "n_ratings": int(len(ratings)),
        "sparsity": float(
            1 - len(ratings) / (ratings.user_id.nunique() * n_items)
        ),
        "rating_dist": ratings.rating.value_counts().sort_index().to_dict(),
        "user_hist": np.histogram(
            per_user.clip(upper=200), bins=40, range=(0, 200)
        )[0].tolist(),
        "user_median": float(per_user.median()),
        "user_p90": float(per_user.quantile(.9)),
        "book_median": float(per_book.median()),
        "book_max": int(per_book.max()),
        "longtail_curve": (
            np.cumsum(bc) / bc.sum()
        )[np.linspace(0, len(bc) - 1, 100).astype(int)].tolist(),
        "top10pct_share": float(bc[: len(bc) // 10].sum() / bc.sum()),
    }

    # ---- Género aproximado a partir de tags y features de contenido
    # Se excluyen tags de género de las features para evitar esa fuga.
    tg = bt.merge(tags, on="tag_id")

    best = (
        tg[tg.tag_name.isin(GENRES)]
        .sort_values("count", ascending=False)
        .drop_duplicates("goodreads_book_id")
        .set_index("goodreads_book_id")["tag_name"]
    )

    books["genre"] = books.goodreads_book_id.map(best).fillna("otro")

    feat = tg[
        ~tg.tag_name.str.contains(NOISE, na=False)
        & ~tg.tag_name.isin(GENRES)
    ]

    top = feat.groupby("tag_name")["count"].sum().nlargest(500).index
    feat = feat[feat.tag_name.isin(top)]

    gid = {
        g: i for i, g in enumerate(books.goodreads_book_id)
    }
    col = {t: j for j, t in enumerate(top)}

    f = feat[feat.goodreads_book_id.isin(gid)]

    M = sp.csr_matrix(
        (
            np.log1p(f["count"].values),
            (
                f.goodreads_book_id.map(gid).values,
                f.tag_name.map(col).values,
            ),
        ),
        shape=(n_items, len(top)),
    )

    idf = np.log(
        n_items / (1 + np.asarray((M > 0).sum(0)).ravel())
    )
    T = normalize(M.multiply(idf).tocsr()).astype(np.float32)

    # ---- Filtrar interacciones positivas y seleccionar usuarios
    pos = ratings[ratings.rating >= a.thr].copy()

    cnt = pos.groupby("user_id").size()
    users = cnt[cnt >= a.min_pos].index.values

    rng = np.random.default_rng(a.seed)

    if a.max_users and len(users) > a.max_users:
        users = rng.choice(users, a.max_users, replace=False)

    pos = pos[pos.user_id.isin(users)].copy()

    # Mapear usuarios e ítems a índices consecutivos
    user_to_idx = {
        u: i for i, u in enumerate(np.sort(users))
    }

    pos["u"] = pos.user_id.map(user_to_idx)
    pos["i"] = pos.book_id.map(item_of)

    # ---- Split cronológico por usuario
    # El orden de las filas de ratings.csv se usa como proxy temporal.
    # Las interacciones anteriores van a train; las más recientes,
    # a validación y prueba.
    pos = pos.sort_values("_order").reset_index(drop=True)

    # Versión vectorizada: posición y tamaño del historial de cada usuario.
    group = pos.groupby("user_id", sort=False)
    position = group.cumcount()
    n = group["user_id"].transform("size")

    n_test = np.ceil(0.20 * n).astype(int).clip(lower=1)
    n_val = np.ceil(0.10 * n).astype(int).clip(lower=1)

    # Garantizar al menos una interacción de entrenamiento
    small = (n_test + n_val) >= n
    n_test = n_test.mask(small, 1)
    n_val = n_val.mask(small, 1)

    n_train = n - n_val - n_test

    pos["split"] = np.select(
        [position >= n_train + n_val, position >= n_train],
        ["test", "val"],
        default="train",
    )

    n_users = len(users)

    # ---- Construir matrices dispersas de interacciones
    def make_matrix(split_name):
        subset = pos[pos.split == split_name]

        return sp.csr_matrix(
            (
                np.ones(len(subset), dtype=np.float32),
                (subset.u, subset.i),
            ),
            shape=(n_users, n_items),
        )

    train = make_matrix("train")
    val = make_matrix("val")
    test = make_matrix("test")

    eda.update({
        "n_users_used": int(n_users),
        "n_pos_used": int(len(pos)),
        "threshold": a.thr,
        "split_sizes": pos.split.value_counts().to_dict(),
        "genre_counts": books.genre.value_counts().to_dict(),
    })

    return eda, books, T, train, val, test, pos


# ------------------------------------------------------------------ METRICAS
def evaluate(score_fn, train, val, test, eval_users, bs=500):
    acc = {f"{m}@{k}": [] for m in ("recall", "ndcg", "map") for k in KS}
    disc = 1 / np.log2(np.arange(2, max(KS) + 2))
    for s in range(0, len(eval_users), bs):
        ub = eval_users[s: s + bs]
        sc = score_fn(ub).astype(np.float32)
        seen = (train[ub] + val[ub]).tocoo()
        sc[seen.row, seen.col] = -np.inf
        top = np.argpartition(-sc, max(KS), axis=1)[:, : max(KS)]
        top = np.take_along_axis(top, np.argsort(-np.take_along_axis(sc, top, 1), 1), 1)
        Tb = test[ub]
        n_t = np.asarray(Tb.sum(1)).ravel()
        h_ = Tb[np.arange(len(ub))[:, None], top]
        hits = (h_.toarray() if sp.issparse(h_) else np.asarray(h_)).astype(np.float32)
        for k in KS:
            h = hits[:, :k]
            acc[f"recall@{k}"].append(h.sum(1) / n_t)
            idcg = np.array([disc[: int(min(n, k))].sum() for n in n_t])
            acc[f"ndcg@{k}"].append((h * disc[:k]).sum(1) / idcg)
            prec = np.cumsum(h, 1) / np.arange(1, k + 1)
            acc[f"map@{k}"].append((prec * h).sum(1) / np.minimum(n_t, k))
    return {m: float(np.concatenate(v).mean()) for m, v in acc.items()}


def knn_purity(E, labels, k=10, bs=1000):
    E = normalize(E)
    idx = np.where(labels != "otro")[0]
    hit = []
    for s in range(0, len(idx), bs):
        q = idx[s: s + bs]
        sim = E[q] @ E.T
        sim[np.arange(len(q)), q] = -np.inf
        nn = np.argpartition(-sim, k, axis=1)[:, :k]
        hit.append((labels[nn] == labels[q][:, None]).mean(1))
    return float(np.concatenate(hit).mean())


def silhouette(E, labels, n=4000, seed=0):
    idx = np.where(labels != "otro")[0]
    idx = np.random.default_rng(seed).choice(idx, min(n, len(idx)), replace=False)
    return float(silhouette_score(E[idx], labels[idx], metric="cosine"))


# ------------------------------------------------------ PUENTE ITEM-TOWER (S1)
def bridge_item_metric(E, seen_sets, query_sets, ks=(5, 10, 20)):
    """Metrica 'puente' de la TORRE DE ITEMS (aisla la geometria de items del
    desempeno en la tarea principal, sin usar la torre de usuario).

    Para cada usuario de evaluacion, sus positivos de TEST actuan como queries:
    cada item test q se compara por similitud coseno contra TODOS los embeddings
    de items E y se rankea a los demas candidatos. El historial train+val del
    usuario se excluye como fuente de candidatos (misma convencion de enmascarado
    que `evaluate()`). Se mide MRR y recall@k de los OTROS positivos test del
    mismo usuario dentro de ese ranking: responde "estan los libros que este
    usuario leera despues agrupados entre si en el espacio de items?".

    Funcion PURA sobre (matriz de embeddings, lista de conjuntos de indices de
    historia, lista de conjuntos de indices de test): deterministica y testeable
    con datos sinteticos, sin TensorFlow. Mismo sample de eval_users y mismos
    positivos held-out que las metricas existentes.
    """
    En = normalize(np.asarray(E, dtype=np.float32))
    n_items = En.shape[0]
    empty = {"mrr": 0.0, **{f"recall@{k}": 0.0 for k in ks}}
    if n_items == 0:
        return empty
    rr, rec = [], {k: [] for k in ks}
    for seen, qs in zip(seen_sets, query_sets):
        qs = [int(x) for x in qs]
        if len(qs) < 2:
            continue  # sin al menos 2 positivos no hay 'otros' que recuperar
        qs_arr = np.array(qs, dtype=int)
        seen_arr = np.array([int(x) for x in seen], dtype=int) if len(seen) else np.array([], dtype=int)
        sim = En[qs_arr] @ En.T                         # (m, n_items) coseno
        if seen_arr.size:
            sim[:, seen_arr] = -np.inf                 # excluye historial train+val
        sim[np.arange(len(qs)), qs_arr] = -np.inf      # excluye el propio query
        ktop = max(1, min(max(ks), n_items - 1))
        part = np.argpartition(-sim, ktop, axis=1)[:, :ktop + 1]
        order = np.take_along_axis(part, np.argsort(-np.take_along_axis(sim, part, 1), 1), 1)
        in_test = (order[:, :, None] == qs_arr[None, None, :]).any(2)
        is_self = (order == qs_arr[:, None])
        hits = in_test & ~is_self
        denom = len(qs) - 1
        any_hit = hits.any(1)
        first = np.argmax(hits, axis=1)
        rr.append(np.where(any_hit, 1.0 / (first + 1.0), 0.0))
        for k in ks:
            rec[k].append(hits[:, :min(k, hits.shape[1])].sum(1) / denom)
    if not rr:
        return empty
    out = {"mrr": float(np.concatenate(rr).mean())}
    for k in ks:
        out[f"recall@{k}"] = float(np.concatenate(rec[k]).mean())
    return out


def bridge_inputs(train, val, test, eval_users):
    """Convierte las matrices dispersas en (conjuntos de historia, conjuntos de
    test) por usuario de evaluacion, para `bridge_item_metric`."""
    seen_sets, query_sets = [], []
    for u in eval_users:
        seen_sets.append(np.concatenate([train[u].indices, val[u].indices]).astype(int).tolist())
        query_sets.append(np.asarray(test[u].indices).astype(int).tolist())
    return seen_sets, query_sets


# ------------------------------------------------ REPRESENTACION DE USUARIO (S4)
def user_repr_stats(U, sample=500, seed=0):
    """Hechos del lado USUARIO sobre una matriz de embeddings de usuario (filas).

    n/dim: tamano. norm_* : norma L2 (las torres terminan en L2-normalize, ~1).
    cos_mean_sample: coseno promedio entre pares de usuarios de una muestra con
    semilla fija -> dicotomia init (~0, aleatorio) vs final (colapso/clustering).
    """
    U = np.asarray(U, dtype=np.float32)
    norms = np.linalg.norm(U, axis=1)
    n = U.shape[0]
    rng = np.random.default_rng(seed)
    idx = np.sort(rng.choice(n, sample, replace=False)) if n > sample else np.arange(n)
    Us = normalize(U[idx])
    sim = Us @ Us.T
    iu = np.triu_indices(len(idx), k=1)
    cos_mean = float(sim[iu].mean()) if len(idx) > 1 else 0.0
    return {"n": int(n), "dim": int(U.shape[1]), "sample": int(len(idx)),
            "norm_mean": float(norms.mean()), "norm_median": float(np.median(norms)),
            "cos_mean_sample": cos_mean}


def user_knn_examples(U, train, sample_users=3, k=5, seed=0):
    """Para `sample_users` usuarios con semilla fija, sus `k` vecinos mas cercanos
    en los embeddings de usuario FINALES, con la cantidad de libros bien valorados
    (positivos de train) de cada vecino. Ligero y deterministico."""
    Un = normalize(np.asarray(U, dtype=np.float32))
    nu = Un.shape[0]
    rng = np.random.default_rng(seed)
    pick = np.sort(rng.choice(nu, min(sample_users, nu), replace=False))
    out = []
    for u in pick:
        u = int(u)
        sim = Un @ Un[u]; sim[u] = -np.inf
        nn = np.argsort(-sim)[:k]
        out.append({"u": u,
                    "neighbors": [{"v": int(v), "pos_items": int(train[int(v)].sum())} for v in nn]})
    return out


# ------------------------------------------------------------------ DOS TORRES
def early_stop_decision(val_ndcg_history, patience):
    """Decision PURA del early stopping sobre val NDCG@10 (puerta T5/S10: fue el
    unico knob que mejoro validacion; port fidel del cierre `train_tt()` de
    tools/experimentos.py, misma semantica de mejora estricta `>`).

    Recibe la historia de NDCG@10 de validacion por epoca (positivos = val, se
    enmascara solo train) y `patience`. Devuelve `(should_stop, best_idx)`:
      - `best_idx`: indice 0-based de la MEJOR epoca. Empates resueltos al
        indice mas antiguo (`np.argmax` conserva la primera ocurrencia del max,
        igual que `nd > best` del closure original).
      - `should_stop`: True cuando ya pasaron `patience` o mas epocas sin una
        mejora estricta del pico.
      - Historial vacio -> (False, -1) (nada que decidir aun).
    Sin side effects: testeable con datos sinteticos, sin TensorFlow.
    """
    if not len(val_ndcg_history):
        return False, -1
    best_idx = int(np.argmax(np.asarray(val_ndcg_history, dtype=np.float64)))
    should_stop = bool(len(val_ndcg_history) - 1 - best_idx >= patience)
    return should_stop, best_idx


def train_two_tower(name, n_users, n_items, pairs, val_pairs, a, item_feats=None,
                    train=None, val=None, eval_users=None):
    """Entrena una torre. Con `train`/`val`/`eval_users` presentes y
    `a.patience >= 1`, corre early stopping sobre NDCG@10 de validacion en cada
    epoca (metrica exacta de tools/experimentos.py: `evaluate(score_fn, train,
    cero, val, eval_users)` enmascara solo train), detiene el loop tras
    `patience` epocas sin mejora, restaura los pesos de la mejor epoca ANTES de
    las predicciones finales, y registra en el historial `val_ndcg` (lista por
    epoca) y `best_epoch` (entero 1-based; 0 si el early stopping no corrio).
    `a.epochs` pasa a ser el MAXIMO de epocas. Sin ES (patience ausente o 0)
    conserva el comportamiento anterior: exactamente `a.epochs` epocas."""
    import tensorflow as tf
    tf.keras.utils.set_random_seed(a.seed)
    L = tf.keras.layers
    l2 = lambda x: tf.math.l2_normalize(x, axis=-1)

    # Correccion logQ: los negativos in-batch se muestrean con la frecuencia
    # de popularidad, asi que restamos log Q(j) de los logits para aproximar
    # el softmax completo (Sampled Softmax Loss, Yi et al. 2019).
    logq = None
    if a.logq:
        c = np.bincount(pairs[1], minlength=n_items).astype(np.float32) + 1.0
        logq = tf.constant(np.log(c / c.sum()).astype(np.float32))

    u_in = tf.keras.Input(shape=(), dtype="int32")
    x = L.Embedding(n_users, a.dim)(u_in)
    x = L.Dense(a.dim * 2, activation="relu")(x)
    user_model = tf.keras.Model(u_in, L.Lambda(l2)(L.Dense(a.dim)(x)))

    i_in = tf.keras.Input(shape=(), dtype="int32")
    x = L.Embedding(n_items, a.dim)(i_in)
    if item_feats is not None:  # ID + tags (tags fijos, proyectados con una capa densa)
        F = tf.keras.initializers.Constant(item_feats)
        fx = L.Embedding(n_items, item_feats.shape[1], embeddings_initializer=F, trainable=False)(i_in)
        x = L.Concatenate()([x, L.Dense(a.dim, activation="relu")(fx)])
    x = L.Dense(a.dim * 2, activation="relu")(x)
    item_model = tf.keras.Model(i_in, L.Lambda(l2)(L.Dense(a.dim)(x)))

    all_items = np.arange(n_items, dtype="int32")
    all_users = np.arange(n_users, dtype="int32")
    item_init = item_model.predict(all_items, batch_size=4096, verbose=0)  # representacion INICIAL (item)
    user_init = user_model.predict(all_users, batch_size=4096, verbose=0)  # representacion INICIAL (usuario)

    opt = tf.keras.optimizers.Adam(1e-3)
    tv = user_model.trainable_variables + item_model.trainable_variables

    def loss_fn(u, i, training):
        logits = tf.matmul(user_model(u, training=training), item_model(i, training=training),
                           transpose_b=True) / a.tau  # negativos in-batch
        if logq is not None:
            logits = logits - tf.gather(logq, i)[None, :]
        return tf.reduce_mean(tf.nn.sparse_softmax_cross_entropy_with_logits(
            labels=tf.range(tf.shape(u)[0]), logits=logits))

    @tf.function
    def step(u, i):
        with tf.GradientTape() as tape:
            loss = loss_fn(u, i, True)
        opt.apply_gradients(zip(tape.gradient(loss, tv), tv))
        return loss

    ds = (tf.data.Dataset.from_tensor_slices((pairs[0], pairs[1])).shuffle(500_000, seed=a.seed)
          .batch(a.batch, drop_remainder=True).prefetch(2))
    vds = tf.data.Dataset.from_tensor_slices((val_pairs[0], val_pairs[1])).batch(a.batch, drop_remainder=True).take(30)
    hist = {"loss": [], "val_loss": [], "val_ndcg": [], "best_epoch": 0}
    patience = int(getattr(a, "patience", 0))
    es = patience >= 1 and train is not None and val is not None and eval_users is not None
    zero = sp.csr_matrix((n_users, n_items), dtype=np.float32)  # val vacio: enmascara solo train
    best = (-np.inf, None, 0)  # (val_ndcg, (pesos_u, pesos_i), epoca 1-based)
    for ep in range(a.epochs):
        tr = [float(step(u, i)) for u, i in ds]
        va = [float(loss_fn(u, i, False)) for u, i in vds]
        hist["loss"].append(float(np.mean(tr))); hist["val_loss"].append(float(np.mean(va)))
        line = f"[{name}] epoca {ep + 1}/{a.epochs} loss={hist['loss'][-1]:.3f} val={hist['val_loss'][-1]:.3f}"
        stop = False
        if es:
            U_ep = user_model.predict(all_users, batch_size=4096, verbose=0)
            E_ep = item_model.predict(all_items, batch_size=4096, verbose=0)
            nd = evaluate(lambda ub: U_ep[ub] @ E_ep.T, train, zero, val, eval_users)["ndcg@10"]
            hist["val_ndcg"].append(float(nd))
            stop, bidx = early_stop_decision(hist["val_ndcg"], patience)
            if bidx == len(hist["val_ndcg"]) - 1:  # mejora estricta: este epoch es el nuevo mejor
                best = (nd, (user_model.get_weights(), item_model.get_weights()), bidx + 1)
            line += f" val_ndcg@10={nd:.4f}"
        print(line)
        if stop:
            print(f"[{name}] early stop en epoca {ep + 1} "
                  f"(mejor epoca {best[2]}, val_ndcg@10={best[0]:.4f})")
            break
    if es and best[1] is not None:  # restaura los pesos de la mejor epoca antes de predecir
        user_model.set_weights(best[1][0]); item_model.set_weights(best[1][1])
        hist["best_epoch"] = int(best[2])
    item_final = item_model.predict(all_items, batch_size=4096, verbose=0)
    user_final = user_model.predict(all_users, batch_size=4096, verbose=0)
    return user_final, user_init, item_init, item_final, hist


# ------------------------------------------------------------------ MAIN
def run_pipeline(a, seed):
    """Corre prepare + baselines + dos torres + evaluacion + analisis para UNA
    semilla. NO escribe a disco: devuelve todo para que main() elija la corrida
    canonica (seed 42 o la primera) y arme `seed_runs` con las demas."""
    a.seed = int(seed)
    t0 = time.time()

    print(f"[seed {seed}] 1/5 Preparando datos...")
    eda, books, T, train, val, test, pos = prepare(a)
    n_users, n_items = train.shape
    rng = np.random.default_rng(a.seed)
    cand = np.where(np.asarray(test.sum(1)).ravel() > 0)[0]
    eval_users = np.sort(rng.choice(cand, min(a.eval_users, len(cand)), replace=False))

    print(f"[seed {seed}] 2/5 Baselines...")
    popc = np.asarray(train.sum(0)).ravel().astype(np.float32)
    Xn = normalize(train.tocsc(), axis=0)
    S = (Xn.T @ Xn).toarray().astype(np.float32); np.fill_diagonal(S, 0)
    Td = T.toarray()
    scorers = {
        "popularidad": lambda u: np.tile(popc, (len(u), 1)),
        "item_knn": lambda u: train[u].toarray() @ S,
        "contenido": lambda u: normalize(np.asarray((train[u] @ T).todense())) @ Td.T,
    }

    print(f"[seed {seed}] 3/5 Dos torres...")
    tr = pos[pos.split == "train"]; va = pos[pos.split == "val"]
    pairs = (tr.u.values.astype("int32"), tr.i.values.astype("int32"))
    vpairs = (va.u.values.astype("int32"), va.i.values.astype("int32"))
    embs, hist = {}, {}
    for name, feats in (("dos_torres_id", None), ("dos_torres_meta", Td)):
        U, U0, E0, E1, h = train_two_tower(name, n_users, n_items, pairs, vpairs, a, feats,
                                           train=train, val=val, eval_users=eval_users)
        embs[name] = (U, U0, E0, E1); hist[name] = h
        scorers[name] = (lambda U_, E_: (lambda u: U_[u] @ E_.T))(U, E1)

    print(f"[seed {seed}] 4/5 Evaluando...")
    metrics = {m: evaluate(f, train, val, test, eval_users) for m, f in scorers.items()}
    for m, v in metrics.items(): print(m, {k: round(x, 4) for k, x in v.items()})

    print(f"[seed {seed}] 5/5 Analisis de representaciones...")
    labels = books.genre.to_numpy(dtype=object)
    seen_sets, query_sets = bridge_inputs(train, val, test, eval_users)
    rep, items = {}, books[["book_id", "title", "authors", "genre", "ratings_count", "average_rating"]].copy()
    npz = {}
    for name in ("dos_torres_id", "dos_torres_meta"):
        U, U0, E0, E1 = embs[name]
        # S1 bridge: retrieval item-item sobre embeddings de items (init vs final)
        # S4 user_repr: stats del lado usuario init vs final + vecinos de usuario (final)
        rep[name] = {"silhouette_init": silhouette(E0, labels), "silhouette_final": silhouette(E1, labels),
                     "purity_init": knn_purity(E0, labels), "purity_final": knn_purity(E1, labels),
                     "bridge_init": bridge_item_metric(E0, seen_sets, query_sets),
                     "bridge_final": bridge_item_metric(E1, seen_sets, query_sets),
                     "user_repr": {"init": user_repr_stats(U0), "final": user_repr_stats(U)},
                     "user_knn": user_knn_examples(U, train)}
        for tag, E in (("init", E0), ("final", E1)):
            xy = PCA(2, random_state=0).fit_transform(E)
            items[f"{name}_{tag}_x"], items[f"{name}_{tag}_y"] = xy[:, 0], xy[:, 1]
            npz[f"{name}_{tag}"] = E.astype(np.float16)
        npz[f"{name}_user_init"] = U0.astype(np.float16)
        npz[f"{name}_user_final"] = U.astype(np.float16)

    demo = []
    title = books.title.to_numpy(dtype=object)
    for u in rng.choice(eval_users, 5, replace=False):
        seen = (train[[u]] + val[[u]]).toarray().ravel() > 0
        row = {"liked": [title[i] for i in np.where(train[u].toarray().ravel() > 0)[0][:6]],
               "held_out": [title[i] for i in test[u].indices[:8]], "recs": {}}
        for m, f in scorers.items():
            s = f(np.array([u])).astype(np.float32)[0]; s[seen] = -np.inf
            row["recs"][m] = [title[i] for i in np.argsort(-s)[:5]]
        demo.append(row)

    return {"seed": int(seed), "config": dict(vars(a)), "eda": eda,
            "minutes": round((time.time() - t0) / 60, 1), "metrics": metrics, "history": hist,
            "repr": rep, "items": items, "npz": npz, "demo": demo,
            "n_eval_users": int(len(eval_users))}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--data", default="data"); p.add_argument("--out", default="artifacts")
    p.add_argument("--thr", type=int, default=4); p.add_argument("--min_pos", type=int, default=5)
    p.add_argument("--max_users", type=int, default=15000); p.add_argument("--eval_users", type=int, default=3000)
    p.add_argument("--dim", type=int, default=64)
    # Default 10 = MAXIMO de epocas de las dos torres: reproduce exactamente los
    # artifacts canonicos commiteados (ver artifacts/results.json -> config.epochs
    # y config.patience; el early stopping detuvo en epoca 6 con mejor epoca 4,
    # seed 42). Un `python pipeline.py` pelado regenera el estado del sitio
    # (S5 reproducibilidad, S8 sin drift de metricas). Con --patience 0 se
    # desactiva el early stopping y --epochs manda otra vez literalmente.
    p.add_argument("--epochs", type=int, default=10)
    p.add_argument("--patience", type=int, default=2,
                   help="early stopping sobre val NDCG@10 (S10/T5): epocas sin mejora antes de parar y restaurar la mejor; 0 desactiva")
    p.add_argument("--batch", type=int, default=2048); p.add_argument("--tau", type=float, default=0.05)
    p.add_argument("--logq", type=int, default=1); p.add_argument("--seed", type=int, default=42)
    p.add_argument("--seeds", default="42",
                   help="lista separada por comas (S2); seed 42 (o la primera) escribe los artifacts canonicos")
    a = p.parse_args()
    out = Path(a.out); out.mkdir(exist_ok=True)

    seeds = [int(s) for s in str(a.seeds).split(",") if s.strip() != ""]
    if not seeds:
        seeds = [int(a.seed)]
    canon_seed = 42 if 42 in seeds else seeds[0]

    # S2: una corrida completa por semilla (reentrenamiento incluido).
    bundles = [run_pipeline(a, sd) for sd in seeds]
    canonical = next(b for b in bundles if b["seed"] == canon_seed)

    # La corrida canonica (seed 42 / primera) escribe los mismos artifacts de siempre.
    canonical["items"].to_csv(out / "items.csv", index=False)
    np.savez_compressed(out / "embeddings.npz", **canonical["npz"])
    json.dump(canonical["demo"], open(out / "demo.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    # S5: registrar la version real de TensorFlow.
    from importlib import metadata as _md
    try:
        tf_version = _md.version("tensorflow")
    except Exception:
        tf_version = None

    # S2: resumen compacto por semilla (metricas de ranking + val_loss final).
    ranking_keys = ["recall@5", "recall@10", "recall@20", "ndcg@5", "ndcg@10", "ndcg@20", "map@10"]
    seed_runs = [{"seed": b["seed"],
                  "metrics": {m: {k: b["metrics"][m][k] for k in ranking_keys if k in b["metrics"][m]}
                              for m in b["metrics"]},
                  "val_loss": {m: (b["history"][m]["val_loss"][-1] if b["history"][m]["val_loss"] else None)
                               for m in b["history"]}}
                 for b in bundles]

    cfg = dict(canonical["config"])
    cfg["seed"] = canon_seed
    cfg["seeds"] = seeds
    cfg["tf_version"] = tf_version

    json.dump({"config": cfg, "eda": canonical["eda"], "metrics": canonical["metrics"],
               "repr": canonical["repr"], "history": canonical["history"], "seed_runs": seed_runs,
               "model_names": MODELS, "n_eval_users": canonical["n_eval_users"],
               "minutes": canonical["minutes"]},
              open(out / "results.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=float)
    print(f"Listo -> {out}/ (canonica seed {canon_seed}, {len(seeds)} corrida(s), "
          f"{canonical['minutes']} min en la canonica)")


if __name__ == "__main__":
    main()
