import { useEffect, useState } from 'react';
import { Check, Lock, X } from 'lucide-react';
import { FREE_PLAN_SUMMARY, getPlanCatalog, PLAN_RANK, type PaidTier, type Periodo, type PlanId } from '../lib/planService';
import { onUpgradeRequest, type UpgradeRequest } from '../lib/planGate';
import { planIsPurchasable, requestCheckout } from '../lib/whop';
import { trackEvent } from '../lib/analytics';

// Modal de planes (Gratis → Medio / Pro). Se abre cuando un servicio toca un
// límite (planGate.assertWithinLimit), cuando la persona pulsa un módulo
// bloqueado (planGate.requestEntitlement) o desde "Cambiar plan". Nunca
// bloquea la app: el plan Gratis sigue usable detrás.
//
// Elegir un plan abre el checkout embebido de Whop (WhopCheckoutModal). Al
// pagar un plan distinto del actual, el webhook cancela la membresía anterior.

export function UpgradeModal({ currentPlan, currentPeriodo = null }: { currentPlan: PlanId; currentPeriodo?: Periodo | null }) {
  const [request, setRequest] = useState<UpgradeRequest | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>('mensual');

  useEffect(() => onUpgradeRequest((req) => {
    setRequest(req);
    if (req.periodo) setPeriodo(req.periodo);
    trackEvent('upgrade_modal_open', { motivo: req.limit || req.entitlement || 'manual', plan: req.planSugerido });
  }), []);

  if (!request) return null;
  const catalog = getPlanCatalog();
  const nivelActual = PLAN_RANK[currentPlan] ?? 3;

  const elegir = (plan: PaidTier) => {
    trackEvent('upgrade_checkout', { plan, periodo });
    setRequest(null);
    requestCheckout({ plan, periodo });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Mejorar plan" onClick={(e) => { if (e.target === e.currentTarget) setRequest(null); }}>
      <div className="my-6 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800"><Lock className="h-3 w-3" /> {request.motivo}</p>
            <h2 className="mt-2 font-display text-xl font-semibold text-slate-900">Sigue creciendo sin cambiar de herramienta</h2>
            <p className="mt-1 text-sm text-slate-500">Lo que ya tienes cargado se queda. Cancelas cuando quieras, sin permanencia.</p>
          </div>
          <button type="button" onClick={() => setRequest(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
          {(['mensual', 'anual'] as Periodo[]).map((p) => (
            <button key={p} type="button" onClick={() => setPeriodo(p)} className={`rounded-full px-3 py-1.5 ${periodo === p ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>{p === 'mensual' ? 'Mensual' : 'Anual · −30 %'}</button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="font-semibold text-slate-900">{FREE_PLAN_SUMMARY.nombre}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{FREE_PLAN_SUMMARY.etiqueta}</p>
            <div className="mt-3 flex items-baseline gap-1"><span className="font-display text-3xl font-semibold text-slate-900">USD 0</span></div>
            <ul className="mt-3 flex-1 space-y-1.5">
              {FREE_PLAN_SUMMARY.incluye.map((f) => <li key={f} className="flex items-start gap-1.5 text-xs text-slate-700"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> {f}</li>)}
            </ul>
            <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-500">{currentPlan === 'free' ? 'Tu plan actual' : 'Incluido siempre'}</p>
          </div>
          {catalog.map((plan) => {
            const sugerido = plan.id === request.planSugerido;
            const esActual = plan.id === currentPlan && (currentPeriodo ?? 'mensual') === periodo;
            const esInferior = (PLAN_RANK[plan.id] ?? 0) < nivelActual;
            const precio = periodo === 'anual' ? plan.precioAnualMes : plan.precioMensual;
            const disponible = planIsPurchasable(plan.id, periodo);
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
                  <span className="text-xs text-slate-500">/ mes{periodo === 'anual' ? ` (USD ${plan.precioAnualTotal} al año)` : ''}</span>
                </div>
                <ul className="mt-3 flex-1 space-y-1.5">
                  {plan.incluye.map((f) => <li key={f} className="flex items-start gap-1.5 text-xs text-slate-700"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> {f}</li>)}
                </ul>
                <button
                  type="button"
                  disabled={esActual || !disponible}
                  onClick={() => elegir(plan.id)}
                  className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${sugerido ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                >
                  {esActual ? 'Tu plan actual' : !disponible ? 'Próximamente' : esInferior ? `Pasar a ${plan.nombre}` : `Elegir ${plan.nombre}`}
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-slate-400">Precios en USD antes de impuestos; Whop muestra el total según tu país antes de pagar. Si ya tienes un plan de pago, al pagar el nuevo el anterior se cancela automáticamente.</p>
      </div>
    </div>
  );
}

export default UpgradeModal;
