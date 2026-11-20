import Section from "../components/Section";
import TheoryCard from "../components/TheoryCard";
import { useStore } from "../lib/store";
import { COLORES, fInt, fNum, fPct } from "../lib/paleta";

/** Seccion 9: problemas encontrados, limitaciones actuales y proximos pasos.
 *  Todo numero que aparece aqui sale de summary.json; las observaciones de
 *  corridas intermedias se etiquetan como anecdoticas, sin artefacto asociado. */
export default function Dificultades() {
  const { summary } = useStore();
  const { config: cfg, eda, metrics: met, run } = summary;
  const sp = eda.split_sizes;
  const posFull = (eda.rating_dist["4"] ?? 0) + (eda.rating_dist["5"] ?? 0);
  const semillas = (summary.seed_runs ?? []).map((r) => r.seed).join(", ");

  return (
    <Section
      id="dificultades"
      n={9}
      title="Dificultades, limitaciones y próximos pasos"
      lead={
        <>
          Una sección honesta sobre lo que salió mal, lo que todavía no está resuelto y lo que sigue. Es el mismo
          estándar que usamos para el resto del informe: los problemas documentados valen más que los promedios
          bonitos. Los números citados aquí salen de los artefactos de <span className="datos">summary.json</span>;
          cuando algo viene de corridas intermedias sin artefacto asociado, lo decimos explícitamente.
        </>
      }
    >
      <h3 className="titulo-h3 mb-3">Problemas encontrados durante el proyecto</h3>
      <div className="mb-8 grid gap-5 lg:grid-cols-2">
        <Bloque titulo="Binarizar los ratings tuvo un costo" color={COLORES.bordo}>
          <p>
            Definimos <strong>interacción positiva = rating ≥ {eda.threshold}</strong>, cómodo para aprendizaje
            implícito, pero con consecuencias: un lector que puso {eda.threshold} y uno que puso 5 quedan iguales, el
            corte en {eda.threshold} es arbitrario y los libros valorados 1–3 pasaron a “desconocidos”, no a negativos.
            El embudo es grande: de {fInt(eda.n_ratings)} valoraciones del dataset, {fInt(posFull)} son ≥{" "}
            {eda.threshold}; tras exigir ≥ {cfg.min_pos} positivos por usuario y recortar al subconjunto de{" "}
            {fInt(eda.n_users_used)} usuarios, quedan {fInt(eda.n_pos_used)} positivas para entrenar.
          </p>
        </Bloque>

        <Bloque titulo="Negativos in-batch sesgados hacia lo popular (y logQ)" color={COLORES.verde}>
          <p>
            La pérdida compara a cada usuario solo contra los {fInt(cfg.batch)} libros del lote, y esos libros llegan
            con frecuencia popular: los famosos son castigados como negativo una y otra vez. Corregimos con{" "}
            <strong>logQ</strong>, restando log Q(i) a la puntuación (corrección de softmax muestreada, Yi et al.,
            WSDM 2019; la fórmula está en Arquitectura).
          </p>
          <p className="mt-2">
            En corridas intermedias (split antiguo, hiperparámetros iniciales) observamos que activar logQ subía el
            NDCG@10 de ~0,04 a ~0,049: lo citamos expresamente como <strong>observación anecdótica de corridas
            intermedias, sin artefacto asociado</strong>. Los números respaldados por el artefacto actual son los de
            la tabla: {fNum(met.dos_torres_meta["ndcg@10"], 4)} para dos torres (ID + tags) y{" "}
            {fNum(met.dos_torres_id["ndcg@10"], 4)} para solo ID.
          </p>
        </Bloque>

        <Bloque titulo="El género es un proxy con etiquetas ruidosas" color={COLORES.laton}>
          <p>
            Goodbooks no trae géneros: asignamos a cada libro su tag de género más frecuente. Un libro que cruza
            varias audiencias recibe una sola etiqueta, así que <strong>silhouette y pureza kNN</strong> miden
            consistencia con un consenso ruidoso, no “la verdad” temática. Las usamos como referencia externa para
            juzgar la organización del espacio (Representaciones), nunca como objetivo de entrenamiento.
          </p>
        </Bloque>

        <Bloque titulo="Valores absolutos bajos de Recall: explicados, no escondidos" color={COLORES.cuero}>
          <p>
            El modelo ordena {fInt(eda.n_books)} libros por usuario y la “verdad” es solo la parte final de su
            historial: {fInt(sp.test ?? 0)} interacciones de test de {fInt(run.n_eval_users)} usuarios evaluados. Un
            acierto legítimo (un libro que el usuario disfrutaría pero aún no lee en esa fecha) cuenta como error.
            En recuperación con catálogo completo y split cronológico los valores absolutos son bajos por diseño;
            lo publicable es la comparación contra baselines (Resultados).
          </p>
        </Bloque>

        <Bloque titulo="Primeras corridas con split aleatorio: métricas infladas" color={COLORES.salvia}>
          <p>
            Al principio dividíamos el historial de cada usuario <em>al azar</em> entre train y test. Con libros que
            un usuario valora en días distintos, el modelo podía apoyarse en lecturas futuras para “predecir” las
            pasadas: fuga de información. Las métricas de esas corridas salían considerablemente más altas que las
            actuales — y no era un logro, era un artefacto. Lo corregimos a <strong>split cronológico por
            usuario</strong>, que es lo que reporta este sitio. Es también una observación anecdótica de corridas
            intermedias, sin artefacto asociado.
          </p>
        </Bloque>

        <Bloque titulo="El sobreajuste no se arregló con regularizaciones, sino parando a tiempo" color={COLORES.laton}>
          <p>
            Vimos que la pérdida de validación volvía a subir tras pocas épocas: señal de
            sobreajuste. Antes de tocar el pipeline exploramos las técnicas estándar de
            regularización —dropout en las torres, mezcla de negativos uniformes extra,
            temperaturas τ mayores, weight decay y, en item-kNN, vecindarios top-k con
            shrinkage— con un harness dedicado (evidencia: <span className="datos">tools/experimentos_results.json</span>{" "}
            en el repo del pipeline). <strong>Todas empeoraron el NDCG@10 de validación</strong>,
            así que se descartaron y el baseline quedó tal cual. El único ajuste que mejoró
            validación fue el <strong>early stopping</strong> sobre ese mismo NDCG@10 (hasta{" "}
            {fInt(cfg.epochs)} épocas como máximo, con restauración de los pesos de la mejor
            época), que hoy es el comportamiento por defecto del pipeline.
          </p>
        </Bloque>

        <Bloque titulo="Límites del propio dataset" color={COLORES.azul}>
          <p>
            Goodbooks-10k aporta valoraciones y tags, no reseñas ni texto real: la única señal de contenido son los
            500 tags TF-IDF, por eso la torre de metadatos es tan delgada. El catálogo es estático, no hay datos
            demográficos ni de contexto de lectura, y la popularidad es estructural: el 10% de libros concentra el{" "}
            {fPct(eda.top10pct_share)} de las valoraciones, lo que hace del baseline de popularidad un rival duro.
          </p>
        </Bloque>
      </div>

      <h3 className="titulo-h3 mb-3">Limitaciones actuales</h3>
      <div className="tarjeta mb-8 p-5">
        <ol className="list-decimal space-y-2 pl-5 text-[0.92rem] leading-relaxed">
          <li>
            <strong>Tabla principal = una corrida canónica</strong> (semilla {cfg.seed}, la del entregable). Varianza
            multi-semilla ya disponible: {summary.seed_runs.length} corridas ({semillas}) con media ± desvío en la tabla
            de <a href="#resultados" className="font-semibold text-bordo underline decoration-laton">Resultados</a>;
            las diferencias pequeñas entre modelos deben leererse contra ese rango, no como una conclusión aislada.
          </li>
          <li>
            <strong>La pérdida de validación es ruidosa</strong>: se estima sobre un número limitado de lotes, así que
            distancias mínimas entre curvas no son concluyentes (Curvas).
          </li>
          <li>
            <strong>La demo subestima el Recall</strong>: las recomendaciones están precomputadas y la lista de libros
            escondidos de cada usuario se muestra truncada, por lo que el conteo visual de aciertos es un piso, no el
            valor real (Demo).
          </li>
          <li>
            <strong>Deriva de versiones</strong>: los artefactos se regeneran hoy con un TensorFlow más nuevo que el
            de las primeras corridas; el script de cocción solo escribe si el NDCG@10 reentrenado reproduce el
            entregable dentro de una tolerancia de ±0,005. Aun así, bit-for-bit no garantizamos idéntico en otro
            entorno: garantizamos reproducibilidad dentro de esa tolerancia.
          </li>
        </ol>
      </div>

      <h3 className="titulo-h3 mb-3">Riesgos y próximos pasos</h3>
      <div className="ficha ficha-verde mb-2 p-4">
        <ul className="list-disc space-y-2 pl-5 text-[0.92rem] leading-relaxed">
          <li>
            <strong>Reentrenar con los {fInt(eda.n_users)} usuarios completos</strong> (
            <span className="datos">--max_users 0</span>): más señal para las torres y menos ruido por submuestreo.
            Riesgo a vigilar: que el costo de entrenamiento y la popularidad del subconjunto cambien el ranking.
          </li>
          <li>
            <strong>Inicialización preentrenada de los embeddings de ID</strong>: item2vec sobre las co-ocurrencias o
            vecindarios estilo NCF, para separar cuánto aporta el init frente a cuánto aporta el entrenamiento
            propio (justificación de partir de ruido en Representaciones).
          </li>
          <li>
            <strong>Métricas por categoría</strong>: Recall/NDCG desglosados por género proxy, para ver si el modelo
            sirve igual a los lectores de ficción popular que a los de nichos.
          </li>
          <li>
            <strong>Análisis de fairness de popularidad</strong>: qué fracción de los aciertos viene de apuestas
            seguras al top {fPct(eda.top10pct_share)} del catálogo y qué espacio queda realmente para la cola larga.
          </li>
          <li>
            <strong>Significancia estadística</strong>: con la varianza multi-semilla publicada, reescribir cada
            afirmación del sitio para sostener solo lo que sobreviva al media ± desvío.
          </li>
        </ul>
      </div>

      <TheoryCard>
        <p>
          ¿Por qué una sección de dificultades? Porque en recuperación de información es facilísimo engañarse: una
          fuga de tiempo infla las métricas, el promedio de una sola corrida parece un hallazgo y un Recall bajo puede
          ser un problema del setup y no del modelo. Cada punto de arriba cambió algo concreto en el pipeline (filtro
          de usuarios, split, corrección logQ) o en cómo leemos los números. Documentarlo es parte del método, no una
          disculpa.
        </p>
      </TheoryCard>
    </Section>
  );
}

function Bloque({ titulo, color, children }: { titulo: string; color: string; children: React.ReactNode }) {
  return (
    <div className="ficha" style={{ borderLeftColor: color }}>
      <div className="p-4">
        <h4 className="font-titulo mb-1.5 text-[0.92rem] font-bold" style={{ color }}>
          {titulo}
        </h4>
        <div className="text-[0.88rem] leading-relaxed text-tinta/90">{children}</div>
      </div>
    </div>
  );
}
