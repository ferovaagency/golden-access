import type { AppData, Cliente } from '../../types';
import type { Project, ProjectDeliverable, ProjectKpi, ProjectObjective } from './types';

function parseItems<T>(value?: string): T[] {
  if (!value) return [];
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed as T[] : []; }
  catch { return []; }
}

export function buildProjectPortfolio(data: Pick<AppData, 'clientes' | 'servicios' | 'ventas' | 'horas'>): Project[] {
  return data.clientes.filter((client) => client.activo).map((client) => ({
    id: client.id,
    client,
    services: data.servicios.filter((service) => data.ventas.some((sale) => sale.cliente_id === client.id && sale.servicio_id === service.id) || data.horas.some((entry) => entry.cliente_id === client.id && entry.servicio_id === service.id)),
    sales: data.ventas.filter((sale) => sale.cliente_id === client.id),
    hours: data.horas.filter((entry) => entry.cliente_id === client.id),
    objectives: parseItems<ProjectObjective>(client.objetivos),
    kpis: parseItems<ProjectKpi>(client.kpis),
    deliverables: parseItems<ProjectDeliverable>(client.entregables),
  }));
}

export function updateProjectClient(clients: Cliente[], projectId: string, update: { marcaInfo: string; responsable: string; progreso: number; objectives: ProjectObjective[]; kpis: ProjectKpi[]; deliverables: ProjectDeliverable[] }): Cliente[] {
  return clients.map((client) => client.id === projectId ? { ...client, marca_info: update.marcaInfo, responsable: update.responsable, progreso: update.progreso, objetivos: JSON.stringify(update.objectives), kpis: JSON.stringify(update.kpis), entregables: JSON.stringify(update.deliverables) } : client);
}
