import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Check, Zap, Battery, BatteryLow, Sun, Moon } from 'lucide-react';

type Energy = 'high' | 'medium' | 'low';
interface Task {
  id: string;
  title: string;
  energy: Energy;
  priority: 1 | 2 | 3;
  block?: 'morning' | 'afternoon' | 'evening';
  done: boolean;
  createdAt: number;
}

const STORAGE_KEY = 'ferova.planner.v1';

function loadTasks(): Task[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveTasks(tasks: Task[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch {}
}

const energyMeta: Record<Energy, { label: string; icon: any; tone: string }> = {
  high: { label: 'Alta', icon: Zap, tone: 'text-amber-700 bg-amber-50' },
  medium: { label: 'Media', icon: Battery, tone: 'text-blue-700 bg-blue-50' },
  low: { label: 'Baja', icon: BatteryLow, tone: 'text-slate-600 bg-slate-100' },
};

const blockMeta = [
  { id: 'morning' as const, label: 'Mañana', hint: '8–12 · alta energía', icon: Sun },
  { id: 'afternoon' as const, label: 'Tarde', hint: '13–17 · media', icon: Sun },
  { id: 'evening' as const, label: 'Noche', hint: '18–21 · baja', icon: Moon },
];

export default function SmartPlanner() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dump, setDump] = useState('');
  const [defaultEnergy, setDefaultEnergy] = useState<Energy>('medium');

  useEffect(() => { setTasks(loadTasks()); }, []);
  useEffect(() => { saveTasks(tasks); }, [tasks]);

  const addFromDump = () => {
    const lines = dump.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const now = Date.now();
    const added: Task[] = lines.map((line, i) => ({
      id: `${now}_${i}`,
      title: line,
      energy: defaultEnergy,
      priority: 2,
      done: false,
      createdAt: now + i,
    }));
    setTasks((prev) => [...added, ...prev]);
    setDump('');
  };

  const autoSchedule = () => {
    const unscheduled = tasks.filter((t) => !t.done && !t.block);
    const buckets: Record<Energy, Task['block']> = { high: 'morning', medium: 'afternoon', low: 'evening' };
    setTasks((prev) => prev.map((t) => (unscheduled.includes(t) ? { ...t, block: buckets[t.energy] } : t)));
  };

  const toggleDone = (id: string) => setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  const removeTask = (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id));
  const move = (id: string, block: Task['block']) => setTasks((prev) => prev.map((t) => t.id === id ? { ...t, block } : t));

  const inbox = tasks.filter((t) => !t.block && !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold text-slate-900 tracking-tight">Planificador inteligente</h1>
        <p className="text-sm text-slate-500">Vacía tu mente, asigna energía y deja que el día se organice.</p>
      </header>

      <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
        <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Brain dump</label>
        <textarea
          value={dump}
          onChange={(e) => setDump(e.target.value)}
          placeholder={'Una tarea por línea…\nGrabar video onboarding\nRevisar propuesta Cliente X\nPagar SS'}
          className="mt-2 block w-full resize-none rounded-xl border border-[var(--line)] bg-slate-50 px-3 py-3 text-sm outline-none focus:border-blue-300 focus:bg-white min-h-28"
        />
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Energía default:</span>
            {(['high', 'medium', 'low'] as Energy[]).map((e) => (
              <button
                key={e}
                onClick={() => setDefaultEnergy(e)}
                className={`rounded-full px-3 py-1 border ${defaultEnergy === e ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-[var(--line)] text-slate-600 hover:bg-slate-50'}`}
              >{energyMeta[e].label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={autoSchedule} className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl border border-[var(--line)] hover:bg-slate-50">Auto-agendar</button>
            <button onClick={addFromDump} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
              <Plus className="h-3.5 w-3.5" /> Agregar
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Bloques del día</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {blockMeta.map((b) => {
            const Icon = b.icon;
            const items = tasks.filter((t) => t.block === b.id && !t.done);
            return (
              <div key={b.id} className="rounded-2xl border border-[var(--line)] bg-white p-4 min-h-40">
                <div className="flex items-center gap-2 mb-3">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-700"><Icon className="h-4 w-4" /></div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{b.label}</p>
                    <p className="text-[11px] text-slate-500">{b.hint}</p>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {items.length === 0 && <li className="text-xs text-slate-400 italic">Vacío</li>}
                  {items.map((t) => {
                    const EIcon = energyMeta[t.energy].icon;
                    return (
                      <li key={t.id} className="group flex items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 hover:bg-slate-50 hover:border-[var(--line)]">
                        <button onClick={() => toggleDone(t.id)} className="grid h-5 w-5 place-items-center rounded-md border border-slate-300 hover:border-blue-400 hover:bg-blue-50">
                          <Check className="h-3 w-3 text-transparent group-hover:text-blue-400" />
                        </button>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${energyMeta[t.energy].tone}`}>
                          <EIcon className="h-3 w-3" /> {energyMeta[t.energy].label}
                        </span>
                        <span className="text-sm text-slate-800 flex-1 truncate">{t.title}</span>
                        <button onClick={() => move(t.id, undefined)} className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-400 hover:text-slate-700">Sacar</button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Bandeja</h2>
        {inbox.length === 0 && <p className="text-xs text-slate-400 italic">Vacía — todo agendado o completado.</p>}
        <ul className="space-y-1.5">
          {inbox.map((t) => {
            const EIcon = energyMeta[t.energy].icon;
            return (
              <li key={t.id} className="group flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2">
                <button onClick={() => toggleDone(t.id)} className="grid h-5 w-5 place-items-center rounded-md border border-slate-300 hover:border-blue-400" />
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${energyMeta[t.energy].tone}`}>
                  <EIcon className="h-3 w-3" /> {energyMeta[t.energy].label}
                </span>
                <span className="text-sm text-slate-800 flex-1 truncate">{t.title}</span>
                <div className="flex items-center gap-1">
                  {blockMeta.map((b) => (
                    <button key={b.id} onClick={() => move(t.id, b.id)} className="text-[10px] text-slate-500 hover:text-blue-700 px-1.5 py-0.5 rounded border border-transparent hover:border-blue-200">{b.label}</button>
                  ))}
                  <button onClick={() => removeTask(t.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Completado hoy · {done.length}</h2>
          <ul className="space-y-1">
            {done.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm text-slate-400 line-through px-2">
                <Check className="h-3.5 w-3.5 text-emerald-500" /> {t.title}
                <button onClick={() => removeTask(t.id)} className="ml-auto text-slate-300 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
