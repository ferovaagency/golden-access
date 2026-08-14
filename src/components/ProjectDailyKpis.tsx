import { useMemo, useState } from 'react';
import { Loader2, Check } from 'lucide-react';

// Registro diario + cumplimiento POR PROYECTO. TOMA los KPIs que se crean en la
// sección "KPIs" del proyecto (no los crea aquí); registra el valor diario y
// recalcula solo semana/mes/año.
//
// POR QUÉ NO USA `project_kpi_entries`
// Había dos sistemas de KPI que no se hablaban. Los KPIs del proyecto viven
// como JSON dentro del cliente (`finance_clientes.kpis`), con ids tipo
// `kpi_1784441708777` y su propio `historial` de fechas — que es de donde salen
// la meta y el "actual" que se ven en las tarjetas. Este componente escribía en
// las tablas `project_kpis`/`project_kpi_entries`, donde `kpi_id` es un UUID:
// mandar `kpi_1784…` reventaba la escritura Y la lectura, así que el registro
// diario no se guardaba nunca y el cumplimiento salía siempre vacío. Esas
// tablas estaban en cero, sin usar.
//
// Ahora se escribe donde ya viven los datos: el `historial` del KPI. Un solo
// sitio, y lo que registras aquí alimenta el "actual" y las tarjetas de arriba.

export interface DailyKpiHistorial { fecha: string; valor: number }
export interface DailyKpiInput {
  id: string;
  nombre: string;
  meta: string;
  cadencia?: string;
  historial?: DailyKpiHistorial[];
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function startOfWeek(d: Date): Date {
  const x = new Date(d); const day = (x.getDay() + 6) % 7; // lunes = 0
  x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x;
}
const toNum = (s: string) => { const n = Number(String(s).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };

export default function ProjectDailyKpis({
  kpis,
  onRegistrar,
}: {
  kpis: DailyKpiInput[];
  /** Guarda el valor del día en el historial del KPI (y con él, el "actual"). */
  onRegistrar: (kpiId: string, fecha: string, valor: number) => Promise<void> | void;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const loading = false;

  const today = isoDate(new Date());
  const yearStart = `${new Date().getFullYear()}-01-01`;

  // Los registros salen del historial del propio KPI: misma fuente que la
  // tarjeta de arriba, así que lo que se ve aquí y allí siempre coincide.
  const entries = useMemo(
    () => kpis.flatMap((k) => (k.historial || [])
      .filter((h) => h.fecha >= yearStart)
      .map((h) => ({ kpi_id: k.id, fecha: h.fecha, valor: Number(h.valor) || 0 }))),
    [kpis, yearStart],
  );

  const weekStart = useMemo(() => isoDate(startOfWeek(new Date())), []);
  const monthStart = useMemo(() => `${today.slice(0, 7)}-01`, [today]);

  const sums = useMemo(() => {
    const map: Record<string, { hoy: number; semana: number; mes: number; anio: number }> = {};
    for (const k of kpis) map[k.id] = { hoy: 0, semana: 0, mes: 0, anio: 0 };
    for (const e of entries) {
      const m = map[e.kpi_id]; if (!m) continue;
      m.anio += e.valor;
      if (e.fecha >= monthStart) m.mes += e.valor;
      if (e.fecha >= weekStart) m.semana += e.valor;
      if (e.fecha === today) m.hoy += e.valor;
    }
    return map;
  }, [kpis, entries, today, weekStart, monthStart]);

  const cumplimientoMensual = useMemo(() => {
    if (!kpis.length) return 0;
    const diasMes = new Date().getDate();
    const pcts = kpis.map((k) => {
      const meta = toNum(k.meta);
      const s = sums[k.id] || { mes: 0 };
      const cad = k.cadencia || 'diario';
      const metaMes = cad === 'diario' ? meta * diasMes : cad === 'semanal' ? meta * 4.33 : cad === 'anual' ? meta / 12 : meta;
      if (!metaMes) return 0;
      return Math.min(1, s.mes / metaMes);
    });
    return Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 100);
  }, [kpis, sums]);

  const registrarHoy = async (kpiId: string) => {
    const raw = drafts[kpiId];
    if (raw === undefined || raw === '') return;
    setSavingId(kpiId);
    try { await onRegistrar(kpiId, today, Number(raw)); setDrafts((d) => ({ ...d, [kpiId]: '' })); }
    catch { /* el aviso lo da la pantalla del proyecto */ } finally { setSavingId(null); }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Registro diario y cumplimiento</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">Registras el diario; el semanal, mensual y anual se recalculan solos.</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Cumplimiento mensual</p>
          <p className={`text-2xl font-bold ${cumplimientoMensual >= 80 ? 'text-emerald-700' : cumplimientoMensual >= 40 ? 'text-amber-600' : 'text-slate-900'}`}>{cumplimientoMensual}%</p>
        </div>
      </div>

      {kpis.length === 0 ? (
        <p className="py-5 text-center text-sm text-slate-400">Este proyecto aún no tiene KPIs. Créalos en la sección <b>KPIs</b> más abajo y aquí podrás registrarlos cada día.</p>
      ) : loading ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2">KPI</th><th>Frec.</th><th className="text-right">Meta</th><th className="text-right">Hoy</th><th className="text-right">Semana</th><th className="text-right">Mes</th><th className="text-right">Año</th><th className="text-right">Registrar hoy</th>
            </tr></thead>
            <tbody>
              {kpis.map((k) => {
                const s = sums[k.id] || { hoy: 0, semana: 0, mes: 0, anio: 0 };
                const meta = toNum(k.meta);
                return (
                  <tr key={k.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">{k.nombre}</td>
                    <td className="text-slate-500">{k.cadencia || 'diario'}</td>
                    <td className="text-right">{k.meta || '—'}</td>
                    <td className={`text-right ${meta > 0 && s.hoy >= meta ? 'font-semibold text-emerald-700' : ''}`}>{s.hoy}</td>
                    <td className="text-right text-slate-600">{s.semana}</td>
                    <td className="text-right text-slate-600">{s.mes}</td>
                    <td className="text-right text-slate-600">{s.anio}</td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <input type="number" value={drafts[k.id] ?? ''} onChange={(e) => setDrafts((d) => ({ ...d, [k.id]: e.target.value }))} placeholder={String(s.hoy || 0)} className="w-16 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-right text-xs" />
                        <button onClick={() => registrarHoy(k.id)} disabled={savingId === k.id} className="grid h-7 w-7 place-items-center rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50" title="Guardar el valor de hoy">{savingId === k.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
