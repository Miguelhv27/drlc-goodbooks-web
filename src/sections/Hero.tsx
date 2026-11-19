import { useStore } from "../lib/store";
import { fInt, fNum, fPct } from "../lib/paleta";
import Carousel from "../components/Carousel";
import BookCover from "../components/BookCover";
import Metric from "../components/Metric";
import ShelfSpines from "../components/ShelfSpines";
import TheoryCard from "../components/TheoryCard";

export default function Hero() {
  const { summary, popular } = useStore();
  const { eda, metrics, run } = summary;
  const best = run.model_order.reduce((a, b) => (metrics[a]["ndcg@10"] >= metrics[b]["ndcg@10"] ? a : b));

  return (
    <section id="inicio" className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-6 pt-10 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:px-8 lg:pt-14">
        <div className="aparece">
          <p className="datos mb-3 text-[0.72rem] font-bold uppercase tracking-[0.28em] text-laton">
            Proyecto final · Deep Representation Learning &amp; Retrieval · Goodbooks-10k
          </p>
          <h1 className="titulo-h1">
            Recomendador de libros con <span className="text-bordo">Deep Representation Learning</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[1.05rem] leading-relaxed text-tinta/90">
            Dado un lector, ordenar los 10.000 libros que aún no leyó según qué tan relevantes son para él. El modelo
            principal es una <strong>arquitectura de dos torres</strong>: una red aprende un vector por usuario, otra un
            vector por libro, y se recomienda cuando apuntan en la misma dirección. Lo que nos interesa del curso:
            analizar <strong>cómo cambian esas representaciones</strong> antes y después de entrenar.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#resultados" className="btn-teoria mr-1 px-4 py-2 text-[0.85rem]">Ver resultados →</a>
            <a href="#demo" className="btn-teoria mr-1 px-4 py-2 text-[0.85rem]">Probar la demo</a>
          </div>
          <p className="mt-6 text-[0.85rem] text-gris">
            Miguel Ángel Hernández Vargas · Juan Sebastián Fajardo Acevedo
          </p>
        </div>

        <div className="relative" style={{ animationDelay: "0.15s" }}>
          <ShelfSpines className="mb-0" seed={11} />
          <div className="tarjeta border-x border-b-0 p-4">
            <Carousel label="Carrusel de libros populares">
              {popular.slice(0, 24).map((p) => (
                <BookCover key={p.i} idx={p.i} w={108} h={162} showMeta={false} />
              ))}
            </Carousel>
            <p className="text-center text-[0.72rem] italic text-gris">
              Los 24 libros con más valoraciones del catálogo (Goodreads → portadas vía Open Library)
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Metric label="Usuarios usados" value={fInt(eda.n_users_used)} delta={`de ${fInt(eda.n_users)}`} />
          <Metric label="Libros" value={fInt(eda.n_books)} accent="#1f4b3a" />
          <Metric
            label={`Interacciones positivas (≥${eda.threshold})`}
            value={fInt(eda.n_pos_used)}
            accent="#b08d57"
          />
          <Metric label="Mejor NDCG@10" value={fNum(metrics[best]["ndcg@10"], 4)} delta={run.model_names[best]} accent="#7a2e2e" />
        </div>
        <p className="mt-3 text-[0.8rem] text-gris">
          Matriz usuario-libro con {fPct(eda.sparsity)} de huecos · dispersidad calculada sobre {fInt(eda.n_users)}×{fInt(eda.n_books)}
        </p>

        <TheoryCard>
          <p>
            Imagina una biblioteca donde cada libro y cada lector se convierten en una <strong>dirección</strong> (una
            flecha en un espacio de 64 dimensiones). Entrenar consiste en mover esas flechas: si a un lector le gustó un
            libro, sus flechas deben apuntar más parecido. “Recomendar” es simplemente mirar qué flechas de libros están
            más alineadas con la del lector. Que 64 números representen “el gusto” de alguien suena mágico, pero eso es
            exactamente lo que aprende una red neuronal a partir de 1,16 millones de lecturas positivas.
          </p>
          <p className="mt-2">
            La <strong>dispersidad</strong> del 98,9% significa que casi nadie ha leído casi nada: de todas las
            combinaciones posibles lector-libro, solo el 1,1% tiene una nota. Justamente por eso un modelo de
            representaciones tiene sentido — las tablas de “quién leyó qué” a secas no alcanzan.          </p>
          <p className="mt-2">
            El NDCG@10 (que verás en Resultados) mide qué tan arriba de una lista de 10 recomendaciones aparecen los
            libros que de verdad leerías. Son números bajos para cualquier sistema de recuperación — importa más la
            comparación entre modelos que el valor absoluto.
          </p>
        </TheoryCard>
      </div>
    </section>
  );
}
