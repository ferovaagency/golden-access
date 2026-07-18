// Product access is resolved from the plan, then adjusted by explicit admin
// overrides. Legacy identifiers are accepted only for existing subscriptions.
export type PlanId =
  | 'projects'
  | 'finance'
  | 'planner'
  | 'crm'
  | 'completo'
  | 'custom'
  | 'financiero'
  | 'crm_ventas';

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
  const enabled = new Set<Entitlement>(isTeam ? ALL_ENTITLEMENTS : PLAN_ENTITLEMENTS[plan && isPlanId(plan) ? plan : 'projects']);
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
