import { useEffect, useState } from "react";

export const SECCIONES = [
  { id: "inicio", label: "Inicio" },
  { id: "dataset", label: "Dataset" },
  { id: "pipeline", label: "Pipeline" },
  { id: "arquitectura", label: "Arquitectura" },
  { id: "curvas", label: "Curvas" },
  { id: "resultados", label: "Resultados" },
  { id: "representaciones", label: "Representaciones" },
  { id: "demo", label: "Demo" },
  { id: "dificultades", label: "Dificultades" },
];

export default function TopNav() {
  const [activa, setActiva] = useState("inicio");

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (vis[0]) setActiva(vis[0].target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0.05, 0.3, 0.7] },
    );
    for (const s of SECCIONES) {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);

  return (
    <header className="nav-fija sticky top-0 z-40">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-6">
        <a href="#inicio" className="mr-2 flex shrink-0 items-center gap-2">
          <LibroIcon />
          <span className="nav-texto font-titulo hidden text-[0.95rem] sm:inline">DRLC · Goodbooks-10k</span>
        </a>
        <nav aria-label="Secciones" className="flex flex-1 gap-1 overflow-x-auto py-1" style={{ scrollbarWidth: "none" }}>
          {SECCIONES.map((s) => (
            <a key={s.id} href={`#${s.id}`} className={`nav-chip ${activa === s.id ? "activa" : ""}`}>
              {s.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

function LibroIcon() {
  return (
    <span aria-hidden className="logo-libro flex h-7 shrink-0 items-end gap-[2.5px] rounded-[3px] px-[5px] pb-[5px] pt-[5px]">
      <i className="block h-[15px] w-[4px] rounded-[1px] bg-[#7a2e2e]" />
      <i className="block h-[19px] w-[4px] rounded-[1px] bg-[#1f4b3a]" />
      <i className="block h-[13px] w-[4px] rounded-[1px] bg-[#b08d57]" />
      <i className="block h-[17px] w-[4px] rounded-[1px] bg-[#6b7f5e]" />
    </span>
  );
}
