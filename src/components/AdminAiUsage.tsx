import { useEffect, useState } from 'react';
import { Loader2, Cpu } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Surface de la analítica de costo de IA (Fase 4). Llama a la edge function
// admin-ai-usage (que envuelve la función SQL admin_ai_usage_overview). Muestra
// el percentil 95 por usuario y por llamada — el número que se necesita para
// fijar precio, no el promedio.

type ModelRow = { modelo: string; llamadas: number; input_tokens: number; output_tokens: number; total_tokens: number };
type FuncRow = { funcion: string; llamadas: number; total_tokens: number; cached_tokens: number };
interface Overview {
  ventana_dias: number;
  totales: { llamadas: number; usuarios_activos: number; input_tokens: number; output_tokens: number; cached_tokens: number; total_tokens: number };
  p95_tokens_por_llamada: number | null;
  p95_tokens_por_usuario: number | null;
  mediana_tokens_por_usuario: number | null;
  por_modelo: ModelRow[];
  por_funcion: FuncRow[];
}

const fmt = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString('es-CO'));

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</div>
      {hint && <div className="text-[10px] text-slate-400">{hint}</div>}
    </div>
  );
}

export default function AdminAiUsage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: res, error: err } = await supabase.functions.invoke('admin-ai-usage');
        if (err) throw err;
        if (!res?.ok) throw new Error(res?.message || 'No se pudo cargar el costo de IA.');
        if (alive) setData(res.overview as Overview);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /></div>;
  if (error) return <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">Costo de IA: {error}</div>;
  if (!data) return null;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800">
        <Cpu className="h-4 w-4" /> Costo de IA · últimos {data.ventana_dias} días
      </div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Usuarios con IA" value={fmt(data.totales.usuarios_activos)} />
          <Stat label="Llamadas al modelo" value={fmt(data.totales.llamadas)} />
          <Stat label="p95 tokens / usuario" value={fmt(data.p95_tokens_por_usuario)} hint="el usuario caro" />
          <Stat label="p95 tokens / llamada" value={fmt(data.p95_tokens_por_llamada)} hint="la respuesta cara" />
        </div>

        <p className="text-[11px] text-slate-500">
          Tokens totales: {fmt(data.totales.total_tokens)} (cacheados: {fmt(data.totales.cached_tokens)}). Mediana por usuario: {fmt(data.mediana_tokens_por_usuario)}.
          Vigila el p95, no el promedio: la cola larga es la que descuadra el mes.
        </p>

        {data.por_modelo?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-xs">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-1 pr-3 font-semibold uppercase tracking-wide">Modelo</th>
                  <th className="py-1 pr-3 font-semibold uppercase tracking-wide">Llamadas</th>
                  <th className="py-1 pr-3 font-semibold uppercase tracking-wide">Entrada</th>
                  <th className="py-1 pr-3 font-semibold uppercase tracking-wide">Salida</th>
                  <th className="py-1 font-semibold uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.por_modelo.map((m) => (
                  <tr key={m.modelo} className="border-t border-slate-100">
                    <td className="py-1.5 pr-3 font-mono text-[11px] text-slate-800">{m.modelo}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-slate-600">{fmt(m.llamadas)}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-slate-600">{fmt(m.input_tokens)}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-slate-600">{fmt(m.output_tokens)}</td>
                    <td className="py-1.5 tabular-nums text-slate-800">{fmt(m.total_tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
