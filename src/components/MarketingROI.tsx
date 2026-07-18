import React, { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { listCampaigns, listMetrics, createCampaign, deleteCampaign, upsertMetrics, type Campaign, type CampaignMetrics } from '../lib/marketingService';
import { computeRoi, reverseRoi, type CampaignMetricsInput } from '../lib/roiCalc';
import { CircleHelp, Loader2, Plus, Trash2 } from 'lucide-react';

const cardClass = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
const inputClass = 'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500';
const btnPrimary = 'inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700';

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
const fmt = (v: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(v);

export default function MarketingROI({ user, formatCop }: { user: User; formatCop: (n: number) => string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [metrics, setMetrics] = useState<CampaignMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [newCanal, setNewCanal] = useState('Meta Ads');

  const reload = () => { setLoading(true); Promise.all([listCampaigns(user.id), listMetrics(user.id)]).then(([c, m]) => { setCampaigns(c); setMetrics(m); }).finally(() => setLoading(false)); };
  useEffect(() => { reload(); }, [user.id]);

  const latestByCampaign = useMemo(() => {
    const map = new Map<string, CampaignMetrics>();
    metrics.forEach((m) => { if (!map.has(m.campaign_id) || m.periodo > (map.get(m.campaign_id)!.periodo)) map.set(m.campaign_id, m); });
    return map;
  }, [metrics]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Marketing ROI</h1>
        <p className="text-sm text-slate-500">Registra campañas, costos completos y resultados. El ROI real incluye pauta, entrega, comisiones y honorarios profesionales.</p>
      </div>

      <div className={cardClass}>
        <h3 className="font-semibold text-slate-900 mb-3">Nueva campaña</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input className={inputClass} placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input className={inputClass} placeholder="Canal" value={newCanal} onChange={(e) => setNewCanal(e.target.value)} />
          <button className={btnPrimary} onClick={async () => {
            if (!newName.trim()) return;
            await createCampaign(user.id, { nombre: newName, canal: newCanal, moneda: 'COP', estado: 'activa' });
            setNewName(''); reload();
          }}><Plus className="w-3.5 h-3.5" /> Crear</button>
        </div>
      </div>

      <div className={cardClass}>
        <h3 className="font-semibold text-slate-900 mb-3">Campañas</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="py-2 w-8"></th><th>Nombre</th><th>Canal</th><th className="text-right">Inversión</th><th className="text-right">Ingresos</th><th className="text-right">ROAS</th><th className="text-right">ROI</th><th></th>
            </tr></thead>
            <tbody>
              {campaigns.map((c) => {
                const m = latestByCampaign.get(c.id);
                const r = m ? computeRoi(m) : null;
                const selected = selection.includes(c.id);
                return (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="py-2"><input type="checkbox" checked={selected} disabled={!selected && selection.length >= 5} onChange={(e) => setSelection((s) => e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id))} /></td>
                    <td className="font-medium">{c.nombre}</td>
                    <td className="text-slate-500">{c.canal || '—'}</td>
                    <td className="text-right">{m ? formatCop(m.inversion) : '—'}</td>
                    <td className="text-right">{r ? formatCop(r.ingresos_brutos) : '—'}</td>
                    <td className="text-right">{r ? `${r.roas.toFixed(2)}x` : '—'}</td>
                    <td className={`text-right font-semibold ${r && r.roi >= 0 ? 'text-emerald-700' : r ? 'text-red-600' : ''}`}>{r ? pct(r.roi) : '—'}</td>
                    <td className="text-right"><button onClick={() => deleteCampaign(c.id).then(reload)} className="text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                );
              })}
              {campaigns.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-slate-400 text-sm">Aún no cargaste campañas.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {campaigns.map((c) => (
        <MetricsEditor key={c.id} user={user} campaign={c} current={latestByCampaign.get(c.id)} onSaved={reload} formatCop={formatCop} />
      ))}

      {selection.length >= 2 && (
        <Comparator campaigns={campaigns.filter((c) => selection.includes(c.id))} latestByCampaign={latestByCampaign} formatCop={formatCop} />
      )}

      <ReverseCalculator latestByCampaign={latestByCampaign} formatCop={formatCop} />
    </div>
  );
}

function MetricsEditor({ user, campaign, current, onSaved, formatCop }: { user: User; campaign: Campaign; current?: CampaignMetrics; onSaved: () => void; formatCop: (n: number) => string }) {
  const [open, setOpen] = useState(false);
  const empty: CampaignMetricsInput & { periodo: string } = {
    periodo: current?.periodo || new Date().toISOString().slice(0, 7),
    inversion: current?.inversion || 0, impresiones: current?.impresiones || 0, clics: current?.clics || 0,
    leads: current?.leads || 0, leads_calificados: current?.leads_calificados || 0, citas: current?.citas || 0, citas_efectivas: current?.citas_efectivas || 0,
    ventas: current?.ventas || 0, ticket_promedio: current?.ticket_promedio || 0, costo_entrega: current?.costo_entrega || 0, comision: current?.comision || 0, costo_profesional: current?.costo_profesional || 0, ltv: current?.ltv || 0,
  };
  const [form, setForm] = useState(empty);
  useEffect(() => { setForm(empty); }, [current?.id]);
  const roi = computeRoi(form);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value.includes('-') || e.target.value === '' ? 0 : Number(e.target.value) });

  return (
    <div className={cardClass}>
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left flex justify-between items-center">
        <div><h3 className="font-semibold text-slate-900">{campaign.nombre}</h3><p className="text-xs text-slate-500">{campaign.canal || 'Sin canal'} · {current ? `ROI ${pct(computeRoi(current).roi)}` : 'Sin métricas'}</p></div>
        <span className="text-xs text-blue-600 font-semibold">{open ? 'Cerrar' : 'Editar métricas'}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Field label="Periodo (YYYY-MM)" value={form.periodo as any} onChange={(e) => setForm({ ...form, periodo: e.target.value })} type="month" />
            <Field label="Inversión" value={form.inversion} onChange={set('inversion')} />
            <Field label="Impresiones" value={form.impresiones} onChange={set('impresiones')} />
            <Field label="Clics" value={form.clics} onChange={set('clics')} />
            <Field label="Leads" value={form.leads} onChange={set('leads')} />
            <Field label="Leads calificados" value={form.leads_calificados} onChange={set('leads_calificados')} />
            <Field label="Citas" value={form.citas} onChange={set('citas')} />
            <Field label="Citas efectivas" value={form.citas_efectivas} onChange={set('citas_efectivas')} />
            <Field label="Ventas" value={form.ventas} onChange={set('ventas')} />
            <Field label="Ticket promedio" value={form.ticket_promedio} onChange={set('ticket_promedio')} />
            <Field label="Costo entrega" value={form.costo_entrega} onChange={set('costo_entrega')} />
            <Field label="Comisión" value={form.comision} onChange={set('comision')} />
            <Field label="Honorarios profesionales" value={form.costo_profesional} onChange={set('costo_profesional')} help="Pago total del profesional o equipo que ejecutó la campaña durante este periodo." />
            <Field label="LTV" value={form.ltv} onChange={set('ltv')} help="Valor total estimado que deja un cliente durante toda su relación con el negocio, no sólo en la primera compra." />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <Kpi label="CPM" value={fmt(roi.cpm)} />
            <Kpi label="CTR" value={pct(roi.ctr)} />
            <Kpi label="CPC" value={fmt(roi.cpc)} />
            <Kpi label="CPL" value={fmt(roi.cpl)} />
            <Kpi label="CPL calif." value={fmt(roi.cpl_calificado)} />
            <Kpi label="CPA" value={fmt(roi.cpa)} />
            <Kpi label="ROAS" value={`${roi.roas.toFixed(2)}x`} />
            <Kpi label="ROI real" value={pct(roi.roi)} highlight={roi.roi >= 0 ? 'good' : 'bad'} />
            <Kpi label="Ingresos" value={formatCop(roi.ingresos_brutos)} />
            <Kpi label="Utilidad neta" value={formatCop(roi.utilidad_neta)} highlight={roi.utilidad_neta >= 0 ? 'good' : 'bad'} />
            <Kpi label="Costos totales" value={formatCop(roi.costos_totales)} />
            <Kpi label="Margen neto" value={pct(roi.margen_neto)} />
            <Kpi label="LTV total" value={formatCop(roi.ltv_total)} />
          </div>
          <button className={btnPrimary} onClick={async () => {
            await upsertMetrics(user.id, { ...form, campaign_id: campaign.id, id: current?.id });
            setOpen(false); onSaved();
          }}>Guardar métricas</button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'number', help }: { label: string; value: any; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; help?: string }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">{label}{help && <span title={help}><CircleHelp className="h-3 w-3" aria-label={help} /></span>}</span>
      <input className={inputClass} type={type} value={value} onChange={onChange} />
    </label>
  );
}
function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: 'good' | 'bad' }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
      <p className={`text-sm font-bold ${highlight === 'good' ? 'text-emerald-700' : highlight === 'bad' ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

function Comparator({ campaigns, latestByCampaign, formatCop }: { campaigns: Campaign[]; latestByCampaign: Map<string, CampaignMetrics>; formatCop: (n: number) => string }) {
  return (
    <div className={cardClass}>
      <h3 className="font-semibold text-slate-900 mb-3">Comparador ({campaigns.length}/5)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-slate-500 border-b border-slate-200"><th className="py-2">Métrica</th>{campaigns.map((c) => <th key={c.id} className="py-2">{c.nombre}</th>)}</tr></thead>
          <tbody>
            {(['inversion','ingresos_brutos','roas','roi','cpl','cpa','margen_neto'] as const).map((k) => (
              <tr key={k} className="border-b border-slate-100">
                <td className="py-1.5 font-semibold text-slate-700">{k}</td>
                {campaigns.map((c) => {
                  const m = latestByCampaign.get(c.id);
                  if (!m) return <td key={c.id} className="text-slate-400">—</td>;
                  const r = computeRoi(m);
                  const v: any = { inversion: m.inversion, ingresos_brutos: r.ingresos_brutos, roas: `${r.roas.toFixed(2)}x`, roi: pct(r.roi), cpl: fmt(r.cpl), cpa: fmt(r.cpa), margen_neto: pct(r.margen_neto) }[k];
                  return <td key={c.id} className="py-1.5">{typeof v === 'number' ? formatCop(v) : v}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReverseCalculator({ latestByCampaign, formatCop }: { latestByCampaign: Map<string, CampaignMetrics>; formatCop: (n: number) => string }) {
  // Baseline: promedio de tasas históricas
  const rates = useMemo(() => {
    const all = Array.from(latestByCampaign.values());
    if (all.length === 0) return { ctr: 0.02, cpc: 800, tasa_lead_a_calificado: 0.5, tasa_calificado_a_cita: 0.4, tasa_cita_a_efectiva: 0.6, tasa_efectiva_a_venta: 0.3 };
    const rs = all.map(computeRoi);
    const avg = (fn: (r: any) => number) => rs.reduce((s, r) => s + fn(r), 0) / rs.length;
    return {
      ctr: avg((r) => r.ctr) || 0.02,
      cpc: avg((r) => r.cpc) || 800,
      tasa_lead_a_calificado: avg((r) => r.tasa_lead_a_calificado) || 0.5,
      tasa_calificado_a_cita: avg((r) => r.tasa_calificado_a_cita) || 0.4,
      tasa_cita_a_efectiva: avg((r) => r.tasa_cita_a_efectiva) || 0.6,
      tasa_efectiva_a_venta: avg((r) => r.tasa_efectiva_a_venta) || 0.3,
    };
  }, [latestByCampaign]);

  const [meta, setMeta] = useState(10000000);
  const [ticket, setTicket] = useState(1500000);
  const result = reverseRoi({ meta_facturacion: meta, ticket_promedio: ticket, ...rates });

  return (
    <div className={cardClass}>
      <h3 className="font-semibold text-slate-900 mb-3">Calculadora inversa</h3>
      <p className="text-xs text-slate-500 mb-3">A partir de tu meta de facturación, calculamos cuántas ventas, citas, leads, clics e impresiones necesitás usando tus tasas actuales.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Field label="Meta facturación" value={meta} onChange={(e) => setMeta(Number(e.target.value) || 0)} />
        <Field label="Ticket promedio" value={ticket} onChange={(e) => setTicket(Number(e.target.value) || 0)} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs">
        <Kpi label="Ventas necesarias" value={fmt(result.ventas)} />
        <Kpi label="Citas efectivas" value={fmt(result.citas_efectivas)} />
        <Kpi label="Citas" value={fmt(result.citas)} />
        <Kpi label="Leads calificados" value={fmt(result.leads_calificados)} />
        <Kpi label="Leads" value={fmt(result.leads)} />
        <Kpi label="Clics" value={fmt(result.clics)} />
        <Kpi label="Impresiones" value={fmt(result.impresiones)} />
        <Kpi label="Inversión estimada" value={formatCop(result.inversion)} />
      </div>
    </div>
  );
}
