import { useStore } from "../lib/store";
import { fInt } from "../lib/paleta";
import ShelfSpines from "../components/ShelfSpines";

export default function Footer() {
  const { summary } = useStore();
  const { eda, config, run } = summary;
  const anio = new Date().getFullYear();

  return (
    <footer className="nav-fija mt-12">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <ShelfSpines className="mb-8 max-w-md" seed={7} />

        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h4 className="font-titulo mb-2 text-[1rem] text-[#f3e9d7]">El proyecto</h4>
            <p className="text-[0.86rem] leading-relaxed text-[#d9c9a8]">
              Recomendación top-k sobre <strong className="text-[#f3e9d7]">Goodbooks-10k</strong> con dos torres en
              TensorFlow/Keras y análisis de representaciones antes y después de entrenar. Proyecto final de DRLC.
            </p>
            <p className="mt-3 text-[0.86rem] text-[#f3e9d7]">
              Miguel Ángel Hernández Vargas · Juan Sebastián Fajardo Acevedo
            </p>
          </div>

          <div>
            <h4 className="font-titulo mb-2 text-[1rem] text-[#f3e9d7]">Cómo está hecho este sitio</h4>
            <ul className="space-y-1.5 text-[0.84rem] text-[#d9c9a8]">
              <li>
                React + Vite + Tailwind · gráficos con Recharts · fórmulas con KaTeX. 100% estático: sin backend, sin
                Python en producción.
              </li>
              <li>
                Los datos se hornearon con <span className="datos text-[#f3e9d7]">tools/gen_data.py</span> corriendo el
                mismo pipeline oficial (semilla {config.seed}) y quedaron en <span className="datos text-[#f3e9d7]">public/data/</span>.
              </li>
              <li>
                La demo muestra resultados precomputados de {fInt(run.n_eval_users)} usuarios evaluados, no inferencia
                en vivo — limitación declarada de un sitio estático.
              </li>
              <li>
                Portadas servidas por Open Library vía ISBN-13 del dataset; si no hay portada, se muestra un lomo
                tipográfico.
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-titulo mb-2 text-[1rem] text-[#f3e9d7]">Fuentes y referencias</h4>
            <ul className="space-y-1.5 text-[0.84rem]">
              <Enlace href="https://github.com/zygmuntz/goodbooks-10k" texto="Dataset Goodbooks-10k (zygmuntz)" />
              <Enlace href="https://github.com/tensorflow/recommenders" texto="TensorFlow Recommenders (idea de retrieval)" />
              <Enlace href="https://dl.acm.org/doi/10.1145/3298687.3347014" texto="Yi et al. 2019 · Sampling-bias-corrected NN (logQ)" />
              <Enlace href="https://www.kaggle.com/datasets/zygmunt/goodbooks-10k" texto="Goodbooks-10k en Kaggle" />
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#6b5444] pt-4">
          <p className="datos text-[0.72rem] text-[#d9c9a8]">
            © {anio} · {eda.n_ratings.toLocaleString("es-CO")} valoraciones · {eda.n_books.toLocaleString("es-CO")} libros · corrida de {run.minutes} min
          </p>
          <a href="#inicio" className="datos text-[0.72rem] font-semibold text-laton hover:text-[#f3e9d7]">
            ↑ volver arriba
          </a>
        </div>
      </div>
    </footer>
  );
}

function Enlace({ href, texto }: { href: string; texto: string }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noreferrer" className="text-[#d9c9a8] underline decoration-[#6b5444] hover:text-[#f3e9d7]">
        {texto}
      </a>
    </li>
  );
}
