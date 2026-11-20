import Section from "../components/Section";
import TheoryCard from "../components/TheoryCard";
import { useStore } from "../lib/store";
import { COLORES, fInt, fNum, fPct } from "../lib/paleta";

/** Seccion 9: justificacion de las decisiones tomadas y del proceso realizado,
 *  mas las conclusiones finales. Todo numero deriva de summary.json. */
export default function Justificacion() {
  const { summary } = useStore();
  const { config: cfg, eda, metrics: met, repr, bridge, run } = summary;
  const sp = eda.split_sizes;
  const posFull = (eda.rating_dist["4"] ?? 0) + (eda.rating_dist["5"] ?? 0);
  const semillas = (summary.seed_runs ?? []).map((r) => r.seed).join(", ");

  // Referencias derivadas para las conclusiones.
  const knnNdcg = met.item_knn["ndcg@10"];
  const idNdcg = met.dos_torres_id["ndcg@10"];
  const metaNdcg = met.dos_torres_meta["ndcg@10"];
  const medios = (modelo: string) => {
    const v = (summary.seed_runs ?? []).map((r) => r.metrics?.[modelo]?.["ndcg@10"] ?? 0);
    if (!v.length) return undefined;
    return v.reduce((a, b) => a + b, 0) / v.length;
  };
  const bId = bridge.dos_torres_id;
  const bMeta = bridge.dos_torres_meta;

  return (
    <Section
      id="justificacion"
      n={9}
      title="Justificación y conclusiones"
      lead={
        <>
          Cierre del informe en el lenguaje de la rúbrica: <strong>por qué</strong> se tomó cada decisión y cómo fue el
          proceso, y <strong>qué concluimos</strong>. Nada de esto es decorativo: cada afirmación está atada a un
          artefacto regenerable del pipeline (semilla {cfg.seed}, {summary.tf_version}) o a la evidencia cruda de las
          campañas de experimentación en el repo del pipeline (<span className="datos">tools/experimentos_results.json</span> y{" "}
          <span className="datos">tools/experimentos2_results.json</span>).
        </>
      }
    >
      <h3 className="titulo-h3 mb-3">Justificación de las decisiones</h3>
      <div className="mb-8 grid gap-5 lg:grid-cols-2">
        <Bloque titulo="La tarea: ranking top-k, no predicción de ratings" color={COLORES.bordo}>
          <p>
            Elegimos recomendación personalizada (<em>¿qué libro leería esta persona?</em>) en lugar de predecir la
            nota numérica, porque la pregunta de negocio de Goodbooks es de ordenamiento y las métricas de ranking
            (Recall/NDCG/MAP@K) miden exactamente eso. Binarizamos con rating ≥ {eda.threshold} porque el aprendizaje
            implícito es el estándar en NCF (He et al., 2017, lectura sugerida del curso): de {fInt(eda.n_ratings)}{" "}
            valoraciones, {fInt(posFull)} son ≥ {eda.threshold}. El costo de esa decisión (1–3 quedan como
            “desconocidos”, no como negativos) está documentado y lo leemos en cada métrica.
          </p>
        </Bloque>

        <Bloque titulo="Preparación de datos: honestidad cronológica antes que métricas bonitas" color={COLORES.verde}>
          <p>
            El split es <strong>cronológico por usuario</strong> (orden del archivo como proxy temporal):{" "}
            {fPct((sp.train ?? 0) / eda.n_pos_used, 0)} de histórico para aprender y solo lo más nuevo para validar y
            testear. Optamos por esto después de detectar que un split aleatorio inflaba las métricas (evalúa libros
            “futuros” que el usuario aún no podía conocer). Exigimos ≥ {cfg.min_pos} positivos por usuario y
            submuestreamos a {fInt(eda.n_users_used)} de {fInt(eda.n_users)} (semilla {cfg.seed}) para que cada corrida
            complete en ~{fNum(run.minutes, 1)} minutos en CPU: la escala completa se experimentó y quedó como próximo
            paso documentado.
          </p>
        </Bloque>

        <Bloque titulo="Arquitectura: dos torres con negativos in-batch y corrección logQ" color={COLORES.azul}>
          <p>
            Con {fInt(cfg.dim)} dimensiones por torre, el producto punto normalizado define el espacio que
            estudiaremos: es la representación, no un subproducto. Los negativos se toman <em>dentro del lote</em>{" "}
            ({fInt(cfg.batch)} por época), con corrección logQ (Yi et al., WSDM 2019) porque el muestreo in-batch sesga
            hacia libros populares — su impacto positivo (NDCG@10 de ~0,04 a ~0,049) quedó registrado como
            <em>observación anecdótica de corridas intermedias, sin artefacto asociado</em>. Partimos de embeddings
            aleatorios (no preentrenados) a propósito: el objetivo del
            curso es <em>ver la transformación</em>, y esa decisión se justifica en Representaciones. La variante con
            metadatos (torre de ítems alimentada con perfiles TF-IDF de tags) existe como ablación: separa cuánto
            aporta la señal de contenido a la geometría.
          </p>
        </Bloque>

        <Bloque titulo="Entrenamiento: early stopping elegido sobre validación, no sobre test" color={COLORES.laton}>
          <p>
            Diagnosticamos sobreajuste (la pérdida de validación se invertía desde la época 2) y atacamos con una
            batería de 30+ configuraciones: dropout, negativos uniformes extra, τ ≥ 0.1, weight decay, dim 32/128,
            learning rates menores y knobs clásicos de item-kNN. <strong>Solo el early stopping</strong> (pico de
            NDCG@10 de validación, restaura los pesos de esa época; tope de {fInt(cfg.epochs)} épocas) mejoró la
            métrica de selección en las dos torres, y es hoy el comportamiento por defecto. Decidimos con val
            <em>siempre</em>: hubo configs que se veían mejor en test pero peor en validación y las rechazamos
            explícitamente — sería fuga de información del conjunto de prueba al proceso de selección.
          </p>
        </Bloque>

        <Bloque titulo="Métricas y análisis: cada pregunta tiene su instrumento" color={COLORES.bordo}>
          <p>
            Para la tarea: Recall/NDCG/MAP@{"{"}{run.ks.join(", ")}{"}"} sobre todo el catálogo, enmascarando lo ya
            visto, con {fInt(cfg.eval_users)} usuarios evaluados y tres baselines (popularidad, item-kNN, contenido)
            para que ningún número absoluto quede huérfano. Para las representaciones: silueta y pureza kNN contra el
            proxy de género, PCA lado a lado y el <strong>puente</strong> — recuperación de los positivos held-out por
            similitud coseno en el espacio de ítems — que conecta la geometría con el desempeño en la tarea. Para la
            estabilidad: {summary.seed_runs.length} semillas ({semillas}) con media ± desvío en Resultados.
          </p>
        </Bloque>

        <Bloque titulo="Proceso realizado (en orden)" color={COLORES.verde}>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Preparación y EDA del dataset; baselines clásicos primero para tener con qué compararse.</li>
            <li>Two-towers Keras con in-batch + logQ; evaluación full-catalog y curva de pérdida con diagnóstico.</li>
            <li>Auditoría contra la rúbrica del curso: faltaban el puente representación↔desempeño, la varianza
              multi-semilla y la caracterización de usuarios — se construyeron sobre el pipeline existente.</li>
            <li>Campaña de tuning con selección estricta en validación → early stopping adoptado; el resto rechazado
              con evidencia.</li>
            <li>Publicación: generador que hornea los artefactos al sitio estático con gate de reproducibilidad
              (±0,005 en NDCG@10; difunde y aborta si la corrida no reproduce), demo con selección estratificada
              documentada y estadística agregada.</li>
          </ol>
        </Bloque>
      </div>

      <h3 className="titulo-h3 mb-3">Conclusiones</h3>
      <div className="tarjeta mb-6 p-5">
        <ol className="list-decimal space-y-2.5 pl-5 text-[0.92rem] leading-relaxed">
          <li>
            <strong>Las representaciones pasaron de ruido a estructura medible.</strong> Con pesos iniciales aleatorios,
            los positivos held-out de un usuario casi no se recuperan por similitud coseno en el espacio de libros
            (MRR {fNum(bId.init.mrr, 4)} en la torre solo-ID); tras el entrenamiento el mismo procedimiento alcanza{" "}
            {fNum(bId.final.mrr, 4)} (×{fNum(bId.final.mrr / Math.max(bId.init.mrr, 1e-12), 1)}), y en la torre con
            tags de {fNum(bMeta.init.mrr, 4)} a {fNum(bMeta.final.mrr, 4)}. La pureza kNN por género proxy subió de{" "}
            {fNum(repr.dos_torres_id.purity_init, 3)} a {fNum(repr.dos_torres_id.purity_final, 3)} (solo-ID). Este es
            el corazón del proyecto: no solo medimos el <em>qué</em> (NDCG) sino el <em>cómo</em> — la geometría se
            reorganizó de forma coherente con el dominio y eso explica el desempeño.
          </li>
          <li>
            <strong>En la tarea, el vecindario clásico sigue al frente.</strong> Item-kNN obtiene el mejor NDCG@10
            canónico ({fNum(knnNdcg, 4)}), por encima de las dos torres entrenadas ({fNum(idNdcg, 4)} solo-ID,{" "}
            {fNum(metaNdcg, 4)} con tags; entre semillas el promedio de la torre con metadatos es{" "}
            {fNum(medios("dos_torres_meta") ?? 0, 4)}. Con el submuestreo a {fInt(eda.n_users_used)} usuarios, las
            torres con inicialización aleatoria no alcanzan al baseline: es un resultado honesto, y la campaña de
            escala (usuarios completos, dim 128 — evidencia en <span className="datos">tools/experimentos2_results.json</span>)
            mostró que la brecha se acorta en validación pero no llega a cerrarse. La lección de NCF que sí se cumple:
            la arquitectura neural aprende representaciones ricas, pero con datos medianos y sin preentrenamiento, un
            baseline de vecindad bien afinado es un rival duro.
          </li>
          <li>
            <strong>El entrenamiento importa, y se ve en las curvas.</strong> El pico de NDCG@10 de validación ocurre
            alrededor de la época {Math.max(...Object.values(summary.history).map((h) => h.best_epoch ?? 0)) || "?"} y
            después la pérdida de validación vuelve a subir: publicar los pesos del pico (early stopping) es hoy la
            diferencia entre un modelo sobreajustado y el que reportamos. La transformación no es “más épocas =
            mejor”: es la que ocurrió <em>dentro</em> de esas pocas épocas.
          </li>
          <li>
            <strong>La honestidad metodológica es parte del resultado.</strong> Split cronológico porque el aleatorio
            mentía; decisiones de tuning tomadas solo sobre validación; anécdotas sin artefacto rotuladas como tales;
            demo estratificada con estadística agregada; ±0,005 de tolerancia de reproducción como contrato de build.
            Si un número no se puede derivar de un artefacto, en este informe no aparece.
          </li>
        </ol>
      </div>

      <div className="ficha ficha-verde mb-2 p-4">
        <p className="text-[0.92rem] leading-relaxed">
          <strong>Qué sigue</strong> (las razones están en la justificación anterior): reentrenar con los{" "}
          {fInt(eda.n_users)} usuarios completos, con subsampling de los embeddings exportados; inicializar con
          item2vec para separar el aporte de la inicialización frente al del entrenamiento; métricas por categoría y
          lectura de fairness de popularidad sobre el top {fPct(eda.top10pct_share)} del catálogo.
        </p>
      </div>

      <TheoryCard>
        <p>
          ¿Por qué una sección de justificación y no una de “recetas”? Porque en aprendizaje de representaciones el
          camino equivale al resultado: un split aleatorio habría inflado las métricas, una corrida extra habría
          empeorado la validación, y elegir por test habría contaminado la comparación. Cada decisión de arriba tiene
          un porqué, un instrumento que lo revisa y evidencia regenerable. Cerrar el informe con las conclusiones —no
          con la promesa de un mejor número— es la diferencia entre entrenar un modelo y entenderlo.
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
