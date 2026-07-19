import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { Loader2, MessageSquare, Bug, Lightbulb, HelpCircle, Send, Users } from 'lucide-react';
import { listCustomers, type AdminCustomer } from '../lib/adminService';
import { sendUserNotification } from '../lib/userEngagementService';
import { useToast, errMsg } from './ui/toast';

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
  const { success: toastOk, error: toastErr, confirm: askConfirm } = useToast();
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'todos' | FeedbackRow['estado']>('todos');
  const [segmentFilter, setSegmentFilter] = useState('todos');
  const [targetUserId, setTargetUserId] = useState('');
  const [notificationTitle, setNotificationTitle] = useState('Un consejo de María Fernanda');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationTab, setNotificationTab] = useState('dashboard');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [f, ev, customerRows] = await Promise.all([
        supabase.functions.invoke('admin-list-feedback'),
        db<EventRow>('saas_user_events').select('module, event_type, created_at, user_id').order('created_at', { ascending: false }).limit(500),
        listCustomers().catch(() => []),
      ]);
      if (f.error) throw f.error;
      if ((f.data as any)?.ok === false) throw new Error((f.data as any).message);
      setFeedback(((f.data as any).feedback || []) as FeedbackRow[]);
      if (ev.error) throw ev.error;
      setEvents(ev.data ?? []);
      setCustomers(customerRows);
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
    if (error) { setFeedback(prev); toastErr(error.message); }
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

  const customerInsights = useMemo(() => customers.map((customer) => {
    const own = events.filter((event) => event.user_id === customer.user_id);
    const counts = own.reduce<Record<string, number>>((acc, event) => { const area = moduleArea(event.module); acc[area] = (acc[area] || 0) + 1; return acc; }, {});
    const topArea = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sin uso';
    const lastActive = own[0]?.created_at || null;
    const inactiveDays = lastActive ? Math.floor((Date.now() - new Date(lastActive).getTime()) / 86_400_000) : null;
    const segments = [
      ...(!customer.onboarding_completado ? ['Configuración incompleta'] : []),
      ...(inactiveDays == null ? ['Sin actividad medida'] : inactiveDays > 14 ? ['En riesgo de abandono'] : inactiveDays <= 7 ? ['Activo 7 días'] : []),
      ...(topArea !== 'Sin uso' ? [`Foco ${topArea}`] : []),
      ...(customer.estado_suscripcion === 'sin_pago' ? ['Sin pago'] : []),
    ];
    return { customer, events: own.length, lastActive, topArea, segments };
  }), [customers, events]);

  const segmentOptions = useMemo(() => Array.from(new Set(customerInsights.flatMap((insight) => insight.segments))).sort(), [customerInsights]);
  const visibleInsights = segmentFilter === 'todos' ? customerInsights : customerInsights.filter((insight) => insight.segments.includes(segmentFilter));

  const sendNotification = async () => {
    if (!targetUserId || !notificationTitle.trim() || !notificationMessage.trim()) return;
    setSending(true);
    try {
      await sendUserNotification(targetUserId, notificationTitle.trim(), notificationMessage.trim(), notificationTab);
      setNotificationMessage('');
      toastErr('Notificación enviada al panel del usuario.');
    } catch (error: any) {
      toastErr(`No se pudo enviar: ${error?.message || error}`);
    } finally {
      setSending(false);
    }
  };

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

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Users className="h-4 w-4" />Microsegmentos de comportamiento</div><select value={segmentFilter} onChange={(event) => setSegmentFilter(event.target.value)} className="rounded border border-slate-200 px-2 py-1 text-xs"><option value="todos">Todos</option>{segmentOptions.map((segment) => <option key={segment} value={segment}>{segment}</option>)}</select></div>
          <div className="max-h-[430px] overflow-auto"><table className="w-full min-w-[680px] text-xs"><thead className="sticky top-0 bg-slate-50 text-left text-slate-500"><tr><th className="p-3">Usuario</th><th>Actividad</th><th>Foco</th><th>Segmentos</th><th></th></tr></thead><tbody>{visibleInsights.map(({ customer, events: count, lastActive, topArea, segments }) => <tr key={customer.user_id} className="border-t border-slate-100"><td className="p-3"><p className="font-semibold text-slate-800">{customer.nombre_negocio || customer.email}</p><p className="text-[10px] text-slate-400">{customer.plan} · {customer.estado_suscripcion}</p></td><td><p>{count} eventos</p><p className="text-[10px] text-slate-400">{lastActive ? new Date(lastActive).toLocaleDateString('es-CO') : 'Sin registro'}</p></td><td>{topArea}</td><td><div className="flex max-w-xs flex-wrap gap-1">{segments.map((segment) => <span key={segment} className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-semibold text-blue-700">{segment}</span>)}</div></td><td className="pr-3"><button type="button" onClick={() => setTargetUserId(customer.user_id)} className="text-[10px] font-semibold text-blue-700 hover:underline">Escribir</button></td></tr>)}</tbody></table></div>
          <p className="border-t border-slate-100 px-5 py-3 text-[10px] leading-4 text-slate-400">Los segmentos usan navegación registrada desde esta versión. Son señales orientativas, no diagnósticos financieros ni personales.</p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Send className="h-4 w-4" />Mensaje personal al panel</div>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">Se mostrará como enviado por María Fernanda. No envía correo automáticamente.</p>
          <div className="mt-4 space-y-3">
            <label className="block text-[10px] font-semibold uppercase text-slate-500">Usuario<select value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs normal-case text-slate-900"><option value="">Selecciona…</option>{customers.map((customer) => <option key={customer.user_id} value={customer.user_id}>{customer.nombre_negocio || customer.email}</option>)}</select></label>
            <label className="block text-[10px] font-semibold uppercase text-slate-500">Título<input value={notificationTitle} onChange={(event) => setNotificationTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs normal-case text-slate-900" /></label>
            <label className="block text-[10px] font-semibold uppercase text-slate-500">Mensaje<textarea rows={5} value={notificationMessage} onChange={(event) => setNotificationMessage(event.target.value)} placeholder="Tip, recurso o recomendación concreta…" className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs normal-case text-slate-900" /></label>
            <label className="block text-[10px] font-semibold uppercase text-slate-500">Abrir módulo<select value={notificationTab} onChange={(event) => setNotificationTab(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs normal-case text-slate-900"><option value="dashboard">Inicio</option><option value="proyectos">Proyectos</option><option value="finops">Finanzas</option><option value="planner">Planner</option><option value="ventas-crm">Ventas</option><option value="ajustes">Ajustes</option></select></label>
            <button type="button" onClick={sendNotification} disabled={sending || !targetUserId || !notificationMessage.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"><Send className="h-3.5 w-3.5" />{sending ? 'Enviando…' : 'Enviar al panel'}</button>
          </div>
        </section>
      </div>

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

function moduleArea(module: string): string {
  if (['ventas', 'gastos', 'pagosEgresos', 'equilibrioGlobal', 'equilibrioServicio', 'iva', 'alertas', 'finops', 'marketingRoi'].includes(module)) return 'Finanzas';
  if (module === 'planner') return 'Planner';
  if (module.includes('crm') || module === 'ventas-crm') return 'Ventas';
  if (['proyectos', 'clientes', 'servicios', 'horas'].includes(module)) return 'Proyectos';
  return 'Inicio';
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
