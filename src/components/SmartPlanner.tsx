import React, { useEffect, useState } from 'react';
import { Sparkles, Wand2, Loader2, Check, Clock, Zap, Battery, BatteryLow, Trash2, ChevronRight, Sunrise, AlertTriangle, Lightbulb, TrendingUp, Info, Lock, Edit2, X, CalendarDays, Columns3, List, SlidersHorizontal } from 'lucide-react';
import { usePlanner } from '../hooks/usePlanner';
import { plannerService, type PlannerBlock, type PlannerCategory, type PlannerEnergy, type PlannerTask } from '../lib/plannerService';
import { AiDisclosure } from './AiDisclosure';

const categoryMeta: Record<PlannerCategory, { label: string; tone: string }> = {
  deep_work: { label: 'Deep Work', tone: 'bg-violet-50 text-violet-700 border-violet-200' },
  meetings: { label: 'Reuniones', tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  admin: { label: 'Admin', tone: 'bg-slate-100 text-slate-700 border-slate-200' },
  creative: { label: 'Creativo', tone: 'bg-pink-50 text-pink-700 border-pink-200' },
  calls: { label: 'Llamadas', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  learning: { label: 'Aprender', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  personal: { label: 'Personal', tone: 'bg-teal-50 text-teal-700 border-teal-200' },
  breaks: { label: 'Descanso', tone: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
};

const energyIcon: Record<PlannerEnergy, any> = { high: Zap, medium: Battery, low: BatteryLow };
const priorityTone: Record<string, string> = { urgent: 'bg-red-100 text-red-700', high: 'bg-amber-100 text-amber-700', medium: 'bg-slate-100 text-slate-600', low: 'bg-slate-50 text-slate-500' };
const scoreOptions = [[1, 'Muy bajo'], [2, 'Bajo'], [3, 'Medio'], [4, 'Alto'], [5, 'Muy alto']] as const;
const clientTones = ['bg-violet-100 text-violet-700 border-violet-200', 'bg-sky-100 text-sky-700 border-sky-200', 'bg-emerald-100 text-emerald-700 border-emerald-200', 'bg-pink-100 text-pink-700 border-pink-200', 'bg-amber-100 text-amber-800 border-amber-200'];
function clientTone(id?: string | null) { return clientTones[Math.abs(Array.from(id || '').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % clientTones.length]; }

function fmtTime(iso: string, timeZone?: string) { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', ...(timeZone ? { timeZone } : {}) }); }

function visiblePriorityScore(task: PlannerTask) {
  const days = task.deadline ? Math.ceil((new Date(task.deadline).getTime() - Date.now()) / 86_400_000) : Number.POSITIVE_INFINITY;
  const urgency = !task.deadline ? 1 : days <= 1 ? 5 : days <= 3 ? 4 : days <= 7 ? 3 : 2;
  return (0.30 * urgency) + (0.25 * (task.financial_impact ?? 3)) + (0.20 * (task.client_impact ?? 3)) + (0.15 * (task.risk_score ?? 3)) + (0.10 * (task.execution_ease ?? 3));
}

export default function SmartPlanner() {
  const p = usePlanner();
  const [plannerView, setPlannerView] = useState<'day' | 'week' | 'month'>(() => (localStorage.getItem('ferova.planner.view') as 'day' | 'week' | 'month') || 'day');
  const [compactCalendar, setCompactCalendar] = useState(() => localStorage.getItem('ferova.planner.compact') === '1');
  const [dump, setDump] = useState('');
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockTitle, setBlockTitle] = useState('');
  const [blockStart, setBlockStart] = useState('09:00');
  const [blockEnd, setBlockEnd] = useState('10:00');
  const [editingTask, setEditingTask] = useState<PlannerTask | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDate, setTaskDate] = useState('');
  const [taskTime, setTaskTime] = useState('');
  const [taskEstimatedMinutes, setTaskEstimatedMinutes] = useState(30);
  const [taskActualMinutes, setTaskActualMinutes] = useState<number | ''>('');
  const [taskProtected, setTaskProtected] = useState(false);
  const [taskDeadline, setTaskDeadline] = useState('');
  const [taskPriority, setTaskPriority] = useState<PlannerTask['priority']>('medium');
  const [taskFinancialImpact, setTaskFinancialImpact] = useState(3);
  const [taskClientImpact, setTaskClientImpact] = useState(3);
  const [taskRiskScore, setTaskRiskScore] = useState(3);
  const [taskExecutionEase, setTaskExecutionEase] = useState(3);
  const [taskDependencies, setTaskDependencies] = useState<string[]>([]);
  const [taskCategory, setTaskCategory] = useState<PlannerCategory>('admin');
  const [taskClientId, setTaskClientId] = useState('');
  const [taskRepeatDays, setTaskRepeatDays] = useState<number[]>([]);
  const [taskRepeatUntil, setTaskRepeatUntil] = useState('');
  const [taskSyncGoogle, setTaskSyncGoogle] = useState(false);
  const [taskSaveNotice, setTaskSaveNotice] = useState<string | null>(null);

  useEffect(() => { localStorage.setItem('ferova.planner.view', plannerView); }, [plannerView]);
  useEffect(() => { localStorage.setItem('ferova.planner.compact', compactCalendar ? '1' : '0'); }, [compactCalendar]);

  const submitDump = async () => {
    const text = dump.trim();
    if (!text) return;
    setDump('');
    await p.classify(text);
  };

  const createProtectedBlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!blockTitle.trim() || blockEnd <= blockStart) return;
    await p.createBlock({
      title: blockTitle,
      starts_at: `${p.date}T${blockStart}:00`,
      ends_at: `${p.date}T${blockEnd}:00`,
      category: 'meetings',
      protected: true,
    });
    setBlockTitle('');
    setShowBlockForm(false);
  };

  const openTaskEditor = (task: PlannerTask) => {
    const linkedBlock = p.blocks.find((block) => block.task_ids?.includes(task.id));
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDate((linkedBlock?.starts_at || task.scheduled_for || p.date).slice(0, 10));
    setTaskTime(linkedBlock ? new Date(linkedBlock.starts_at).toLocaleTimeString('en-GB', { timeZone: p.timeZone, hour: '2-digit', minute: '2-digit', hour12: false }) : '');
    setTaskEstimatedMinutes(task.estimated_minutes);
    setTaskActualMinutes(task.actual_minutes ?? '');
    setTaskProtected(linkedBlock?.protected ?? false);
    setTaskDeadline(task.deadline?.slice(0, 10) || '');
    setTaskPriority(task.priority);
    setTaskFinancialImpact(task.financial_impact ?? 3);
    setTaskClientImpact(task.client_impact ?? 3);
    setTaskRiskScore(task.risk_score ?? 3);
    setTaskExecutionEase(task.execution_ease ?? 3);
    setTaskDependencies(task.dependency_task_ids || []);
    setTaskCategory(task.category);
    setTaskClientId(task.client_ref || '');
    setTaskRepeatDays(task.recurrence_days || []);
    setTaskRepeatUntil(task.recurrence_until || '');
    setTaskSyncGoogle(task.sync_to_google_calendar || false);
  };

  const saveTaskEditor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingTask || !taskTitle.trim() || taskEstimatedMinutes < 5) return;
    const result = await p.updateTask(editingTask.id, {
      title: taskTitle,
      category: taskCategory,
      priority: taskPriority,
      financial_impact: taskFinancialImpact,
      client_impact: taskClientImpact,
      risk_score: taskRiskScore,
      execution_ease: taskExecutionEase,
      dependency_task_ids: taskDependencies,
      client_ref: taskClientId || null,
      deadline: taskDeadline || null,
      estimated_minutes: taskEstimatedMinutes,
      actual_minutes: taskActualMinutes === '' ? null : Number(taskActualMinutes),
      scheduled_for: taskDate || null,
      schedule_time: taskTime || null,
      protected: taskProtected,
      recurrence_days: taskRepeatDays,
      recurrence_until: taskRepeatDays.length ? (taskRepeatUntil || null) : null,
      sync_to_google_calendar: taskSyncGoogle,
    });
    if (taskSyncGoogle) setTaskSaveNotice(result?.message || 'Tarea guardada.');
    setEditingTask(null);
  };

  const openTasks = p.tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
  const completedToday = p.tasks.filter((t) => t.status === 'done' && (t.completed_at || '').slice(0, 10) === p.date);

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Smart Planner</p>
          <h1 className="font-display text-3xl font-semibold text-slate-900 tracking-tight mt-1">Tu día, bajo control.</h1>
          <p className="text-sm text-slate-500 mt-1">Vacía tu mente. El sistema clasifica, prioriza y arma bloques por energía.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={p.date}
            onChange={(e) => p.setDate(e.target.value)}
            className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
          />
          <button
            onClick={p.planDay}
            disabled={p.busy === 'plan' || openTasks.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {p.busy === 'plan' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            Organizar agenda automáticamente
          </button>
        </div>
      </header>

      {p.rescheduledCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {p.rescheduledCount === 1
            ? '1 tarea de un día anterior no se completó y se reprogramó automáticamente para hoy.'
            : `${p.rescheduledCount} tareas de días anteriores no se completaron y se reprogramaron automáticamente para hoy.`}
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1" aria-label="Vista del planner">
          {([
            ['day', 'Día', List],
            ['week', 'Semana', Columns3],
            ['month', 'Calendario', CalendarDays],
          ] as const).map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setPlannerView(value)} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold ${plannerView === value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><Icon className="h-4 w-4" />{label}</button>)}
        </div>
        <label className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600"><SlidersHorizontal className="h-4 w-4 text-slate-400" /><input type="checkbox" checked={compactCalendar} onChange={(event) => setCompactCalendar(event.target.checked)} /> Vista compacta</label>
      </section>

      <AiDisclosure />

      {p.error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{p.error}</div>}

      {plannerView !== 'day' && <PlannerCalendar view={plannerView} date={p.date} tasks={openTasks} clients={p.clients} compact={compactCalendar} timeZone={p.timeZone} onSelectDate={(date) => { p.setDate(date); setPlannerView('day'); }} onEdit={openTaskEditor} />}

      {plannerView === 'day' && <DayAgendaSummary blocks={p.blocks} tasks={p.tasks} clients={p.clients} timeZone={p.timeZone} onComplete={p.completeTask} />}

      {/* Briefing */}
      <section className="rounded-2xl border border-[var(--line)] bg-gradient-to-br from-blue-50/60 to-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-100 text-blue-700"><Sunrise className="h-4 w-4" /></div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Resumen del día (generado por IA)</p>
              <p className="text-base font-semibold text-slate-900 mt-1">{p.briefing?.headline || 'Todavía no hay resumen generado.'}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Solo un vistazo narrativo — tu lista real de tareas está en "Bandeja de tareas", más abajo.</p>
            </div>
          </div>
          <button
            onClick={() => p.regenerateBriefing('morning')}
            disabled={p.busy === 'briefing'}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-50 inline-flex items-center gap-1"
          >
            {p.busy === 'briefing' && <Loader2 className="h-3 w-3 animate-spin" />} Generar
          </button>
        </div>
        {p.briefing?.bullets?.length ? (
          <ul className="mt-3 space-y-1.5 pl-12">
            {p.briefing.bullets.map((b, i) => (
              <li key={i} className="text-sm text-slate-700 flex items-start gap-2"><span className="text-slate-300 mt-1">•</span>{b}</li>
            ))}
          </ul>
        ) : null}
        {p.briefing?.suggested_focus && (
          <div className="mt-3 ml-12 rounded-xl bg-white border border-[var(--line)] px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">Foco sugerido:</span> {p.briefing.suggested_focus}
            {p.briefing.estimated_workload_minutes ? <span className="ml-2 text-slate-400">· ~{Math.round(p.briefing.estimated_workload_minutes / 60)}h</span> : null}
          </div>
        )}
      </section>

      {/* Brain Dump */}
      <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-900">Brain dump</h2>
          <span className="text-xs text-slate-400">El sistema detecta tipo, prioridad, energía, duración y fecha límite.</span>
        </div>
        <textarea
          value={dump}
          onChange={(e) => setDump(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void submitDump(); }}
          placeholder={'Escribí lo que sea. Ej.:\n- Llamar a Juan mañana\n- Pagar impuestos el viernes\n- Crear landing para producto X\n- Reunión con cliente Y'}
          className="mt-3 block w-full resize-none rounded-xl border border-[var(--line)] bg-slate-50 px-3 py-3 text-sm outline-none focus:border-blue-300 focus:bg-white min-h-28"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">⌘/Ctrl + Enter para clasificar</span>
          <button
            onClick={submitDump}
            disabled={!dump.trim() || p.busy === 'classify'}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {p.busy === 'classify' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Clasificar tareas
          </button>
        </div>
      </section>

      {/* Timeline of blocks */}
      {plannerView === 'day' && <section>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Tu agenda del {new Date(p.date + 'T00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400">{p.blocks.length} bloques</span>
            <button onClick={() => setShowBlockForm((value) => !value)} className="text-xs font-semibold text-blue-700 hover:text-blue-900">{showBlockForm ? 'Cancelar' : '+ Bloque protegido'}</button>
          </div>
        </div>
        <p className="mb-3 text-[11px] text-slate-400">Esto sí es horario: cada bloque tiene una hora fija. "Reorganizar mi día" puede moverlos, excepto los marcados <span className="inline-flex items-center gap-0.5 text-amber-700"><Lock className="h-2.5 w-2.5" />Protegido</span>.</p>
        {showBlockForm && (
          <form onSubmit={createProtectedBlock} className="mb-3 grid gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <label className="text-xs text-slate-600">Evento o compromiso
              <input value={blockTitle} onChange={(event) => setBlockTitle(event.target.value)} required placeholder="Ej. reunión con cliente" className="mt-1 block w-full rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-500" />
            </label>
            <label className="text-xs text-slate-600">Inicio
              <input type="time" value={blockStart} onChange={(event) => setBlockStart(event.target.value)} required className="mt-1 block rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-500" />
            </label>
            <label className="text-xs text-slate-600">Fin
              <input type="time" value={blockEnd} onChange={(event) => setBlockEnd(event.target.value)} required className="mt-1 block rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-500" />
            </label>
            <button type="submit" disabled={p.busy === 'block' || blockEnd <= blockStart} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{p.busy === 'block' ? 'Guardando…' : 'Proteger'}</button>
            <p className="sm:col-span-4 text-[11px] text-blue-800">Este bloque queda protegido: el planificador no lo moverá al reorganizar tu día.</p>
          </form>
        )}
        {p.blocks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-6 text-center text-sm text-slate-500">
            Sin bloques aún. Presioná <span className="font-semibold text-slate-700">Reorganizar mi día</span> para que el planificador arme el horario.
          </div>
        ) : (
          <ul className="space-y-2">
            {p.blocks.map((b) => <BlockRow key={b.id} block={b} tasks={p.tasks} clients={p.clients} timeZone={p.timeZone} onComplete={p.completeTask} />)}
          </ul>
        )}
      </section>}

      {/* Tasks queue */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Tu lista de tareas · {openTasks.length}</h2><span className="text-[11px] text-slate-400">Esto es lo que tenés pendiente. Edita agenda, entrega, prioridad, cliente y recurrencia; "Reorganizar mi día" las convierte en bloques de la agenda.</span></div>
        {taskSaveNotice && <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">{taskSaveNotice}</div>}
        {editingTask && (
          <form onSubmit={saveTaskEditor} className="mb-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">Editar tarea</p><p className="text-[11px] text-slate-600">Una hora crea o actualiza su bloque de agenda.</p></div><button type="button" onClick={() => setEditingTask(null)} className="text-slate-500 hover:text-slate-900" aria-label="Cerrar edición"><X className="h-4 w-4" /></button></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="sm:col-span-2 text-xs text-slate-600">Tarea<input required value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} className="mt-1 block w-full rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-500" /></label>
              <label className="text-xs text-slate-600">Día<input type="date" value={taskDate} onChange={(event) => setTaskDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-500" /></label>
              <label className="text-xs text-slate-600">Hora<input type="time" value={taskTime} onChange={(event) => setTaskTime(event.target.value)} className="mt-1 block w-full rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-500" /></label>
              <label className="text-xs text-slate-600">Fecha de entrega<input type="date" value={taskDeadline} onChange={(event) => setTaskDeadline(event.target.value)} className="mt-1 block w-full rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-500" /></label>
              <label className="text-xs text-slate-600">Prioridad<select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as PlannerTask['priority'])} className="mt-1 block w-full rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label>
              <label className="text-xs text-slate-600">Impacto financiero<select value={taskFinancialImpact} onChange={(event) => setTaskFinancialImpact(Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm">{scoreOptions.map(([value, label]) => <option key={value} value={value}>{value} · {label}</option>)}</select></label>
              <label className="text-xs text-slate-600">Impacto cliente<select value={taskClientImpact} onChange={(event) => setTaskClientImpact(Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm">{scoreOptions.map(([value, label]) => <option key={value} value={value}>{value} · {label}</option>)}</select></label>
              <label className="text-xs text-slate-600">Riesgo al aplazar<select value={taskRiskScore} onChange={(event) => setTaskRiskScore(Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm">{scoreOptions.map(([value, label]) => <option key={value} value={value}>{value} · {label}</option>)}</select></label>
              <label className="text-xs text-slate-600">Facilidad de ejecución<select value={taskExecutionEase} onChange={(event) => setTaskExecutionEase(Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm">{scoreOptions.map(([value, label]) => <option key={value} value={value}>{value} · {label}</option>)}</select></label>
              <label className="sm:col-span-2 text-xs text-slate-600">Depende de (solo se agenda al completar estas tareas)<select multiple value={taskDependencies} onChange={(event) => setTaskDependencies(Array.from(event.target.selectedOptions, (option) => option.value))} className="mt-1 block min-h-20 w-full rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm">{openTasks.filter((task) => task.id !== editingTask.id).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select><span className="mt-1 block text-[10px] text-slate-400">Usa Ctrl/Cmd para seleccionar varias.</span></label>
              <label className="text-xs text-slate-600">Categoría<select value={taskCategory} onChange={(event) => setTaskCategory(event.target.value as PlannerCategory)} className="mt-1 block w-full rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm">{Object.entries(categoryMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></label>
              <label className="text-xs text-slate-600">Cliente<select value={taskClientId} onChange={(event) => setTaskClientId(event.target.value)} className="mt-1 block w-full rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm"><option value="">Sin cliente</option>{p.clients.map((client) => <option key={client.id} value={client.id}>{client.nombre}</option>)}</select></label>
              <label className="text-xs text-slate-600">Duración estimada (min)<input type="number" min="5" step="5" value={taskEstimatedMinutes} onChange={(event) => setTaskEstimatedMinutes(Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-500" /></label>
              <label className="text-xs text-slate-600">Tiempo dedicado (min)<input type="number" min="0" step="5" value={taskActualMinutes} onChange={(event) => setTaskActualMinutes(event.target.value === '' ? '' : Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-500" /></label>
              <label className="flex items-end gap-2 pb-2 text-xs text-slate-700"><input type="checkbox" checked={taskProtected} disabled={!taskTime} onChange={(event) => setTaskProtected(event.target.checked)} className="h-4 w-4 rounded border-blue-300 text-blue-600" /><span>Bloque protegido</span></label>
              <fieldset className="sm:col-span-2 lg:col-span-4 rounded-lg border border-blue-200 bg-white p-3"><legend className="px-1 text-xs text-slate-600">Repetir semanalmente</legend><div className="flex flex-wrap gap-2">{[['D',0],['L',1],['M',2],['X',3],['J',4],['V',5],['S',6]].map(([label, day]) => <button type="button" key={String(day)} onClick={() => setTaskRepeatDays((days) => days.includes(Number(day)) ? days.filter((value) => value !== Number(day)) : [...days, Number(day)].sort())} className={`h-8 w-8 rounded-full text-xs font-semibold ${taskRepeatDays.includes(Number(day)) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>)}<label className="ml-2 text-xs text-slate-600">Hasta<input type="date" disabled={!taskRepeatDays.length} value={taskRepeatUntil} onChange={(event) => setTaskRepeatUntil(event.target.value)} className="ml-2 rounded border border-blue-200 px-2 py-1" /></label><label className="ml-auto flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={taskSyncGoogle} disabled={!taskDate || !taskTime} onChange={(event) => setTaskSyncGoogle(event.target.checked)} /> Sincronizar con Google Calendar</label></div></fieldset>
              <div className="flex items-end gap-2"><button type="submit" disabled={p.busy === 'task'} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{p.busy === 'task' ? 'Guardando…' : 'Guardar tarea'}</button><button type="button" onClick={() => setEditingTask(null)} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button></div>
            </div>
          </form>
        )}
        {openTasks.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Bandeja vacía.</p>
        ) : (
          <ul className="space-y-1.5">
            {openTasks.map((t) => <TaskRow key={t.id} task={t} clientName={p.clients.find((client) => client.id === t.client_ref)?.nombre} isProtected={p.blocks.some((block) => block.task_ids?.includes(t.id) && block.protected)} onEdit={openTaskEditor} onComplete={p.completeTask} onPostpone={async (id) => { await p.postponeTask(id); setTaskSaveNotice('Tarea reprogramada para mañana.'); setTimeout(() => setTaskSaveNotice(null), 2500); }} onDelete={p.deleteTask} />)}
          </ul>
        )}
      </section>

      {completedToday.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Completado hoy · {completedToday.length}</h2>
          <ul className="space-y-1">
            {completedToday.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm text-slate-400 line-through px-2">
                <Check className="h-3.5 w-3.5 text-emerald-500" /> {t.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function DayAgendaSummary({ blocks, tasks, clients, timeZone, onComplete }: { blocks: PlannerBlock[]; tasks: PlannerTask[]; clients: Array<{ id: string; nombre: string }>; timeZone: string; onComplete: (id: string) => void }) {
  return <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-blue-950">Agenda de hoy</h2><p className="mt-0.5 text-[11px] text-blue-800">Tus tareas ya asignadas aparecen aquí en su hora; el detalle completo continúa más abajo.</p></div><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-blue-700">{blocks.length} bloques</span></div>
    {blocks.length ? <ul className="mt-3 space-y-2">{blocks.map((block) => <BlockRow key={block.id} block={block} tasks={tasks} clients={clients} timeZone={timeZone} onComplete={onComplete} />)}</ul> : <p className="mt-3 rounded-xl border border-dashed border-blue-200 bg-white px-3 py-3 text-xs text-slate-500">Aún no hay tareas con horario. Usa “Reorganizar mi día” para asignarlas.</p>}
  </section>;
}

function PlannerCalendar({ view, date, tasks, clients, compact, timeZone, onSelectDate, onEdit }: {
  view: 'week' | 'month'; date: string; tasks: PlannerTask[]; clients: Array<{ id: string; nombre: string }>;
  compact: boolean; timeZone: string; onSelectDate: (date: string) => void; onEdit: (task: PlannerTask) => void;
}) {
  const selected = new Date(`${date}T00:00:00`);
  const mondayOffset = (selected.getDay() + 6) % 7;
  const weekStart = addDays(selected, -mondayOffset);
  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const monthGridStart = addDays(monthStart, -((monthStart.getDay() + 6) % 7));
  const days = view === 'week' ? Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)) : Array.from({ length: 42 }, (_, index) => addDays(monthGridStart, index));
  const [rangeBlocks, setRangeBlocks] = useState<PlannerBlock[]>([]);
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const rangeStart = toDateKey(days[0]);
  const rangeEnd = toDateKey(addDays(days[days.length - 1], 1));
  useEffect(() => { void plannerService.listBlocksRange(rangeStart, rangeEnd).then(setRangeBlocks); }, [rangeStart, rangeEnd]);
  const tasksFor = (key: string) => tasks.filter((task) => {
    if ((task.scheduled_for || task.deadline || '').slice(0, 10) === key) return true;
    return rangeBlocks.some((block) => block.starts_at.slice(0, 10) === key && block.task_ids?.includes(task.id));
  });
  const timeFor = (task: PlannerTask, key: string) => rangeBlocks.find((block) => block.starts_at.slice(0, 10) === key && block.task_ids?.includes(task.id))?.starts_at;
  const detailTasks = detailDate ? tasksFor(detailDate) : [];

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">{view === 'week' ? 'Vista semanal' : selected.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}</h2><p className="text-[11px] text-slate-500">Selecciona un día para abrir su agenda. Los colores identifican clientes.</p></div>
    <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((label) => <div key={label} className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>)}</div>
    <div className="grid grid-cols-7">
      {days.map((day) => {
        const key = toDateKey(day);
        const dayTasks = tasksFor(key);
        const outsideMonth = view === 'month' && day.getMonth() !== selected.getMonth();
        return <div key={key} className={`min-w-0 border-b border-r border-slate-100 p-1.5 ${compact ? 'min-h-24' : 'min-h-32'} ${outsideMonth ? 'bg-slate-50/70' : 'bg-white'}`}>
          <button type="button" onClick={() => onSelectDate(key)} className={`mb-1 grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${key === date ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'}`} aria-label={`Abrir agenda del ${key}`}>{day.getDate()}</button>
          <div className="space-y-1">{dayTasks.slice(0, compact ? 2 : 4).map((task) => {
            const client = clients.find((item) => item.id === task.client_ref);
            const time = timeFor(task, key);
            return <button key={task.id} type="button" onClick={() => onEdit(task)} title={`${task.title}${client ? ` · ${client.nombre}` : ''}`} className={`block w-full break-words rounded-md border px-1.5 py-1 text-left text-[10px] font-medium leading-tight ${client ? clientTone(task.client_ref) : categoryMeta[task.category].tone}`}>{time ? <span className="mr-1 opacity-70">{fmtTime(time, timeZone)}</span> : null}<span className="line-clamp-2">{task.title}</span></button>;
          })}{dayTasks.length > 0 && <button type="button" onClick={() => setDetailDate(key)} className="w-full rounded-md bg-slate-100 px-1.5 py-1 text-left text-[9px] font-semibold text-blue-700 hover:bg-blue-50">Ver agenda ({dayTasks.length})</button>}</div>
        </div>;
      })}
    </div>
    {detailDate && <div className="fixed inset-0 z-50 flex items-end bg-slate-950/35 p-3 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label="Tareas del día">
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">Tareas programadas</p><p className="mt-0.5 text-xs text-slate-500">{new Date(`${detailDate}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })} · {detailTasks.length} tareas</p></div><button type="button" onClick={() => setDetailDate(null)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X className="h-4 w-4" /></button></div>
        <ul className="mt-4 space-y-2">{detailTasks.map((task) => { const client = clients.find((item) => item.id === task.client_ref); const time = timeFor(task, detailDate); return <li key={task.id}><button type="button" onClick={() => { setDetailDate(null); onEdit(task); }} className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50"><div className="flex items-start justify-between gap-3"><span className="text-sm font-medium text-slate-900">{task.title}</span>{time && <span className="shrink-0 text-xs font-semibold text-blue-700">{fmtTime(time, timeZone)}</span>}</div><p className="mt-1 text-xs text-slate-500">{client?.nombre || categoryMeta[task.category].label} · {task.estimated_minutes} min</p></button></li>; })}</ul>
      </div>
    </div>}
  </section>;
}

function BlockRow({ block, tasks, clients, timeZone, onComplete }: { block: PlannerBlock; tasks: PlannerTask[]; clients: Array<{ id: string; nombre: string }>; timeZone?: string; onComplete: (id: string) => void }) {
  const meta = categoryMeta[block.category];
  const linked = tasks.filter((t) => block.task_ids?.includes(t.id));
  return (
    <li className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center min-w-[56px] pt-0.5">
            <span className="text-sm font-semibold text-slate-900">{fmtTime(block.starts_at, timeZone)}</span>
            <span className="text-[10px] text-slate-400">{fmtTime(block.ends_at, timeZone)}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.tone}`}>{meta.label}</span>
              <p className="text-sm font-semibold text-slate-900">{block.title}</p>
              {linked[0]?.client_ref && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${clientTone(linked[0].client_ref)}`}>● {clients.find((client) => client.id === linked[0].client_ref)?.nombre || 'Cliente'}</span>}
              {block.protected && (
                <span title="Bloque protegido: no se moverá al reorganizar el día." className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] border-amber-200 bg-amber-50 text-amber-700">
                  <Lock className="h-3 w-3" /> Protegido
                </span>
              )}
            </div>
            {block.notes && <p className="text-xs text-slate-500 mt-1 italic">{block.notes}</p>}
            {linked.length > 0 && (
              <ul className="mt-2 space-y-1">
                {linked.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-xs text-slate-600">
                    <button onClick={() => onComplete(t.id)} className="grid h-4 w-4 place-items-center rounded border border-slate-300 hover:border-emerald-400 hover:bg-emerald-50"><Check className="h-2.5 w-2.5 text-transparent hover:text-emerald-500" /></button>
                    <span className="truncate">{t.title}</span>
                    <span className="text-slate-300">· {t.estimated_minutes}m</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function TaskRow({ task, clientName, isProtected, onEdit, onComplete, onPostpone, onDelete }: { task: PlannerTask; clientName?: string; isProtected: boolean; onEdit: (task: PlannerTask) => void; onComplete: (id: string) => void; onPostpone: (id: string) => void | Promise<void>; onDelete: (id: string) => void }) {
  const EIcon = energyIcon[task.energy_required];
  return (
    <li className="group flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2">
      <button onClick={() => onComplete(task.id)} aria-label="Marcar como completada" title="Completar" className="grid h-5 w-5 place-items-center rounded-md border border-slate-300 hover:border-emerald-400 hover:bg-emerald-50">
        <Check className="h-3 w-3 text-transparent group-hover:text-emerald-400" />
      </button>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityTone[task.priority] || priorityTone.medium}`}>{task.priority}</span>
      <span title={`Priority Score ${visiblePriorityScore(task).toFixed(2)}/5. Urgencia 30%, impacto financiero 25%, impacto cliente 20%, riesgo 15%, facilidad 10%.`} className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">Score {visiblePriorityScore(task).toFixed(1)}</span>
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${categoryMeta[task.category].tone}`}>{categoryMeta[task.category].label}</span>
      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><EIcon className="h-3 w-3" aria-hidden /> {task.energy_required}</span>
      <span className="text-sm text-slate-800 flex-1 min-w-[8rem] truncate">{task.title}</span>
      {clientName && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${clientTone(task.client_ref)}`}>● {clientName}</span>}
      <span className="text-[10px] text-slate-400 inline-flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden /> {task.estimated_minutes}m</span>
      {isProtected && <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700"><Lock className="h-3 w-3" aria-hidden /> Protegido</span>}
      {task.deadline && <span className="text-[10px] text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">⏰ {new Date(task.deadline).toLocaleDateString()}</span>}
      {/* Actions: always visible on touch/mobile, subtle on desktop hover. */}
      <div className="flex items-center gap-1 sm:opacity-70 sm:group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(task)} aria-label="Editar tarea" title="Editar tarea" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-700"><Edit2 className="h-3.5 w-3.5" /></button>
        <button onClick={() => onPostpone(task.id)} aria-label="Posponer a mañana" title="Posponer a mañana" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"><ChevronRight className="h-3.5 w-3.5" aria-hidden /> Mañana</button>
        <button onClick={() => onDelete(task.id)} aria-label="Eliminar tarea" title="Eliminar tarea" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </li>
  );
}

/** Compact insights card reusable on Home. */
export function InsightsCard({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const p = usePlanner();
  if (p.loading && p.insights.length === 0) return null;
  const severityIcon: Record<string, any> = { risk: AlertTriangle, warn: AlertTriangle, opportunity: TrendingUp, info: Info };
  const severityTone: Record<string, string> = {
    risk: 'text-red-700 bg-red-50 border-red-200',
    warn: 'text-amber-700 bg-amber-50 border-amber-200',
    opportunity: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    info: 'text-blue-700 bg-blue-50 border-blue-200',
  };
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <Lightbulb className="h-3.5 w-3.5" /> Lo que quizás no estás viendo
        </h2>
        <button onClick={p.regenerateInsights} disabled={p.busy === 'insights'} className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 disabled:opacity-50">
          {p.busy === 'insights' && <Loader2 className="h-3 w-3 animate-spin" />} Actualizar
        </button>
      </div>
      {p.insights.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-5 text-sm text-slate-500">
          Sin insights aún. El sistema los genera con tus datos de finanzas, CRM y Planner.
        </div>
      ) : (
        <ul className="space-y-2">
          {p.insights.slice(0, 6).map((it) => {
            const Icon = severityIcon[it.severity] || Info;
            return (
              <li key={it.id} className={`rounded-2xl border px-4 py-3 ${severityTone[it.severity]}`}>
                <div className="flex items-start gap-3">
                  <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{it.title}</p>
                    <p className="text-xs opacity-90 mt-0.5">{it.body}</p>
                    {(it.action_hint || it.action_route) && (
                      <div className="mt-1.5 flex items-center gap-3">
                        {it.action_route && onNavigate && (
                          <button onClick={() => onNavigate(it.action_route!)} className="text-[11px] font-semibold underline underline-offset-2">
                            {it.action_hint || 'Ir'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <button onClick={() => p.dismissInsight(it.id)} className="text-[10px] opacity-60 hover:opacity-100">×</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
