/** Tokens de tema para Recharts, replicando _tema_altair() de app.py. */
import type { CSSProperties } from "react";

export const FUENTE = "Source Serif 4, Georgia, serif";
export const TINTA = "#2b1d14";
export const NOGAL = "#3b2a20";
export const TARJETA = "#fbf6ea";
export const ARENA = "#c9b99a";
export const GRID = "#e4d8bf";
export const CUERO = "#8a5a3b";
export const LATON = "#b08d57";
export const BORDO = "#7a2e2e";
export const VERDE = "#1f4b3a";

export const tick = { fill: TINTA, fontSize: 11.5, fontFamily: FUENTE } as const;
export const lineaEje = { stroke: CUERO } as const;
export const gridProps = { stroke: GRID, strokeDasharray: "3 3" } as const;

export const tooltipContenido: CSSProperties = {
  background: TARJETA,
  border: `1px solid ${ARENA}`,
  borderLeft: `5px solid ${LATON}`,
  borderRadius: 4,
  fontFamily: FUENTE,
  fontSize: "0.85rem",
  color: TINTA,
  boxShadow: "2px 2px 0 rgba(59,42,32,.12)",
};

export const tooltipFila: CSSProperties = { padding: "1px 0", fontSize: "0.83rem" };

export const leyendaTexto: CSSProperties = {
  fontFamily: FUENTE,
  fontSize: "0.84rem",
  color: TINTA,
};
