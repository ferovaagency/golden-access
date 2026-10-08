import { useEffect, useState } from 'react';
import { Check, Loader2, Lock, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { getPlanCatalog, type PlanId } from '../lib/planService';
import { onUpgradeRequest, type UpgradeRequest } from '../lib/planGate';
import { openPaddleCheckout, planIsPurchasable, type PaidPlan, type Periodo } from '../lib/paddle';
import { checkSubscription } from '../lib/supabase';
import { trackEvent } from '../lib/analytics';

// Modal de upgrade (Freemium → Básico / Intermedio / Full). Se abre cuando un
// servicio toca un límite (planGate.assertWithinLimit) o cuando la persona
// pulsa un módulo bloqueado (planGate.requestEntitlement). Nunca bloquea la
// app: la versión gratis sigue usable detrás.
//
// Tras pagar, Paddle avisa por webhook y aquí sólo se espera a que la
// suscripción aparezca activa para recargar con el plan nuevo.

const ORDEN: Record<string, number> = { free: 0, basico: 1, intermedio: 2, full: 3 };

export function UpgradeModal({ user, currentPlan, onUpgraded }: { user: User; currentPlan: PlanId; onUpgraded: () => void }) {
  const [request, setRequest] = useState<UpgradeRequest | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>('mensual');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onUpgradeRequest((req) => { setRequest(req); setError(null); trackEvent('upgrade_modal_open', { motivo: req.limit || req.entitlement || 'manual', plan: req.planSugerido }); }), []);

  if (!request) return null;
  const catalog = getPlanCatalog().filter((p) => p.id !== 'free');
  const nivelActual = ORDEN[currentPlan] ?? 3;

  const comprar = async (plan: PaidPlan) => {
    setError(null);
    trackEvent('upgrade_checkout', { plan, periodo });
    try {
      await openPaddleCheckout({
        userId: user.id,
        email: user.email ?? undefined,
        plan,
        periodo,
        onEvent: (event) => {
          if (event.name !== 'checkout.completed') return;
          setConfirming(true);
          let attempts = 0;
          const timer = window.setInterval(async () => {
            attempts += 1;
            const paid = await checkSubscription(user.id).catch(() => false);
            if (paid || attempts >= 20) {
              window.clearInterval(timer);
              setConfirming(false);
              if (paid) { setRequest(null); onUpgraded(); }
              else setError('Paddle recibió el pago pero la activación aún no llega. En unos segundos se activará sola.');
            }
          }, 3000);
        },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible abrir el pago.');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Mejorar plan" onClick={(e) => { if (e.target === e.currentTarget && !confirming) setRequest(null); }}>
      <div className="my-6 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800"><Lock className="h-3 w-3" /> {request.motivo}</p>
            <h2 className="mt-2 font-display text-xl font-semibold text-slate-900">Sigue creciendo sin cambiar de herramienta</h2>
            <p className="mt-1 text-sm text-slate-500">Lo que ya tienes cargado se queda. Cancelas cuando quieras, sin permanencia.</p>
          </div>
          <button type="button" onClick={() => setRequest(null)} disabled={confirming} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
          {(['mensual', 'anual'] as Periodo[]).map((p) => (
            <button key={p} type="button" onClick={() => setPeriodo(p)} className={`rounded-full px-3 py-1.5 ${periodo === p ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>{p === 'mensual' ? 'Mensual' : 'Anual · −20 %'}</button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {catalog.map((plan) => {
            const sugerido = plan.id === request.planSugerido;
            const yaIncluido = (ORDEN[plan.id] ?? 0) <= nivelActual;
            const precio = periodo === 'anual' ? plan.precioAnualMes : plan.precioMensual;
            const disponible = planIsPurchasable(plan.id as PaidPlan, periodo);
            return (
              <div key={plan.id} className={`flex flex-col rounded-2xl border p-4 ${sugerido ? 'border-amber-400 bg-amber-50/40 shadow-[0_12px_30px_rgba(245,158,11,.15)]' : plan.destacado ? 'border-slate-300' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{plan.nombre}</p>
                  {sugerido && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">Te desbloquea esto</span>}
                  {!sugerido && plan.destacado && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">Más elegido</span>}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">{plan.etiqueta}</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-semibold text-slate-900">USD {precio}</span>
                  <span className="text-xs text-slate-500">/ mes{periodo === 'anual' ? ', facturado al año' : ''}</span>
                </div>
                <ul className="mt-3 flex-1 space-y-1.5">
                  {plan.incluye.map((f) => <li key={f} className="flex items-start gap-1.5 text-xs text-slate-700"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> {f}</li>)}
                </ul>
                <button
                  type="button"
                  disabled={yaIncluido || !disponible || confirming}
                  onClick={() => comprar(plan.id as PaidPlan)}
                  className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${sugerido ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                >
                  {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {yaIncluido ? 'Tu plan actual' : !disponible ? 'Próximamente' : `Pasar a ${plan.nombre}`}
                </button>
              </div>
            );
          })}
        </div>
        {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <p className="mt-3 text-[11px] text-slate-400">Precios antes de impuestos; Paddle calcula el total exacto según tu país en el pago.</p>
      </div>
    </div>
  );
}

export default UpgradeModal;
