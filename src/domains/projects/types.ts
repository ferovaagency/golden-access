import type { Cliente, Hora, Servicio, Venta } from '../../types';

/** Periodicidad con la que se mide/persigue un objetivo o KPI. */
export type ProjectCadence = 'diario' | 'semanal' | 'mensual' | 'anual';

export interface ProjectObjective { id: string; text: string; completado: boolean; metaFecha?: string; progreso?: number; cadencia?: ProjectCadence; }
export interface ProjectKpiHistory { fecha: string; valor: number; }
export interface ProjectKpi { id: string; nombre: string; meta: string; actual: string; tendencia: 'Subiendo' | 'Estable' | 'Bajando'; objetivo_id?: string; historial?: ProjectKpiHistory[]; cadencia?: ProjectCadence; }
export interface ProjectDeliverable { id: string; nombre: string; estado: 'Pendiente' | 'En Progreso' | 'Cumplido'; fecha?: string; }

/** Current projects are delivery contexts persisted on a client record. */
export interface Project {
  id: string;
  client: Cliente;
  services: Servicio[];
  sales: Venta[];
  hours: Hora[];
  objectives: ProjectObjective[];
  kpis: ProjectKpi[];
  deliverables: ProjectDeliverable[];
}
