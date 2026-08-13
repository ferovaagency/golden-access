import { useMemo, useState } from 'react';
import { Search, Play, Check, Clock, Trash2, X, GripVertical } from 'lucide-react';
import type { PlannerTask, PlannerCategory } from '../../lib/plannerService';

// Vistas Lista y Kanban del Planner, con filtros tipo Notion. Se alimenta de
// TODAS las tareas y aplica filtros en cliente. Reutiliza los handlers del hook.

const CATEGORY_LABEL: Record<PlannerCategory, string> = {
  deep_work: 'Deep Work', meetings: 'Reuniones', admin: 'Admin', creative: 'Creativo',
  calls: 'Llamadas', learning: 'Aprender', personal: 'Personal', breaks: 'Descanso',
};
const PRIORITY_LABEL: Record<string, string> = { urgent: 'Urgente', high: 'Alta', medium: 'Media', low: 'Baja' };
const PRIORITY_TONE: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700', high: 'bg-amber-100 text-amber-700',
  medium: 'bg-slate-100 text-slate-600', low: 'bg-slate-50 text-slate-500',
};
const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog', scheduled: 'Programadas', in_progress: 'En progreso',
  postponed: 'Pospuestas', done: 'Hechas', cancelled: 'Canceladas',
};
// Columnas del kanban, en orden de flujo.
const KANBAN_COLUMNS = ['backlog', 'scheduled', 'in_progress', 'postponed', 'done'] as const;

export interface PlannerBoardHandlers {
  onEdit: (task: PlannerTask) => void;
  onStart: (id: string) => void | Promise<void>;
  onComplete: (id: string) => void | Promise<void>;
  onPostpone: (id: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onSetStatus?: (id: string, status: string) => void | Promise<void>;
}

interface Props extends PlannerBoardHandlers {
  mode: 'list' | 'kanban';
  tasks: PlannerTask[];
  clients: Array<{ id: string; nombre: string }>;
}

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '—';

export default function PlannerBoard({ mode, tasks, clients, onEdit, onStart, onComplete, onPostpone, onDelete, onSetStatus }: Props) {
  const [q, setQ] = useState('');
  const [fClient, setFClient] = useState('');
  const [fCategory, setFCategory] = useState('');
  const [fPriority, setFPriority] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);

  const clientName = (id?: string | null) => clients.find((c) => c.id === id)?.nombre;

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (text && !(`${t.title} ${t.description || ''}`.toLowerCase().includes(text))) return false;
      if (fClient && t.client_ref !== fClient) return false;
      if (fCategory && t.category !== fCategory) return false;
      if (fPriority && t.priority !== fPriority) return false;
      if (fStatus && t.status !== fStatus) return false;
      return true;
    });
  }, [tasks, q, fClient, fCategory, fPriority, fStatus]);

  const hasFilters = q || fClient || fCategory || fPriority || fStatus;
  const clear = () => { setQ(''); setFClient(''); setFCategory(''); setFPriority(''); setFStatus(''); };

  const selectCls = 'rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-blue-400 focus:outline-none';

  return (
    <div className="space-y-4">
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tarea…" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs text-slate-700 focus:border-blue-400 focus:outline-none" />
        </div>
        <select value={fClient} onChange={(e) => setFClient(e.target.value)} className={selectCls}>
          <option value="">Cliente: todos</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select value={fCategory} onChange={(e) => setFCategory(e.target.value)} className={selectCls}>
          <option value="">Categoría: todas</option>
          {Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={fPriority} onChange={(e) => setFPriority(e.target.value)} className={selectCls}>
          <option value="">Prioridad: todas</option>
          {Object.entries(PRIORITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {mode === 'list' && (
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selectCls}>
            <option value="">Estado: todos</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        )}
        {hasFilters && (
          <button onClick={clear} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-500 hover:bg-slate-50">
            <X className="h-3.5 w-3.5" /> Limpiar
          </button>
        )}
        <span className="ml-auto text-[11px] text-slate-400">{filtered.length} tarea{filtered.length === 1 ? '' : 's'}</span>
      </div>

      {mode === 'list' ? (
        <ListView tasks={filtered} clientName={clientName} onEdit={onEdit} onStart={onStart} onComplete={onComplete} onPostpone={onPostpone} onDelete={onDelete} />
      ) : (
        <KanbanView
          tasks={filtered}
          clientName={clientName}
          onEdit={onEdit}
          onSetStatus={onSetStatus}
          dragId={dragId}
          setDragId={setDragId}
        />
      )}
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone || 'bg-slate-100 text-slate-600'}`}>{children}</span>;
}

function ListView({ tasks, clientName, onEdit, onStart, onComplete, onPostpone, onDelete }: {
  tasks: PlannerTask[]; clientName: (id?: string | null) => string | undefined;
} & Omit<PlannerBoardHandlers, 'onSetStatus'>) {
  if (!tasks.length) return <EmptyState />;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-semibold">Tarea</th>
              <th className="px-3 py-2 font-semibold">Cliente</th>
              <th className="px-3 py-2 font-semibold">Categoría</th>
              <th className="px-3 py-2 font-semibold">Prioridad</th>
              <th className="px-3 py-2 font-semibold">Estado</th>
              <th className="px-3 py-2 font-semibold">Vence</th>
              <th className="px-3 py-2 font-semibold">Est.</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="max-w-[280px] px-3 py-2">
                  <button onClick={() => onEdit(t)} className="text-left font-medium text-slate-800 hover:text-blue-700">{t.title}</button>
                </td>
                <td className="px-3 py-2 text-slate-600">{clientName(t.client_ref) || '—'}</td>
                <td className="px-3 py-2"><Badge>{CATEGORY_LABEL[t.category]}</Badge></td>
                <td className="px-3 py-2"><Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority] || t.priority}</Badge></td>
                <td className="px-3 py-2 text-slate-600">{STATUS_LABEL[t.status] || t.status}</td>
                <td className="px-3 py-2 text-slate-600">{fmtDate(t.deadline)}</td>
                <td className="px-3 py-2 text-slate-500">{t.estimated_minutes ? `${t.estimated_minutes}m` : '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {t.status !== 'done' && (
                      <>
                        <IconBtn title="Empezar" onClick={() => onStart(t.id)}><Play className="h-3.5 w-3.5" /></IconBtn>
                        <IconBtn title="Completar" onClick={() => onComplete(t.id)}><Check className="h-3.5 w-3.5 text-emerald-600" /></IconBtn>
                        <IconBtn title="Posponer" onClick={() => onPostpone(t.id)}><Clock className="h-3.5 w-3.5" /></IconBtn>
                      </>
                    )}
                    <IconBtn title="Eliminar" onClick={() => onDelete(t.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KanbanView({ tasks, clientName, onEdit, onSetStatus, dragId, setDragId }: {
  tasks: PlannerTask[]; clientName: (id?: string | null) => string | undefined;
  onEdit: (t: PlannerTask) => void; onSetStatus?: (id: string, status: string) => void | Promise<void>;
  dragId: string | null; setDragId: (id: string | null) => void;
}) {
  const byStatus = (status: string) => tasks.filter((t) => (t.status || 'backlog') === status);
  const canDrag = Boolean(onSetStatus);
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {KANBAN_COLUMNS.map((status) => {
        const items = byStatus(status);
        return (
          <div
            key={status}
            onDragOver={canDrag ? (e) => { e.preventDefault(); } : undefined}
            onDrop={canDrag ? async () => { if (dragId) { await onSetStatus!(dragId, status); setDragId(null); } } : undefined}
            className="flex min-h-[120px] flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-2"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{STATUS_LABEL[status]}</span>
              <span className="rounded-full bg-white px-1.5 text-[10px] font-semibold text-slate-400 ring-1 ring-slate-200">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((t) => (
                <div
                  key={t.id}
                  draggable={canDrag}
                  onDragStart={canDrag ? () => setDragId(t.id) : undefined}
                  onDragEnd={canDrag ? () => setDragId(null) : undefined}
                  onClick={() => onEdit(t)}
                  className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-blue-300"
                >
                  <div className="flex items-start gap-1.5">
                    {canDrag && <GripVertical className="mt-0.5 h-3.5 w-3.5 flex-none text-slate-300 group-hover:text-slate-400" />}
                    <p className="text-xs font-medium leading-snug text-slate-800">{t.title}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority] || t.priority}</Badge>
                    <Badge>{CATEGORY_LABEL[t.category]}</Badge>
                    {t.client_ref && <span className="text-[10px] text-slate-500">● {clientName(t.client_ref)}</span>}
                  </div>
                </div>
              ))}
              {!items.length && <p className="px-1 py-3 text-center text-[10px] text-slate-300">—</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button title={title} onClick={onClick} className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50">
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-xs text-slate-400">
      No hay tareas que coincidan con los filtros.
    </div>
  );
}
