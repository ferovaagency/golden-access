import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Loader2, Play, Check } from 'lucide-react';
import { plannerService, type PlannerTask } from '../../lib/plannerService';
import { formatMinutes } from '../../lib/duration';

/**
 * Bloque "Hoy" del inicio: muestra las tareas del planner agendadas para hoy y
 * permite iniciarlas o cerrarlas sin salir del dashboard. Reutiliza el mismo
 * servicio del Planner (start/complete ya registran horas automáticamente).
 */
export function TodayPlannerBlock({ onOpenPlanner }: { onOpenPlanner?: () => void }) {
  const [tasks, setTasks] = useState<PlannerTask[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    try {
      const all = await plannerService.listTasks();
      setTasks(all.filter((task) => task.scheduled_for === today && task.status !== 'cancelled'));
    } catch {
      setTasks([]);
    }
  }, [today]);

  useEffect(() => { void load(); }, [load]);

  const act = async (id: string, action: 'start' | 'done') => {
    setBusyId(id);
    try {
      if (action === 'start') await plannerService.startTask(id);
      else {
        const result = await plannerService.completeTask(id);
        const parts: string[] = [];
        if (result.estimatedMinutes != null) parts.push(`estimado ${result.estimatedMinutes} min`);
        if (result.actualMinutes != null) parts.push(`real ${result.actualMinutes} min`);
        if (result.hourLogged) parts.push(result.missingService ? `en Horas (${result.hourDate}), falta asignar servicio` : `en Horas (${result.hourDate})`);
        setNotice(parts.length ? parts.join(' · ') : 'Tarea completada.');
        window.setTimeout(() => setNotice(null), 9000);
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const done = (tasks || []).filter((task) => task.status === 'done').length;
  const plannedMinutes = (tasks || []).reduce((sum, task) => sum + (task.estimated_minutes || 0), 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Hoy</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">Tu día en el Planner</h3>
          <p className="mt-1 text-xs text-slate-500">{tasks ? `${done}/${tasks.length} tareas · ${formatMinutes(plannedMinutes)} planificados` : 'Cargando agenda…'}</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-blue-600" />
          {onOpenPlanner && <button onClick={onOpenPlanner} className="text-xs font-semibold text-blue-600 hover:text-blue-800">Abrir Planner</button>}
        </div>
      </div>
      <div className="mt-4 divide-y divide-slate-100">
        {tasks === null && <p className="py-6 text-center text-sm text-slate-400"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Cargando…</p>}
        {tasks?.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No hay tareas agendadas para hoy.</p>}
        {tasks?.map((task) => (
          <div key={task.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className={`truncate text-sm font-medium ${task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{formatMinutes(task.actual_minutes ?? task.estimated_minutes ?? 0)}{task.status === 'in_progress' ? ' · en curso' : ''}</p>
            </div>
            {task.status !== 'done' && (
              <div className="flex shrink-0 items-center gap-2">
                {task.status !== 'in_progress' && (
                  <button disabled={busyId === task.id} onClick={() => act(task.id, 'start')} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"><Play className="h-3 w-3" />Iniciar</button>
                )}
                <button disabled={busyId === task.id} onClick={() => act(task.id, 'done')} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"><Check className="h-3 w-3" />Terminar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
