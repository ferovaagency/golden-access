import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Loader2, Check } from 'lucide-react';
import {
  listProjectKpis, createProjectKpi, deleteProjectKpi,
  listKpiEntries, upsertKpiEntry,
  type ProjectKpi, type KpiEntry, type KpiFrecuencia,
} from '../lib/projectKpisService';

// Registro diario + cumplimiento POR PROYECTO. Cada proyecto define sus propios
// KPIs (nombre + frecuencia + meta). Se registra el diario y lo semanal/mensual/
// anual se recalcula solo con los datos reales. Reemplaza al tablero global.

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function startOfWeek(d: Date): Date {
  const x = new Date(d); const day = (x.getDay() + 6) % 7; // lunes = 0
  x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x;
}

const FRECUENCIAS: { value: KpiFrecuencia; label: string }[] = [
  { value: 'diaria', label: 'Diaria' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensual', label: 'Mensual' },
];

export default function ProjectDailyKpis({ clienteId }: { clienteId: string }) {
  const [kpis, setKpis] = useState<ProjectKpi[]>([]);
  const [entries, setEntries] = useState<KpiEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [form, setForm] = useState<{ nombre: string; frecuencia: KpiFrecuencia; meta: string }>({ nombre: '', frecuencia: 'diaria', meta: '' });

  const today = isoDate(new Date());
  const yearStart = `${new Date().getFullYear()}-01-01`;

  const reload = async () => {
    setLoading(true);
    try {
      const list = await listProjectKpis(clienteId);
      setKpis(list);
      const ents = await listKpiEntries(list.map((k) => k.id), yearStart);
      setEntries(ents);
    } catch { /* la UI muestra vacío si falla */ } finally { setLoading(false); }
  };
  useEffect(() => { if (clienteId) void reload(); /* eslint-disable-next-line */ }, [clienteId]);

  const weekStart = useMemo(() => isoDate(startOfWeek(new Date())), []);
  const monthStart = useMemo(() => `${today.slice(0, 7)}-01`, [today]);

  const sums = useMemo(() => {
    const map: Record<string, { hoy: number; semana: number; mes: number; anio: number; dias: number }> = {};
    for (const k of kpis) map[k.id] = { hoy: 0, semana: 0, mes: 0, anio: 0, dias: 0 };
    for (const e of entries) {
      const m = map[e.kpi_id]; if (!m) continue;
      m.anio += e.valor;
      if (e.fecha >= monthStart) m.mes += e.valor;
      if (e.fecha >= weekStart) m.semana += e.valor;
      if (e.fecha === today) m.hoy += e.valor;
      if (e.valor > 0) m.dias += 1;
    }
    return map;
  }, [kpis, entries, today, weekStart, monthStart]);

  // Cumplimiento mensual del proyecto: promedio del avance mensual de sus KPIs.
  const cumplimientoMensual = useMemo(() => {
    if (!kpis.length) return 0;
    const diasMes = new Date().getDate();
    const pcts = kpis.map((k) => {
      const s = sums[k.id] || { mes: 0 };
      const metaMes = k.frecuencia === 'diaria' ? k.meta * diasMes : k.frecuencia === 'semanal' ? k.meta * 4.33 : k.meta;
      if (!metaMes) return 0;
      return Math.min(1, s.mes / metaMes);
    });
    return Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 100);
  }, [kpis, sums]);

  const registrarHoy = async (kpiId: string) => {
    const raw = drafts[kpiId];
    if (raw === undefined || raw === '') return;
    setSavingId(kpiId);
    try {
      await upsertKpiEntry(kpiId, today, Number(raw));
      await reload();
      setDrafts((d) => ({ ...d, [kpiId]: '' }));
    } catch { /* noop */ } finally { setSavingId(null); }
  };

  const addKpi = async () => {
    if (!form.nombre.trim()) return;
    await createProjectKpi({ cliente_id: clienteId, nombre: form.nombre.trim(), frecuencia: form.frecuencia, meta: Number(form.meta) || 0 });
    setForm({ nombre: '', frecuencia: 'diaria', meta: '' });
    await reload();
  };

  const diarios = kpis.filter((k) => k.frecuencia === 'diaria');

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Registro diario y cumplimiento</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">Registras el diario; el semanal, mensual y anual se recalculan solos.</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Cumplimiento mensual</p>
          <p className={`text-lg font-bold ${cumplimientoMensual >= 80 ? 'text-emerald-700' : cumplimientoMensual >= 40 ? 'text-amber-600' : 'text-slate-900'}`}>{cumplimientoMensual}%</p>
        </div>
      </div>

      {/* Alta de KPI */}
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
        <input className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm sm:col-span-2" placeholder="Nombre del KPI (ej. Contactos segmentados)" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        <select className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" value={form.frecuencia} onChange={(e) => setForm({ ...form, frecuencia: e.target.value as KpiFrecuencia })}>
          {FRECUENCIAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <div className="flex gap-2">
          <input className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" type="number" placeholder="Meta" value={form.meta} onChange={(e) => setForm({ ...form, meta: e.target.value })} />
          <button onClick={addKpi} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"><Plus className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /></div>
      ) : kpis.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Este proyecto aún no tiene KPIs. Agrega el primero arriba.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2">KPI</th><th>Frec.</th><th className="text-right">Meta</th><th className="text-right">Hoy</th><th className="text-right">Semana</th><th className="text-right">Mes</th><th className="text-right">Año</th>
              <th className="text-right">Registrar hoy</th><th></th>
            </tr></thead>
            <tbody>
              {kpis.map((k) => {
                const s = sums[k.id] || { hoy: 0, semana: 0, mes: 0, anio: 0 };
                return (
                  <tr key={k.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">{k.nombre}</td>
                    <td className="text-slate-500">{k.frecuencia}</td>
                    <td className="text-right">{k.meta}</td>
                    <td className={`text-right ${k.frecuencia === 'diaria' && s.hoy >= k.meta && k.meta > 0 ? 'font-semibold text-emerald-700' : ''}`}>{s.hoy}</td>
                    <td className="text-right text-slate-600">{s.semana}</td>
                    <td className="text-right text-slate-600">{s.mes}</td>
                    <td className="text-right text-slate-600">{s.anio}</td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <input type="number" value={drafts[k.id] ?? ''} onChange={(e) => setDrafts((d) => ({ ...d, [k.id]: e.target.value }))} placeholder={String(s.hoy || 0)} className="w-16 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-right text-xs" />
                        <button onClick={() => registrarHoy(k.id)} disabled={savingId === k.id} className="grid h-7 w-7 place-items-center rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50" title="Guardar el valor de hoy">{savingId === k.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}</button>
                      </div>
                    </td>
                    <td className="text-right">
                      <button onClick={async () => { await deleteProjectKpi(k.id); await reload(); }} className="text-red-600 hover:text-red-700" title="Eliminar KPI"><Trash2 className="h-4 w-4 inline" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {diarios.length > 0 && <p className="mt-2 text-[11px] text-slate-400">El "cumplimiento mensual" promedia el avance de cada KPI contra su meta escalada al mes. Registra cada día para que suba solo.</p>}
        </div>
      )}
    </div>
  );
}
