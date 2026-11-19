import { useState } from "react";
import Section from "../components/Section";
import TheoryCard from "../components/TheoryCard";
import md from "../lib/md";
import { AJUSTES, DIFICULTADES, type Item } from "../lib/textos";
import { CHECKLIST } from "../lib/textos";

export default function Challenges() {
  return (
    <Section
      id="dificultades"
      n={9}
      title="Dificultades y ajustes al plan"
      lead={
        <>
          Ninguna de estas decisiones estaba en la propuesta original. Aparecieron al chocar con el dataset real y con
          el feedback del curso, y cada una cambió números o arquitectura.
        </>
      }
    >
      <div className="mb-10">
        <h3 className="titulo-h3 mb-4">Checklist del entregable 2</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {CHECKLIST.map((c) => (
            <a key={c.requisito} href={c.href} className="ficha ficha-verde block p-3.5 transition hover:-translate-y-0.5">
              <div className="flex items-start gap-2.5">
                <Check />
                <div>
                  <div className="text-[0.9rem] font-semibold leading-snug text-nogal">{c.requisito}</div>
                  <div className="mt-0.5 text-[0.78rem] text-gris">Ver: {c.donde}</div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Bloque
          titulo="Dificultades encontradas"
          items={DIFICULTADES}
          color="#7a2e2e"
          teoria={
            <p>
              El patrón común: <strong>el dataset no es como uno lo imagina</strong>. No hay fechas (usamos el orden de
              filas como proxy, con el supuesto documentado), no hay género (lo reconstruimos desde tags), no escala de
              golpe (subsampleamos), y la cola larga hace que “lo popular” sea un rival durísimo. Ninguna dificultad se
              resolvió con maña: cada una cambió una decisión metodológica visible en los resultados.
            </p>
          }
        />
        <Bloque
          titulo="Ajustes al plan original"
          items={AJUSTES}
          color="#1f4b3a"
          teoria={
            <p>
              Un <strong>baseline</strong> es el punto de referencia barato que un modelo complejo debe superar (aquí:
              popularidad, item-kNN, contenido). Un <strong>proxy</strong> es una sustitución razonable cuando no existe
              la variable real (el orden de filas reemplaza a las fechas; el tag más frecuente reemplaza al género). El
              <em> logQ correction</em> merece nombre propio: en el entrenamiento con negativos in-batch los negativos
              salen de la distribución de popularidad, así que un libro famoso aparece como negativo muchísimas veces y
              el modelo lo castiga de más. Restar log Q(j) compensa esa frecuencia y evita que el NDCG@10 se quede a
              mitad de camino.
            </p>
          }
        />
      </div>

      <TheoryCard title="Cómo leer esta sección">
        <p>
          Presentar dificultades no es “contar problemas”: es la evidencia de que el pipeline se corrió de verdad. Cada
          ajuste tiene un efecto medible (el logQ movió el NDCG@10 de las torres de ~0.024 a ~0.049), y cada dificultad
          dejó una salvedad que sigue visible en el resto del sitio (el split cronológico, el género excluido de las
          features, la evaluación sobre muestra).
        </p>
      </TheoryCard>
    </Section>
  );
}

function Bloque({
  titulo,
  items,
  color,
  teoria,
}: {
  titulo: string;
  items: Item[];
  color: string;
  teoria: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(0);
  return (
    <div>
      <h3 className="titulo-h3 mb-3 flex items-center gap-2.5">
        <span className="inline-block h-3.5 w-1 rounded-full" style={{ background: color }} />
        {titulo}
      </h3>
      <div className="flex flex-col gap-2.5">
        {items.map((it, i) => (
          <div key={it.t} className="tarjeta overflow-hidden" style={{ borderLeft: `5px solid ${i === abierto ? color : "var(--color-arena)"}` }}>
            <button
              type="button"
              onClick={() => setAbierto(i === abierto ? -1 : i)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              aria-expanded={i === abierto}
            >
              <span className="text-[0.94rem] font-semibold text-nogal">{md(it.t)}</span>
              <span
                className="shrink-0 text-[0.78rem] transition-transform"
                style={{ transform: i === abierto ? "rotate(180deg)" : "none", color }}
                aria-hidden
              >
                ▼
              </span>
            </button>
            {i === abierto && (
              <div className="px-4 pb-3.5 text-[0.92rem] leading-relaxed text-tinta/90 aparece">{md(it.x)}</div>
            )}
          </div>
        ))}
      </div>
      <TheoryCard>{teoria}</TheoryCard>
    </div>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1f4b3a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
