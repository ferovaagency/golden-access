import { useEffect, useMemo, useState } from 'react';
import { Loader2, TrendingDown, AlertTriangle } from 'lucide-react';
import { fetchDeepAnalytics, type DeepAnalyticsCustomer, type DeepAnalyticsPortfolio } from '../lib/adminService';

const money = (n: number) => `$ ${Math.round(n).toLocaleString('es-CO')}`;

const riskTone: Record<DeepAnalyticsCustomer['risk']['level'], string> = {
  alto: 'bg-red-50 text-red-700 border-red-200',
  medio: 'bg-amber-50 text-amber-700 border-amber-200',
  bajo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function AdminDeepAnalytics() {
  const [portfolio, setPortfolio] = useState<DeepAnalyticsPortfolio | null>(null);
  const [customers, setCustomers] = useState<DeepAnalyticsCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<'todos' | DeepAnalyticsCustomer['risk']['level']>('todos');

  const load = async () => {
    setLoading(true);
    try {
      const { portfolio: p, customers: c } = await fetchDeepAnalytics();
      setPortfolio(p);
      setCustomers(c);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(
    () => (riskFilter === 'todos' ? customers : customers.filter((c) => c.risk.level === riskFilter)),
    [customers, riskFilter],
  );

  if (loading) return <div className="flex items-center justify-center p-16"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;
  if (error) return <div className="p-4 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>;
  if (!portfolio) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Clientes activos" value={portfolio.totalCustomers} />
        <Stat label="Riesgo alto" value={portfolio.altoRiesgo} tone="danger" />
        <Stat label="Cartera vencida" value={money(portfolio.carteraVencidaTotal)} tone="danger" />
        <Stat label="Por pagar vencido" value={money(portfolio.porPagarVencidoTotal)} tone="accent" />
        <Stat label="Riesgo medio" value={portfolio.medioRiesgo} tone="accent" />
        <Stat label="Sin usar Planner" value={portfolio.sinPlanner} />
        <Stat label="Sin usar CRM propio" value={portfolio.sinCrm} />
        <Stat label="Riesgo bajo" value={portfolio.bajoRiesgo} />
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <TrendingDown className="h-4 w-4" />Salud por cliente
          </div>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as typeof riskFilter)} className="rounded border border-slate-200 px-2 py-1 text-xs">
            <option value="todos">Todos</option>
            <option value="alto">Riesgo alto</option>
            <option value="medio">Riesgo medio</option>
            <option value="bajo">Riesgo bajo</option>
          </select>
        </div>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[920px] text-xs">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="p-3">Cliente</th>
                <th>Riesgo</th>
                <th>Planner</th>
                <th>Finanzas</th>
                <th>CRM propio</th>
                <th>Venta cruzada</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.user_id} className="border-t border-slate-100 align-top">
                  <td className="p-3">
                    <p className="font-semibold text-slate-800">{c.nombre_negocio || c.email}</p>
                    <p className="text-[10px] text-slate-400">{c.plan} · {c.estado_suscripcion}</p>
                  </td>
                  <td className="pr-3">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${riskTone[c.risk.level]}`}>
                      {c.risk.level === 'alto' && <AlertTriangle className="h-2.5 w-2.5" />}{c.risk.level}
                    </span>
                    <ul className="mt-1 space-y-0.5 text-[10px] text-slate-400">
                      {c.risk.reasons.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  </td>
                  <td className="pr-3">
                    <p>{c.planner.completedTasks}/{c.planner.totalTasks} tareas{c.planner.completionRate != null ? ` (${c.planner.completionRate}%)` : ''}</p>
                    {c.planner.avgActualVsEstimatedRatio != null && (
                      <p className="text-[10px] text-slate-400">{c.planner.avgActualVsEstimatedRatio}x tiempo real/estimado</p>
                    )}
                  </td>
                  <td className="pr-3">
                    <p>{c.finance.entriesLast30d} registros / 30d</p>
                    <p className="text-[10px] text-slate-400">Caja: {money(c.finance.cashBalance)}</p>
                    {c.finance.overdueReceivables.count > 0 && (
                      <p className="text-[10px] text-red-600">{c.finance.overdueReceivables.count} CxC vencidas · {money(c.finance.overdueReceivables.total)}</p>
                    )}
                    {c.finance.overduePayables.count > 0 && (
                      <p className="text-[10px] text-amber-600">{c.finance.overduePayables.count} CxP vencidas · {money(c.finance.overduePayables.total)}</p>
                    )}
                  </td>
                  <td className="pr-3">
                    <p>{c.crm.totalContacts} contactos</p>
                    {c.crm.totalContacts > 0 && (
                      <p className="text-[10px] text-slate-400">{c.crm.withNextAction} con próxima acción</p>
                    )}
                  </td>
                  <td className="pr-3">
                    <div className="flex max-w-[180px] flex-wrap gap-1">
                      {c.crossSell.length === 0
                        ? <span className="text-[10px] text-slate-400">Usa todos los módulos</span>
                        : c.crossSell.map((m) => <span key={m} className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-semibold text-blue-700">{m}</span>)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-5 py-3 text-[10px] leading-4 text-slate-400">
          El riesgo es una heurística orientativa por señales de uso (pago, actividad, onboarding, registros financieros), no un diagnóstico ni una predicción garantizada.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'danger' | 'accent' }) {
  const color = tone === 'danger' ? 'text-red-600' : tone === 'accent' ? 'text-amber-600' : 'text-slate-900';
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-xl font-semibold ${color} mt-1`}>{value}</div>
    </div>
  );
}
