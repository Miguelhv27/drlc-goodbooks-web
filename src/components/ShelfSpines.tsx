import { useMemo } from "react";

const COLORES = ["#7a2e2e", "#1f4b3a", "#b08d57", "#8a5a3b", "#6b7f5e", "#4a5d7a", "#5b4636", "#a65e3a"];

/** PRNG replicable: mismo seed => mismo estante (misma logica de estante() en app.py, rng seed 7). */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

interface Props {
  seed?: number;
  className?: string;
}

/** Franja decorativa de lomos de libros (solo CSS, sin imagenes). */
export default function ShelfSpines({ seed = 7, className = "" }: Props) {
  const bg = useMemo(() => {
    const rnd = mulberry32(seed);
    const stops: string[] = [];
    let pos = 0;
    while (pos < 100) {
      const w = 1.2 + rnd() * 2.0;
      const c = COLORES[Math.floor(rnd() * COLORES.length) % COLORES.length];
      stops.push(`${c} ${pos.toFixed(1)}% ${Math.min(pos + w, 100).toFixed(1)}%`);
      pos += w;
    }
    return `linear-gradient(90deg, ${stops.join(", ")})`;
  }, [seed]);

  return <div className={`estante ${className}`} style={{ background: bg }} aria-hidden="true" />;
}
