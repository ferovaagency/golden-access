import { useMemo } from 'react';
import { Users2 } from 'lucide-react';
import type { PlannerClient, PlannerTask } from '../../lib/plannerService';
import { formatMinutes } from '../../lib/duration';

/**
 * Progreso del día agrupado por cliente: cuánto tiempo hay planificado, cuánto
 * se completó y el porcentaje real. Solo lectura sobre las tareas ya cargadas
 * en el planner — no consulta ni escribe nada nuevo.
 */
export function DayClientProgress({ tasks, clients, date }: { tasks: PlannerTask[]; clients: PlannerClient[]; date: string }) {
  const rows = useMemo(() => {
    const today = tasks.filter((task) => task.scheduled_for === date && task.status !== 'cancelled');
    const map = new Map<string, { name: string; planned: number; done: number; total: number; completed: number }>();
    for (const task of today) {
      const key = task.client_ref || 'sin-cliente';
      const name = clients.find((client) => client.id === task.client_ref)?.nombre || 'Sin cliente asignado';
      const entry = map.get(key) || { name, planned: 0, done: 0, total: 0, completed: 0 };
      const minutes = task.actual_minutes ?? task.estimated_minutes ?? 0;
      entry.planned += task.estimated_minutes || 0;
      entry.total += 1;
      if (task.status === 'done') { entry.done += minutes; entry.completed += 1; }
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.planned - a.planned);
  }, [tasks, clients, date]);

  if (!rows.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <Users2 className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-900">Progreso del día por cliente</h3>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">Tiempo planificado frente a tiempo ya completado en las tareas de hoy.</p>
      <div className="mt-3 space-y-3">
        {rows.map((row) => {
          const pct = row.planned > 0 ? Math.min(100, Math.round((row.done / row.planned) * 100)) : row.completed === row.total ? 100 : 0;
          return (
            <div key={row.name}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="font-semibold text-slate-800">{row.name}</span>
                <span className="text-slate-500">{formatMinutes(row.done)} de {formatMinutes(row.planned)} · {row.completed}/{row.total} tareas</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
