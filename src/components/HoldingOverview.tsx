import { useEffect, useState } from 'react';
import { Building2, Loader2, Network, TrendingDown, TrendingUp } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

// Vista consolidada del holding: una fila por empresa y el total.
// Los datos llegan de la edge function holding-overview, que es quien tiene
// permiso para leer varias cuentas. Ver docs/DISENO_ORGANIZACIONES.md.

interface EmpresaResumen {
  org_id: string;
  nombre: string;
  ventas: number;
  egresos: number;
  margen: number;
  clientes_activos: number;
  tareas_abiertas: number;
  meta_ventas: number | null;
}

interface Total {
  ventas: number;
  egresos: number;
  margen: number;
  clientes_activos: number;
  tareas_abiertas: number;
}

interface Props { formatCop: (value: number) => string }

export default function HoldingOverview({ formatCop }: Props) {
  const [empresas, setEmpresas] = useState<EmpresaResumen[]>([]);
  const [total, setTotal] = useState<Total | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.functions.invoke('holding-overview')
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err || !data?.ok) { setError(err?.message || data?.message || 'No se pudo cargar el consolidado.'); return; }
        setEmpresas(data.empresas || []);
        setTotal(data.total || null);
      })
      .catch((e) => { if (alive) setError(e?.message || String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Consolidando las empresas…
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">{error}</div>;
  }

  if (!empresas.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-xs text-slate-600">
        Todavía no hay empresas con cuenta vinculada. Créalas en Configuración → Holding y empresas;
        cada una aparecerá aquí en cuanto su fundador se registre con el correo invitado.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-700"><Network className="h-4 w-4" /></span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Consolidado del holding</h2>
          <p className="text-xs text-slate-500">{empresas.length} empresas. Cada una sigue aislada; esto sólo suma.</p>
        </div>
      </div>

      {total && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Tarjeta titulo="Ingresos" valor={formatCop(total.ventas)} tono="positivo" />
          <Tarjeta titulo="Egresos" valor={formatCop(total.egresos)} tono="negativo" />
          <Tarjeta titulo="Margen" valor={formatCop(total.margen)} tono={total.margen >= 0 ? 'positivo' : 'negativo'} />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-semibold">Empresa</th>
              <th className="px-3 py-2 text-right font-semibold">Ingresos</th>
              <th className="px-3 py-2 text-right font-semibold">Egresos</th>
              <th className="px-3 py-2 text-right font-semibold">Margen</th>
              <th className="px-3 py-2 text-right font-semibold">Clientes</th>
              <th className="px-3 py-2 text-right font-semibold">Tareas abiertas</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((e) => (
              <tr key={e.org_id} className="border-b border-slate-100 last:border-b-0">
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2 font-semibold text-slate-900">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />{e.nombre}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{formatCop(e.ventas)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{formatCop(e.egresos)}</td>
                <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${e.margen >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatCop(e.margen)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{e.clientes_activos}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{e.tareas_abiertas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        No se incluyen pipeline ni reseñas: hoy salen de tablas compartidas por el equipo y darían el
        mismo número para todas las empresas.
      </p>
    </div>
  );
}

function Tarjeta({ titulo, valor, tono }: { titulo: string; valor: string; tono: 'positivo' | 'negativo' }) {
  const Icono = tono === 'positivo' ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <Icono className={`h-3 w-3 ${tono === 'positivo' ? 'text-emerald-600' : 'text-rose-600'}`} />
        {titulo}
      </span>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{valor}</p>
    </div>
  );
}
