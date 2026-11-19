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
export type History = Record<string, { loss: number[]; val_loss: number[] }>;

export interface ArchRow {
  capa: string;
  tipo: string;
  salida: string;
  parametros: number;
  entrenable: string;
}
export type Arch = Record<string, { usuario: ArchRow[]; libro: ArchRow[] }>;

export interface Summary {
  run: RunInfo;
  config: Config;
  eda: Eda;
  metrics: Metrics;
  repr: Rep;
  history: History;
  arch: Arch;
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

export interface PopularItem {
  i: number;
  rc: number;
  ar: number;
}

export interface Genres {
  order: string[];
  counts: Record<string, number>;
}
