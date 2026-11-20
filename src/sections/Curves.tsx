import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Section from "../components/Section";
import TheoryCard from "../components/TheoryCard";
import { Legend } from "recharts";
import { useStore } from "../lib/store";
import { fInt, fNum } from "../lib/paleta";
import { BORDO, GRID, LATON, TINTA, VERDE, leyendaTexto, tick, tooltipContenido } from "../lib/chartTheme";
import { TORRES } from "../lib/paleta";

export default function Curves() {
  const { summary } = useStore();
  const hist = summary.history;
  const azar = Math.log(summary.config.batch);

  const { filas, mejores, gap } = useMemo(() => {
    const f: { epoca: number; modelo: string; conjunto: string; perdida: number }[] = [];
    for (const [k, h] of Object.entries(hist)) {
      h.loss.forEach((a, i) => f.push({ epoca: i + 1, modelo: TORRES[k], conjunto: "Entrenamiento", perdida: a }));
      h.val_loss.forEach((b, i) => f.push({ epoca: i + 1, modelo: TORRES[k], conjunto: "Validación", perdida: b }));
    }
    const mejor = Object.entries(hist).map(([k, h]) => {
      const i = h.val_loss.indexOf(Math.min(...h.val_loss));
      return { epoca: i + 1, perdida: h.val_loss[i], modelo: TORRES[k] };
    });
    const g: { epoca: number; modelo: string; brecha: number }[] = [];
    for (const [k, h] of Object.entries(hist)) {
      h.loss.forEach((a, i) => g.push({ epoca: i + 1, modelo: TORRES[k], brecha: +(h.val_loss[i] - a).toFixed(4) }));
    }
    return { filas: f, mejores: mejor, gap: g };
  }, [hist]);

  const epocas = Math.max(...Object.values(hist).map((h) => h.loss.length));
  const diag = useMemo(
    () =>
      Object.entries(hist).map(([k, h]) => {
        const tr = h.loss;
        const va = h.val_loss;
        const n = va.length;
        const best = va.indexOf(Math.min(...va)) + 1;
        let lectura: string;
        if (best < n && va[n - 1] - Math.min(...va) > 0.02) {
          lectura = `La validación empezó a empeorar después de la época ${best} mientras el entrenamiento seguía bajando: señal de sobreajuste. Esa señal es la que hoy corta el entrenamiento: el pipeline aplica early stopping sobre el NDCG@10 de validación y restaura los pesos de la mejor época, así que la curva termina cuando se agota la paciencia.`;
        } else if (best === n && n > 1 && va[n - 2] - va[n - 1] > 0.01) {
          lectura = "La validación seguía bajando en la última época: el modelo aún estaba aprendiendo y más épocas podrían ayudar.";
        } else {
          lectura = "La validación se estabilizó: el modelo prácticamente convergió con este número de épocas.";
        }
        return {
          modelo: TORRES[k],
          inicial: tr[0],
          finalTr: tr[n - 1],
          finalVa: va[n - 1],
          best,
          vsAzar: ((azar - va[n - 1]) / azar) * 100,
          lectura,
          color: k === "dos_torres_id" ? BORDO : VERDE,
        };
      }),
    [hist, azar],
  );

  const serie = (modelo: string, conjunto: "Entrenamiento" | "Validación") =>
    filas.filter((f) => f.modelo === modelo && f.conjunto === conjunto).map((f) => ({ epoca: f.epoca, perdida: f.perdida }));

  const idata = serie(TORRES.dos_torres_id, "Entrenamiento");
  const vdata = serie(TORRES.dos_torres_id, "Validación");
  const mdata = serie(TORRES.dos_torres_meta, "Entrenamiento");
  const nadata = serie(TORRES.dos_torres_meta, "Validación");

  return (
    <Section
      id="curvas"
      n={5}
      title="Curvas de entrenamiento"
      lead={
        <>
          La <strong>pérdida</strong> mide qué tan “sorprendido” está el modelo al ver el libro que el usuario realmente
          leyó entre los {fInt(summary.config.batch)} candidatos del lote: <strong>menor es mejor</strong>. Un modelo que
          adivina al azar tendría una pérdida de ln({fInt(summary.config.batch)}) ≈ <strong>{fNum(azar, 2)}</strong> (línea
          punteada). La línea continua es <strong>entrenamiento</strong> y la discontinua es <strong>validación</strong>{" "}
          (interacciones más recientes que el modelo no usa para aprender).
        </>
      }
    >
      <div className="tarjeta p-4">
        <div style={{ height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
              <XAxis dataKey="epoca" type="number" domain={[1, epocas]} ticks={Array.from({ length: epocas }, (_, i) => i + 1)} tick={tick} tickLine={{ stroke: "#8a5a3b" }} axisLine={{ stroke: "#8a5a3b" }} label={{ value: "Época", position: "insideBottom", offset: -2, fill: TINTA, fontSize: 12 }} />
              <YAxis tick={tick} tickLine={{ stroke: "#8a5a3b" }} axisLine={{ stroke: "#8a5a3b" }} domain={["auto", "auto"]} tickFormatter={(v) => Number(v).toFixed(2)} label={{ value: "Pérdida", angle: -90, position: "insideLeft", fill: TINTA, fontSize: 12 }} />
              <Tooltip contentStyle={tooltipContenido} formatter={(v: number | string, name: string) => [fNum(Number(v)), name]} labelFormatter={(l) => `Época ${l}`} />
              <ReferenceLine y={azar} stroke={TINTA} strokeDasharray="4 5" label={{ value: `Azar: ln(${fInt(summary.config.batch)}) = ${fNum(azar, 2)}`, position: "right", fill: TINTA, fontSize: 11 }} />
              <Line data={idata} dataKey="perdida" name={`${TORRES.dos_torres_id} · train`} stroke={BORDO} strokeWidth={2.5} dot={{ r: 3, fill: BORDO }} />
              <Line data={vdata} dataKey="perdida" name={`${TORRES.dos_torres_id} · val`} stroke={BORDO} strokeWidth={2.5} strokeDasharray="7 5" dot={{ r: 3, fill: "#fff" }} />
              <Line data={mdata} dataKey="perdida" name={`${TORRES.dos_torres_meta} · train`} stroke={VERDE} strokeWidth={2.5} dot={{ r: 3, fill: VERDE }} />
              <Line data={nadata} dataKey="perdida" name={`${TORRES.dos_torres_meta} · val`} stroke={VERDE} strokeWidth={2.5} strokeDasharray="7 5" dot={{ r: 3, fill: "#fff" }} />
              <Legend verticalAlign="top" wrapperStyle={leyendaTexto} />
              {mejores.map((p) => (
                <ReferenceDot key={p.modelo} x={p.epoca} y={p.perdida} r={9} fill="none" stroke={LATON} strokeWidth={3} shape={Rombo} ifOverflow="extendDomain" />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[0.8rem] text-gris" style={{ fontFamily: leyendaTexto.fontFamily }}>
          El rombo dorado marca la época con <strong>menor pérdida de validación</strong> de cada modelo.
        </p>
      </div>

      <TheoryCard>
        <p>
          <strong>¿Por qué ln(2048)?</strong> Si el modelo no supiera nada, el libro correcto sería uno entre 2048 al
          azar, y la sorpresa media (entropía) sería ln(2048) ≈ 7,62. Cada época que el modelo baja de ese número está
          aportando señal real. En el límite perfecto la pérdida vale 0: “sabía con certeza absoluta qué ibas a leer”.
        </p>
        <p className="mt-2">
          <strong>Train vs validación:</strong> la de train baja porque el modelo la está optimizando; la de validación
          baja solo si lo aprendido <em>generaliza</em> a interacciones más recientes. Que validación quede siempre un
          poco por arriba es normal aquí (split cronológico, los gustos cambian), el problema es cuando la distancia
          <em>crece</em> época a época.
        </p>
        <p className="mt-2">
          <strong>La métrica de entrenamiento es el promedio de la época</strong>, medida mientras el modelo todavía está
          cambiando en medio de ella; la de validación se mide al final, con el modelo ya actualizado. Esa asimetría hace
          que la brecha real sea un poco menor que la que se ve en el gráfico.
        </p>
      </TheoryCard>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="tarjeta p-4">
          <h3 className="titulo-h3 mb-2">Brecha entre validación y entrenamiento</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={gap} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="epoca" tick={{ ...tick, fontSize: 10.5 }} tickLine={{ stroke: "#8a5a3b" }} axisLine={{ stroke: "#8a5a3b" }} />
                <YAxis tick={tick} tickLine={{ stroke: "#8a5a3b" }} axisLine={{ stroke: "#8a5a3b" }} tickFormatter={(v) => Number(v).toFixed(2)} />
                <Tooltip contentStyle={tooltipContenido} formatter={(v: number | string) => [fNum(Number(v)), "val − train"]} />
                <ReferenceLine y={0} stroke={TINTA} />
                <Bar dataKey="brecha" fill={LATON} radius={[2, 2, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[0.8rem] leading-relaxed text-gris">
            Si la brecha crece de época en época mientras la pérdida de entrenamiento baja, el modelo empieza a
            memorizar (sobreajuste).
          </p>
        </div>

        <div>
          <h3 className="titulo-h3 mb-3">Diagnóstico por modelo</h3>
          <div className="flex flex-col gap-4">
            {diag.map((d) => (
              <div key={d.modelo} className="ficha" style={{ borderLeftColor: d.color }}>
                <div className="p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <strong className="text-[0.95rem] text-nogal">{d.modelo}</strong>
                    <span className="datos text-[0.75rem] text-gris">
                      loss {fNum(d.inicial, 3)} → {fNum(d.finalTr, 3)} · val {fNum(d.finalVa, 3)} · mejor época {d.best} ·{" "}
                      <strong style={{ color: d.vsAzar >= 0 ? "#1f4b3a" : "#7a2e2e" }}>
                        {Math.round(d.vsAzar)}% mejor que azar
                      </strong>
                    </span>
                  </div>
                  <p className="mt-1.5 text-[0.88rem] leading-relaxed text-tinta/90">{d.lectura}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <TheoryCard variant="nota" title="Qué significa y qué limitaciones tiene esta lectura">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>No es la métrica final.</strong> La pérdida mide qué tan bien el modelo identifica el libro correcto
            entre los del lote; las métricas de recomendación (Recall, NDCG, MAP) están en{" "}
            <a href="#resultados" className="font-semibold text-bordo underline decoration-laton">Resultados</a>.
          </li>
          <li>
            <strong>La validación suele quedar por encima del entrenamiento</strong> porque son interacciones más
            recientes (split cronológico) y los usuarios cambian de gusto.
          </li>
          <li>
            <strong>La pérdida de entrenamiento es el promedio de la época</strong> (el modelo mejora durante ella), así
            que es algo más pesimista que la de validación, que se mide al final.
          </li>
          <li>
            <strong>La validación usa un número limitado de lotes</strong> (30 lotes), por lo que es ruidosa; diferencias
            muy pequeñas no son concluyentes.
          </li>
          <li>Los umbrales del diagnóstico automático (0,02 y 0,01) son heurísticos y sirven como guía de lectura.</li>
        </ul>
      </TheoryCard>
    </Section>
  );
}


/** Rombo dorado: marca la epoca de menor perdida de validacion (mismo gesto que app.py). */
function Rombo(props: { cx?: number; cy?: number; size?: number; stroke?: string; strokeWidth?: number }) {
  const { cx = 0, cy = 0, size = 9, stroke = "#b08d57", strokeWidth = 3 } = props;
  return (
    <path
      d={`M ${cx} ${cy - size} L ${cx + size} ${cy} L ${cx} ${cy + size} L ${cx - size} ${cy} Z`}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}
