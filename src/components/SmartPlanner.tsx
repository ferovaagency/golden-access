import React, { useState } from 'react';
import { Sparkles, Wand2, Loader2, Check, Clock, Zap, Battery, BatteryLow, Trash2, ChevronRight, Sunrise, AlertTriangle, Lightbulb, TrendingUp, Info, Lock } from 'lucide-react';
import { usePlanner } from '../hooks/usePlanner';
import type { PlannerBlock, PlannerCategory, PlannerEnergy, PlannerTask } from '../lib/plannerService';

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

function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

export default function SmartPlanner() {
  const p = usePlanner();
  const [dump, setDump] = useState('');
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockTitle, setBlockTitle] = useState('');
  const [blockStart, setBlockStart] = useState('09:00');
  const [blockEnd, setBlockEnd] = useState('10:00');

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

  const openTasks = p.tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
  const completedToday = p.tasks.filter((t) => t.status === 'done' && (t.completed_at || '').slice(0, 10) === p.date);

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Smart Planner</p>
          <h1 className="font-display text-3xl font-semibold text-slate-900 tracking-tight mt-1">Tu día, diseñado por IA.</h1>
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
            Reorganizar mi día
          </button>
        </div>
      </header>

      {p.error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{p.error}</div>}

      {p.planPreview && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-950">Vista previa de la agenda</p>
              <p className="mt-1 text-xs text-blue-800">{p.planPreview.summary} Revisa los bloques antes de aplicarlos.</p>
            </div>
            <button onClick={p.applyPlan} disabled={p.busy === 'plan'} className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50">Aplicar plan</button>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-blue-900">
            {p.planPreview.blocks.map((block) => <li key={`${block.starts_at}-${block.title}`}>{fmtTime(block.starts_at)} - {fmtTime(block.ends_at)}: {block.title}</li>)}
          </ul>
        </section>
      )}

      {/* Briefing */}
      <section className="rounded-2xl border border-[var(--line)] bg-gradient-to-br from-blue-50/60 to-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-100 text-blue-700"><Sunrise className="h-4 w-4" /></div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Briefing de hoy</p>
              <p className="text-base font-semibold text-slate-900 mt-1">{p.briefing?.headline || 'Todavía no hay briefing generado.'}</p>
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
          <span className="text-xs text-slate-400">La IA detecta tipo, prioridad, energía, duración y deadline.</span>
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
            Clasificar con IA
          </button>
        </div>
      </section>

      {/* Timeline of blocks */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Bloques del {new Date(p.date + 'T00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400">{p.blocks.length} bloques</span>
            <button onClick={() => setShowBlockForm((value) => !value)} className="text-xs font-semibold text-blue-700 hover:text-blue-900">{showBlockForm ? 'Cancelar' : '+ Bloque protegido'}</button>
          </div>
        </div>
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
            Sin bloques aún. Presioná <span className="font-semibold text-slate-700">Reorganizar mi día</span> para que la IA arme el horario.
          </div>
        ) : (
          <ul className="space-y-2">
            {p.blocks.map((b) => <BlockRow key={b.id} block={b} tasks={p.tasks} onComplete={p.completeTask} />)}
          </ul>
        )}
      </section>

      {/* Tasks queue */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Bandeja de tareas · {openTasks.length}</h2>
        {openTasks.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Bandeja vacía.</p>
        ) : (
          <ul className="space-y-1.5">
            {openTasks.map((t) => <TaskRow key={t.id} task={t} onComplete={p.completeTask} onPostpone={p.postponeTask} onDelete={p.deleteTask} />)}
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

function BlockRow({ block, tasks, onComplete }: { block: PlannerBlock; tasks: PlannerTask[]; onComplete: (id: string) => void }) {
  const meta = categoryMeta[block.category];
  const linked = tasks.filter((t) => block.task_ids?.includes(t.id));
  return (
    <li className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center min-w-[56px] pt-0.5">
            <span className="text-sm font-semibold text-slate-900">{fmtTime(block.starts_at)}</span>
            <span className="text-[10px] text-slate-400">{fmtTime(block.ends_at)}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.tone}`}>{meta.label}</span>
              <p className="text-sm font-semibold text-slate-900">{block.title}</p>
              {(block.protected || block.is_locked) && (
                <span title={block.protected ? 'Bloque protegido: no se moverá al reorganizar el día.' : 'Bloque fijado.'} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${block.protected ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                  <Lock className="h-3 w-3" /> {block.protected ? 'Protegido' : 'Fijado'}
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

function TaskRow({ task, onComplete, onPostpone, onDelete }: { task: PlannerTask; onComplete: (id: string) => void; onPostpone: (id: string) => void; onDelete: (id: string) => void }) {
  const EIcon = energyIcon[task.energy_required];
  return (
    <li className="group flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2">
      <button onClick={() => onComplete(task.id)} className="grid h-5 w-5 place-items-center rounded-md border border-slate-300 hover:border-emerald-400 hover:bg-emerald-50">
        <Check className="h-3 w-3 text-transparent group-hover:text-emerald-400" />
      </button>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityTone[task.priority] || priorityTone.medium}`}>{task.priority}</span>
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${categoryMeta[task.category].tone}`}>{categoryMeta[task.category].label}</span>
      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><EIcon className="h-3 w-3" /> {task.energy_required}</span>
      <span className="text-sm text-slate-800 flex-1 truncate">{task.title}</span>
      <span className="text-[10px] text-slate-400 inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {task.estimated_minutes}m</span>
      {task.deadline && <span className="text-[10px] text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">⏰ {new Date(task.deadline).toLocaleDateString()}</span>}
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
        <button onClick={() => onPostpone(task.id)} title="Postergar" className="text-[10px] text-slate-400 hover:text-slate-700 px-1.5 py-0.5 rounded"><ChevronRight className="h-3.5 w-3.5" /></button>
        <button onClick={() => onDelete(task.id)} title="Eliminar" className="text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
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
          Sin insights aún. La IA los genera con tus datos de finanzas, CRM y planner.
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
