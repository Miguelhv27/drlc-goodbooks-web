import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Section from "../components/Section";
import TheoryCard from "../components/TheoryCard";
import Carousel from "../components/Carousel";
import BookCover from "../components/BookCover";
import { useStore } from "../lib/store";
import { fInt, fPct } from "../lib/paleta";
import { BORDO, GRID, LATON, TINTA, VERDE, leyendaTexto, tick, tooltipContenido } from "../lib/chartTheme";

export default function Dataset() {
  const { summary, genres, books, popular } = useStore();
  const eda = summary.eda;

  const ratings = Object.entries(eda.rating_dist).map(([r, c]) => ({ r: `${r}★`, c }));
  const hist = eda.user_hist.map((c, i) => ({ x: `${i * 5}`, c }));
  const longtail = eda.longtail_curve.map((v, i) => ({ pct: i + 1, acum: +(v * 100).toFixed(2) }));
  const genreBars = useMemo(
    () => genres.order.filter((g) => g !== "otro").map((g) => ({ g, n: genres.counts[g] })),
    [genres],
  );
  const sp = eda.split_sizes;

  return (
    <Section
      id="dataset"
      n={2}
      title="Dataset preparado"
      lead={
        <>
          Goodbooks-10k completo: <strong>{fInt(eda.n_ratings)}</strong> calificaciones de <strong>{fInt(eda.n_users)}</strong>{" "}
          usuarios sobre <strong>{fInt(eda.n_books)}</strong> libros. Solo el{" "}
          <strong>{fPct(1 - eda.sparsity, 2)}</strong> de las combinaciones usuario–libro tiene calificación: la matriz
          es <em>muy</em> dispersa, por eso un modelo de embeddings tiene sentido.
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Grafico titulo="Distribución de calificaciones" alto={280}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={ratings} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid {...{ stroke: GRID }} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="r" tick={tick} tickLine={{ stroke: "#8a5a3b" }} axisLine={{ stroke: "#8a5a3b" }} />
              <YAxis tick={tick} tickLine={{ stroke: "#8a5a3b" }} axisLine={{ stroke: "#8a5a3b" }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
              <Tooltip contentStyle={tooltipContenido} formatter={(v) => [fInt(Number(v)), "calificaciones"]} />
              <Bar dataKey="c" fill={BORDO} radius={[2, 2, 0, 0]} />
              <ReferenceLine y={eda.n_ratings / 5} stroke={LATON} strokeDasharray="5 4" label={{ value: "uniforme", fill: TINTA, fontSize: 10, position: "insideTopRight" }} />
            </ComposedChart>
          </ResponsiveContainer>
          <Nota>
            Las calificaciones altas dominan. Tomamos como <strong>interacción positiva</strong> rating ≥ {eda.threshold}.
          </Nota>
        </Grafico>

        <Grafico titulo="Calificaciones por usuario" alto={280}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={hist} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="x" tick={tick} tickLine={{ stroke: "#8a5a3b" }} axisLine={{ stroke: "#8a5a3b" }} interval={4} />
              <YAxis tick={tick} tickLine={{ stroke: "#8a5a3b" }} axisLine={{ stroke: "#8a5a3b" }} />
              <Tooltip contentStyle={tooltipContenido} formatter={(v) => [fInt(Number(v)), "usuarios"]} labelFormatter={(l) => `~${l} calificaciones`} />
              <Bar dataKey="c" fill={VERDE} radius={[2, 2, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
          <Nota>
            Mediana: <strong>{Math.round(eda.user_median)}</strong> calificaciones · percentil 90:{" "}
            <strong>{Math.round(eda.user_p90)}</strong>. Hay muchísimos usuarios con pocas notas (eje X topeado en 200).
          </Nota>
        </Grafico>

        <Grafico titulo="Long tail de libros (popularidad)" alto={280}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={longtail} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
              <XAxis dataKey="pct" tick={tick} tickLine={{ stroke: "#8a5a3b" }} axisLine={{ stroke: "#8a5a3b" }} tickFormatter={(v) => `${v}%`} />
              <YAxis tick={tick} tickLine={{ stroke: "#8a5a3b" }} axisLine={{ stroke: "#8a5a3b" }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <Tooltip contentStyle={tooltipContenido} formatter={(v) => [`${v}%`, "% acumulado de calificaciones"]} labelFormatter={(l) => `top ${l}% de libros`} />
              <ReferenceLine x={10} stroke={LATON} strokeDasharray="5 4" />
              <Line type="monotone" dataKey="acum" stroke={BORDO} strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <Nota>
            El <strong>10% de libros más populares concentra el {fPct(eda.top10pct_share)}</strong> de las calificaciones →
            sesgo estructural hacia lo popular: el baseline de popularidad es difícil de superar.
          </Nota>
        </Grafico>

        <Grafico titulo="Géneros (proxy desde tags)" alto={280}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={genreBars} layout="vertical" margin={{ top: 4, right: 8, left: 28, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={tick} tickLine={{ stroke: "#8a5a3b" }} axisLine={{ stroke: "#8a5a3b" }} />
              <YAxis type="category" dataKey="g" width={110} tick={{ ...tick, fontSize: 10.5 }} tickLine={{ stroke: "#8a5a3b" }} axisLine={{ stroke: "#8a5a3b" }} />
              <Tooltip contentStyle={tooltipContenido} formatter={(v) => [fInt(Number(v)), "libros"]} />
              <Bar dataKey="n" fill={LATON} radius={[0, 2, 2, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
          <Nota>
            Usado solo como <strong>referencia visual</strong> para analizar los embeddings; <em>no</em> entra como
            entrada del modelo (y se excluyó de las features de contenido para evitar fuga).
          </Nota>
        </Grafico>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="min-w-0">
          <h3 className="titulo-h3 mb-3">Preparación aplicada</h3>
          <div className="overflow-x-auto">
          <table className="biblio">
            <thead>
              <tr><th>Paso</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              <tr><td className="whitespace-nowrap font-semibold">Interacción positiva</td><td>rating ≥ {eda.threshold}</td></tr>
              <tr>
                <td className="font-semibold">Filtro de usuarios</td>
                <td>
                  ≥ {summary.config.min_pos} positivos por usuario; subconjunto de {fInt(eda.n_users_used)} usuarios
                </td>
              </tr>
              <tr>
                <td className="font-semibold">Split</td>
                <td>
                  Cronológico por usuario (proxy: orden de filas del archivo) → train {fInt(sp.train ?? 0)} · val{" "}
                  {fInt(sp.val ?? 0)} · test {fInt(sp.test ?? 0)}
                </td>
              </tr>
              <tr><td className="font-semibold">Exclusión</td><td>Al recomendar se excluyen libros ya vistos (train + val)</td></tr>
              <tr><td className="font-semibold">Features de contenido</td><td>TF-IDF de los 500 tags más frecuentes (sin tags ruidosos ni de género)</td></tr>
            </tbody>
          </table>
          </div>
        </div>

        <div className="min-w-0">
          <h3 className="titulo-h3 mb-3">El catálogo, en el estante</h3>
          <div className="tarjeta p-4">
            <Carousel label="Carrusel de muestra del catálogo">
              {popular.slice(24, 48).map((p) => (
                <BookCover key={p.i} idx={p.i} w={92} h={138} showMeta={false} />
              ))}
            </Carousel>
            <p className="text-[0.74rem] italic text-gris">
              Muestra del catálogo ordenada por número de valoraciones · {fInt(books.length)} libros disponibles con
              autor, año, género proxy y portada cuando Open Library la tiene.
            </p>
          </div>
        </div>
      </div>

      <TheoryCard>
        <p className="mb-2">
          <strong>¿Por qué “solo” rating ≥ 4 cuenta como positivo?</strong> Porque el objetivo es recuperar lecturas que
          <em> gustaron</em>, no registrar todo contacto. Un 3 es ambiguo; un 1–2 dice “no lo recomendaría”. Con ese filtro
          pasamos de {fInt(eda.n_ratings)} valoraciones a {fInt(eda.n_pos_used)} señales limpias.
        </p>
        <p className="mb-2 mt-3">
          <strong>Split cronológico en vez de aleatorio:</strong> si cortáramos al azar, el modelo podría “adivinar” un
          libro que el usuario leyó antes a partir de libros que leyó después (fuga de futuro). Al separar por tiempo —
          lo antiguo a train, lo reciente a test — se evalúa lo que de verdad importa: dado el historial, ¿acertamos qué
          leerá a continuación?
        </p>
        <p className="mb-2 mt-3">
          <strong>Dispersidad:</strong> la matriz usuario×libro tiene {fPct(eda.sparsity)} de huecos. Ningún método
          puede llenar eso con promedios; el trabajo real es aprender una <em>función</em> (los embeddings) que
          generalize de 1,1% de observaciones al 98,9% restante.
        </p>
        <p className="mt-3">
          <strong>Género proxy:</strong> Goodbooks no trae géneros, trae tags de usuarios. Asignamos a cada libro su tag
          de género más frecuente (fantasy, romance, mystery…). Es imperfecto pero suficiente como <em>referencia
          externa</em> para juzgar si el entrenamiento organizó el espacio de libros.
        </p>
      </TheoryCard>
    </Section>
  );
}

function Grafico({ titulo, alto, children }: { titulo: string; alto: number; children: React.ReactNode }) {
  return (
    <div className="tarjeta p-4">
      <h3 className="titulo-h3 mb-2 text-[1.0rem]">{titulo}</h3>
      <div style={{ height: alto }}>{children}</div>
    </div>
  );
}

function Nota({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[0.8rem] leading-relaxed text-gris" style={{ fontFamily: leyendaTexto.fontFamily }}>{children}</p>;
}
