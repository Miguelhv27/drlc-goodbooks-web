import type { DemoFile, DemoMeta, DemoUser } from "./types";

/** Desde T8 (L11), demo.json se hornea como objeto { selection_rule, n_test_min,
 *  n_test_max, users }. El store conserva el tipo historico DemoUser[] y este
 *  helper normaliza ambas formas en tiempo de render, sin tocar el loader. */
export function readDemoFile(demo: DemoUser[] | DemoFile): { users: DemoUser[]; meta: DemoMeta | null } {
  if (Array.isArray(demo)) return { users: demo, meta: null };
  const { users, selection_rule, n_test_min, n_test_max } = demo;
  return { users: users ?? [], meta: { selection_rule, n_test_min, n_test_max } };
}

export interface DemoAggregate {
  /** aciertos top-k de media por usuario */
  meanHits: number;
  /** fraccion (0..1) de usuarios con >=1 acierto en el top-k */
  fracUsers: number;
}

/** Estadisticas agrupadas de la demo, a partir de demo.json (k fijo = 10 para
 *  casar con Recall@10). Un "acierto" usa la misma regla que la vista por
 *  usuario: interseccion del top-k del modelo con la lista escondida (que esta
 *  truncada en el horneado, de ahi la salvedad de subestimacion en Demo.tsx). */
export function demoAggregates(users: DemoUser[], modelos: string[], k = 10): Record<string, DemoAggregate> {
  const out: Record<string, DemoAggregate> = {};
  const n = users.length || 1;
  for (const m of modelos) {
    let total = 0;
    let withHit = 0;
    for (const u of users) {
      const hid = new Set(u.held_out);
      const hits = (u.recs[m] ?? []).slice(0, k).filter((i) => hid.has(i)).length;
      total += hits;
      if (hits > 0) withHit += 1;
    }
    out[m] = { meanHits: total / n, fracUsers: withHit / n };
  }
  return out;
}
