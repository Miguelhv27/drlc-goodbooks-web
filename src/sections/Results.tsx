import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Section from "../components/Section";
import Tabs from "../components/Tabs";
import TheoryCard from "../components/TheoryCard";
import Metric from "../components/Metric";
import { useStore } from "../lib/store";
import { COLOR_MODELO, fDelta, fInt, fNum } from "../lib/paleta";
import { GRID, leyendaTexto, tick, tooltipContenido } from "../lib/chartTheme";

const FAM_LABEL: Record<string, string> = { recall: "Recall@k", ndcg: "NDCG@k", map: "MAP@k" };
const ORDEN_FAM = ["recall", "ndcg", "map"];

type Fam = "recall" | "ndcg" | "map";

export default function Results() {
  const { summary } = useStore();
  const met = summary.metrics;
  const names = summary.run.model_names;
  const ks = summary.run.ks;
  const modelos = useMemo(() => Object.keys(met).filter((m) => met[m]["ndcg@10"] !== undefined), [met]);
  const cols = useMemo(
    () => Object.keys(met[modelos[0]]).sort((a, b) => {
      const [fa, ka] = a.split("@");
      const [fb, kb] = b.split("@");
      return ORDEN_FAM.indexOf(fa) - ORDEN_FAM.indexOf(fb) || Number(ka) - Number(kb);
    }),
    [met, modelos],
  );
  const fams = useMemo(() => [...new Set(cols.map((c) => c.split("@")[0]))] as Fam[], [cols]);
  const key = cols.includes("ndcg@10") ? "ndcg@10" : cols[0];
  const [fam, setFam] = useState<Fam>("ndcg");

  const popn = "popularidad";
  const best = modelos.reduce((a, b) => (met[a][key] >= met[b][key] ? a : b));
  const kref = ks.includes(10) ? 10 : ks[0];

  const filas = useMemo(
    () =>
      modelos.map((m) => {
        const row: Record<string, number | string> = { modelo: names[m] };
        for (const c of cols) row[c] = met[m][c];
        return row;
      }),
    [modelos, cols, met, names],
  );
  const maxPorCol = useMemo(() => {
    const mx: Record<string, number> = {};
    for (const c of cols) mx[c] = Math.max(...modelos.map((m) => met[m][c]));
    return mx;
  }, [cols, modelos, met]);

  const grafico = useMemo(
    () =>
      ks.map((k) => {
        const row: Record<string, number | string> = { k: `k=${k}` };
        for (const m of modelos) row[names[m]] = met[m][`${fam}@${k}`];
        return row;
      }),
    [ks, modelos, met, fam, names],
  );

  // interpretacion automatica (misma logica que app.py)
  const bases = ["popularidad", "item_knn", "contenido"].filter((m) => modelos.includes(m));
  const dos = ["dos_torres_id", "dos_torres_meta"].filter((m) => modelos.includes(m));
  const bb = bases.reduce((a, b) => (met[a][key] >= met[b][key] ? a : b));
  const bt = dos.reduce((a, b) => (met[a][key] >= met[b][key] ? a : b));
  const vsBase = (met[bt][key] / met[bb][key] - 1) * 100;
  const vsPop = (met[bt][key] / met[popn][key] - 1) * 100;
  const dif = (met["dos_torres_meta"][key] / met["dos_torres_id"][key] - 1) * 100;

  return (
    <Section
      id="resultados"
      n={6}
      title="Resultados preliminares"
      lead={
        <>
          EvaluaciÃ³n sobre <strong>{fInt(summary.run.n_eval_users)}</strong> usuarios con libros en test, ordenando los{" "}
          <strong>{fInt(summary.eda.n_books)}</strong> libros del catÃ¡logo y excluyendo los ya vistos (train + validaciÃ³n).
          Importa mÃ¡s la <strong>comparaciÃ³n entre modelos</strong> que el valor absoluto: se compite contra 10.000
          candidatos con un futuro deliberadamente oculto.
        </>
      }
    >
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {fams.map((f) => {
          const nombre = `${f}@${kref}`;
          const v = met[best][nombre];
          const d = met[popn][nombre] ? (v / met[popn][nombre] - 1) * 100 : 0;
          return (
            <Metric
              key={f}
              label={`${FAM_LABEL[f].slice(0, -2)}${kref} Â· ${names[best]}`}
              value={fNum(v, 4)}
              delta={`${fDelta(d)} vs. popularidad`}
              deltaGood={d >= 0}
              accent={COLOR_MODELO[best] ?? "#7a2e2e"}
            />
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="tarjeta overflow-x-auto p-4">
          <h3 className="titulo-h3 mb-2">Tabla completa de mÃ©tricas</h3>
          <table className="biblio datos text-[0.78rem]">
            <thead>
              <tr>
                <th>modelo</th>
                {cols.map((c) => (
                  <th key={c} className="text-right whitespace-nowrap">{c.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((r) => (
                <tr key={r.modelo as string}>
                  <td className="whitespace-nowrap font-semibold text-nogal">{r.modelo}</td>
                  {cols.map((c) => {
                    const esMax = Math.abs((r[c] as number) - maxPorCol[c]) < 1e-9;
                    return (
                      <td
                        key={c}
                        className="text-right"
                        style={{ background: esMax ? "#e6d3a0" : undefined, fontWeight: esMax ? 700 : 400 }}
                      >
                        {fNum(r[c] as number, 4)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[0.78rem] text-gris" style={{ fontFamily: leyendaTexto.fontFamily }}>
            En dorado, el mejor valor de cada columna.
          </p>
        </div>

        <div className="tarjeta overflow-x-auto p-4">
          <h3 className="titulo-h3 mb-2">Mejora relativa frente a popularidad</h3>
          <table className="biblio datos text-[0.78rem]">
            <thead>
              <tr>
                <th>modelo</th>
                {cols.map((c) => (
                  <th key={c} className="text-right whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modelos.map((m) => (
                <tr key={m}>
                  <td className="whitespace-nowrap font-semibold text-nogal">{names[m]}</td>
                  {cols.map((c) => {
                    const rel = (met[m][c] / met[popn][c] - 1) * 100;
                    return (
                      <td key={c} className="text-right" style={{ color: rel >= 0 ? "#1f4b3a" : "#7a2e2e", fontWeight: 600 }}>
                        {fDelta(rel)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[0.78rem] text-gris" style={{ fontFamily: leyendaTexto.fontFamily }}>
            Positivo = mejor que recomendar a todos lo mÃ¡s popular. Negativo = peor.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="titulo-h3">ComparaciÃ³n grÃ¡fica</h3>
          <Tabs
            value={fam}
            onChange={setFam}
            options={fams.map((f) => ({ value: f, label: FAM_LABEL[f] }))}
          />
        </div>
        <div className="tarjeta p-4">
          <div style={{ height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafico} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="k" tick={tick} tickLine={{ stroke: "#8a5a3b" }} axisLine={{ stroke: "#8a5a3b" }} />
                <YAxis tick={tick} tickLine={{ stroke: "#8a5a3b" }} axisLine={{ stroke: "#8a5a3b" }} tickFormatter={(v) => Number(v).toFixed(3)} />
                <Tooltip contentStyle={tooltipContenido} formatter={(v: number | string) => fNum(Number(v), 4)} />
                <Legend wrapperStyle={leyendaTexto} />
                {modelos.map((m) => (
                  <Bar key={m} dataKey={names[m]} fill={COLOR_MODELO[m]} radius={[2, 2, 0, 0]} maxBarSize={34}>
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <BloqueInterpretacion
          titulo="Frente a los baselines"
          color="#7a2e2e"
          texto={
            <>
              En <strong>{key.toUpperCase()}</strong> la mejor referencia simple es <strong>{names[bb]}</strong> (
              {fNum(met[bb][key], 4)}). La mejor versiÃ³n de dos torres es <strong>{names[bt]}</strong> (
              {fNum(met[bt][key], 4)}): {fDelta(vsBase)} respecto a esa referencia y {fDelta(vsPop)} respecto a
              popularidad.
            </>
          }
        />
        <BloqueInterpretacion
          titulo="Â¿Ayudan los tags?"
          color="#1f4b3a"
          texto={
            <>
              Solo ID: {fNum(met.dos_torres_id[key], 4)} Â· ID + tags: {fNum(met.dos_torres_meta[key], 4)} (
              {fDelta(dif)} relativo).{" "}
              {Math.abs(dif) < 10
                ? "La diferencia es pequeÃ±a y proviene de una sola corrida, por lo que la tomamos como una tendencia preliminar y no como una conclusiÃ³n."
                : "La diferencia es apreciable, pero proviene de una sola corrida; falta repetir con otras semillas para confirmarla."}
            </>
          }
        />
        <BloqueInterpretacion
          titulo="Por quÃ© los valores absolutos son bajos"
          color="#b08d57"
          texto={
            <>
              Se ordena un catÃ¡logo de {fInt(summary.eda.n_books)} libros, el split es cronolÃ³gico y solo se usa como
              â€œverdadâ€ la parte mÃ¡s reciente del historial: el resto de los gustos del usuario queda oculto. Por eso
              importa mÃ¡s la comparaciÃ³n entre modelos que el valor absoluto.
            </>
          }
        />
      </div>

      <TheoryCard>
        <p className="mb-2 font-semibold">Glosario de mÃ©tricas</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Recall@k</strong>: de los libros que el usuario leyÃ³ despuÃ©s (escondidos), quÃ© fracciÃ³n aparece en
            las primeras <em>k</em> recomendaciones.
          </li>
          <li>
            <strong>NDCG@k</strong>: como Recall, pero da mÃ¡s puntos si los aciertos aparecen en los primeros lugares de
            la lista.
          </li>
          <li>
            <strong>MAP@k</strong>: promedio de la precisiÃ³n calculada en cada posiciÃ³n donde hubo un acierto; premia
            acertar temprano y varias veces.
          </li>
          <li>
            <strong>k</strong>: tamaÃ±o de la lista recomendada (por ejemplo, 10 libros). Con k grande cualquier mÃ©todo
            sube: por eso se comparan <em>curvas</em>, no un nÃºmero suelto.
          </li>
        </ul>
        <p className="mt-3">
          <strong>Â¿Por quÃ© es difÃ­cil superar a popularidad?</strong> Porque el test tambiÃ©n estÃ¡ dominado por libros
          famosos: recomendar â€œlo de siempreâ€ ya acierta una fracciÃ³n nada despreciable. Un modelo de embeddings solo
          gana cuando personaliza de verdad â€” y lo medimos mirando NDCG, que penaliza el orden.
        </p>
      </TheoryCard>
    </Section>
  );
}

function BloqueInterpretacion({ titulo, texto, color }: { titulo: string; texto: React.ReactNode; color: string }) {
  return (
    <div className="ficha" style={{ borderLeftColor: color }}>
      <div className="p-4">
        <h4 className="font-titulo mb-1.5 text-[0.92rem] font-bold" style={{ color }}>
          {titulo}
        </h4>
        <p className="text-[0.88rem] leading-relaxed text-tinta/90">{texto}</p>
      </div>
    </div>
  );
}
