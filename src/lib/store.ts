import { createContext, useContext } from "react";
import type { Book, DemoUser, Genres, Neighbors, PopularItem, Summary } from "./types";

const BASE = import.meta.env.BASE_URL;

export interface Store {
  summary: Summary;
  books: Book[];
  genres: Genres;
  popular: PopularItem[];
  demo: DemoUser[];
  neighbors: Neighbors;
}

async function get<T>(rel: string): Promise<T> {
  const r = await fetch(`${BASE}${rel}`, { cache: "force-cache" });
  if (!r.ok) throw new Error(`No se pudo cargar ${rel} (${r.status})`);
  return (await r.json()) as T;
}

export async function loadStore(): Promise<Store> {
  const [summary, books, genres, popular, demo, neighbors] = await Promise.all([
    get<Summary>("data/summary.json"),
    get<Book[]>("data/books.json"),
    get<Genres>("data/genres.json"),
    get<PopularItem[]>("data/popular.json"),
    get<DemoUser[]>("data/demo.json"),
    get<Neighbors>("data/neighbors.json"),
  ]);
  return { summary, books, genres, popular, demo, neighbors };
}

export interface PcaPointLite {
  i: number;
  x: number;
  y: number;
  g: string;
}

const pcaCache = new Map<string, PcaPointLite[]>();

export async function loadPca(model: string, stage: "init" | "final"): Promise<PcaPointLite[]> {
  const key = `${model}_${stage}`;
  const hit = pcaCache.get(key);
  if (hit) return hit;
  const pts = await get<PcaPointLite[]>(`data/pca_${key}.json`);
  pcaCache.set(key, pts);
  return pts;
}

const StoreCtx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(StoreCtx);
  if (!s) throw new Error("useStore fuera del proveedor de datos");
  return s;
}

export function useBook(i: number): Book {
  const { books } = useStore();
  return books[i];
}

export const StoreProvider = StoreCtx.Provider;
