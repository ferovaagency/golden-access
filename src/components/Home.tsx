import { useEffect, useState, type ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, BriefcaseBusiness, CalendarCheck, CheckCircle2, CircleDollarSign, Clock3, HeartPulse, Plus, ShieldCheck, Users, Wallet } from 'lucide-react';
import type { AppData } from '../types';
import type { FinancialMetrics } from '../lib/calculations';
import { convertToCop } from '../lib/calculations';
import { type Period, inPeriod, periodKey as toPeriodKey } from '../lib/period';
import { isFerovaUiV2Enabled } from '../lib/featureFlags';
import type { Signal, Tone } from './executive/types';
import { ExecutiveHero } from './executive/ExecutiveHero';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { KpiStrip, type KpiItem } from './executive/KpiStrip';
import { ExecutiveBrief } from './executive/ExecutiveBrief';
import { BusinessHealth } from './executive/BusinessHealth';
import { BlindSpots } from './executive/BlindSpots';
import { RecentActivity } from './executive/RecentActivity';
import { PrioritiesList } from './executive/PrioritiesList';
import { QuickActionsGrid } from './executive/QuickActionsGrid';

interface HomeProps {
  data: AppData;
  metrics: FinancialMetrics;
  period: Period;
  formatCop: (value: number) => string;
  onNavigate: (tab: string) => void;
}

const toneStyles: Record<Tone, string> = {
  positive: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-700 ring-amber-100',
  critical: 'bg-rose-50 text-rose-700 ring-rose-100',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
};

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: LucideIcon }) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/30 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{value}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-100"><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

export default function Home({ data, metrics, period, formatCop, onNavigate }: HomeProps) {
  const [sectionOrder, setSectionOrder] = useState<HomeSectionId[]>(readSectionOrder);
  useEffect(() => { localStorage.setItem('ferova.home.sectionOrder', JSON.stringify(sectionOrder)); }, [sectionOrder]);
  const moveSection = (id: HomeSectionId, direction: -1 | 1) => setSectionOrder((current) => {
    const from = current.indexOf(id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= current.length) return current;
    const next = [...current];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  });
  const periodSales = data.ventas.filter((sale) => inPeriod(sale.fecha, period));
  const periodHours = data.horas.filter((entry) => inPeriod(entry.fecha, period));
  const activeClients = data.clientes.filter((client) => client.activo);
  const totalHours = periodHours.reduce((total, entry) => total + entry.horas, 0);
  const hasSales = periodSales.length > 0;
  const margin = metrics.totalVentas > 0 ? (metrics.utilidadOperacional / metrics.totalVentas) * 100 : 0;

  const health: Signal = metrics.utilidadOperacional < 0
    ? { title: 'Atención requerida', detail: 'La utilidad operacional del período es negativa.', tone: 'critical', action: { label: 'Ver finanzas', tab: 'dashboard' } }
    : margin < 15
      ? { title: 'Margen bajo vigilancia', detail: `Margen operacional de ${margin.toFixed(0)}% en el período.`, tone: 'warning', action: { label: 'Revisar costos', tab: 'gastos' } }
      : { title: 'Negocio saludable', detail: `Margen operacional de ${margin.toFixed(0)}% en el período.`, tone: 'positive' };

  const blindSpots = ([
    !hasSales ? { title: 'Sin ventas registradas', detail: 'No hay ingresos en el período seleccionado.', tone: 'critical', action: { label: 'Registrar venta', tab: 'ventas' } } : null,
    totalHours === 0 ? { title: 'Capacidad sin medir', detail: 'No hay horas registradas en el período.', tone: 'warning', action: { label: 'Registrar horas', tab: 'horas' } } : null,
    activeClients.length === 0 ? { title: 'Sin clientes activos', detail: 'Activa o registra una cuenta para iniciar seguimiento.', tone: 'warning', action: { label: 'Gestionar clientes', tab: 'clientes' } } : null,
    metrics.totalVentas > 0 && metrics.totalVentas < metrics.puntoEquilibrioVentas ? { title: 'Meta de equilibrio pendiente', detail: `Faltan ${formatCop(Math.max(0, metrics.puntoEquilibrioVentas - metrics.totalVentas))} para el punto de equilibrio.`, tone: 'warning', action: { label: 'Ver equilibrio', tab: 'equilibrioGlobal' } } : null,
  ] as Array<Signal | null>).filter((signal): signal is Signal => signal !== null).slice(0, 3);

  const priorities = ([
    !hasSales ? { title: 'Actualiza ingresos del período', detail: 'Registra ventas y abonos para que el control ejecutivo sea confiable.', tone: 'warning', action: { label: 'Abrir ventas', tab: 'ventas' } } : null,
    totalHours === 0 ? { title: 'Registra la capacidad entregada', detail: 'Las horas conectan la rentabilidad con la operación.', tone: 'neutral', action: { label: 'Abrir horas', tab: 'horas' } } : null,
    activeClients.length > 0 ? { title: 'Revisa el avance de proyectos activos', detail: `${activeClients.length} cliente${activeClients.length === 1 ? '' : 's'} activo${activeClients.length === 1 ? '' : 's'} requieren seguimiento de entrega.`, tone: 'neutral', action: { label: 'Abrir proyectos', tab: 'proyectos' } } : null,
  ] as Array<Signal | null>).filter((signal): signal is Signal => signal !== null).slice(0, 3);

  const activity = [
    ...periodSales.map((sale) => ({ id: `sale-${sale.id}`, date: sale.fecha, title: `Venta · ${sale.cliente_nombre}`, detail: `${sale.servicio_nombre} · ${formatCop(sale.precio_venta_unitario * sale.cantidad)}`, icon: CircleDollarSign })),
    ...periodHours.map((entry) => ({ id: `hour-${entry.id}`, date: entry.fecha, title: `Horas · ${entry.cliente_nombre}`, detail: `${entry.horas} h · ${entry.servicio_nombre}`, icon: Clock3 })),
    ...data.pagosEgresos.map((payment) => ({ id: `payment-${payment.id}`, date: payment.fecha, title: `Egreso · ${payment.concepto}`, detail: formatCop(payment.monto), icon: Wallet })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const quickActions = [
    { label: 'Registrar venta', icon: Plus, tab: 'ventas' },
    { label: 'Registrar horas', icon: Clock3, tab: 'horas' },
    { label: 'Ver proyectos', icon: BriefcaseBusiness, tab: 'proyectos' },
    { label: 'Gestionar clientes', icon: Users, tab: 'clientes' },
  ];

  // Rediseno Ferova One v2 (docs/DESIGN_SYSTEM_V2.md, Fase 3): mismos health/
  // blindSpots/priorities/activity/quickActions/sectionOrder de arriba, solo
  // cambia la presentacion. Ningun calculo financiero se toca aqui.
  if (isFerovaUiV2Enabled()) {
    const kpiItems: KpiItem[] = [
      { key: 'ingresos', label: 'Ingresos', value: metrics.totalVentas, format: formatCop, detail: 'Ventas del período', icon: CircleDollarSign, tooltipCode: 'VENTAS_TOTALES' },
      { key: 'utilidadOp', label: 'Utilidad operativa', value: metrics.utilidadOperacional, format: formatCop, detail: 'Después de costos y gastos', icon: Wallet, tooltipCode: 'UTILIDAD_OPERACIONAL' },
      { key: 'utilidadNeta', label: 'Utilidad neta', value: metrics.utilidadNeta, format: formatCop, detail: 'Estimación después de impuestos', icon: ShieldCheck, tooltipCode: 'UTILIDAD_NETA' },
      { key: 'clientes', label: 'Clientes activos', value: activeClients.length, format: (v) => String(Math.round(v)), detail: 'Cuentas en seguimiento', icon: Users },
    ];

    // Agregaciones panorámicas del período (convertidas a COP).
    const trm = data.config.trm;
    const topServicios = aggregateRevenue(periodSales, (sale) => sale.servicio_nombre, trm).slice(0, 5);
    const clientesRanking = aggregateRevenue(periodSales, (sale) => sale.cliente_nombre, trm);
    const topClientes = clientesRanking.slice(0, 5);
    const totalClienteRev = clientesRanking.reduce((total, c) => total + c.value, 0);
    const concentracionTop = totalClienteRev > 0 && clientesRanking[0] ? (clientesRanking[0].value / totalClienteRev) * 100 : 0;
    const inactiveClients = Math.max(0, data.clientes.length - activeClients.length);

    return (
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-4 pb-8">
        <KpiStrip items={kpiItems} periodKey={toPeriodKey(period)} />

        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <SalesTrendChart sales={data.ventas} formatCop={formatCop} />
          <MoneyFlowDonut metrics={metrics} formatCop={formatCop} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <RankBarChart title="Ingresos por servicio" subtitle="Top 5 del período" rows={topServicios} formatCop={formatCop} color="#2563EB" />
          <RankBarChart title="Ingresos por cliente" subtitle={concentracionTop > 0 ? `Top 5 · el mayor concentra ${concentracionTop.toFixed(0)}%` : 'Top 5 del período'} rows={topClientes} formatCop={formatCop} color="#0ea5e9" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <ClientsDonut activos={activeClients.length} inactivos={inactiveClients} />
          <OperationsChart income={metrics.totalVentas} operatingProfit={metrics.utilidadOperacional} totalHours={totalHours} activeClients={activeClients.length} formatCop={formatCop} />
          <BusinessHealth health={health} onNavigate={onNavigate} />
        </div>

        <ExecutiveBrief health={health} topPriority={priorities[0]} onNavigate={onNavigate} />

        <div className="grid gap-4 lg:grid-cols-2">
          <BlindSpots spots={blindSpots} onNavigate={onNavigate} />
          <PrioritiesList priorities={priorities} onNavigate={onNavigate} />
        </div>

        <RecentActivity entries={activity} />
        <QuickActionsGrid actions={quickActions} onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10 animate-fade-in">
      <section className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm shadow-slate-200/40 sm:px-7 sm:py-8 lg:flex-row lg:items-end" style={{ order: -2 }}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600">Executive Control Center</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Tu negocio, en una mirada.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Prioridades, salud y señales que requieren tu atención para el período seleccionado.</p>
        </div>
        <button onClick={() => onNavigate('proyectos')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800">
          Revisar proyectos <ArrowRight className="h-4 w-4" />
        </button>
      </section>

      <section aria-label="Indicadores clave" className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-5" style={{ order: -1 }}>
        <MetricCard label="Ingresos" value={formatCop(metrics.totalVentas)} detail="Ventas del período" icon={CircleDollarSign} />
        <MetricCard label="Utilidad operativa" value={formatCop(metrics.utilidadOperacional)} detail="Después de costos y gastos" icon={Wallet} />
        <MetricCard label="Utilidad neta" value={formatCop(metrics.utilidadNeta)} detail="Estimación después de impuestos" icon={ShieldCheck} />
        <MetricCard label="Clientes activos" value={String(activeClients.length)} detail="Cuentas en seguimiento" icon={Users} />
        <MetricCard label="Horas registradas" value={`${totalHours} h`} detail="Capacidad del período" icon={Clock3} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30 sm:p-6" style={{ order: sectionOrder.indexOf('quick') }}><div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Acceso rápido</p><h3 className="mt-1 text-lg font-semibold text-slate-950">Quick Actions</h3></div><OrderControls id="quick" order={sectionOrder} onMove={moveSection} /></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{quickActions.map(({ label, icon: Icon, tab }) => <button key={tab} onClick={() => onNavigate(tab)} className="flex min-h-24 flex-col items-start justify-between rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:bg-blue-50"><Icon className="h-4 w-4 text-blue-600" /><span className="text-xs font-semibold text-slate-700">{label}</span></button>)}</div></section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_0.65fr]" style={{ order: sectionOrder.indexOf('priorities') }}>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Hoy</p><h3 className="mt-1 text-lg font-semibold text-slate-950">Prioridades</h3></div><div className="flex items-center gap-1"><CalendarCheck className="h-5 w-5 text-blue-600" /><OrderControls id="priorities" order={sectionOrder} onMove={moveSection} /></div></div>
          <div className="mt-5 divide-y divide-slate-100">{priorities.map((priority) => <div key={priority.title} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-slate-900">{priority.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{priority.detail}</p></div>{priority.action && <button onClick={() => onNavigate(priority.action!.tab)} className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-800">{priority.action.label}</button>}</div>)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30 sm:p-6"><div className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-rose-500" /><h3 className="text-lg font-semibold text-slate-950">Business Health</h3></div><div className={`mt-5 rounded-2xl p-4 ring-1 ${toneStyles[health.tone]}`}><p className="text-sm font-semibold">{health.title}</p><p className="mt-1 text-xs leading-5 opacity-80">{health.detail}</p>{health.action && <button onClick={() => onNavigate(health.action!.tab)} className="mt-3 text-xs font-semibold underline underline-offset-4">{health.action.label}</button>}</div></div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30 sm:p-6" style={{ order: sectionOrder.indexOf('blind') }}><div className="flex items-center justify-between"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /><h3 className="text-lg font-semibold text-slate-950">Blind Spots</h3></div><OrderControls id="blind" order={sectionOrder} onMove={moveSection} /></div><div className="mt-4 space-y-3">{blindSpots.length ? blindSpots.map((spot) => <div key={spot.title} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-sm font-medium text-slate-800">{spot.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{spot.detail}</p></div>{spot.action && <button onClick={() => onNavigate(spot.action!.tab)} className="shrink-0 text-xs font-semibold text-blue-600">Abrir</button>}</div>) : <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"><CheckCircle2 className="mr-2 inline h-4 w-4" />No hay señales críticas para este período.</div>}</div></section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30 sm:p-6" style={{ order: sectionOrder.indexOf('activity') }}><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Últimos movimientos</p><h3 className="mt-1 text-lg font-semibold text-slate-950">Recent Activity</h3></div><OrderControls id="activity" order={sectionOrder} onMove={moveSection} /></div><div className="mt-4 divide-y divide-slate-100">{activity.length ? activity.map(({ id, date, title, detail, icon: Icon }) => <div key={id} className="flex items-center gap-3 py-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-50 text-slate-500"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{title}</p><p className="truncate text-xs text-slate-500">{detail}</p></div><time className="text-[11px] font-medium text-slate-400">{date}</time></div>) : <p className="py-6 text-center text-sm text-slate-500">Aún no hay actividad registrada para este período.</p>}</div></section>
    </div>
  );
}

function SalesTrendChart({ sales, formatCop }: { sales: AppData['ventas']; formatCop: (value: number) => string }) {
  const byMonth = new Map<string, number>();
  sales.forEach((sale) => {
    const key = sale.fecha.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) || 0) + (sale.precio_venta_unitario * sale.cantidad));
  });
  const data = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, ingresos]) => ({ month: new Date(`${month}-15T12:00:00`).toLocaleDateString('es-CO', { month: 'short' }), ingresos }));
  return <section className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-5 shadow-[var(--ferova-shadow)]"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#64748b]">Pulso financiero</p><h2 className="mt-1 font-display text-lg font-semibold text-[#0f172a]">Ingresos por mes</h2></div><span className="rounded-full bg-[var(--ferova-ai)] px-2.5 py-1 text-xs font-semibold text-[var(--ferova-navy)]">Últimos 6 meses</span></div>{data.length ? <div className="mt-4 h-52"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}><defs><linearGradient id="ferovaIncome" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity={.24} /><stop offset="100%" stopColor="#2563EB" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} /><YAxis hide /><Tooltip formatter={(value: number) => formatCop(value)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} /><Area type="monotone" dataKey="ingresos" stroke="#2563EB" strokeWidth={3} fill="url(#ferovaIncome)" animationDuration={900} /></AreaChart></ResponsiveContainer></div> : <div className="mt-4 grid h-52 place-items-center rounded-xl bg-[var(--ferova-soft)] text-sm text-[#64748b]">Registra ventas para ver la tendencia de ingresos.</div>}</section>;
}

function OperationsChart({ income, operatingProfit, totalHours, activeClients, formatCop }: { income: number; operatingProfit: number; totalHours: number; activeClients: number; formatCop: (value: number) => string }) {
  const chart = [{ name: 'Ingresos', value: Math.max(0, income) }, { name: 'Utilidad', value: Math.max(0, operatingProfit) }];
  const margin = income > 0 ? (operatingProfit / income) * 100 : 0;
  return <section className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-5 shadow-[var(--ferova-shadow)]"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#64748b]">Rendimiento operativo</p><h2 className="mt-1 font-display text-lg font-semibold text-[#0f172a]">Ingresos vs. utilidad</h2></div><div className="mt-3 grid grid-cols-3 gap-2"><MetricMini label="Margen" value={`${margin.toFixed(0)}%`} /><MetricMini label="Horas" value={`${Math.round(totalHours)} h`} /><MetricMini label="Clientes" value={String(activeClients)} /></div><div className="mt-3 h-32"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} barSize={28}><CartesianGrid vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} /><YAxis hide /><Tooltip formatter={(value: number) => formatCop(value)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} /><Bar dataKey="value" fill="#2563EB" radius={[7, 7, 0, 0]} animationDuration={800} /></BarChart></ResponsiveContainer></div></section>;
}

function MetricMini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[var(--ferova-soft)] px-2.5 py-2"><p className="text-[9px] font-semibold uppercase tracking-wide text-[#8a8377]">{label}</p><p className="mt-1 text-sm font-semibold text-[#1f1b16]">{value}</p></div>; }

// Suma ingresos (en COP) agrupados por una dimensión (servicio, cliente...).
function aggregateRevenue(
  sales: AppData['ventas'],
  getName: (sale: AppData['ventas'][number]) => string,
  trm: number,
): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const sale of sales) {
    const name = getName(sale) || '—';
    const cop = convertToCop((sale.precio_venta_unitario || 0) * (sale.cantidad || 0), sale.moneda, trm);
    map.set(name, (map.get(name) || 0) + cop);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

const FLOW_COLORS = ['#f59e0b', '#8b5cf6', '#0ea5e9', '#ef4444', '#10b981'];

// Donut: de cada peso facturado, a dónde se va.
function MoneyFlowDonut({ metrics, formatCop }: { metrics: FinancialMetrics; formatCop: (value: number) => string }) {
  const segments = [
    { name: 'Costos directos', value: Math.max(0, metrics.costosVariables) },
    { name: 'Gastos operativos', value: Math.max(0, metrics.gastosOperativos) },
    { name: 'Sueldo', value: Math.max(0, metrics.salarioPropuesto) },
    { name: 'Impuestos', value: Math.max(0, metrics.impuestoRentaEstimado) },
    { name: 'Utilidad neta', value: Math.max(0, metrics.utilidadNeta) },
  ].map((s, i) => ({ ...s, color: FLOW_COLORS[i] })).filter((s) => s.value > 0);
  const total = segments.reduce((t, s) => t + s.value, 0);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
      <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Distribución</p><h2 className="mt-1 text-lg font-semibold text-slate-950">¿A dónde va cada peso?</h2></div>
      {total > 0 ? (
        <div className="mt-3 flex items-center gap-4">
          <div className="h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={segments} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none">
                  {segments.map((s) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
                <Tooltip formatter={(value: number) => formatCop(value)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex-1 space-y-1.5">
            {segments.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />{s.name}</span>
                <span className="font-semibold text-slate-900">{Math.round((s.value / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-4 grid h-40 place-items-center rounded-xl bg-slate-50 text-sm text-slate-500">Sin datos financieros para el período.</div>
      )}
    </section>
  );
}

// Barras horizontales de un ranking (top servicios / clientes por ingreso).
function RankBarChart({ title, subtitle, rows, formatCop, color }: { title: string; subtitle: string; rows: { name: string; value: number }[]; formatCop: (value: number) => string; color: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
      <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">{subtitle}</p><h2 className="mt-1 text-lg font-semibold text-slate-950">{title}</h2></div>
      {rows.length ? (
        <div className="mt-3" style={{ height: Math.max(150, rows.length * 44) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#475569' }} />
              <Tooltip formatter={(value: number) => formatCop(value)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="value" fill={color} radius={[0, 6, 6, 0]} barSize={18} animationDuration={700} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-4 grid h-36 place-items-center rounded-xl bg-slate-50 text-sm text-slate-500">Sin ventas en el período.</div>
      )}
    </section>
  );
}

// Donut de cartera: clientes activos vs inactivos.
function ClientsDonut({ activos, inactivos }: { activos: number; inactivos: number }) {
  const total = activos + inactivos;
  const segments = [
    { name: 'Activos', value: activos, color: '#10b981' },
    { name: 'Inactivos', value: inactivos, color: '#94a3b8' },
  ].filter((s) => s.value > 0);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
      <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Cartera</p><h2 className="mt-1 text-lg font-semibold text-slate-950">Clientes</h2></div>
      {total > 0 ? (
        <div className="mt-3 flex items-center gap-4">
          <div className="relative h-32 w-32 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={segments} dataKey="value" nameKey="name" innerRadius={42} outerRadius={60} paddingAngle={2} stroke="none">
                  {segments.map((s) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="text-center"><p className="text-xl font-semibold text-slate-900">{total}</p><p className="text-[10px] text-slate-400">total</p></div></div>
          </div>
          <ul className="flex-1 space-y-2">
            {segments.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />{s.name}</span>
                <span className="font-semibold text-slate-900">{s.value}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-4 grid h-32 place-items-center rounded-xl bg-slate-50 text-sm text-slate-500">Sin clientes registrados.</div>
      )}
    </section>
  );
}

type HomeSectionId = 'quick' | 'priorities' | 'blind' | 'activity';
const defaultSectionOrder: HomeSectionId[] = ['quick', 'priorities', 'blind', 'activity'];

function readSectionOrder(): HomeSectionId[] {
  if (typeof window === 'undefined') return defaultSectionOrder;
  try {
    const stored = JSON.parse(localStorage.getItem('ferova.home.sectionOrder') || '[]') as HomeSectionId[];
    return stored.length === defaultSectionOrder.length && defaultSectionOrder.every((id) => stored.includes(id)) ? stored : defaultSectionOrder;
  } catch { return defaultSectionOrder; }
}

function OrderControls({ id, order, onMove }: { id: HomeSectionId; order: HomeSectionId[]; onMove: (id: HomeSectionId, direction: -1 | 1) => void }) {
  const index = order.indexOf(id);
  return <div className="flex items-center gap-1" aria-label="Cambiar orden de la ficha">
    <button type="button" disabled={index === 0} onClick={() => onMove(id, -1)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25" title="Mover arriba" aria-label="Mover ficha arriba"><ArrowUp className="h-3.5 w-3.5" /></button>
    <button type="button" disabled={index === order.length - 1} onClick={() => onMove(id, 1)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25" title="Mover abajo" aria-label="Mover ficha abajo"><ArrowDown className="h-3.5 w-3.5" /></button>
  </div>;
}
