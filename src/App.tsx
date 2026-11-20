import { useEffect, useState } from "react";
import { loadStore, StoreProvider, type Store } from "./lib/store";
import TopNav, { SECCIONES } from "./components/TopNav";
import Hero from "./sections/Hero";
import Dataset from "./sections/Dataset";
import PipelineSec from "./sections/PipelineSec";
import Architecture from "./sections/Architecture";
import Curves from "./sections/Curves";
import Results from "./sections/Results";
import Representations from "./sections/Representations";
import Demo from "./sections/Demo";
import Justificacion from "./sections/Justificacion";
import Footer from "./components/Footer";
import ShelfSpines from "./components/ShelfSpines";

const PAGINAS = {
  inicio: Hero,
  dataset: Dataset,
  pipeline: PipelineSec,
  arquitectura: Architecture,
  curvas: Curves,
  resultados: Results,
  representaciones: Representations,
  demo: Demo,
  justificacion: Justificacion,
} as const;

export type PaginaId = keyof typeof PAGINAS;

function paginaDesdeHash(): PaginaId {
  const h = window.location.hash.replace(/^#/, "");
  return h in PAGINAS ? (h as PaginaId) : "inicio";
}

export default function App() {
  return (
    <div className="paper-grain relative min-h-screen">
      <div className="relative z-10">
        <Shell />
      </div>
    </div>
  );
}

function Shell() {
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagina, setPagina] = useState<PaginaId>(() => paginaDesdeHash());

  useEffect(() => {
    loadStore().then(setStore).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const onHash = () => setPagina(paginaDesdeHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pagina]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <ShelfSpines className="mb-8" />
        <h1 className="titulo-h2 mb-4">No pude cargar los datos</h1>
        <p className="mb-2 text-gris">El sitio necesita `public/data/*.json`. Vuelve a generarlos con:</p>
        <pre className="tarjeta datos my-4 overflow-x-auto p-4 text-left text-[0.82rem]">python tools/gen_data.py --retrain</pre>
        <p className="datos text-[0.75rem] text-gris">{error}</p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6">
        <ShelfSpines className="w-56" seed={7} />
        <p className="datos animate-pulse text-[0.85rem] font-semibold tracking-widest text-laton">
          ABRIFIENDO LA BIBLIOTECA…
        </p>
      </div>
    );
  }

  const Seccion = PAGINAS[pagina] ?? Hero;

  return (
    <StoreProvider value={store}>
      <TopNav activa={pagina} />
      <main className="flex min-h-[calc(100vh-13rem)] flex-col">
        <div key={pagina} className="aparece grow">
          <Seccion />
        </div>
        <PageNav pagina={pagina} />
      </main>
      <Footer />
    </StoreProvider>
  );
}

/** Botones anterior/siguiente: la única forma de pasar de una sección a otra. */
function PageNav({ pagina }: { pagina: PaginaId }) {
  const idx = SECCIONES.findIndex((s) => s.id === pagina);
  const prev = idx > 0 ? SECCIONES[idx - 1] : null;
  const next = idx >= 0 && idx < SECCIONES.length - 1 ? SECCIONES[idx + 1] : null;
  if (!prev && !next) return null;
  return (
    <nav
      aria-label="Navegación entre páginas"
      className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pb-10 sm:px-6 lg:px-8"
    >
      {prev ? (
        <a href={`#${prev.id}`} className="btn-teoria px-4 py-2 text-[0.82rem]">
          ← {prev.label}
        </a>
      ) : (
        <span />
      )}
      {next ? (
        <a href={`#${next.id}`} className="btn-teoria px-4 py-2 text-[0.82rem]">
          {next.label} →
        </a>
      ) : (
        <span />
      )}
    </nav>
  );
}
