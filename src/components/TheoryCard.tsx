import { useRef, useState } from "react";

interface Props {
  title?: string;
  children: React.ReactNode;
  variant?: "teoria" | "nota";
}

/** Tarjeta "Explicación simple" que se despliega debajo de un bloque tecnico. */
export default function TheoryCard({ title, children, variant = "teoria" }: Props) {
  const [abierto, setAbierto] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const esTeoria = variant === "teoria";

  return (
    <div className={`mt-4 ${esTeoria ? "teoria-card" : "nota-card"}`}>
      <button
        type="button"
        className="btn-teoria my-2.5 ml-2.5"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        {esTeoria ? (
          <>
            <LampIcon />
            {abierto ? "Ocultar explicación simple" : title ?? "Explicación simple"}
          </>
        ) : (
          <>
            <BookIcon />
            {abierto ? "Ocultar contexto" : title ?? "Contexto y alcance"}
          </>
        )}
      </button>
      <div
        ref={body}
        className="teoria-body"
        style={{ maxHeight: abierto ? (body.current?.scrollHeight ?? 600) + 40 : 0, opacity: abierto ? 1 : 0 }}
      >
        <div className="px-4 pb-4 pt-1 text-[0.95rem] leading-relaxed text-tinta/90">{children}</div>
      </div>
    </div>
  );
}

function LampIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M9 18h6M10 21h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13A2.5 2.5 0 0 0 6.5 22H20" />
    </svg>
  );
}
