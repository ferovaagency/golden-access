import type { Cliente, Hora, Servicio, Venta } from '../../types';

export interface ProjectObjective { id: string; text: string; completado: boolean; metaFecha?: string; }
export interface ProjectKpi { id: string; nombre: string; meta: string; actual: string; tendencia: 'Subiendo' | 'Estable' | 'Bajando'; }
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
