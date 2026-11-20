import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import Section from "../components/Section";
import Tabs from "../components/Tabs";
import Carousel from "../components/Carousel";
import BookCover from "../components/BookCover";
import TheoryCard from "../components/TheoryCard";
import Metric from "../components/Metric";
import { loadPca, useStore, type PcaPointLite } from "../lib/store";
import { COLOR_MODELO, COLOR_TORRE, colorGenero, fInt, fNum } from "../lib/paleta";
import { GRID, TINTA, leyendaTexto, tooltipContenido } from "../lib/chartTheme";

type Modelo = "dos_torres_id" | "dos_torres_meta";

export default function Representations() {
  const { summary, genres, neighbors } = useStore();
  const [m, setM] = useState<Modelo>("dos_torres_meta");
  const [ng, setNg] = useState(8);
  const [pts, setPts] = useState<Record<"init" | "final", PcaPointLite[]> | null>(null);

  useEffect(() => {
    let vivo = true;
    setPts(null);
    Promise.all([loadPca(m, "init"), loadPca(m, "final")]).then(([a, b]) => {
      if (vivo) setPts({ init: a, final: b });
    });
    return () => {
      vivo = false;
    };
  }, [m]);

  const r = summary.repr[m];
  const ngDiferido = useDeferredValue(ng);
  const generosDisponibles = useMemo(() => genres.order.filter((g) => g !== "otro").length, [genres]);
  const topg = useMemo(
    () => genres.order.filter((g) => g !== "otro").slice(0, Math.min(ngDiferido, generosDisponibles)),
    [genres, ngDiferido, generosDisponibles],
  );

  const grupos = useMemo(() => {
    if (!pts) return null;
    const agrupar = (arr: PcaPointLite[]) => {
      const m = new Map<string, { x: number; y: number }[]>();
      for (const p of arr) {
        let bucket = m.get(p.g);
        if (!bucket) {
          bucket = [];
          m.set(p.g, bucket);
        }
        bucket.push({ x: p.x, y: p.y });
      }
      return m;
    };
    return { init: agrupar(pts.init), final: agrupar(pts.final) };
  }, [pts]);

  const series = useMemo(() => {
    if (!grupos) return null;
    const porGenero = (pref: "init" | "final") =>
      topg.map((g) => ({ g, pref, datos: grupos[pref].get(g) ?? [] }));
    return { init: porGenero("init"), final: porGenero("final") };
  }, [grupos, topg]);

  return (
    <Section
      id="representaciones"
      n={7}
      title="Representaciones: antes vs. después de entrenar"
      lead={
        <>
          <strong>“Inicial”</strong> = salida de la torre de libros con pesos aleatorios (sin entrenar).{" "}
          <strong>“Final”</strong> = tras entrenar. Si el entrenamiento funcionó, libros del mismo género deberían
          quedar más cerca entre sí, <strong>aunque nunca le dimos el género al modelo</strong>.
        </>
      }
    >
      <div className="mb-6">
        <Tabs
          value={m}
          onChange={setM}
          dotColor={(v) => COLOR_TORRE[v]}
          options={[
            { value: "dos_torres_id", label: "Dos torres (solo ID)" },
            { value: "dos_torres_meta", label: "Dos torres (ID + tags)" },
          ]}
        />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Silhouette inicial" value={fNum(r.silhouette_init, 3)} accent={COLOR_MODELO[m]} />
        <Metric
          label="Silhouette final"
          value={fNum(r.silhouette_final, 3)}
          delta={`${(r.silhouette_final - r.silhouette_init >= 0 ? "+" : "−") + fNum(Math.abs(r.silhouette_final - r.silhouette_init), 3)}`}
          deltaGood={r.silhouette_final >= r.silhouette_init}
          accent={COLOR_MODELO[m]}
        />
        <Metric label="Pureza kNN@10 inicial" value={fNum(r.purity_init, 3)} accent="#b08d57" />
        <Metric
          label="Pureza kNN@10 final"
          value={fNum(r.purity_final, 3)}
          delta={`${(r.purity_final - r.purity_init >= 0 ? "+" : "−") + fNum(Math.abs(r.purity_final - r.purity_init), 3)}`}
          deltaGood={r.purity_final >= r.purity_init}
          accent="#b08d57"
        />
      </div>
      <p className="-mt-4 mb-8 text-[0.82rem] leading-relaxed text-gris">
        <strong>Silhouette</strong> (coseno, usando género): cerca de 1 = grupos bien separados; ~0 = mezclados.{" "}
        <strong>Pureza kNN@10</strong>: promedio de vecinos (entre los 10 más cercanos) que comparten género con el
        libro.
      </p>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
        <h3 className="titulo-h3">Proyección PCA del espacio de libros</h3>
        <label className="flex items-center gap-3">
          <span className="text-[0.84rem] text-gris">Géneros a mostrar</span>
          <input
            type="range"
            min={2}
            max={generosDisponibles}
            step={1}
            value={Math.min(ng, generosDisponibles)}
            onChange={(e) => setNg(Number(e.target.value))}
            className="w-56 accent-bordo"
            aria-label="Cantidad de géneros a mostrar"
          />
          <span className="datos w-8 text-[0.9rem] font-bold text-nogal">{ng}</span>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {(["init", "final"] as const).map((tag) => (
          <div key={tag} className="tarjeta p-4">
            <h4 className="mb-2 text-[0.95rem] font-bold" style={{ color: tag === "init" ? TINTA : COLOR_TORRE[m] }}>
              {tag === "init" ? "Inicial (sin entrenar)" : "Final (entrenado)"}
            </h4>
            <div style={{ height: 380 }}>
              {series ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 4, right: 4, left: -14, bottom: 4 }}>
                    <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="x" name="PC1" tick={false} axisLine={{ stroke: "#8a5a3b" }} />
                    <YAxis type="number" dataKey="y" name="PC2" tick={false} axisLine={{ stroke: "#8a5a3b" }} />
                    <ZAxis range={[26, 26]} />
                    <Tooltip
                      contentStyle={tooltipContenido}
                      content={({ payload }) => {
                        const p = payload?.[0]?.payload as { g?: string } | undefined;
                        if (!p?.g) return null;
                        return (
                          <div style={tooltipContenido} className="rounded px-2.5 py-1.5 text-[0.8rem]">
                            <strong>{p.g}</strong>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ ...leyendaTexto, fontSize: "0.72rem" }} />
                    {series[tag].map((s) => (
                      <Scatter key={`${tag}-${s.g}`} name={s.g} data={s.datos} fill={colorGenero(s.g, genres.order)} fillOpacity={0.72} />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-[0.82rem] text-gris">Cargando proyección…</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h3 className="titulo-h3 mb-1">Vecinos más cercanos de un libro</h3>
        <p className="mb-4 text-[0.85rem] text-gris">
          Cada tarjeta compara los 10 libros más parecidos <strong>antes</strong> y <strong>después</strong> de entrenar,
          sobre el top {fInt(neighbors.pool.length)} del catálogo por número de valoraciones.
        </p>
        {!pts ? (
          <div className="tarjeta p-6 text-[0.85rem] text-gris">Calculando vecinos…</div>
        ) : (
          <Carousel label="Carrusel de vecinos antes y despues">
            {neighbors.pool.slice(0, 40).map((i) => (
              <Vecinos key={`${m}-${i}`} idx={i} m={m} />
            ))}
          </Carousel>
        )}
      </div>

      <TheoryCard>
        <p className="mb-2">
          <strong>¿De dónde sale la representación “inicial”?</strong> Las dos torres arrancan con la inicialización
          aleatoria por defecto de Keras para las capas de embedding: una distribución uniforme aproximada en [−0.05,
          0.05] por dimensión. No hay nada preentrenado detrás: el punto de partida es ruido puro y todo lo que
          organiza el espacio proviene del entrenamiento con este dataset. Elegimos{" "}
          <strong>entrenar desde cero</strong> y no partir de embeddings preentrenados (item2vec sobre co-ocurrencias,
          word2vec sobre texto, inicializaciones tipo NCF) por tres razones: el dataset es mediano y sin corpus de
          texto real del cual transferir —solo tags—; un init preentrenado llegaría con estructura ya formada y
          <em> ocultaría</em> justamente lo que el curso pide observar, es decir, <strong>la transformación</strong> de
          la representación durante el entrenamiento; y así el “antes vs. después” es atribuible por completo a
          nuestro pipeline. Usar embeddings preentrenados como init es una alternativa legítima que queda registrada
          como próximo paso en <a href="#dificultades" className="font-semibold text-bordo underline decoration-laton">Dificultades</a>.
        </p>
        <p className="mt-2 mb-2">
          <strong>¿Qué es PCA aquí?</strong> Los vectores viven en {summary.config.dim} dimensiones. PCA es una transformación lineal que
          busca las 2 direcciones donde los datos varían más y proyecta todo sobre ellas: una “sombra” de 2D que
          conserva lo esencial de la estructura. Que dos libros se toquen en la sombra no prueba que sean idénticos,
          pero que se separen sí es evidencia de organización.
        </p>
        <p className="mt-2">
          <strong>Silhouette</strong> pregunta: tomando el género como etiqueta, ¿cada libro está más cerca del centro
          de su propio grupo que del de otro? 0.6 es “grupos claros”, 0 es “mezclado”, negativo es “los grupos están
          intercambiados”. En solo-ID pasamos de un valor casi nulo a uno positivo pequeño: el entrenamiento organizó
          el espacio, pero no convirtió el género en la única dimensión.
        </p>
        <p className="mt-2">
          <strong>Pureza kNN@10</strong> es la prueba local: de los 10 vecinos más cercanos, ¿cuántos comparten género?
          Con pesos aleatorios, la respuesta es lo que daría el azar (la frecuencia del género más común). Con el
          espacio entrenado, sube muchísimo. Es la métrica que mejor refleja lo que buscaba el curso: que la
          representación cambie de estructura sin habérselo pedido.
        </p>
        {m === "dos_torres_meta" && (
          <p className="mt-2">
            En esta versión la representación inicial <strong>ya trae información</strong>: los tags entran por una capa
            aleatoria que conserva parte de su estructura, por eso la pureza inicial no parte del azar. Compara con el
            modelo solo-ID para ver qué aporta el entrenamiento por sí solo.
          </p>
        )}
      </TheoryCard>
    </Section>
  );
}

function Vecinos({ idx, m }: { idx: number; m: string }) {
  const { books, neighbors } = useStore();
  const b = books[idx];
  const antes = neighbors.nn[`${m}_init`][String(idx)] ?? [];
  const despues = neighbors.nn[`${m}_final`][String(idx)] ?? [];
  const mismoGenero = (l: number[]) => {
    if (b.g === "otro") return null;
    return l.filter((j) => books[j]?.g === b.g).length;
  };
  const ga = mismoGenero(antes);
  const gd = mismoGenero(despues);

  return (
    <div className="tarjeta p-3" style={{ width: 258 }}>
      <BookCover idx={idx} w={72} h={106} showMeta={false} />
      <div className="mt-2 leading-tight">
        <div className="text-[0.78rem] font-bold text-nogal" title={b.t}>
          {b.t.length > 36 ? b.t.slice(0, 35) + "…" : b.t}
        </div>
        <div className="text-[0.7rem] text-gris">{b.g}</div>
      </div>

      <Fila etiqueta="Antes" n={ga} color="#5a4a3c" items={antes.slice(0, 5)} />
      <Fila etiqueta="Después" n={gd} color="#1f4b3a" items={despues.slice(0, 5)} />
      {ga !== null && gd !== null && gd > ga && (
        <div className="datos mt-1 text-[0.68rem] font-bold text-verde">+{gd - ga} vecinos del mismo género</div>
      )}
    </div>
  );
}

function Fila({ etiqueta, n, color, items }: { etiqueta: string; n: number | null; color: string; items: number[] }) {
  const { books } = useStore();
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <span className="datos text-[0.65rem] font-bold uppercase tracking-wider" style={{ color }}>
          {etiqueta}
        </span>
        {n !== null && (
          <span className="datos text-[0.65rem] text-gris">
            {n}/5 mismo género
          </span>
        )}
      </div>
      <ul className="mt-0.5 space-y-0.5">
        {items.map((j) => (
          <li key={j} className="truncate text-[0.7rem] text-tinta/80" title={books[j]?.t}>
            · {books[j]?.t ?? "?"}
          </li>
        ))}
      </ul>
    </div>
  );
}
