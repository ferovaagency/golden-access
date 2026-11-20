// Product access is resolved from the plan, then adjusted by explicit admin
// overrides. Legacy identifiers are accepted only for existing subscriptions.
//
// Modelo (nov 2026, cobro con Whop):
//   free   → Gratis: saber si ganas o pierdes. Toda cuenta sin suscripción
//            entra aquí, con topes de volumen.
//   medio  → USD 20: controlar todo el negocio de una persona (finanzas
//            completas, impuestos, Google, rentabilidad por cliente).
//   pro    → USD 50: vender y crecer con equipo (CRM, WhatsApp, Apollo, BI,
//            varias empresas).
// Los ids anteriores (basico / intermedio / full de oct 2026, y completo,
// financiero, … de antes) siguen resolviendo para quien ya los tiene.
export type PlanId =
  | 'free'
  | 'medio'
  | 'pro'
  | 'basico'
  | 'intermedio'
  | 'full'
  | 'projects'
  | 'finance'
  | 'planner'
  | 'crm'
  | 'completo'
  | 'custom'
  | 'financiero'
  | 'crm_ventas';

/** Los planes de pago que se venden hoy, en orden ascendente. */
export const PAID_TIERS = ['medio', 'pro'] as const;
export type PaidTier = typeof PAID_TIERS[number];
/** Planes de pago anteriores (oct 2026). Ya no se venden; quien los tiene los conserva. */
export const LEGACY_PAID_TIERS = ['basico', 'intermedio', 'full'] as const;
/** Orden de nivel para comparar planes (subir / bajar). */
export const PLAN_RANK: Record<string, number> = { free: 0, basico: 1, medio: 1, intermedio: 2, pro: 3, full: 3 };

export type Entitlement =
  | 'core_projects'
  | 'finance'
  | 'finance_advanced'
  | 'planner'
  | 'crm'
  | 'marketing_roi'
  | 'ai_assistant'
  | 'google_sheets'
  | 'google_calendar'
  | 'advanced_analytics'
  | 'team_management';

export interface ModuleFlags {
  core_projects: boolean;
  finance: boolean;
  /** Medio+: caja y bancos, cobrar y pagar, estado y presupuesto, impuestos y memoria. */
  finance_advanced: boolean;
  planner: boolean;
  crm: boolean;
  marketing_roi: boolean;
  ai_assistant: boolean;
  google_sheets: boolean;
  google_calendar: boolean;
  advanced_analytics: boolean;
  team_management: boolean;
  // Compatibility aliases for the existing UI while it is migrated.
  financiero: boolean;
  crm_ventas: boolean;
}

export type ModuleOverrides = Partial<Record<Entitlement, boolean>>;

const PLAN_ENTITLEMENTS: Record<PlanId, readonly Entitlement[]> = {
  // Gratis: planner + finanzas básicas (movimientos, rentabilidad) + proyectos + IA, todo con tope.
  free: ['core_projects', 'finance', 'planner', 'ai_assistant'],
  medio: ['core_projects', 'finance', 'finance_advanced', 'planner', 'ai_assistant', 'google_calendar', 'google_sheets'],
  pro: ['core_projects', 'finance', 'finance_advanced', 'planner', 'ai_assistant', 'google_calendar', 'google_sheets', 'crm', 'marketing_roi', 'advanced_analytics', 'team_management'],
  // Planes de oct 2026 (ya no se venden).
  basico: ['core_projects', 'finance', 'finance_advanced', 'planner', 'ai_assistant', 'google_calendar', 'google_sheets'],
  intermedio: ['core_projects', 'finance', 'finance_advanced', 'planner', 'ai_assistant', 'google_calendar', 'google_sheets', 'crm', 'marketing_roi'],
  full: ['core_projects', 'finance', 'finance_advanced', 'planner', 'ai_assistant', 'google_calendar', 'google_sheets', 'crm', 'marketing_roi', 'advanced_analytics', 'team_management'],
  // Legado: quien ya pagaba finanzas conserva todo lo de finanzas.
  projects: ['core_projects'],
  finance: ['core_projects', 'finance', 'finance_advanced', 'marketing_roi', 'google_sheets'],
  planner: ['core_projects', 'planner', 'ai_assistant', 'google_calendar'],
  crm: ['core_projects', 'crm', 'ai_assistant'],
  completo: ['core_projects', 'finance', 'finance_advanced', 'planner', 'crm', 'marketing_roi', 'ai_assistant', 'google_sheets', 'google_calendar', 'advanced_analytics', 'team_management'],
  custom: ['core_projects'],
  financiero: ['core_projects', 'finance', 'finance_advanced', 'marketing_roi', 'google_sheets'],
  crm_ventas: ['core_projects', 'crm', 'ai_assistant'],
};

const ALL_ENTITLEMENTS = Object.keys({
  core_projects: true,
  finance: true,
  finance_advanced: true,
  planner: true,
  crm: true,
  marketing_roi: true,
  ai_assistant: true,
  google_sheets: true,
  google_calendar: true,
  advanced_analytics: true,
  team_management: true,
}) as Entitlement[];

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && value in PLAN_ENTITLEMENTS;
}

export function getModules(
  plan: PlanId | null | undefined,
  isTeam: boolean,
  overrides: ModuleOverrides = {},
): ModuleFlags {
  const enabled = new Set<Entitlement>(isTeam ? ALL_ENTITLEMENTS : PLAN_ENTITLEMENTS[plan && isPlanId(plan) ? plan : 'free']);
  for (const entitlement of ALL_ENTITLEMENTS) {
    if (overrides[entitlement] === true) enabled.add(entitlement);
    if (overrides[entitlement] === false) enabled.delete(entitlement);
  }

  const has = (entitlement: Entitlement) => enabled.has(entitlement);
  return {
    core_projects: has('core_projects'),
    finance: has('finance'),
    finance_advanced: has('finance_advanced'),
    planner: has('planner'),
    crm: has('crm'),
    marketing_roi: has('marketing_roi'),
    ai_assistant: has('ai_assistant'),
    google_sheets: has('google_sheets'),
    google_calendar: has('google_calendar'),
    advanced_analytics: has('advanced_analytics'),
    team_management: has('team_management'),
    financiero: has('finance'),
    crm_ventas: has('crm'),
  };
}

// ---------------------------------------------------------------------------
// Límites de volumen (disparadores de upgrade). `null` = sin límite.
// ---------------------------------------------------------------------------
export type LimitKind = 'tareas_semana' | 'movimientos_mes' | 'proyectos_activos' | 'consultas_ia_mes' | 'miembros';

export interface PlanLimits {
  tareas_semana: number | null;
  movimientos_mes: number | null;
  proyectos_activos: number | null;
  consultas_ia_mes: number | null;
  miembros: number | null;
}

const UNLIMITED: PlanLimits = { tareas_semana: null, movimientos_mes: null, proyectos_activos: null, consultas_ia_mes: null, miembros: null };

const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  // `proyectos_activos` cuenta clientes activos (ver financeService).
  free: { tareas_semana: 15, movimientos_mes: 30, proyectos_activos: 2, consultas_ia_mes: 10, miembros: 1 },
  medio: { tareas_semana: null, movimientos_mes: null, proyectos_activos: 10, consultas_ia_mes: 150, miembros: 2 },
  pro: { tareas_semana: null, movimientos_mes: null, proyectos_activos: null, consultas_ia_mes: 1000, miembros: 5 },
  // Planes de oct 2026: conservan sus topes.
  basico: { tareas_semana: null, movimientos_mes: null, proyectos_activos: 3, consultas_ia_mes: 100, miembros: 1 },
  intermedio: { tareas_semana: null, movimientos_mes: null, proyectos_activos: 10, consultas_ia_mes: null, miembros: 3 },
  full: { ...UNLIMITED, miembros: 10 },
  // Legado: quien ya pagaba no recibe topes nuevos.
  projects: UNLIMITED, finance: UNLIMITED, planner: UNLIMITED, crm: UNLIMITED, completo: UNLIMITED, custom: UNLIMITED, financiero: UNLIMITED, crm_ventas: UNLIMITED,
};

export function getLimits(plan: PlanId | null | undefined, isTeam: boolean): PlanLimits {
  if (isTeam) return UNLIMITED;
  return PLAN_LIMITS[plan && isPlanId(plan) ? plan : 'free'];
}

/** ¿Cabe `extra` más dentro del límite? `used` = lo consumido hasta ahora. */
export function withinLimit(limits: PlanLimits, kind: LimitKind, used: number, extra = 1): boolean {
  const limit = limits[kind];
  if (limit === null) return true;
  return used + extra <= limit;
}

/**
 * Plan mínimo que desbloquea un módulo, o cuyo tope alcanza para `needed`
 * (sin `needed`: el primero sin tope). Ej.: 3 clientes → Medio; 11 → Pro.
 */
export function minimumPlanFor(target: { entitlement?: Entitlement; limit?: LimitKind; needed?: number }): PaidTier {
  for (const tier of PAID_TIERS) {
    if (target.entitlement && PLAN_ENTITLEMENTS[tier].includes(target.entitlement)) return tier;
    if (target.limit) {
      const limit = PLAN_LIMITS[tier][target.limit];
      if (limit === null || (target.needed !== undefined && target.needed <= limit)) return tier;
    }
  }
  return 'pro';
}

// ---------------------------------------------------------------------------
// Catálogo comercial (nov 2026). Lo que cobra Whop es el precio del plan
// configurado allá: si cambia uno, cambia el otro. Se pueden sobreescribir por
// entorno (VITE_PLAN_PRICE_*) sin tocar código.
// ---------------------------------------------------------------------------
export const PLAN_PRICES_USD: Record<PaidTier, { mensual: number; anualTotal: number }> = {
  medio: { mensual: 20, anualTotal: 168 },
  pro: { mensual: 50, anualTotal: 420 },
};

export type Periodo = 'mensual' | 'anual';

export interface PlanCard {
  id: PaidTier;
  nombre: string;
  etiqueta: string;
  para: string;
  promesa: string;
  /** USD/mes facturado mensual. */
  precioMensual: number;
  /** USD total facturado una vez al año. */
  precioAnualTotal: number;
  /** USD/mes equivalente del anual. */
  precioAnualMes: number;
  /** Ahorro del anual frente a 12 meses, en porcentaje entero. */
  ahorroAnualPct: number;
  destacado: boolean;
  incluye: string[];
  limites: PlanLimits;
}

function envPrice(key: string, fallback: number): number {
  const raw = (import.meta as any).env?.[key];
  const value = Number(typeof raw === 'string' ? raw.trim() : raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function card(id: PaidTier, base: Omit<PlanCard, 'id' | 'precioMensual' | 'precioAnualTotal' | 'precioAnualMes' | 'ahorroAnualPct' | 'limites'>): PlanCard {
  const key = id.toUpperCase();
  const mensual = envPrice(`VITE_PLAN_PRICE_${key}`, PLAN_PRICES_USD[id].mensual);
  const anualTotal = envPrice(`VITE_PLAN_PRICE_${key}_ANUAL`, PLAN_PRICES_USD[id].anualTotal);
  return {
    id, ...base,
    precioMensual: mensual,
    precioAnualTotal: anualTotal,
    precioAnualMes: Math.round((anualTotal / 12) * 100) / 100,
    ahorroAnualPct: Math.max(0, Math.round((1 - anualTotal / (mensual * 12)) * 100)),
    limites: PLAN_LIMITS[id],
  };
}

/** Lo que incluye el plan Gratis (no se cobra, así que no es una PlanCard). */
export const FREE_PLAN_SUMMARY = {
  nombre: 'Gratis',
  etiqueta: 'Hasta 2 clientes activos',
  promesa: 'Sabes si con cada servicio ganas o pierdes.',
  incluye: ['Hasta 2 clientes activos y servicios ilimitados', 'Ingresos, pagos y costos: 30 movimientos al mes', 'Rentabilidad y punto de equilibrio por servicio', '1 proyecto con horas y temporizador', 'Planner: 15 tareas por semana', 'Asistente IA: 10 consultas al mes'],
} as const;

export function getPlanCatalog(): PlanCard[] {
  return [
    card('medio', {
      nombre: 'Medio', etiqueta: 'Hasta 10 clientes activos', para: 'Para el freelancer que quiere controlar todo su negocio: caja, cobros, impuestos y cuánto le deja cada cliente.',
      promesa: 'Sabes cuánto te deja cada cliente, cuánto cobrar y cuándo pagar impuestos.', destacado: true,
      incluye: ['Hasta 10 clientes activos', 'Todo lo del plan Gratis, sin topes de movimientos ni tareas', 'Caja y bancos, cuentas por cobrar y por pagar, presupuesto', 'Impuestos: IVA, alertas DIAN y UVT', 'Rentabilidad por cliente y por servicio', 'Proyectos ilimitados · Google Calendar y respaldo en Sheets', 'Asistente IA: 150 consultas al mes · Memoria del negocio', '2 usuarios'],
    }),
    card('pro', {
      nombre: 'Pro', etiqueta: 'Clientes ilimitados', para: 'Para la pequeña agencia que vende, tiene equipo y maneja una o varias empresas.',
      promesa: 'Vendes, cobras y ves todas tus empresas en un solo tablero.', destacado: false,
      incluye: ['Clientes ilimitados', 'Todo lo del plan Medio', 'Ventas: CRM, pipeline y citas', 'Marketing ROI · WhatsApp, bot y Apollo', 'Reportes CEO, salud del negocio y metas de MRR', 'Varias empresas / holding', 'Asistente IA: 1.000 consultas al mes', '5 usuarios con permisos'],
    }),
  ];
}
