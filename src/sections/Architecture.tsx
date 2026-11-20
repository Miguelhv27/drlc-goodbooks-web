import { useMemo, useState } from "react";
import Section from "../components/Section";
import Tabs from "../components/Tabs";
import FlowDiagram, { type Arista, type Nodo } from "../components/FlowDiagram";
import Math from "../components/Math";
import TheoryCard from "../components/TheoryCard";
import { useStore } from "../lib/store";
import { fInt } from "../lib/paleta";
import { COLOR_TORRE } from "../lib/paleta";

type Modelo = "dos_torres_id" | "dos_torres_meta";

const LLENO = "#efe4cf";
const TAGS = "#dfe6d6";
const SALIDA = "#eadbb4";
const PERDIDA = "#e9d3cf";

function diagrama(meta: boolean, dim: number, logq: boolean): { nodos: Nodo[]; aristas: Arista[] } {
  const W = 230;
  const H = 54;
  const P = 80;
  const y = (i: number) => 16 + i * P;
  const xU = 30;
  const xI = meta ? 310 : 320;
  const xT = 590;
  const sX = 165;
  const ultimaFila = meta ? 5 : 4;
  const sY = y(ultimaFila) + H + 34;
  const U = (i: number, label: string, fill?: string): Nodo => ({ id: `u${i}`, label, x: xU, y: y(i), w: W, h: H, fill });
  const I = (i: number, fila: number, label: string, fill?: string): Nodo => ({ id: `i${i}`, label, x: xI, y: y(fila), w: W, h: H, fill });
  const nodos: Nodo[] = [
    U(0, "ID de usuario"),
    U(1, `Embedding ${dim}`),
    U(2, `Dense ${2 * dim}\nReLU`),
    U(3, `Dense ${dim}`),
    U(4, "Normalización L2", LLENO),
    I(0, 0, "ID de libro"),
    I(1, 1, `Embedding ID ${dim}`),
  ];
  if (meta) {
    nodos.push(
      { id: "t0", label: "Tags TF-IDF\n(fijos, no entrenables)", x: xT, y: y(0), w: W, h: H, fill: TAGS },
      { id: "t1", label: `Dense ${dim}\nReLU`, x: xT, y: y(1), w: W, h: H, fill: TAGS },
      { id: "c", label: `Concatenar\n${2 * dim}`, x: xT, y: y(2), w: W, h: H, fill: LLENO },
      I(2, 3, `Dense ${2 * dim}\nReLU`),
      I(3, 4, `Dense ${dim}`),
      I(4, 5, "Normalización L2", LLENO),
    );
  } else {
    nodos.push(I(2, 2, `Dense ${2 * dim}\nReLU`), I(3, 3, `Dense ${dim}`), I(4, 4, "Normalización L2", LLENO));
  }
  nodos.push(
    { id: "s", label: `Producto punto / τ${logq ? "\n− log Q" : ""}`, x: sX, y: sY, w: 240, h: H, fill: SALIDA },
    { id: "l", label: "Pérdida softmax\nnegativos in-batch", x: sX, y: sY + 70, w: 240, h: H, fill: PERDIDA },
  );
  const aristas: Arista[] = [
    { from: "u0", to: "u1" }, { from: "u1", to: "u2" }, { from: "u2", to: "u3" }, { from: "u3", to: "u4" },
    { from: "i0", to: "i1" },
  ];
  if (meta) {
    aristas.push(
      { from: "i0", to: "t0" }, { from: "t0", to: "t1" }, { from: "i1", to: "c" }, { from: "t1", to: "c" },
      { from: "c", to: "i2" }, { from: "i2", to: "i3" }, { from: "i3", to: "i4" },
      { from: "u4", to: "s" }, { from: "i4", to: "s" }, { from: "s", to: "l" },
    );
  } else {
    aristas.push(
      { from: "i1", to: "i2" }, { from: "i2", to: "i3" }, { from: "i3", to: "i4" },
      { from: "u4", to: "s" }, { from: "i4", to: "s" }, { from: "s", to: "l" },
    );
  }
  return { nodos, aristas };
}

export default function Architecture() {
  const { summary } = useStore();
  const cfg = summary.config;
  const [m, setM] = useState<Modelo>("dos_torres_id");
  const { nodos, aristas } = useMemo(() => diagrama(m === "dos_torres_meta", cfg.dim, !!cfg.logq), [m, cfg.dim, cfg.logq]);
  const arch = summary.arch?.[m];

  return (
    <Section
      id="arquitectura"
      n={4}
      title="Arquitectura de las dos torres"
      lead={
        <>
          Cada torre es una pequeña red neuronal que convierte un identificador (usuario o libro) en un vector de{" "}
          <strong>{cfg.dim} números</strong>. Si el vector del usuario y el del libro apuntan en direcciones parecidas,
          el sistema recomienda ese libro. El vector de libro es la <strong>representación</strong> que analizamos antes
          y después de entrenar.
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

      <div className="mb-8">
        <FlowDiagram nodos={nodos} aristas={aristas} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <TheoryCard>
            <p>
              <strong>¿Qué es un embedding?</strong> Un ID de libro (un número como 4321) no dice nada por sí mismo. Un
              embedding convierte ese ID en una lista de 64 decimales que la red <em>aprende</em>: con el tiempo, esos 64
              números pasan a codificar cosas como “épico y fantástico” o “íntimo y contemporáneo”, sin que nadie se los
              dijera. Nadie define qué significa cada dimensión: surgen solas al intentar predecir lecturas.
            </p>
            <p className="mt-2">
              <strong>“Dos torres”</strong> solo significa que hay dos redes separadas que nunca comparten parámetros:
              una mira usuarios, otra mira libros, y se encuentran <em>al final</em>, multiplicando sus vectores. Eso
              permite precalcular las 10.000 flechas de libros una vez y después recomendar baratisimo: solo se
              recalcula la flecha del usuario.
            </p>
            <p className="mt-2">
              La versión “ID + tags” le añade a la torre de libro un atajo: una fila fija con los tags TF-IDF del libro.
              Ojo con la palabra <em>fija</em>: esa matriz de tags se congela como constantes dentro de una capa y no se
              entrena — lo entrenable es la proyección densa que la comprime.
            </p>
        </TheoryCard>

        <div className="flex flex-col gap-5">
          <h3 className="titulo-h3">Cómo se entrena</h3>
          <div className="tarjeta flex flex-col items-center gap-4 p-5">
            <div className="text-center">
              <Math block tex={cfg.logq ? `s(u,i)=\\frac{\\langle \\hat{u},\\hat{v}_i\\rangle}{\\tau}-\\log Q(i)` : `s(u,i)=\\frac{\\langle \\hat{u},\\hat{v}_i\\rangle}{\\tau}`} />
              <div className="mx-auto mt-2 h-px w-24 bg-arena" />
              <div className="mt-3">
                <Math block tex={`\\mathcal{L}=-\\frac{1}{B}\\sum_{b=1}^{B}\\log\\frac{e^{s(u_b,i_b)}}{\\sum_{j=1}^{B}e^{s(u_b,i_j)}}`} />
              </div>
            </div>
          </div>

          <ul className="space-y-2 text-[0.92rem] leading-relaxed">
            <li>
              <Math tex={`\\hat{u},\\ \\hat{v}_i`} className="mr-1" /> son los vectores tras la normalización L2: solo
              importa su dirección (similitud coseno).
            </li>
            <li>
              <strong>τ = {cfg.tau}</strong> (temperatura): valores pequeños hacen la competencia entre candidatos más
              exigente.
            </li>
            <li>
              <strong>B = {fInt(cfg.batch)}</strong>: en cada lote hay {fInt(cfg.batch)} pares (usuario, libro leído). Para
              cada usuario, su libro es el positivo y los otros {fInt(cfg.batch - 1)} libros del lote actúan como
              negativos (negativos in-batch).
            </li>
            {!!cfg.logq && (
              <li>
                <strong>Q(i)</strong> es la frecuencia de popularidad del libro i en train; restar log Q(i) corrige que
                los libros populares aparecen mucho más como negativos (corrección logQ).
              </li>
            )}
          </ul>

          <TheoryCard>
            <p>
              La pérdida dice: <em>“de todos los libros que hay en este lote, dale la mayor puntuación al que este
              usuario realmente leyó”</em>. Es la misma idea de un clasificador de imágenes que tiene 2048 clases por
              lote, pero aquí las clases son libros y cambian en cada paso. Por eso los negativos son gratis: ya estaban
              ahí, en el lote.
            </p>
            <p className="mt-2">
              <strong>τ (temperatura)</strong> es el dial de exigencia: con τ pequeño, una diferencia mínima de similitud
              se amplifica muchísimo en la softmax y el modelo se ve forzado a separar con claridad; con τ grande todo
              se aplana. {cfg.tau} es un valor agresivo, típico en retrieval.
            </p>
            <p className="mt-2">
              <strong>logQ</strong>: el lote se arma con la distribución real (popular), así que “El Hobbit” aparece como
              negativo en demasiados lotes y el modelo aprende a castigarlo. Si conocemos su frecuencia Q(i), basta con
              restar log Q(i) de la puntuación y el sesgo desaparece. Es la corrección de softmax muestreada de Yi et
              al. (WSDM 2019).
            </p>
          </TheoryCard>
        </div>
      </div>

      {arch && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {(["usuario", "libro"] as const).map((key) => {
            const filas = arch[key];
            const total = filas.reduce((a, r) => a + r.parametros, 0);
            const entr = filas.reduce((a, r) => a + (r.entrenable === "Sí" ? r.parametros : 0), 0);
            return (
              <div key={key} className="tarjeta p-4">
                <h3 className="titulo-h3 mb-2 capitalize">Torre de {key}</h3>
                <div className="overflow-x-auto">
                  <table className="biblio datos text-[0.8rem]">
                    <thead>
                      <tr><th>Capa</th><th>Tipo</th><th>Salida</th><th>Parámetros</th><th>Entrenable</th></tr>
                    </thead>
                    <tbody>
                      {filas.map((r) => (
                        <tr key={r.capa}>
                          <td className="whitespace-nowrap">{r.capa}</td>
                          <td>{r.tipo}</td>
                          <td>{r.salida}</td>
                          <td className="text-right">{fInt(r.parametros)}</td>
                          <td>
                            <span
                              className="inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-bold"
                              style={{
                                background: r.entrenable === "Sí" ? "rgba(31,75,58,0.14)" : r.entrenable === "No" ? "rgba(122,46,46,0.14)" : "rgba(90,74,60,0.10)",
                                color: r.entrenable === "Sí" ? "#1f4b3a" : r.entrenable === "No" ? "#7a2e2e" : "#5a4a3c",
                              }}
                            >
                              {r.entrenable}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[0.78rem] text-gris">
                  Parámetros totales: <strong className="datos">{fInt(total)}</strong> · entrenables:{" "}
                  <strong className="datos">{fInt(entr)}</strong>
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        <h3 className="titulo-h3 mb-3">Hiperparámetros</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {[
            ["Dimensión", String(cfg.dim)],
            ["Lote", fInt(cfg.batch)],
            ["Temperatura τ", String(cfg.tau)],
            ["Optimizador", "Adam · lr 1e-3"],
            ["Épocas (máx.)", String(cfg.epochs)],
            ["logQ", cfg.logq ? "Sí" : "No"],
            ["Semilla", String(cfg.seed)],
          ].map(([k, v]) => (
            <div key={k} className="ficha ficha-laton p-3">
              <div className="datos text-[0.68rem] font-semibold uppercase tracking-wider text-gris">{k}</div>
              <div className="datos mt-1 text-[0.95rem] font-bold text-nogal">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
