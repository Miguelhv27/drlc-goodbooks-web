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

export default function TopNav({ activa }: { activa: string }) {
  return (
    <header className="nav-fija sticky top-0 z-40">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <a href="#inicio" className="mr-1 flex shrink-0 items-center gap-2.5">
          <LibroIcon />
          <span className="nav-texto font-titulo hidden text-[1.08rem] sm:inline">DRLC · Goodbooks-10k</span>
        </a>
        <nav aria-label="Secciones" className="flex flex-1 gap-1.5 overflow-x-auto py-1" style={{ scrollbarWidth: "none" }}>
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
    <span aria-hidden className="logo-libro flex h-9 shrink-0 items-end gap-[3px] rounded-[3px] px-[6px] pb-[6px] pt-[6px]">
      <i className="block h-[19px] w-[5px] rounded-[1px] bg-[#7a2e2e]" />
      <i className="block h-[23px] w-[5px] rounded-[1px] bg-[#1f4b3a]" />
      <i className="block h-[17px] w-[5px] rounded-[1px] bg-[#b08d57]" />
      <i className="block h-[21px] w-[5px] rounded-[1px] bg-[#6b7f5e]" />
    </span>
  );
}
