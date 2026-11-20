import Section from "../components/Section";
import FlowDiagram, { type Arista, type Nodo } from "../components/FlowDiagram";
import TheoryCard from "../components/TheoryCard";
import { useStore } from "../lib/store";
import { fInt, fNum } from "../lib/paleta";

const NODOS: Nodo[] = [
  { id: "A", label: "ratings + books\n+ tags", x: 10, y: 66, w: 122, sub: "4 archivos CSV" },
  { id: "B", label: "Limpieza\ny positivos (≥4)", x: 172, y: 66, w: 130 },
  { id: "C", label: "Split cronológico\npor usuario", x: 342, y: 66, w: 140, sub: "69 / 10 / 20 %" },
  { id: "D", label: "Baselines\npop · item-kNN · contenido", x: 522, y: 8, w: 160 },
  { id: "E", label: "Dos torres\nID  /  ID+tags", x: 522, y: 122, w: 160, fill: "#efe4cf" },
  { id: "F", label: "Embeddings\ninicial vs final", x: 722, y: 180, w: 130 },
  { id: "G", label: "Evaluación\nRecall · NDCG · MAP", x: 722, y: 8, w: 150 },
  { id: "H", label: "PCA · kNN\nsilhouette", x: 722, y: 90, w: 130 },
];

const ARISTAS: Arista[] = [
  { from: "A", to: "B" },
  { from: "B", to: "C" },
  { from: "C", to: "D" },
  { from: "C", to: "E" },
  { from: "D", to: "G" },
  { from: "E", to: "G" },
  { from: "E", to: "F" },
  { from: "F", to: "H", label: "antes / después" },
];

const CONFIG_KEYS: { k: string; label: string; fmt?: (v: unknown) => string }[] = [
  { k: "thr", label: "Umbral de interacción positiva" },
  { k: "min_pos", label: "Mínimo de positivos por usuario" },
  { k: "max_users", label: "Subconjunto de usuarios" },
  { k: "eval_users", label: "Usuarios evaluados" },
  { k: "dim", label: "Dimensión del embedding" },
  { k: "epochs", label: "Épocas" },
  { k: "batch", label: "Tamaño de lote" },
  { k: "tau", label: "Temperatura τ", fmt: (v) => fNum(Number(v), 2) },
  { k: "logq", label: "Corrección logQ", fmt: (v) => (Number(v) ? "Sí (activada)" : "No") },
  { k: "seed", label: "Semilla (reproducibilidad)" },
];

export default function PipelineSec() {
  const { summary } = useStore();
  const { config, eda, run } = summary;
  const semillas = (config.seeds ?? (summary.seed_runs ?? []).map((r) => r.seed)).join(", ");

  return (
    <Section
      id="pipeline"
      n={3}
      title="Pipeline inicial"
      lead={
        <>
          Todo el flujo corre en <strong>un solo script</strong> (<code className="datos text-[0.85em] text-bordo">pipeline.py</code>) y
          termina en {run.minutes} minutos sobre el subconjunto de {fInt(eda.n_users_used)} usuarios. Cada artefacto del
          sitio sale de ahí, sin pasos intermedios manuales.
        </>
      }
    >
      <FlowDiagram nodos={NODOS} aristas={ARISTAS} alto={250} />

      <TheoryCard>
        <p>
          Un <strong>pipeline</strong> es la cadena ordenada que convierte datos crudos en resultados: si un paso cambia,
          todo lo que sigue se vuelve a calcular. Así se evita el clásico “funcionaba en mi notebook”.
        </p>
        <p className="mt-2">
          Aquí la cadena hace tres cosas: (1) deja solo las interacciones <em>positivas</em> (rating ≥ {config.thr}) porque
          queremos recuperar lecturas que gustaron, no todo registro; (2) corta el tiempo de cada lector en train/val/test
          de forma cronológica; (3) entrena y evalúa todos los modelos en una pasada, y guarda números y vectores en
          <code className="datos text-[0.85em]"> artifacts/</code> para que la web solo tenga que leerlos.
        </p>
        <p className="mt-2">
          Que el pipeline corra completo en ~1 minuto es <em>parte del diseño</em>: permite experimentar rápido. El
          modo <code className="datos text-[0.85em]">--max_users 0</code> deja correr con los {fInt(eda.n_users)} usuarios cuando
          ya se validó la idea.
        </p>
        <p className="mt-2">
          Las dos torres parten de la <strong>inicialización aleatoria por defecto de Keras</strong> para los embeddings
          (uniforme ~[−0.05, 0.05]) y se entrenan <strong>desde cero</strong>, sin init preentrenado: el dataset es
          mediano y no trae corpus de texto del que transferir, y el objetivo del curso es ver la transformación de las
          representaciones — que llega limpia cuando el punto de partida es ruido. La justificación completa está en{" "}
          <a href="#representaciones" className="font-semibold text-bordo underline decoration-laton">Representaciones</a>.
        </p>
      </TheoryCard>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="tarjeta p-5">
          <h3 className="titulo-h3 mb-3">Configuración usada (exacta de <span className="datos">results.json</span>)</h3>
          <table className="biblio">
            <thead>
              <tr><th>Parámetro</th><th>Valor</th></tr>
            </thead>
            <tbody>
              {CONFIG_KEYS.map(({ k, label, fmt }) => (
                <tr key={k}>
                  <td>{label}</td>
                  <td className="datos font-semibold text-nogal">
                    {fmt ? fmt((config as unknown as Record<string, unknown>)[k]) : String((config as unknown as Record<string, unknown>)[k])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="datos rounded-full border border-laton bg-papel2 px-3 py-1 text-[0.75rem] font-semibold text-cuero">
              TensorFlow {summary.tf_version}
            </span>
            <span className="datos rounded-full border border-laton bg-papel2 px-3 py-1 text-[0.75rem] font-semibold text-cuero">
              Semillas del multi-run: {semillas}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="ficha p-4">
            <p className="text-[0.92rem] leading-relaxed">
              <strong>Modelo principal: dos torres.</strong> La torre de usuario convierte un ID en un vector; la de
              libro convierte un ID (y en la versión 2, también sus tags) en otro vector. Ambos se normalizan y se
              comparan con producto punto. Se entrena con <strong>softmax y negativos in-batch</strong>.
            </p>
          </div>
          <div className="ficha ficha-verde p-4">
            <p className="text-[0.92rem] leading-relaxed">
              Los detalles de capas están en <a href="#arquitectura" className="font-semibold text-verde underline decoration-laton">Arquitectura</a>,
              el entrenamiento en <a href="#curvas" className="font-semibold text-verde underline decoration-laton">Curvas</a> y el
              análisis de vectores en <a href="#representaciones" className="font-semibold text-verde underline decoration-laton">Representaciones</a>.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
