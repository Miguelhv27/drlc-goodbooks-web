import { useMemo, useState } from "react";
import Section from "../components/Section";
import Tabs from "../components/Tabs";
import Carousel from "../components/Carousel";
import BookCover from "../components/BookCover";
import TheoryCard from "../components/TheoryCard";
import { useStore } from "../lib/store";
import { COLOR_MODELO, fInt, fNum } from "../lib/paleta";

const KS = [5, 10, 12] as const;

export default function Demo() {
  const { summary, demo, books } = useStore();
  const modelos = summary.run.model_order;
  const names = summary.run.model_names;
  const [ui, setUi] = useState(0);
  const [k, setK] = useState<(typeof KS)[number]>(10);

  const u = demo[ui];
  const hid = useMemo(() => new Set(u.held_out), [u]);
  const aciertos = useMemo(() => {
    const o: Record<string, number> = {};
    for (const m of modelos) o[m] = u.recs[m].slice(0, k).filter((i) => hid.has(i)).length;
    return o;
  }, [u, k, hid, modelos]);
  const mejor = modelos.reduce((a, b) => (aciertos[a] >= aciertos[b] ? a : b), modelos[0]);

  return (
    <Section
      id="demo"
      n={8}
      title="Demo: recomendaciones para usuarios reales"
      lead={
        <>
          Selecciona un lector del subconjunto evaluado y compara qué recomienda cada modelo. Verde{" "}
          <strong>[acierto]</strong> = el modelo colocó ahí un libro escondido del test. Estos resultados están{" "}
          <strong>precomputados</strong> con el pipeline original (semilla {summary.config.seed}), no se calculan en el
          navegador.
        </>
      }
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-3">
          <span className="text-[0.85rem] font-semibold text-nogal">Usuario de ejemplo</span>
          <select
            value={ui}
            onChange={(e) => setUi(Number(e.target.value))}
            className="selector datos"
          >
            {demo.map((d, i) => (
              <option key={d.u} value={i}>
                Usuario {i + 1} · interno #{d.u} · {d.held_out.length} libros escondidos en muestra ({fInt(d.n_test)} en total)
              </option>
            ))}
          </select>
        </label>
        <Tabs
          value={String(k)}
          onChange={(v) => setK(Number(v) as (typeof KS)[number])}
          options={KS.map((x) => ({ value: String(x), label: `top ${x}` }))}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ColumnaListas
          titulo="Le gustaron (train)"
          color="#8a5a3b"
          items={u.liked}
          subtitulo="Libros con rating ≥ 4 que el modelo sí vio al entrenar"
        />
        <ColumnaListas
          titulo="Escondidos (test)"
          color="#7a2e2e"
          items={u.held_out}
          subtitulo="Lo que leyó después: el modelo nunca los vio; adivinarlos es el reto"
          marcar
          hid={hid}
        />
      </div>

      <h3 className="titulo-h3 mt-8 mb-1">Recomendaciones por modelo</h3>
      <p className="mb-3 text-[0.82rem] text-gris">
        Cada carrusel es el top-{k} de un modelo, en el orden que el modelo propone. Compara los aciertos entre carruseles.
      </p>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {modelos.map((mo) => (
          <div key={mo} className="tarjeta min-w-0 p-4" style={{ borderTop: `4px solid ${COLOR_MODELO[mo]}` }}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h4 className="font-titulo text-[0.88rem] font-bold text-nogal">{names[mo]}</h4>
              <span
                className="datos rounded-full px-2 py-0.5 text-[0.7rem] font-bold"
                style={{
                  background: aciertos[mo] > 0 ? "rgba(31,75,58,0.14)" : "rgba(122,46,46,0.10)",
                  color: aciertos[mo] > 0 ? "#1f4b3a" : "#7a2e2e",
                }}
              >
                {aciertos[mo]}/{k} aciertos
              </span>
            </div>
            {mo === mejor && aciertos[mo] > 0 && (
              <div className="datos mb-1.5 text-[0.68rem] font-bold uppercase tracking-wider text-laton">mejor aqui</div>
            )}
            <Carousel label={`Recomendaciones de ${names[mo]}`}>
              {u.recs[mo].slice(0, k).map((i, pos) => (
                <div key={`${i}-${pos}`} className="relative">
                  <BookCover idx={i} w={96} h={142} showMeta={false} />
                  <span className="pos-dato datos absolute left-1 top-1 rounded px-1.5 py-0.5 text-[0.62rem] font-bold">
                    {pos + 1}
                  </span>
                  {hid.has(i) && (
                    <span className="marca-acierto datos absolute inset-x-0 bottom-0 py-1 text-center text-[0.62rem] font-bold">
                      ✓ acierto
                    </span>
                  )}
                </div>
              ))}
            </Carousel>
            <p className="mt-1 truncate text-[0.7rem] italic text-gris" title={books[u.recs[mo][0]]?.t}>
              1er lugar: {books[u.recs[mo][0]]?.t}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="ficha ficha-laton min-w-0 p-4">
          <h4 className="font-titulo mb-2 text-[0.9rem] font-bold text-nogal">Resumen numérico de esta corrida</h4>
          <div className="overflow-x-auto">
          <table className="biblio datos text-[0.8rem]">
            <thead>
              <tr>
                <th>modelo</th>
                <th>NDCG@10 global</th>
                <th>aciertos top-{k} (este usuario)</th>
              </tr>
            </thead>
            <tbody>
              {modelos.map((mo) => (
                <tr key={mo}>
                  <td className="whitespace-nowrap font-semibold" style={{ color: COLOR_MODELO[mo] }}>
                    {names[mo]}
                  </td>
                  <td>{fNum(summary.metrics[mo]["ndcg@10"], 4)}</td>
                  <td>{aciertos[mo]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <p className="mt-2 text-[0.76rem] leading-relaxed text-gris">
            El NDCG@10 global es sobre {fInt(summary.run.n_eval_users)} usuarios; en un solo usuario la varianza es
            enorme — lo que ves aquí puede no coincidir con el promedio, y esa es la razón de reportar métricas sobre
            miles de usuarios y no una demo aislada.
          </p>
        </div>

        <TheoryCard>
          <p className="mb-2">
            <strong>¿Cómo puede “acertar” un modelo que nunca vio el futuro?</strong> Porque aprendió regularidades:
            cadenas de saga, autores, gustos por género y vecinos de lectura. Si tu flecha quedó cerca de la de un libro
            con el que nadie te asoció explícitamente, ese libro aparece arriba. Un acierto no es memoria: es
            generalización.
          </p>
          <p className="mt-2">
            <strong>Limitación honesta:</strong> la lista de escondidos mostrada aquí está truncada (se guardan solo los
            primeros del test). Un acierto puede no aparecer marcado si el libro escondido quedó fuera de esa ventana, y
            por eso el conteo de “aciertos” de la demo es una <em>subestimación</em> del Recall real de ese usuario.
          </p>
          <p className="mt-2">
            <strong>Tiempo de cómputo:</strong> generar estas recomendaciones toma milisegundos porque los vectores de
            libro ya están precalculados; recomendar = multiplicar la flecha del usuario por las 10.000 flechas de libro
            y tomar el mayor. Eso es lo que hace escalable la arquitectura de dos torres en producción.
          </p>
        </TheoryCard>
      </div>
    </Section>
  );
}

function ColumnaListas({
  titulo,
  color,
  items,
  subtitulo,
  marcar = false,
  hid,
}: {
  titulo: string;
  color: string;
  items: number[];
  subtitulo: string;
  marcar?: boolean;
  hid?: Set<number>;
}) {
  return (
    <div className="tarjeta min-w-0 p-4">
      <h3 className="titulo-h3 mb-1" style={{ color }}>
        {titulo}
      </h3>
      <p className="mb-3 text-[0.78rem] italic text-gris">{subtitulo}</p>
      <Carousel label={titulo}>
        {items.map((i) => (
          <div key={i} className="relative">
            <BookCover idx={i} w={96} h={142} showMeta={false} />
            {marcar && hid?.has(i) && (
              <span className="marca-escondido datos absolute inset-x-0 bottom-0 py-1 text-center text-[0.62rem] font-bold">
                escondido
              </span>
            )}
          </div>
        ))}
      </Carousel>
    </div>
  );
}
