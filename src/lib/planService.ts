// Product access is resolved from the plan, then adjusted by explicit admin
// overrides. Legacy identifiers are accepted only for existing subscriptions.
//
// Modelo (oct 2026): 3 niveles de pago con 7 días de prueba sin tarjeta
// (cardless trial de Paddle) en el plan que la persona elija.
//   free        → id reservado (ya no se vende; sin suscripción no hay acceso).
//   basico      → Control operativo personal: Calendar, Sheets, finanzas
//                 completas, impuestos y punto de equilibrio.
//   intermedio  → Automatización comercial e IA: CRM, Apollo, WhatsApp,
//                 rentabilidad por cliente, proyectos ilimitados.
//   full        → Multi-empresa, BI y equipo.
// Los ids viejos (completo, financiero, …) siguen resolviendo para quien ya
// los tiene; `completo` equivale a `full`.
export type PlanId =
  | 'free'
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

/** Los tres planes que se venden hoy, en orden ascendente. */
export const PAID_TIERS = ['basico', 'intermedio', 'full'] as const;
export type PaidTier = typeof PAID_TIERS[number];
/** Días de prueba sin tarjeta. Debe coincidir con el trial_period de los prices en Paddle. */
export const TRIAL_DAYS = 7;

export type Entitlement =
  | 'core_projects'
  | 'finance'
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
  // Freemium: planner + finanzas básicas + proyectos + IA, todo con tope.
  free: ['core_projects', 'finance', 'planner', 'ai_assistant'],
  basico: ['core_projects', 'finance', 'planner', 'ai_assistant', 'google_calendar', 'google_sheets'],
  intermedio: ['core_projects', 'finance', 'planner', 'ai_assistant', 'google_calendar', 'google_sheets', 'crm', 'marketing_roi'],
  full: ['core_projects', 'finance', 'planner', 'ai_assistant', 'google_calendar', 'google_sheets', 'crm', 'marketing_roi', 'advanced_analytics', 'team_management'],
  // Legado.
  projects: ['core_projects'],
  finance: ['core_projects', 'finance', 'marketing_roi', 'google_sheets'],
  planner: ['core_projects', 'planner', 'ai_assistant', 'google_calendar'],
  crm: ['core_projects', 'crm', 'ai_assistant'],
  completo: ['core_projects', 'finance', 'planner', 'crm', 'marketing_roi', 'ai_assistant', 'google_sheets', 'google_calendar', 'advanced_analytics', 'team_management'],
  custom: ['core_projects'],
  financiero: ['core_projects', 'finance', 'marketing_roi', 'google_sheets'],
  crm_ventas: ['core_projects', 'crm', 'ai_assistant'],
};

const ALL_ENTITLEMENTS = Object.keys({
  core_projects: true,
  finance: true,
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
  free: { tareas_semana: 15, movimientos_mes: 20, proyectos_activos: 1, consultas_ia_mes: 10, miembros: 1 },
  // La escalera es por clientes activos: todos los planes son para
  // freelancers y suben según cuántos clientes atienden.
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
 * (sin `needed`: el primero sin tope). Ej.: 4 clientes → Intermedio; 11 → Full.
 */
export function minimumPlanFor(target: { entitlement?: Entitlement; limit?: LimitKind; needed?: number }): 'basico' | 'intermedio' | 'full' {
  for (const tier of ['basico', 'intermedio', 'full'] as const) {
    if (target.entitlement && PLAN_ENTITLEMENTS[tier].includes(target.entitlement)) return tier;
    if (target.limit) {
      const limit = PLAN_LIMITS[tier][target.limit];
      if (limit === null || (target.needed !== undefined && target.needed <= limit)) return tier;
    }
  }
  return 'full';
}

// ---------------------------------------------------------------------------
// Catálogo comercial. Precios = los prices reales de Paddle (8 oct 2026):
// mensual 19 / 29 / 99 y anual 159 / 249 / 829 (≈ 30 % menos). Se pueden
// sobreescribir por entorno (VITE_PLAN_PRICE_*) sin tocar código, pero lo
// que cobra Paddle es lo que tenga el price: si cambia uno, cambia el otro.
// ---------------------------------------------------------------------------
export const PLAN_PRICES_USD: Record<PaidTier, { mensual: number; anualTotal: number }> = {
  basico: { mensual: 19, anualTotal: 159 },
  intermedio: { mensual: 29, anualTotal: 249 },
  full: { mensual: 99, anualTotal: 829 },
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

export function getPlanCatalog(): PlanCard[] {
  return [
    card('basico', {
      nombre: 'Básico', etiqueta: 'Hasta 3 clientes activos', para: 'Para el freelancer que arranca: pocos clientes y la necesidad de saber si con ellos gana o pierde.',
      promesa: 'Sabes cuánto te deja cada hora, cuánto cobrar y cuándo pagar impuestos.', destacado: false,
      incluye: ['Hasta 3 clientes activos con rentabilidad por hora', 'Planner con captura en lenguaje natural + Google Calendar', 'Finanzas completas: ingresos, egresos, IVA e impuestos, punto de equilibrio', 'Respaldo y sincronización con Google Sheets', 'Asistente IA: 100 consultas al mes'],
    }),
    card('intermedio', {
      nombre: 'Intermedio', etiqueta: 'Hasta 10 clientes activos', para: 'Para el freelancer con cartera: varios clientes a la vez, cotizaciones abiertas y la pregunta de a quién cobrarle más.',
      promesa: 'Sabes a qué cliente cobrarle más y de dónde sale el próximo.', destacado: true,
      incluye: ['Hasta 10 clientes activos', 'Todo lo del Básico', 'CRM: pipeline, cotizaciones y valor ganado', 'Leads enriquecidos con Apollo y oportunidades en Reddit', 'WhatsApp: avisos y asistencia con contexto', 'Rentabilidad por cliente y por servicio · IA sin tope razonable', 'Acceso a actualizaciones y funciones nuevas', 'Próximamente: vitrina para encontrar clientes'],
    }),
    card('full', {
      nombre: 'Full', etiqueta: 'Clientes ilimitados', para: 'Para el freelancer que ya es una pequeña agencia: muchos clientes, varias marcas y gente que ayuda.',
      promesa: 'Todos tus clientes y marcas en un solo tablero, y el sistema te avisa antes de que algo se rompa.', destacado: false,
      incluye: ['Clientes ilimitados', 'Todo lo del Intermedio', 'Varias marcas o empresas desde una sola cuenta', 'Motor BI: salud del negocio y puntos ciegos', 'Reportes ejecutivos', 'Colaboradores con roles (hasta 10)', 'Soporte prioritario y onboarding asistido', 'Primeros en probar cada función nueva (acceso anticipado)', 'Próximamente: vitrina para encontrar clientes, con prioridad'],
    }),
  ];
}
