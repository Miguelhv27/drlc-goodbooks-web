import { useMemo } from "react";

export interface Nodo {
  id: string;
  label: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  fill?: string;
  sub?: string;
}
export interface Arista {
  from: string;
  to: string;
  label?: string;
}

interface Props {
  nodos: Nodo[];
  aristas: Arista[];
  alto?: number;
}

const CUERO = "#8a5a3b";
const TARJETA = "#fbf6ea";
const TINTA = "#2b1d14";

/** Diagrama de flujo tipo graphviz con el tema de la app (cajas redondeadas + flechas). */
export default function FlowDiagram({ nodos, aristas, alto }: Props) {
  const mapa = useMemo(() => Object.fromEntries(nodos.map((n) => [n.id, n])), [nodos]);
  const anchoMax = Math.max(...nodos.map((n) => n.x + (n.w ?? 150))) + 24;
  const H = alto ?? Math.max(...nodos.map((n) => n.y + (n.h ?? 54))) + 16;

  return (
    <div className="tarjeta overflow-x-auto p-4">
      <svg
        viewBox={`0 0 ${anchoMax} ${H}`}
        style={{
          width: "100%",
          maxWidth: anchoMax,
          height: "auto",
          display: "block",
          margin: "0 auto",
          fontFamily: "Inter, sans-serif",
        }}
        role="img"
      >
        <defs>
          <marker id="flecha" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
            <polygon points="0 0, 9 3.5, 0 7" fill={CUERO} />
          </marker>
        </defs>
        {aristas.map((a, i) => {
          const f = mapa[a.from];
          const t = mapa[a.to];
          if (!f || !t) return null;
          const fw = f.w ?? 150;
          const fh = f.h ?? 54;
          const tw = t.w ?? 150;
          const th = t.h ?? 54;
          const fcx = f.x + fw / 2;
          const fcy = f.y + fh / 2;
          const tcx = t.x + tw / 2;
          const tcy = t.y + th / 2;
          let x1: number, y1: number, x2: number, y2: number, d: string;
          if (t.x >= f.x + fw) {
            x1 = f.x + fw;
            y1 = fcy;
            x2 = t.x;
            y2 = tcy;
            const dx = Math.max(24, (x2 - x1) / 2);
            d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
          } else if (f.x >= t.x + tw) {
            x1 = f.x;
            y1 = fcy;
            x2 = t.x + tw;
            y2 = tcy;
            const dx = Math.max(24, (x1 - x2) / 2);
            d = `M ${x1} ${y1} C ${x1 - dx} ${y1}, ${x2 + dx} ${y2}, ${x2} ${y2}`;
          } else {
            x1 = fcx;
            y1 = f.y + fh;
            x2 = tcx;
            y2 = t.y;
            const dy = Math.max(18, (y2 - y1) / 2);
            d = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
          }
          const ml = a.label ? (a.label.length * 6 + 12) / 2 : 0;
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={CUERO} strokeWidth="1.6" markerEnd="url(#flecha)" />
              {a.label && (
                <>
                  <rect x={mx - ml} y={my - 9} width={ml * 2} height={18} rx={9} fill="#f6efe2" stroke="#c9b99a" strokeWidth="0.7" />
                  <text x={mx} y={my + 3.5} textAnchor="middle" fontSize="10.5" fill={TINTA} fontWeight={600}>
                    {a.label}
                  </text>
                </>
              )}
            </g>
          );
        })}
        {nodos.map((n) => {
          const w = n.w ?? 150;
          const h = n.h ?? 54;
          const lineas = n.label.split("\n");
          return (
            <g key={n.id}>
              <rect x={n.x} y={n.y} width={w} height={h} rx={8} fill={n.fill ?? TARJETA} stroke={CUERO} strokeWidth="1.4" />
              {lineas.map((l, i) => (
                <text
                  key={i}
                  x={n.x + w / 2}
                  y={n.y + h / 2 + (i - (lineas.length - 1) / 2) * 16 + (n.sub ? -6 : 0) + 4.5}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight={650}
                  fill={TINTA}
                >
                  {l}
                </text>
              ))}
              {n.sub && (
                <text x={n.x + w / 2} y={n.y + h - 10} textAnchor="middle" fontSize="10" fill="#5a4a3c">
                  {n.sub}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
