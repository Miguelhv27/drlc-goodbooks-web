import { useEffect, useState } from "react";
import { loadStore, StoreProvider, type Store } from "./lib/store";
import TopNav from "./components/TopNav";
import Hero from "./sections/Hero";
import Dataset from "./sections/Dataset";
import PipelineSec from "./sections/PipelineSec";
import Architecture from "./sections/Architecture";
import Curves from "./sections/Curves";
import Results from "./sections/Results";
import Representations from "./sections/Representations";
import Demo from "./sections/Demo";
import Challenges from "./sections/Challenges";
import Footer from "./components/Footer";
import ShelfSpines from "./components/ShelfSpines";

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

  useEffect(() => {
    loadStore().then(setStore).catch((e) => setError(String(e)));
  }, []);

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

  return (
    <StoreProvider value={store}>
      <TopNav />
      <main>
        <Hero />
        <Dataset />
        <PipelineSec />
        <Architecture />
        <Curves />
        <Results />
        <Representations />
        <Demo />
        <Challenges />
      </main>
      <Footer />
    </StoreProvider>
  );
}
