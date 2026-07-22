import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { FileText, Loader2, Sparkles, AlertTriangle, CheckCircle2, Target, Calculator } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CeoReport, DecisionSimulation, ReportPeriod, generateReport, listReports, listSimulations, runSimulation } from '../lib/reportsService';
import { AiDisclosure } from './AiDisclosure';

const periodLabel: Record<ReportPeriod, string> = { daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual' };

const SCENARIOS: Array<{ id: string; label: string; fields: Array<{ key: string; label: string; type: 'number' | 'text'; hint?: string }> }> = [
  { id: 'hire', label: 'Contratar a alguien', fields: [
    { key: 'monthly_cost', label: 'Costo mensual (COP)', type: 'number' },
    { key: 'expected_extra_hours_month', label: 'Horas extra al mes', type: 'number' },
    { key: 'avg_hourly_rate', label: 'Tarifa promedio por hora (COP)', type: 'number', hint: 'Si vacío, uso tu promedio real' },
  ]},
  { id: 'price_change', label: 'Cambiar precio', fields: [
    { key: 'pct', label: 'Cambio % (0.10 = +10%)', type: 'number' },
    { key: 'demand_elasticity', label: 'Elasticidad de demanda (default -1)', type: 'number' },
  ]},
  { id: 'invest', label: 'Invertir', fields: [
    { key: 'upfront_cost', label: 'Inversión inicial (COP)', type: 'number' },
    { key: 'expected_monthly_return', label: 'Retorno mensual esperado (COP)', type: 'number' },
    { key: 'months', label: 'Meses a evaluar', type: 'number' },
  ]},
  { id: 'cut_cost', label: 'Recortar gasto', fields: [
    { key: 'monthly_saving', label: 'Ahorro mensual (COP)', type: 'number' },
    { key: 'risk_note', label: '¿Qué riesgo asumo?', type: 'text' },
  ]},
  { id: 'promo', label: 'Hacer promoción', fields: [
    { key: 'discount_pct', label: 'Descuento % (0.20 = 20%)', type: 'number' },
    { key: 'expected_volume_multiplier', label: 'Multiplicador de volumen esperado', type: 'number', hint: '1.5 = 50% más ventas' },
  ]},
];

function formatCop(n: number | undefined | null): string {
  if (n === null || n === undefined) return '—';
  return '$' + Math.round(Number(n)).toLocaleString('es-CO');
}

export default function ReportsView({ user }: { user: User }) {
  const [period, setPeriod] = useState<ReportPeriod>('weekly');
  const [reports, setReports] = useState<CeoReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState<'reports' | 'decisions'>('reports');
  const [error, setError] = useState<string | null>(null);

  const [sims, setSims] = useState<DecisionSimulation[]>([]);
  const [scenario, setScenario] = useState<string>('hire');
  const [question, setQuestion] = useState('');
  const [inputs, setInputs] = useState<Record<string, any>>({});
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => { void reload(); }, [period, user.id]);
  useEffect(() => { void reloadSims(); }, [user.id]);

  async function reload() {
    setLoading(true); setError(null);
    try { setReports(await listReports(user.id, period)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }
  async function reloadSims() {
    try { setSims(await listSimulations(user.id)); } catch {}
  }

  async function handleGenerate() {
    setGenerating(true); setError(null);
    try { await generateReport(period); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setGenerating(false); }
  }

  async function handleSimulate() {
    setSimLoading(true); setError(null);
    try {
      const cleanInputs: Record<string, any> = {};
      for (const [k, v] of Object.entries(inputs)) {
        const scen = SCENARIOS.find((s) => s.id === scenario);
        const field = scen?.fields.find((f) => f.key === k);
        if (field?.type === 'number') cleanInputs[k] = v === '' || v === undefined ? undefined : Number(v);
        else cleanInputs[k] = v;
      }
      await runSimulation({ question: question || `¿Debería ${SCENARIOS.find((s) => s.id === scenario)?.label.toLowerCase()}?`, scenario_type: scenario, inputs: cleanInputs });
      setQuestion(''); setInputs({});
      await reloadSims();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSimLoading(false); }
  }

  const activeScen = SCENARIOS.find((s) => s.id === scenario)!;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reportes CEO & Decisiones</h1>
          <p className="text-sm text-slate-500">Síntesis ejecutiva del negocio y simulador de decisiones.</p>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button onClick={() => setTab('reports')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${tab==='reports'?'bg-blue-600 text-white':'text-slate-600'}`}>Reportes</button>
          <button onClick={() => setTab('decisions')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${tab==='decisions'?'bg-blue-600 text-white':'text-slate-600'}`}>Simulador</button>
        </div>
      </header>

      <AiDisclosure variant="report" />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {tab === 'reports' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {(['daily','weekly','monthly'] as ReportPeriod[]).map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${period===p?'bg-slate-900 text-white':'text-slate-600'}`}>{periodLabel[p]}</button>
              ))}
            </div>
            <button onClick={handleGenerate} disabled={generating} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generar reporte {periodLabel[period].toLowerCase()}
            </button>
          </div>

          {!loading && reports.length > 0 && <ReportsOverview reports={reports} />}

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
            </div>
          ) : reports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-600">Aún no hay reportes {periodLabel[period].toLowerCase()}s. Generá el primero con el botón de arriba.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((r) => <ReportCard key={r.id} report={r} />)}
            </div>
          )}
        </>
      )}

      {tab === 'decisions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-900">
              <Calculator className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-semibold">Nueva simulación</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SCENARIOS.map((s) => (
                <button key={s.id} onClick={() => { setScenario(s.id); setInputs({}); }} className={`text-left rounded-lg border px-3 py-2 text-xs font-semibold ${scenario===s.id?'border-blue-500 bg-blue-50 text-blue-700':'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>{s.label}</button>
              ))}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Pregunta</label>
              <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="¿Debería contratar a un asistente?" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            {activeScen.fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">{f.label}</label>
                <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={inputs[f.key] ?? ''}
                  onChange={(e) => setInputs({ ...inputs, [f.key]: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                {f.hint && <p className="text-[10px] text-slate-400">{f.hint}</p>}
              </div>
            ))}
            <button onClick={handleSimulate} disabled={simLoading} className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {simLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Simular
            </button>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700 px-1">Historial</h2>
            {sims.length === 0 && <p className="text-xs text-slate-400 px-1">Aún no hay simulaciones.</p>}
            {sims.map((s) => <SimulationCard key={s.id} sim={s} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportsOverview({ reports }: { reports: CeoReport[] }) {
  const latest = reports[0];
  const metrics = latest.metrics || {};
  const history = [...reports].reverse().slice(-8).map((report) => ({
    period: report.period_end.slice(5),
    ingresos: Number(report.metrics?.revenue_cop || 0),
    utilidad: Number(report.metrics?.gross_margin_cop || report.metrics?.cash_cop || 0),
    score: Number(report.health_score || 0),
  }));
  const health = Math.max(0, Math.min(100, Number(latest.health_score || 0)));
  const margin = Number(metrics.gross_margin_pct || 0);
  const cards = [
    ['Ingresos', formatCop(metrics.revenue_cop), 'Facturación del período'],
    ['Utilidad neta', formatCop(metrics.cash_cop), 'Caja después de movimientos'],
    ['Margen bruto', `${Math.round(margin * (Math.abs(margin) <= 1 ? 100 : 1))}%`, 'Rentabilidad del período'],
  ];
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value, detail]) => <article key={label} className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-white p-4 shadow-[var(--ferova-shadow)]"><p className="text-[9px] font-bold uppercase tracking-[.15em] text-slate-400">{label}</p><p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-[11px] text-slate-500">{detail}</p></article>)}
      <article className="flex items-center justify-between rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-white p-4 shadow-[var(--ferova-shadow)]"><div><p className="text-[9px] font-bold uppercase tracking-[.15em] text-slate-400">Health del negocio</p><p className="mt-2 text-xl font-semibold text-slate-950">{health}%</p><p className="mt-1 text-[11px] text-slate-500">Ecosistema de indicadores</p></div><div className="grid h-16 w-16 place-items-center rounded-full" style={{ background: `conic-gradient(#541014 ${health * 3.6}deg, #ececee 0)` }}><div className="grid h-11 w-11 place-items-center rounded-full bg-white text-xs font-bold text-[#541014]">{health}</div></div></article>
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
      <article className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-white p-4 shadow-[var(--ferova-shadow)]"><div className="mb-3"><p className="text-[9px] font-bold uppercase tracking-[.15em] text-slate-400">Evolución</p><h2 className="mt-1 text-sm font-semibold text-slate-900">Reporte de decisiones</h2></div><div className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={history}><defs><linearGradient id="reportRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#541014" stopOpacity={.28}/><stop offset="100%" stopColor="#541014" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#ececee"/><XAxis dataKey="period" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#8b8b91'}}/><YAxis hide/><Tooltip formatter={(value:number) => formatCop(value)} contentStyle={{borderRadius:10,border:'1px solid #e4e5e7',fontSize:11}}/><Area type="monotone" dataKey="ingresos" stroke="#541014" strokeWidth={2.5} fill="url(#reportRevenue)" animationDuration={900}/></AreaChart></ResponsiveContainer></div></article>
      <article className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-white p-4 shadow-[var(--ferova-shadow)]"><div className="mb-3"><p className="text-[9px] font-bold uppercase tracking-[.15em] text-slate-400">Comparativo</p><h2 className="mt-1 text-sm font-semibold text-slate-900">Ingresos y utilidad</h2></div><div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={history.slice(-5)} layout="vertical"><CartesianGrid horizontal={false} stroke="#ececee"/><XAxis type="number" hide/><YAxis dataKey="period" type="category" axisLine={false} tickLine={false} width={42} tick={{fontSize:10,fill:'#8b8b91'}}/><Tooltip formatter={(value:number) => formatCop(value)} contentStyle={{borderRadius:10,border:'1px solid #e4e5e7',fontSize:11}}/><Bar dataKey="ingresos" fill="#541014" radius={[0,6,6,0]} barSize={9}/><Bar dataKey="utilidad" fill="#58a97a" radius={[0,6,6,0]} barSize={9}/></BarChart></ResponsiveContainer></div></article>
    </div>
  </div>;
}

function ReportCard({ report }: { report: CeoReport }) {
  const m = report.metrics || {};
  const growth = Number(m.revenue_growth || 0);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">{report.period_start} → {report.period_end}</p>
          <h3 className="text-lg font-semibold text-slate-900 mt-1">{report.headline}</h3>
        </div>
        {report.health_score !== null && (
          <div className="text-right">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Health</p>
            <p className="text-2xl font-bold text-slate-900">{report.health_score}</p>
          </div>
        )}
      </header>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Metric label="Ingresos" value={formatCop(m.revenue_cop)} delta={growth} />
        <Metric label="Costo directo" value={formatCop(m.direct_costs_cop)} />
        <Metric label="Margen bruto" value={formatCop(m.gross_margin_cop)} delta={m.gross_margin_pct} />
        <Metric label="Pagos reales" value={formatCop(m.cash_out_cop ?? m.expenses_cop)} />
        <Metric label="Caja neta" value={formatCop(m.cash_cop)} />
      </div>
      {report.summary_md && <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{report.summary_md}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <List icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} title="Logros" items={report.wins} tone="emerald" />
        <List icon={<AlertTriangle className="w-4 h-4 text-amber-600" />} title="Riesgos" items={report.risks} tone="amber" />
        <List icon={<Target className="w-4 h-4 text-blue-600" />} title="Prioridades" items={report.priorities} tone="blue" />
      </div>
    </article>
  );
}

function Metric({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-900 mt-1">{value}</p>
      {delta !== undefined && delta !== 0 && (
        <p className={`text-[10px] font-semibold mt-1 ${delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{delta > 0 ? '+' : ''}{Math.round(delta * 100)}%</p>
      )}
    </div>
  );
}

function List({ icon, title, items, tone }: { icon: React.ReactNode; title: string; items: string[]; tone: 'emerald' | 'amber' | 'blue' }) {
  const toneCls = { emerald: 'border-emerald-100 bg-emerald-50/50', amber: 'border-amber-100 bg-amber-50/50', blue: 'border-blue-100 bg-blue-50/50' }[tone];
  return (
    <div className={`rounded-lg border ${toneCls} p-3`}>
      <div className="flex items-center gap-1.5 mb-2">{icon}<h4 className="text-xs font-semibold text-slate-700">{title}</h4></div>
      {items.length === 0 ? <p className="text-xs text-slate-400">—</p> : (
        <ul className="space-y-1">{items.map((it, i) => <li key={i} className="text-xs text-slate-700 leading-snug">• {it}</li>)}</ul>
      )}
    </div>
  );
}

function SimulationCard({ sim }: { sim: DecisionSimulation }) {
  const r = sim.result || {};
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-slate-900">{sim.question}</p>
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">{sim.scenario_type}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {Object.entries(r).slice(0, 6).map(([k, v]) => (
          <div key={k} className="rounded-md bg-slate-50 border border-slate-100 px-2 py-1">
            <p className="text-[9px] font-mono uppercase tracking-widest text-slate-400">{k}</p>
            <p className="text-xs font-semibold text-slate-800">{typeof v === 'number' ? (Math.abs(v) >= 1000 ? formatCop(v) : String(v)) : String(v)}</p>
          </div>
        ))}
      </div>
      {sim.recommendation && <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed border-t border-slate-100 pt-2">{sim.recommendation}</p>}
    </article>
  );
}
