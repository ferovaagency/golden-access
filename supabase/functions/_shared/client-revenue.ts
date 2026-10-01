import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/**
 * Impacto financiero 1..5 por cliente, derivado de VENTAS REALES (Pareto):
 * los clientes que acumulan el 50 % del ingreso de la ventana son 5, los que
 * completan el 80 % son 4, el resto con ventas 3, y un cliente sin ventas en
 * la ventana es 2. Sin cliente no hay dato y se deja la sugerencia de la IA.
 *
 * Antes `financial_impact` era un 1..5 que la IA adivinaba del texto y casi
 * siempre quedaba en 3: el "primero lo que más produce" no tenía con qué.
 */
export const REVENUE_WINDOW_DAYS = 90;

type Venta = { cliente_id: string; cantidad: number | null; precio_venta_unitario: number | null; moneda: string | null; trm_conversion: number | null; estado_pago?: string | null };

export function scoreClientsByRevenue(ventas: Venta[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const v of ventas) {
    if (!v.cliente_id) continue;
    const unit = Number(v.precio_venta_unitario) || 0;
    const qty = Number(v.cantidad) || 1;
    const fx = v.moneda && v.moneda.toUpperCase() !== "COP" ? (Number(v.trm_conversion) || 1) : 1;
    totals.set(v.cliente_id, (totals.get(v.cliente_id) || 0) + unit * qty * fx);
  }
  const ranked = [...totals.entries()].filter(([, total]) => total > 0).sort((a, b) => b[1] - a[1]);
  const grand = ranked.reduce((sum, [, total]) => sum + total, 0);
  const scores = new Map<string, number>();
  let cumulative = 0;
  for (const [clientId, total] of ranked) {
    cumulative += total;
    const share = grand > 0 ? cumulative / grand : 1;
    scores.set(clientId, share <= 0.5 ? 5 : share <= 0.8 ? 4 : 3);
  }
  // Cumulative share: the first client can exceed 50 % on its own and must
  // still be a 5, not a 4.
  if (ranked.length) scores.set(ranked[0][0], 5);
  return scores;
}

export async function loadClientRevenueScores(
  admin: SupabaseClient<any, "public", "public", any, any>,
  accountId: string,
): Promise<Map<string, number>> {
  const since = new Date(Date.now() - REVENUE_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await admin
    .from("finance_ventas")
    .select("cliente_id,cantidad,precio_venta_unitario,moneda,trm_conversion")
    .eq("user_id", accountId)
    .gte("fecha", since)
    .limit(5000);
  if (error) {
    console.error("[client-revenue] finance_ventas", error);
    return new Map();
  }
  return scoreClientsByRevenue((data || []) as Venta[]);
}

/** Impacto para un cliente conocido: su score por ventas, o 2 si no vendió en la ventana. */
export function financialImpactForClient(scores: Map<string, number>, clientId: string | null | undefined): number | null {
  if (!clientId) return null;
  return scores.get(clientId) ?? 2;
}
