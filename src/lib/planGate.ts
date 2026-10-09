// Puerta de plan: un solo lugar que sabe en qué plan está la cuenta activa,
// cuánto lleva consumido y cuándo toca pedir el upgrade.
//
// Los servicios (planner, finanzas) llaman a `assertWithinLimit` antes de
// escribir; si no cabe, lanzan un LimitError y avisan a la interfaz para que
// abra el modal de upgrade. Los módulos bloqueados llaman a `requestUpgrade`.
// No hay React aquí a propósito: lo usan servicios puros.
import { supabase } from './supabase';
import { getLimits, minimumPlanFor, withinLimit, type Entitlement, type LimitKind, type PlanId, type PlanLimits } from './planService';

export interface UpgradeRequest {
  /** Por qué se pide: límite alcanzado o módulo bloqueado. */
  motivo: string;
  /** Plan mínimo que lo resuelve. */
  planSugerido: 'basico' | 'intermedio' | 'full';
  limit?: LimitKind;
  entitlement?: Entitlement;
  /** Periodo preseleccionado en el modal (p. ej. el elegido en la landing). */
  periodo?: 'mensual' | 'anual';
}

export class LimitError extends Error {
  readonly request: UpgradeRequest;
  constructor(request: UpgradeRequest) {
    super(request.motivo);
    this.name = 'LimitError';
    this.request = request;
  }
}

const state: { plan: PlanId; isTeam: boolean } = { plan: 'free', isTeam: false };
const listeners = new Set<(request: UpgradeRequest) => void>();

export function setCurrentPlan(plan: PlanId, isTeam: boolean) {
  state.plan = plan;
  state.isTeam = isTeam;
}

export function currentPlan(): PlanId { return state.plan; }
export function currentLimits(): PlanLimits { return getLimits(state.plan, state.isTeam); }

export function onUpgradeRequest(listener: (request: UpgradeRequest) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function requestUpgrade(request: UpgradeRequest) {
  for (const listener of listeners) listener(request);
}

const LIMIT_LABEL: Record<LimitKind, string> = {
  tareas_semana: 'tareas por semana',
  movimientos_mes: 'movimientos financieros por mes',
  proyectos_activos: 'clientes activos',
  consultas_ia_mes: 'consultas al asistente por mes',
  miembros: 'personas en la cuenta',
};

function startOfWeekIso(): string {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // lunes = 0
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  return monday.toISOString();
}

function startOfMonthDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Consumo actual de la cuenta activa. Cuenta en la base (RLS limita a la
 * cuenta activa); la IA se controla en el servidor, no aquí.
 */
export async function countUsage(kind: Exclude<LimitKind, 'consultas_ia_mes' | 'miembros'>): Promise<number> {
  const db = supabase as any;
  if (kind === 'tareas_semana') {
    const { count } = await db.from('planner_tasks').select('id', { count: 'exact', head: true }).gte('created_at', startOfWeekIso());
    return count || 0;
  }
  if (kind === 'movimientos_mes') {
    const since = startOfMonthDate();
    const [{ count: ventas }, { count: egresos }] = await Promise.all([
      db.from('finance_ventas').select('id', { count: 'exact', head: true }).gte('fecha', since),
      db.from('finance_pagos_egresos').select('id', { count: 'exact', head: true }).gte('fecha', since),
    ]);
    return (ventas || 0) + (egresos || 0);
  }
  const { count } = await db.from('finance_clientes').select('id', { count: 'exact', head: true }).eq('activo', true);
  return count || 0;
}

/**
 * Lanza LimitError (y abre el modal de upgrade) si `used + extra` supera el
 * tope del plan. `used` se puede pasar cuando quien llama ya lo sabe (p. ej.
 * la lista completa que va a guardar); si no, se cuenta en la base.
 */
export async function assertWithinLimit(kind: Exclude<LimitKind, 'consultas_ia_mes' | 'miembros'>, extra = 1, used?: number): Promise<void> {
  const limits = currentLimits();
  if (limits[kind] === null) return;
  const consumed = used ?? await countUsage(kind);
  if (withinLimit(limits, kind, consumed, extra)) return;
  const request: UpgradeRequest = {
    motivo: `Tu plan permite ${limits[kind]} ${LIMIT_LABEL[kind]} y ya llevas ${consumed}.`,
    // El plan que alcanza para lo que se intenta: 4 clientes → Intermedio, 11 → Full.
    planSugerido: minimumPlanFor({ limit: kind, needed: consumed + extra }),
    limit: kind,
  };
  requestUpgrade(request);
  throw new LimitError(request);
}

/** Para módulos apagados en el plan: abre el modal con el plan que lo trae. */
export function requestEntitlement(entitlement: Entitlement, nombre: string) {
  requestUpgrade({
    motivo: `${nombre} no está en tu plan actual.`,
    planSugerido: minimumPlanFor({ entitlement }),
    entitlement,
  });
}

export function isLimitError(error: unknown): error is LimitError {
  return error instanceof LimitError || (!!error && typeof error === 'object' && (error as { name?: string }).name === 'LimitError');
}
