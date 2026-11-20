/** Tipos de los datos horneados por tools/gen_data.py (public/data/). */

export interface RunInfo {
  minutes: number;
  n_eval_users: number;
  model_order: string[];
  model_names: Record<string, string>;
  ks: number[];
  generated_from: string;
}

export interface Config {
  thr: number;
  min_pos: number;
  max_users: number;
  eval_users: number;
  dim: number;
  epochs: number;
  batch: number;
  tau: number;
  logq: number;
  seed: number;
  seeds: number[];
  tf_version: string;
}

export interface Eda {
  n_users: number;
  n_books: number;
  n_ratings: number;
  sparsity: number;
  rating_dist: Record<string, number>;
  user_hist: number[];
  user_median: number;
  user_p90: number;
  book_median: number;
  book_max: number;
  longtail_curve: number[];
  top10pct_share: number;
  n_users_used: number;
  n_pos_used: number;
  threshold: number;
  split_sizes: Record<string, number>;
  genre_counts: Record<string, number>;
}

export type Metrics = Record<string, Record<string, number>>;
export type Rep = Record<string, Record<string, number>>;
export type History = Record<string, { loss: number[]; val_loss: number[]; val_ndcg?: number[]; best_epoch?: number }>;

export interface ArchRow {
  capa: string;
  tipo: string;
  salida: string;
  parametros: number;
  entrenable: string;
}
export type Arch = Record<string, { usuario: ArchRow[]; libro: ArchRow[] }>;

/** Etapa del puente representacion↔desempeno: MRR y Recall@k de recuperar los
 *  positivos held-out por similitud coseno contra el espacio de libros. */
export interface BridgeStage {
  mrr: number;
  "recall@5": number;
  "recall@10": number;
  "recall@20": number;
}

export interface BridgeTower {
  init: BridgeStage;
  final: BridgeStage;
}

/** puente por modelo de dos torres (clave = id de modelo). */
export type Bridge = Record<string, BridgeTower>;

/** Estadisticos del espacio de usuarios por etapa (muestreados en el pipeline). */
export interface UserReprStage {
  n: number;
  dim: number;
  sample: number;
  norm_mean: number;
  norm_median: number;
  cos_mean_sample: number;
}

/** Vecino de un usuario en el espacio de embeddings, con su cuenta de items positivos. */
export interface UserNeighbor {
  v: number;
  pos_items: number;
}

export interface UserKnnExample {
  u: number;
  neighbors: UserNeighbor[];
}

export interface UserReprTower {
  init: UserReprStage;
  final: UserReprStage;
  knn: UserKnnExample[];
}

/** representacion de usuarios por modelo de dos torres (clave = id de modelo). */
export type UserRepr = Record<string, UserReprTower>;

/** Corrida completa del pipeline para una semilla dada (metricas de todos los
 *  modelos; val_loss solo de las dos torres). */
export interface SeedRun {
  seed: number;
  metrics: Record<string, Record<string, number>>;
  val_loss: Record<string, number>;
}

export interface Summary {
  run: RunInfo;
  config: Config;
  eda: Eda;
  metrics: Metrics;
  repr: Rep;
  history: History;
  arch: Arch;
  bridge: Bridge;
  user_repr: UserRepr;
  seed_runs: SeedRun[];
  tf_version: string;
}

/** Libro indexado por el indice interno del pipeline (orden de book_id). */
export interface Book {
  t: string; // title
  a: string; // authors
  g: string; // genre (proxy)
  rc: number; // ratings_count
  ar: number; // average_rating
  y: number | null; // original_publication_year
  is: string | null; // isbn13 -> portada Open Library
  gr: number; // goodreads_book_id
}

export interface PcaPoint {
  i: number;
  x: number;
  y: number;
  g: string;
}

export interface Neighbors {
  pool: number[];
  k: number;
  nn: Record<string, Record<string, number[]>>;
}

export interface DemoUser {
  u: number;
  liked: number[];
  held_out: number[];
  n_test: number;
  recs: Record<string, number[]>;
}

/** Metadata de seleccion horneada en demo.json (fase model-tuning, T8/L11).
 *  selection_rule documenta como se eligieron los usuarios de demo (cuantiles
 *  deterministas de n_test sobre la muestra de evaluacion, nunca por hits);
 *  n_test_min/n_test_max dan el spread de positivos de test de esa seleccion. */
export interface DemoMeta {
  selection_rule: string;
  n_test_min: number;
  n_test_max: number;
}

/** demo.json horneado desde T8: objeto con metadata + usuarios. Los artefactos
 *  antiguos eran una lista cruda de DemoUser; readDemoFile() normaliza ambas. */
export interface DemoFile extends DemoMeta {
  users: DemoUser[];
}

export interface PopularItem {
  i: number;
  rc: number;
  ar: number;
}

export interface Genres {
  order: string[];
  counts: Record<string, number>;
}
