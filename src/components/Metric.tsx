import { fDelta } from "../lib/paleta";

interface Props {
  label: string;
  value: string;
  delta?: string;
  deltaGood?: boolean | null;
  accent?: string;
}

/** Metrica tipo "ficha de catalogo" (stMetric con el tema biblioteca). */
export default function Metric({ label, value, delta, deltaGood = null, accent = "#7a2e2e" }: Props) {
  const cls = deltaGood === null ? "text-gris" : deltaGood ? "text-verde" : "text-bordo";
  return (
    <div className="ficha" style={{ borderLeftColor: accent }}>
      <div className="px-4 py-3">
        <div className="datos text-[0.78rem] font-medium text-gris">{label}</div>
        <div className="mt-0.5 font-titulo text-nogal" style={{ fontSize: "1.42rem", lineHeight: 1.2 }}>
          {value}
        </div>
        {delta && <div className={`datos mt-0.5 text-[0.75rem] font-semibold ${cls}`}>{delta}</div>}
      </div>
    </div>
  );
}

export function DeltaMetric({ label, value, deltaPct, suffix }: Props & { deltaPct: number; suffix?: string }) {
  return (
    <Metric
      label={label}
      value={value + (suffix ?? "")}
      delta={fDelta(deltaPct)}
      deltaGood={deltaPct >= 0}
    />
  );
}
