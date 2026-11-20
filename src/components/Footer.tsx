export default function Footer() {
  const anio = new Date().getFullYear();

  return (
    <footer className="nav-fija mt-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 py-8">
          <div>
            <p className="font-titulo text-[1rem] font-bold text-[#f3e9d7]">
              Recomendador de libros · Goodbooks-10k
            </p>
            <p className="mt-1.5 text-[0.86rem] text-[#d9c9a8]">
              Miguel Ángel Hernández Vargas · Juan Sebastián Fajardo Acevedo
            </p>
            <p className="mt-0.5 text-[0.8rem] text-[#d9c9a8]">
              Proyecto final · Deep Representation Learning &amp; Retrieval (DRLC)
            </p>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/zygmuntz/goodbooks-10k"
              target="_blank"
              rel="noreferrer"
              className="text-[0.82rem] text-[#d9c9a8] underline decoration-[#6b5444] hover:text-[#f3e9d7]"
            >
              Dataset
            </a>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="cursor-pointer text-[0.82rem] font-semibold text-laton hover:text-[#f3e9d7]"
            >
              ↑ Volver arriba
            </button>
          </div>
        </div>
        <div className="border-t border-[#6b5444] py-4">
          <p className="text-[0.75rem] text-[#b09a76]">© {anio} · Sitio estático del proyecto.</p>
        </div>
      </div>
    </footer>
  );
}
