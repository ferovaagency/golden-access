// Deriva que modulos ve un cliente segun su plan. Los miembros del equipo de
// Ferova (isTeam) siguen viendo todo, igual que hoy (hasPaid = paid || team).
export type PlanId = 'financiero' | 'crm_ventas' | 'completo';

export interface ModuleFlags {
  financiero: boolean;
  crm_ventas: boolean;
}

export function getModules(plan: PlanId | null | undefined, isTeam: boolean): ModuleFlags {
  if (isTeam) return { financiero: true, crm_ventas: true };
  if (plan === 'crm_ventas') return { financiero: false, crm_ventas: true };
  if (plan === 'completo') return { financiero: true, crm_ventas: true };
  return { financiero: true, crm_ventas: false };
}
