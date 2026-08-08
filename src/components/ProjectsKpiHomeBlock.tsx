import { useEffect, useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { useProjectPortfolio } from '../hooks/useProjectPortfolio';
import { listKpiEntries, type KpiEntry } from '../lib/projectKpisService';
import type { AppData } from '../types';

// Bloque de inicio: cumplimiento mensual de cada proyecto, usando los KPIs
// creados en Proyectos y su registro diario (project_kpi_entries).

const toNum = (s: string) => { const n = Number(String(s).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };

export default function ProjectsKpiHomeBlock({ data, onNavigate }: { data: Pick<AppData, 'clientes' | 'servicios' | 'ventas' | 'horas'>; onNavigate: (tab: string) => void }) {
  const projects = useProjectPortfolio(data);
  const withKpis = useMemo(() => projects.filter((p: any) => (p.kpis?.length ?? 0) > 0), [projects]);
  const allKpiIds = useMemo(() => withKpis.flatMap((p: any) => p.kpis.map((k: any) => k.id)), [withKpis]);
  const key = allKpiIds.join(',');

  const [entries, setEntries] = useState<KpiEntry[]>([]);
  useEffect(() => {
    let alive = true;
    if (!allKpiIds.length) { setEntries([]); return; }
    listKpiEntries(allKpiIds, `${new Date().getFullYear()}-01-01`).then((e) => { if (alive) setEntries(e); }).catch(() => undefined);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
  const mesPorKpi = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) if (e.fecha >= monthStart) map[e.kpi_id] = (map[e.kpi_id] || 0) + e.valor;
    return map;
  }, [entries, monthStart]);

  const rows = useMemo(() => {
    const diasMes = new Date().getDate();
    return withKpis.map((p: any) => {
      const pcts = p.kpis.map((k: any) => {
        const meta = toNum(k.meta); const cad = k.cadencia || 'diario';
        const metaMes = cad === 'diario' ? meta * diasMes : cad === 'semanal' ? meta * 4.33 : cad === 'anual' ? meta / 12 : meta;
        if (!metaMes) return 0;
        return Math.min(1, (mesPorKpi[k.id] || 0) / metaMes);
      });
      const pct = pcts.length ? Math.round((pcts.reduce((a: number, b: number) => a + b, 0) / pcts.length) * 100) : 0;
      return { id: p.id, nombre: p.client?.nombre || 'Proyecto', kpis: p.kpis.length, pct };
    }).sort((a, b) => a.pct - b.pct);
  }, [withKpis, mesPorKpi]);

  if (withKpis.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-700"><Target className="h-4 w-4" /></span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Cumplimiento de proyectos</p>
            <h3 className="text-lg font-semibold text-slate-950">Este mes, por proyecto</h3>
          </div>
        </div>
        <button onClick={() => onNavigate('proyectos')} className="text-xs font-semibold text-blue-700 hover:text-blue-900">Ver proyectos →</button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <button key={r.id} onClick={() => onNavigate('proyectos')} className="rounded-xl border border-slate-200 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-slate-900">{r.nombre}</span>
              <span className={`text-sm font-bold ${r.pct >= 80 ? 'text-emerald-700' : r.pct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{r.pct}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${r.pct >= 80 ? 'bg-emerald-500' : r.pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(r.pct, 100)}%` }} /></div>
            <p className="mt-1 text-[10px] text-slate-400">{r.kpis} KPI{r.kpis === 1 ? '' : 's'}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
