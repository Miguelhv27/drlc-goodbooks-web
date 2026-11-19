import type { ReactNode } from "react";

interface Props {
  id: string;
  n: number;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}

export default function Section({ id, n, title, lead, children }: Props) {
  return (
    <section id={id} className="relative mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-baseline gap-3">
          <span className="datos text-[0.8rem] font-bold tracking-widest text-laton">
            {String(n).padStart(2, "0")}
          </span>
          <h2 className="titulo-h2 flex-1">{title}</h2>
        </div>
        {lead && <div className="mt-3 max-w-3xl text-[1.02rem] leading-relaxed text-tinta/85">{lead}</div>}
      </div>
      {children}
    </section>
  );
}
