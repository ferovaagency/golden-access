import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, MessageSquare, Bug, Lightbulb, HelpCircle } from 'lucide-react';

type FeedbackRow = {
  id: string;
  email: string | null;
  tipo: 'bug' | 'sugerencia' | 'otro';
  mensaje: string;
  estado: 'nuevo' | 'revisado' | 'resuelto';
  created_at: string;
};

type EventRow = { module: string; event_type: string; created_at: string; user_id: string | null };

export default function AdminFeedbackPanel() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'todos' | FeedbackRow['estado']>('todos');

  const load = async () => {
    setLoading(true);
    try {
      const [f, ev] = await Promise.all([
        supabase.functions.invoke('admin-list-feedback'),
        (supabase as any).from('saas_user_events').select('module, event_type, created_at, user_id').order('created_at', { ascending: false }).limit(500),
      ]);
      if (f.error) throw f.error;
      if ((f.data as any)?.ok === false) throw new Error((f.data as any).message);
      setFeedback(((f.data as any).feedback || []) as FeedbackRow[]);
      if (ev.error) throw ev.error;
      setEvents((ev.data || []) as EventRow[]);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateEstado = async (id: string, estado: FeedbackRow['estado']) => {
    const prev = feedback;
    setFeedback((f) => f.map((x) => (x.id === id ? { ...x, estado } : x)));
    const { error } = await supabase.functions.invoke('admin-update-feedback-status', { body: { id, estado } });
    if (error) { setFeedback(prev); alert(error.message); }
  };

  const filtered = useMemo(
    () => (filter === 'todos' ? feedback : feedback.filter((f) => f.estado === filter)),
    [feedback, filter],
  );

  const stats = useMemo(() => {
    const byModule: Record<string, number> = {};
    const activeUsers = new Set<string>();
    const last7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
    events.forEach((e) => {
      byModule[e.module] = (byModule[e.module] || 0) + 1;
      if (e.user_id && new Date(e.created_at).getTime() > last7) activeUsers.add(e.user_id);
    });
    return {
      totalEventos: events.length,
      activos7d: activeUsers.size,
      porModulo: Object.entries(byModule).sort((a, b) => b[1] - a[1]).slice(0, 8),
      bugsAbiertos: feedback.filter((f) => f.tipo === 'bug' && f.estado !== 'resuelto').length,
      sugerenciasAbiertas: feedback.filter((f) => f.tipo === 'sugerencia' && f.estado !== 'resuelto').length,
    };
  }, [feedback, events]);

  if (loading) return <div className="flex items-center justify-center p-16"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Eventos SaaS" value={stats.totalEventos} />
        <Stat label="Usuarios activos 7d" value={stats.activos7d} />
        <Stat label="Bugs abiertos" value={stats.bugsAbiertos} tone="danger" />
        <Stat label="Sugerencias abiertas" value={stats.sugerenciasAbiertas} tone="accent" />
      </div>

      {stats.porModulo.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Uso por módulo</div>
          <div className="space-y-2">
            {stats.porModulo.map(([m, c]) => (
              <div key={m} className="flex items-center gap-3 text-sm">
                <div className="w-40 text-slate-700">{m}</div>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (c / stats.totalEventos) * 100)}%` }} />
                </div>
                <div className="w-12 text-right font-mono text-xs text-slate-500">{c}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm"><MessageSquare className="w-4 h-4" /> Feedback de producto</div>
          <div className="flex gap-1 text-xs">
            {(['todos', 'nuevo', 'revisado', 'resuelto'] as const).map((s) => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-2.5 py-1 rounded font-mono uppercase tracking-wider ${filter === s ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'text-slate-500 hover:bg-slate-50'}`}>{s}</button>
            ))}
          </div>
        </div>
        {error && <div className="p-4 bg-red-50 text-red-700 text-sm">{error}</div>}
        <ul className="divide-y divide-slate-100">
          {filtered.length === 0 && <li className="p-8 text-center text-slate-400 text-sm">Sin feedback en este filtro.</li>}
          {filtered.map((f) => (
            <li key={f.id} className="p-4 flex gap-3">
              <div className="mt-0.5">
                {f.tipo === 'bug' ? <Bug className="w-4 h-4 text-red-500" /> : f.tipo === 'sugerencia' ? <Lightbulb className="w-4 h-4 text-amber-500" /> : <HelpCircle className="w-4 h-4 text-slate-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500 flex gap-2">
                  <span>{f.email || 'anónimo'}</span>
                  <span>·</span>
                  <span>{new Date(f.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{f.mensaje}</p>
              </div>
              <select value={f.estado} onChange={(e) => updateEstado(f.id, e.target.value as FeedbackRow['estado'])}
                className="text-xs border border-slate-200 rounded px-2 py-1 self-start bg-white">
                <option value="nuevo">nuevo</option>
                <option value="revisado">revisado</option>
                <option value="resuelto">resuelto</option>
              </select>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'danger' | 'accent' }) {
  const color = tone === 'danger' ? 'text-red-600' : tone === 'accent' ? 'text-amber-600' : 'text-slate-900';
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold ${color} mt-1`}>{value}</div>
    </div>
  );
}
