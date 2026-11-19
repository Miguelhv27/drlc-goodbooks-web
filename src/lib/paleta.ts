/** Paleta, nombres de modelos y helpers de formato — spec visual heredada de app.py. */

export const COLORES = {
  bordo: "#7a2e2e",
  verde: "#1f4b3a",
  laton: "#b08d57",
  cuero: "#8a5a3b",
  salvia: "#6b7f5e",
  azul: "#4a5d7a",
  teja: "#a65e3a",
  cacao: "#5b4636",
  oliva: "#9c8f5a",
  ciruela: "#7d4a6b",
  teal: "#3f6b6b",
  arena_osc: "#a99572",
} as const;

/** Paleta categorica exacta de app.py (PALETA). */
export const PALETA = [
  COLORES.bordo, COLORES.verde, COLORES.laton, COLORES.cuero, COLORES.salvia,
  "#4a5d7a", "#a65e3a", "#5b4636", "#9c8f5a", "#7d4a6b", "#3f6b6b", "#c28f5a",
  "#6e6e4e", "#a04b4a",
];

/** MCOL de app.py: color fijo por modelo en comparaciones. */
export const COLOR_MODELO: Record<string, string> = {
  popularidad: COLORES.arena_osc,
  item_knn: COLORES.cuero,
  contenido: COLORES.salvia,
  dos_torres_id: COLORES.bordo,
  dos_torres_meta: COLORES.verde,
};

/** TT de app.py: nombre corto por modelo de dos torres. */
export const TORRES: Record<string, string> = {
  dos_torres_id: "Dos torres (solo ID)",
  dos_torres_meta: "Dos torres (ID + tags)",
};

export const COLOR_TORRE: Record<string, string> = {
  dos_torres_id: COLORES.bordo,
  dos_torres_meta: COLORES.verde,
};

/** Genero -> color estable para dispersores PCA (usa PALETA por orden de frecuencia). */
export function colorGenero(g: string, orden: string[]): string {
  if (g === "otro") return "#b9ad93";
  const i = orden.indexOf(g);
  return PALETA[(i >= 0 ? i : PALETA.length - 1) % PALETA.length];
}

// ------------------------------------------------------------- formato
export const fInt = (n: number) => n.toLocaleString("es-CO");
export const fPct = (x: number, d = 0) => `${(x * 100).toFixed(d).replace(".", ",")}%`;
export const fNum = (x: number, d = 4) => x.toFixed(d).replace(".", ",");
export const fDelta = (x: number, d = 1) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(d).replace(".", ",")}%`;

export function portadaIsbn(isbn: string | null, size: "S" | "M" | "L" = "M"): string | null {
  if (!isbn) return null;
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg`;
}

/** Color deterministico de lomo/fallback a partir del titulo. */
export function colorTitulo(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return PALETA[Math.abs(h) % PALETA.length];
}

export function tituloCorto(t: string, n = 46): string {
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
}
