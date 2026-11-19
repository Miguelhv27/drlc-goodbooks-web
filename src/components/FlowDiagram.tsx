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
    <div className="tarjeta overflow-x-auto p-3">
      <svg viewBox={`0 0 ${Math.max(anchoMax, 640)} ${H}`} width="100%" style={{ minWidth: anchoMax > 860 ? anchoMax * 0.78 : undefined, fontFamily: "Inter, sans-serif" }} role="img">
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
          const th = t.h ?? 54;
          const x1 = f.x + fw;
          const y1 = f.y + fh / 2;
          const x2 = t.x;
          const y2 = t.y + th / 2;
          const dx = Math.max(24, (x2 - x1) / 2);
          const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
          const ml = a.label ? (a.label.length * 5.6 + 10) / 2 : 0;
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={CUERO} strokeWidth="1.5" markerEnd="url(#flecha)" />
              {a.label && (
                <>
                  <rect x={mx - ml} y={my - 8} width={ml * 2} height={16} rx={8} fill="#f6efe2" stroke="#c9b99a" strokeWidth="0.7" />
                  <text x={mx} y={my + 3.5} textAnchor="middle" fontSize="9.5" fill={TINTA} fontWeight={600}>
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
              <rect x={n.x} y={n.y} width={w} height={h} rx={7} fill={n.fill ?? TARJETA} stroke={CUERO} strokeWidth="1.3" />
              {lineas.map((l, i) => (
                <text
                  key={i}
                  x={n.x + w / 2}
                  y={n.y + h / 2 + (i - (lineas.length - 1) / 2) * 13 + (n.sub ? -5 : 0)}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={650}
                  fill={TINTA}
                >
                  {l}
                </text>
              ))}
              {n.sub && (
                <text x={n.x + w / 2} y={n.y + h - 9} textAnchor="middle" fontSize="8.8" fill="#5a4a3c">
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
