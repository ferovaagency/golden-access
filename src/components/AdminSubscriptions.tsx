import { useEffect, useState } from 'react';
import { Loader2, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PADDLE_LIST_PRICE_USD } from '../lib/paddle';

// Resumen de suscripciones / MRR (Fase 7). La métrica reina de un SaaS
// autofinanciado. MRR estimado = suscriptores de pago × precio de lista.

interface Overview {
  activos: number;
  activos_pagos: number;
  nuevos_mes: number;
  por_estado: { status: string; n: number }[];
  por_proveedor: { provider: string; n: number }[];
}

const listPrice = Number(PADDLE_LIST_PRICE_USD) || 0;
const usd = (n: number) => `US$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</div>
      {hint && <div className="text-[10px] text-slate-400">{hint}</div>}
    </div>
  );
}

export default function AdminSubscriptions() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: res, error: err } = await supabase.functions.invoke('admin-subscriptions');
        if (err) throw err;
        if (!res?.ok) throw new Error(res?.message || 'No se pudo cargar suscripciones.');
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
  if (error) return <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">Suscripciones: {error}</div>;
  if (!data) return null;

  const mrr = data.activos_pagos * listPrice;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800">
        <CreditCard className="h-4 w-4" /> Suscripciones y MRR
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="MRR estimado" value={usd(mrr)} hint={`${data.activos_pagos} de pago × ${usd(listPrice)}`} />
          <Stat label="Suscriptores de pago" value={String(data.activos_pagos)} />
          <Stat label="Nuevos este mes" value={String(data.nuevos_mes)} />
          <Stat label="Activos (incl. cortesía)" value={String(data.activos)} />
        </div>
        <p className="text-[11px] text-slate-500">
          MRR estimado con el precio de lista; excluye cortesías y accesos manuales. En un SaaS
          autofinanciado tu métrica reina es la recuperación de CAC (apunta a &lt; 12 meses).
          {data.por_proveedor?.length > 0 && (
            <> Activos por proveedor: {data.por_proveedor.map((p) => `${p.provider} (${p.n})`).join(', ')}.</>
          )}
        </p>
      </div>
    </section>
  );
}
