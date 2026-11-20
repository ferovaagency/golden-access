import { lazy, Suspense, useEffect, useState } from 'react';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { getPlanCatalog } from '../../lib/planService';
import { onCheckoutRequest, planIsPurchasable, type CheckoutRequest } from '../../lib/whop';
import { waitForPlan } from '../../lib/subscriptionActions';
import { trackEvent } from '../../lib/analytics';

// El SDK de Whop sólo se descarga cuando alguien abre el checkout.
const WhopCheckoutFrame = lazy(() => import('./WhopCheckoutFrame'));

// Checkout embebido de Whop. Vive una vez en App.tsx; cualquier parte de la app
// lo abre con requestCheckout({ plan, periodo }). El acceso lo activa el
// webhook (whop-webhook); aquí sólo se espera a ver la suscripción activa.
export default function WhopCheckoutModal({ user, onActivated }: { user: User; onActivated: () => void }) {
  const [request, setRequest] = useState<CheckoutRequest | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onCheckoutRequest((next) => {
    setError(null);
    setWaiting(false);
    if (!planIsPurchasable(next.plan, next.periodo)) {
      setRequest(next);
      setError('Este plan todavía no está disponible para compra.');
      return;
    }
    trackEvent('checkout_open', { plan: next.plan, periodo: next.periodo });
    setRequest(next);
  }), []);

  if (!request) return null;
  const card = getPlanCatalog().find((p) => p.id === request.plan);
  const close = () => { if (!waiting) setRequest(null); };

  const handlePaid = () => {
    trackEvent('checkout_complete', { plan: request.plan, periodo: request.periodo });
    setWaiting(true);
    waitForPlan(user.id, request.plan, (ok) => {
      setWaiting(false);
      if (ok) { setRequest(null); onActivated(); return; }
      setError('Whop recibió el pago, pero la activación aún no llega. Recarga en un minuto; si sigue igual, escríbenos.');
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Pagar suscripción" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="my-6 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Plan {card?.nombre ?? request.plan} · {request.periodo === 'anual' ? 'anual' : 'mensual'}</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-slate-900">
              USD {request.periodo === 'anual' ? card?.precioAnualTotal : card?.precioMensual}
              <span className="ml-1 text-sm font-normal text-slate-500">{request.periodo === 'anual' ? 'al año' : 'al mes'}</span>
            </h2>
          </div>
          <button type="button" onClick={close} disabled={waiting} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40" aria-label="Cerrar"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 min-h-[320px]">
          {waiting ? (
            <div className="grid min-h-[320px] place-items-center text-center">
              <div>
                <Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-600" />
                <p className="mt-3 text-sm font-semibold text-slate-900">Activando tu plan…</p>
                <p className="mt-1 text-xs text-slate-500">Whop nos confirma el pago en unos segundos.</p>
              </div>
            </div>
          ) : error && !planIsPurchasable(request.plan, request.periodo) ? null : (
            <Suspense fallback={<div className="grid min-h-[320px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}>
              <WhopCheckoutFrame user={user} plan={request.plan} periodo={request.periodo} onPaid={handlePaid} onLoadError={(message) => setError(message)} />
            </Suspense>
          )}
        </div>

        {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400"><ShieldCheck className="h-3.5 w-3.5" /> Pago seguro con Whop. Cancelas cuando quieras desde Configuración → Plan y suscripción.</p>
      </div>
    </div>
  );
}
