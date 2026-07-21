import { useEffect, useState, type ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, BriefcaseBusiness, CalendarCheck, CheckCircle2, CircleDollarSign, Clock3, HeartPulse, Plus, ShieldCheck, Users, Wallet } from 'lucide-react';
import type { AppData } from '../types';
import type { FinancialMetrics } from '../lib/calculations';
import { isFerovaUiV2Enabled } from '../lib/featureFlags';
import type { Signal, Tone } from './executive/types';
import { ExecutiveHero } from './executive/ExecutiveHero';
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
  selectedMonth: string;
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

export default function Home({ data, metrics, selectedMonth, formatCop, onNavigate }: HomeProps) {
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
  const periodSales = selectedMonth === 'Todos' ? data.ventas : data.ventas.filter((sale) => sale.fecha.startsWith(selectedMonth));
  const periodHours = selectedMonth === 'Todos' ? data.horas : data.horas.filter((entry) => entry.fecha.startsWith(selectedMonth));
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
      { key: 'ingresos', label: 'Ingresos', value: metrics.totalVentas, format: formatCop, detail: 'Ventas del período', icon: CircleDollarSign },
      { key: 'utilidadOp', label: 'Utilidad operativa', value: metrics.utilidadOperacional, format: formatCop, detail: 'Después de costos y gastos', icon: Wallet },
      { key: 'utilidadNeta', label: 'Utilidad neta', value: metrics.utilidadNeta, format: formatCop, detail: 'Estimación después de impuestos', icon: ShieldCheck },
      { key: 'clientes', label: 'Clientes activos', value: activeClients.length, format: (v) => String(Math.round(v)), detail: 'Cuentas en seguimiento', icon: Users },
      { key: 'horas', label: 'Horas registradas', value: totalHours, format: (v) => `${Math.round(v)} h`, detail: 'Capacidad del período', icon: Clock3 },
    ];

    const reorderableSections: Record<HomeSectionId, ReactElement> = {
      quick: <QuickActionsGrid actions={quickActions} onNavigate={onNavigate} />,
      priorities: (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <PrioritiesList priorities={priorities} onNavigate={onNavigate} />
          <BusinessHealth health={health} onNavigate={onNavigate} />
        </div>
      ),
      blind: <BlindSpots spots={blindSpots} onNavigate={onNavigate} />,
      activity: <RecentActivity entries={activity} />,
    };

    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
        <ExecutiveHero
          eyebrow="Executive Control Center"
          title="Tu negocio, en una mirada."
          subtitle="Prioridades, salud y señales que requieren tu atención para el período seleccionado."
          primaryAction={{ label: 'Revisar proyectos', onClick: () => onNavigate('proyectos') }}
        />
        <KpiStrip items={kpiItems} periodKey={selectedMonth} />
        <ExecutiveBrief health={health} topPriority={priorities[0]} onNavigate={onNavigate} />
        {sectionOrder.map((id) => (
          <div key={id} className="space-y-1.5">
            <div className="flex justify-end"><OrderControls id={id} order={sectionOrder} onMove={moveSection} /></div>
            {reorderableSections[id]}
          </div>
        ))}
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
