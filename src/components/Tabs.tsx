import { COLOR_MODELO } from "../lib/paleta";

interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  dotColor?: (v: T) => string | undefined;
}

/** Radio horizontal tipo "st.radio(horizontal=True)" con el estilo del tema. */
export default function Tabs<T extends string>({ value, onChange, options, dotColor }: Props<T>) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {options.map((o) => {
        const activa = o.value === value;
        const dot = dotColor?.(o.value) ?? (COLOR_MODELO[o.value] ?? undefined);
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={activa}
            type="button"
            onClick={() => onChange(o.value)}
            className={`tab ${activa ? "activa" : ""}`}
          >
            {dot && <span className="punto inline-block h-2.5 w-2.5 rounded-full" style={{ background: dot }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
