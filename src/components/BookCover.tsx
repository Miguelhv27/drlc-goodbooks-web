import { useState } from "react";
import { useStore } from "../lib/store";
import { colorTitulo, portadaIsbn, tituloCorto } from "../lib/paleta";

interface Props {
  idx: number; // indice interno de libro
  w?: number;
  h?: number;
  size?: "S" | "M" | "L";
  showMeta?: boolean;
  badge?: string;
  badgeColor?: string;
}

/** Portada via Open Library (isbn13) con fallback tipografico tipo lomo.
 *  Ojo: Open Library responde 200 con un GIF 1x1 cuando no hay portada,
 *  por eso se descarta tambien por naturalWidth. */
export default function BookCover({ idx, w = 120, h = 180, size = "M", showMeta = true, badge, badgeColor = "#7a2e2e" }: Props) {
  const book = useStore().books[idx];
  const [estado, setEstado] = useState<"cargando" | "ok" | "fallback">("cargando");
  const url = portadaIsbn(book?.is ?? null, size);
  const color = colorTitulo(book?.t ?? String(idx));

  if (!book) return null;

  return (
    <div className="flex flex-col" style={{ width: w }}>
      <div className="portada portada-sombra" style={{ width: w, height: h }}>
        {url && estado !== "fallback" ? (
          <img
            src={url}
            alt={`Portada de ${book.t}`}
            loading="lazy"
            decoding="async"
            onError={() => setEstado("fallback")}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth <= 4) setEstado("fallback");
              else setEstado("ok");
            }}
          />
        ) : null}
        {estado !== "ok" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center"
            style={{ background: `linear-gradient(160deg, ${color}, ${shade(color)})`, visibility: estado === "cargando" ? "hidden" : "visible" }}
          >
            <div className="font-titulo text-[0.72rem] leading-snug text-[#f6efe2] [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]" style={{ width: w - 18 }}>
              {tituloCorto(book.t, 60)}
            </div>
            <div className="datos text-[0.6rem] text-[#f6efe2]/80">{book.y ?? ""}</div>
          </div>
        )}
        <div className="lomo" />
        {badge && (
          <span
            className="datos absolute -top-1.5 -right-1.5 rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold text-[#fffdf7] shadow"
            style={{ background: badgeColor }}
          >
            {badge}
          </span>
        )}
      </div>
      {showMeta && (
        <div className="mt-1.5 leading-tight">
          <div className="text-[0.72rem] font-semibold text-nogal" title={book.t}>
            {tituloCorto(book.t, 42)}
          </div>
          <div className="text-[0.68rem] text-gris" title={book.a}>
            {tituloCorto(book.a.split(",")[0], 24)} · <span className="datos">{book.ar.toFixed(2).replace(".", ",")}★</span>
          </div>
        </div>
      )}
    </div>
  );
}

function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (x: number) => Math.max(0, Math.floor(x * 0.62));
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
