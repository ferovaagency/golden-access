import { useMemo, useState } from 'react';
import { ArrowDown, CheckCircle2, CircleDollarSign, Save, Target, FolderKanban } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AppData } from '../types';
import { totalGatewayFeesCop, type GatewayDefaults } from '../lib/paymentFees';
import { useProjectPortfolio } from '../hooks/useProjectPortfolio';

type MetricKey = 'contactos' | 'seguimientos' | 'calificadas' | 'respuestas';
type DailyValues = Record<MetricKey, number>;
type DailyTargets = Record<MetricKey, number>;
type StoredDay = DailyValues & { date: string };

const metricDefs: Array<{ key: MetricKey; label: string; dailyTarget: number }> = [
  { key: 'contactos', label: 'Contactos segmentados', dailyTarget: 20 },
  { key: 'seguimientos', label: 'Seguimientos', dailyTarget: 10 },
  { key: 'calificadas', label: 'Conversaciones calificadas', dailyTarget: 5 },
  { key: 'respuestas', label: 'Respuestas recibidas', dailyTarget: 8 },
];
const defaultTargets = (): DailyTargets => ({ contactos: 20, seguimientos: 10, calificadas: 5, respuestas: 8 });
const emptyValues = (): DailyValues => ({ contactos: 0, seguimientos: 0, calificadas: 0, respuestas: 0 });
const defaultGateway = (): GatewayDefaults => ({ porcentaje: 0, fija: 0, retiro: 0 });
const dateKey = (date = new Date()) => date.toISOString().slice(0, 10);

function readHistory(userId: string): StoredDay[] {
  try { return JSON.parse(localStorage.getItem(`ferova.kpi.daily.${userId}`) || '[]') as StoredDay[]; }
  catch { return []; }
}

function readJson<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? { ...fallback, ...JSON.parse(raw) } as T : fallback; }
  catch { return fallback; }
}

function startOfWeek(input = new Date()): Date {
  const date = new Date(input); const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1); date.setHours(0, 0, 0, 0); return date;
}

const sumDays = (days: StoredDay[]): DailyValues => days.reduce((sum, day) => {
  metricDefs.forEach(({ key }) => { sum[key] += Number(day[key] || 0); }); return sum;
}, emptyValues());

export default function OperatingKpiDashboard({ userId, data, formatCop }: { userId: string; data: AppData; formatCop: (value: number) => string }) {
  const [history, setHistory] = useState<StoredDay[]>(() => readHistory(userId));
  const [today, setToday] = useState<DailyValues>(() => history.find((row) => row.date === dateKey()) || emptyValues());
  const [annualMrrTarget, setAnnualMrrTarget] = useState<number>(() => Number(localStorage.getItem(`ferova.kpi.annualMrr.${userId}`) || 0));
  const [targets, setTargets] = useState<DailyTargets>(() => readJson(`ferova.kpi.targets.${userId}`, defaultTargets()));
  const [gateway, setGateway] = useState<GatewayDefaults>(() => readJson(`ferova.kpi.gateway.${userId}`, defaultGateway()));
  const [gatewayName, setGatewayName] = useState<string>(() => localStorage.getItem(`ferova.kpi.gatewayName.${userId}`) || '');
  const weekStart = dateKey(startOfWeek());
  const monthStart = dateKey().slice(0, 7);
  const yearStart = dateKey().slice(0, 4);
  const weekDays = history.filter((row) => row.date >= weekStart);
  const monthDays = history.filter((row) => row.date.startsWith(monthStart));
  const week = sumDays(weekDays);
  const month = sumDays(monthDays);
  const yearSales = data.ventas.filter((sale) => sale.fecha.startsWith(yearStart));
  const monthSales = data.ventas.filter((sale) => sale.fecha.startsWith(monthStart));
  const grossMonthCop = monthSales.reduce((sum, sale) => sum + sale.precio_venta_unitario * sale.cantidad * (sale.moneda === 'USD' ? data.config.trm : 1), 0);
  const hasGatewayDefaults = gateway.porcentaje > 0 || gateway.fija > 0 || gateway.retiro > 0;
  const feesMonthCop = totalGatewayFeesCop(monthSales, data.config.trm, hasGatewayDefaults ? gateway : undefined);
  const netMrr = Math.max(0, grossMonthCop - feesMonthCop);
  const activeClients = data.clientes.filter((client) => client.activo).length;
  const weekScore = rollupScore(week, 5, targets);
  const monthScore = rollupScore(month, 22, targets);
  const annualProgress = annualMrrTarget > 0 ? Math.min(100, netMrr / annualMrrTarget * 100) : 0;

  // La meta anual (O10) no vive aislada: se alimenta de los objetivos y KPIs
  // definidos por proyecto/cliente (pestaña Proyectos). Aquí se hace explícita
  // esa relación -- cada objetivo con su meta y el avance de sus KPIs.
  const projects = useProjectPortfolio(data);
  const objetivosProyectos = useMemo(() => projects.flatMap((project) =>
    project.objectives.map((obj) => ({
      cliente: project.client.nombre,
      texto: obj.text,
      metaFecha: obj.metaFecha,
      completado: obj.completado,
      kpis: project.kpis.filter((kpi) => kpi.objetivo_id === obj.id),
    }))
  ), [projects]);
  const totalObjetivos = objetivosProyectos.length;
  const objetivosCumplidos = objetivosProyectos.filter((o) => o.completado).length;
  const kpiEnMeta = (meta: string, actual: string) => {
    const m = Number(String(meta).replace(/[^0-9.-]/g, ''));
    const a = Number(String(actual).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(m) && Number.isFinite(a) && m > 0 ? a >= m : null;
  };
  const trend = useMemo(() => history.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-14).map((day) => ({ date: day.date.slice(5), cumplimiento: rollupScore(day, 1, targets) })), [history, targets]);

  const saveToday = () => {
    const next = [...history.filter((row) => row.date !== dateKey()), { date: dateKey(), ...today }].sort((a, b) => a.date.localeCompare(b.date));
    setHistory(next); localStorage.setItem(`ferova.kpi.daily.${userId}`, JSON.stringify(next));
  };
  const saveAnnualTarget = (value: number) => { setAnnualMrrTarget(value); localStorage.setItem(`ferova.kpi.annualMrr.${userId}`, String(value)); };
  const updateTarget = (key: MetricKey, value: number) => {
    const next = { ...targets, [key]: Math.max(0, value) };
    setTargets(next); localStorage.setItem(`ferova.kpi.targets.${userId}`, JSON.stringify(next));
  };
  const updateGateway = (patch: Partial<GatewayDefaults>) => {
    const next = { ...gateway, ...patch };
    setGateway(next); localStorage.setItem(`ferova.kpi.gateway.${userId}`, JSON.stringify(next));
  };
  const updateGatewayName = (value: string) => { setGatewayName(value); localStorage.setItem(`ferova.kpi.gatewayName.${userId}`, value); };

  return <section className="space-y-4" aria-labelledby="tracking-title">
    <header className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[#101726] p-5 text-white shadow-[var(--ferova-shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">Objetivos · un solo tablero</p><h2 id="tracking-title" className="mt-1 text-2xl font-bold tracking-tight">Sistema de seguimiento</h2><p className="mt-1 text-xs text-slate-300">Registras el diario; el semanal, mensual y anual se recalculan solos con datos reales.</p></div><div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-right"><p className="text-[9px] uppercase text-slate-400">Cumplimiento mensual</p><p className="text-2xl font-bold text-amber-300">{monthScore.toFixed(0)}%</p></div></div>
    </header>

    <div className="grid gap-4 xl:grid-cols-[.9fr_1.4fr]">
      <div className="space-y-2">
        <CadenceCard title="Diario" subtitle="Motor de prospección" accent="cyan" value={`${rollupScore(today, 1, targets).toFixed(0)}%`} items={metricDefs.map((metric) => `${metric.label}: ${today[metric.key]}/${targets[metric.key]}`)} />
        <FeedArrow />
        <CadenceCard title="Semanal" subtitle="Ritmo de venta" accent="emerald" value={`${weekScore.toFixed(0)}%`} items={[`${week.calificadas} conversaciones calificadas`, `${week.seguimientos} seguimientos`, `${week.contactos} contactos segmentados`, `${weekDays.length} días registrados`]} />
        <FeedArrow />
        <CadenceCard title="Mensual" subtitle="Salud del negocio" accent="amber" value={formatCop(netMrr)} items={[`${month.calificadas} conversaciones calificadas`, `${month.contactos} contactos`, `${monthSales.length} ventas`, `Comisiones: ${formatCop(feesMonthCop)}`]} />
        <FeedArrow />
        <CadenceCard title="Anual" subtitle="Norte a 12 meses" accent="violet" value={annualMrrTarget ? `${annualProgress.toFixed(0)}%` : 'Por confirmar'} items={[`Meta MRR: ${annualMrrTarget ? formatCop(annualMrrTarget) : 'sin definir'}`, `${activeClients} clientes activos`, `Objetivos de proyectos: ${objetivosCumplidos}/${totalObjetivos} cumplidos`, `${yearSales.length} ventas este año`]} />
      </div>

      <div className="space-y-4">
        <article className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-white p-5 shadow-[var(--ferova-shadow)]">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ferova-brand)]">Registro de hoy</p><h3 className="mt-1 text-base font-semibold text-slate-900">KPIs que alimentan todo el sistema</h3><p className="mt-0.5 text-[10px] text-slate-400">El número que registrás y su meta diaria son editables.</p></div><button type="button" onClick={saveToday} className="inline-flex items-center gap-2 rounded-xl bg-[var(--ferova-brand)] px-3 py-2 text-xs font-semibold text-white"><Save className="h-3.5 w-3.5" /> Guardar día</button></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{metricDefs.map((metric) => <div key={metric.key} className="rounded-xl bg-[var(--ferova-soft)] p-3"><span className="text-[10px] font-semibold text-slate-600">{metric.label}</span><div className="mt-2 grid grid-cols-2 gap-2"><label className="block"><span className="text-[9px] uppercase tracking-wide text-slate-400">Hoy</span><input type="number" min="0" value={today[metric.key]} onChange={(event) => setToday({ ...today, [metric.key]: Math.max(0, Number(event.target.value)) })} className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label><label className="block"><span className="text-[9px] uppercase tracking-wide text-slate-400">Meta diaria</span><input type="number" min="0" value={targets[metric.key]} onChange={(event) => updateTarget(metric.key, Number(event.target.value))} className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label></div></div>)}</div>
        </article>

        <article className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-white p-5 shadow-[var(--ferova-shadow)]"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-cyan-700">Cumplimiento y tendencia</p><div className="mt-4 space-y-3">{metricDefs.map((metric, index) => <Progress key={metric.key} label={metric.label} value={targets[metric.key] > 0 ? today[metric.key] / targets[metric.key] * 100 : 0} tone={['#2dd4bf','#54c59c','#f2b84b','#ef6681'][index]} />)}</div><div className="mt-5 h-36">{trend.length > 1 ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} /><YAxis hide domain={[0, 100]} /><Tooltip formatter={(value: number) => `${value.toFixed(0)}%`} /><Line type="monotone" dataKey="cumplimiento" stroke="#14b8a6" strokeWidth={2.5} dot={{ r: 2 }} /></LineChart></ResponsiveContainer> : <div className="grid h-full place-items-center rounded-xl bg-slate-50 text-xs text-slate-400">Guarda al menos dos días para ver la tendencia.</div>}</div></article>

        <article className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[#101726] p-5 text-white shadow-[var(--ferova-shadow)]"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-amber-300">Comisiones por pasarela</p><p className="mt-1 text-xs text-slate-300">El MRR real es el neto, no el bruto. Configura tu pasarela y se aplica a las ventas sin comisión propia.</p></div><CircleDollarSign className="h-5 w-5 text-amber-300" /></div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="block"><span className="text-[9px] uppercase tracking-wide text-slate-400">Pasarela</span><input type="text" value={gatewayName} onChange={(event) => updateGatewayName(event.target.value)} placeholder="PayPal, Wompi…" className="mt-0.5 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-white placeholder:text-slate-500" /></label>
            <label className="block"><span className="text-[9px] uppercase tracking-wide text-slate-400">Comisión %</span><input type="number" min="0" max="100" step="0.1" value={gateway.porcentaje || ''} onChange={(event) => updateGateway({ porcentaje: Math.max(0, Number(event.target.value)) })} placeholder="4.4" className="mt-0.5 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-white placeholder:text-slate-500" /></label>
            <label className="block"><span className="text-[9px] uppercase tracking-wide text-slate-400">Cargo fijo</span><input type="number" min="0" step="0.01" value={gateway.fija || ''} onChange={(event) => updateGateway({ fija: Math.max(0, Number(event.target.value)) })} placeholder="0.30" className="mt-0.5 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-white placeholder:text-slate-500" /></label>
            <label className="block"><span className="text-[9px] uppercase tracking-wide text-slate-400">Retiro</span><input type="number" min="0" step="0.01" value={gateway.retiro || ''} onChange={(event) => updateGateway({ retiro: Math.max(0, Number(event.target.value)) })} placeholder="0" className="mt-0.5 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-white placeholder:text-slate-500" /></label>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><Money label="Bruto mes" value={formatCop(grossMonthCop)} /><span className="text-amber-300">→</span><Money label="Neto mes" value={formatCop(netMrr)} /></div>
          <p className="mt-3 text-[11px] text-slate-400">Descontado: {formatCop(feesMonthCop)} entre porcentaje, cargo fijo y retiro{gatewayName ? ` (${gatewayName})` : ''}. El cargo fijo y el retiro se aplican en la moneda de cada venta; la conversión usa la TRM efectiva. Una venta con comisión propia en su registro conserva la suya.</p></article>

        <article className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-white p-5"><div className="flex items-center gap-2"><Target className="h-4 w-4 text-[var(--ferova-brand)]" /><h3 className="text-sm font-semibold text-slate-900">Meta anual O10</h3></div><p className="mt-1 text-xs text-slate-500">La meta queda visible como “por confirmar” hasta que ingreses tu MRR objetivo real. Se alimenta de los objetivos por proyecto definidos abajo.</p><div className="mt-3 flex gap-2"><input type="number" min="0" value={annualMrrTarget || ''} onChange={(event) => saveAnnualTarget(Number(event.target.value))} placeholder="MRR objetivo a 12 meses (COP)" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /><span className="grid place-items-center rounded-xl bg-slate-50 px-3 text-xs font-semibold text-slate-500">COP</span></div></article>

        <article className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-white p-5 shadow-[var(--ferova-shadow)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2"><FolderKanban className="h-4 w-4 text-violet-600" /><h3 className="text-sm font-semibold text-slate-900">Objetivos por proyecto que alimentan la meta</h3></div>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">{objetivosCumplidos}/{totalObjetivos} cumplidos</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Cada objetivo, hito y KPI se define en <span className="font-semibold text-slate-700">Projects → Proyectos</span>. Aquí se ve cómo su avance sostiene la meta anual.</p>
          {objetivosProyectos.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-400">Aún no hay objetivos por proyecto. Definilos en Proyectos para relacionarlos con la meta anual.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {objetivosProyectos.slice(0, 8).map((obj, index) => (
                <li key={index} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{obj.texto}</p>
                      <p className="text-[10px] text-slate-400">{obj.cliente}{obj.metaFecha ? ` · meta ${obj.metaFecha}` : ''}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${obj.completado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{obj.completado ? 'Cumplido' : 'En curso'}</span>
                  </div>
                  {obj.kpis.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {obj.kpis.map((kpi) => {
                        const enMeta = kpiEnMeta(kpi.meta, kpi.actual);
                        return (
                          <span key={kpi.id} className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-medium ${enMeta === true ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : enMeta === false ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                            {kpi.nombre}: {kpi.actual || '—'} / {kpi.meta}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </div>
  </section>;
}

function rollupScore(values: DailyValues, days: number, targets: DailyTargets): number { return metricDefs.reduce((sum, metric) => { const target = targets[metric.key] * days; return sum + (target > 0 ? Math.min(100, values[metric.key] / target * 100) : 0); }, 0) / metricDefs.length; }
function FeedArrow() { return <div className="flex h-5 items-center justify-center gap-2 text-[9px] uppercase tracking-widest text-slate-400"><ArrowDown className="h-3 w-3" /> alimenta</div>; }
function CadenceCard({ title, subtitle, accent, value, items }: { title: string; subtitle: string; accent: 'cyan'|'emerald'|'amber'|'violet'; value: string; items: string[] }) { const colors = { cyan: 'border-l-cyan-400 text-cyan-600', emerald: 'border-l-emerald-400 text-emerald-600', amber: 'border-l-amber-400 text-amber-600', violet: 'border-l-violet-400 text-violet-600' }; return <article className={`rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] border-l-4 bg-white p-4 shadow-[var(--ferova-shadow)] ${colors[accent]}`}><div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-bold uppercase tracking-tight">{title}</h3><p className="text-[10px] text-slate-400">{subtitle}</p></div><p className="text-sm font-bold text-slate-900">{value}</p></div><ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">{items.map((item) => <li key={item} className="flex gap-1 text-[10px] text-slate-600"><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />{item}</li>)}</ul></article>; }
function Progress({ label, value, tone }: { label: string; value: number; tone: string }) { const safe = Math.max(0, Math.min(100, value)); return <div><div className="mb-1 flex justify-between text-[11px]"><span className="text-slate-600">{label}</span><span className="font-bold text-slate-900">{safe.toFixed(0)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all" style={{ width: `${safe}%`, backgroundColor: tone }} /></div></div>; }
function Money({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-black/15 p-3"><p className="text-[9px] uppercase text-slate-400">{label}</p><p className="mt-1 text-base font-bold text-white">{value}</p></div>; }
