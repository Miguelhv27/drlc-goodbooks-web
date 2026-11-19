import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  label?: string;
}

/** Carrusel horizontal con scroll-snap, flechas y puntos de pagina. */
export default function Carousel({ children, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pag, setPag] = useState({ actual: 0, total: 1 });

  const measure = () => {
    const el = ref.current;
    if (!el) return;
    const total = Math.max(1, Math.ceil(el.scrollWidth / Math.max(1, el.clientWidth)));
    const actual = Math.min(total - 1, Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    setPag({ actual, total });
  };

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  const mover = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="relative" aria-label={label} role="group">
      <div ref={ref} className="carrusel" onScroll={measure}>
        {children}
      </div>
      <button
        type="button"
        onClick={() => mover(-1)}
        disabled={pag.actual === 0}
        aria-label="Anterior"
        className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-arena bg-tarjeta p-2 text-nogal shadow transition hover:bg-laton hover:text-white disabled:opacity-25 disabled:hover:bg-tarjeta disabled:hover:text-nogal"
      >
        <Flecha dir="l" />
      </button>
      <button
        type="button"
        onClick={() => mover(1)}
        disabled={pag.actual >= pag.total - 1}
        aria-label="Siguiente"
        className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-arena bg-tarjeta p-2 text-nogal shadow transition hover:bg-laton hover:text-white disabled:opacity-25 disabled:hover:bg-tarjeta disabled:hover:text-nogal"
      >
        <Flecha dir="r" />
      </button>
      {pag.total > 1 && (
        <div className="mt-1 flex justify-center gap-1.5">
          {Array.from({ length: pag.total }, (_, i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === pag.actual ? "bg-laton" : "bg-arena"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function Flecha({ dir }: { dir: "l" | "r" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dir === "l" ? "rotate(180deg)" : undefined }}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
