import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, LogOut, ShieldCheck, CreditCard } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { logout, supabase, checkSubscription, type SubscriptionInfo } from '../lib/supabase';
import { getPlanCatalog, TRIAL_DAYS, type PaidTier, type Periodo } from '../lib/planService';
import { openPaddlePaymentMethodCheckout } from '../lib/paddle';
import { trackEvent } from '../lib/analytics';

// Pantalla previa a la app cuando no hay acceso:
//   · estado none    → elegir plan y empezar 7 días gratis sin tarjeta
//                      (el servidor crea la prueba en Paddle: paddle-start-trial).
//   · estado expired → la prueba venció sin tarjeta (o se canceló): agregar
//                      método de pago con el checkout de una página de Paddle.

const PAISES: Array<[string, string]> = [['CO', 'Colombia'], ['MX', 'México'], ['AR', 'Argentina'], ['CL', 'Chile'], ['PE', 'Perú'], ['EC', 'Ecuador'], ['ES', 'España'], ['US', 'Estados Unidos'], ['BR', 'Brasil'], ['UY', 'Uruguay'], ['PA', 'Panamá'], ['CR', 'Costa Rica'], ['DO', 'República Dominicana'], ['GT', 'Guatemala'], ['BO', 'Bolivia'], ['PY', 'Paraguay'], ['VE', 'Venezuela']];

export default function SubscriptionGate({ user, subscription, onReady }: { user: User; subscription: SubscriptionInfo; onReady: () => void }) {
  const [plan, setPlan] = useState<PaidTier>('intermedio');
  const [periodo, setPeriodo] = useState<Periodo>('mensual');
  const [country, setCountry] = useState('CO');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const pollRef = useRef<number | null>(null);
  const catalog = getPlanCatalog();
  const expired = subscription.estado === 'expired';

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  const waitForActivation = () => {
    setWaiting(true);
    let attempts = 0;
    pollRef.current = window.setInterval(async () => {
      attempts += 1;
      const paid = await checkSubscription(user.id).catch(() => false);
      if (paid || attempts >= 20) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        setWaiting(false);
        if (paid) onReady();
        else setError('Paddle recibió el pago pero la activación aún no llega. Se activará en unos segundos; recarga la página.');
      }
    }, 3000);
  };

  const startTrial = async () => {
    setBusy(true); setError(null);
    trackEvent('signup_start', { plan, periodo, country });
    try {
      const { data, error: err } = await supabase.functions.invoke('paddle-start-trial', { body: { plan, periodo, country } });
      if (err) throw new Error(err.message);
      if (!data?.ok) {
        if (data?.code === 'already_active') { onReady(); return; }
        throw new Error(data?.message || 'No fue posible iniciar la prueba.');
      }
      trackEvent('signup_complete', { plan, periodo });
      onReady();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible iniciar la prueba.');
    } finally {
      setBusy(false);
    }
  };

  const addPaymentMethod = async () => {
    setBusy(true); setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke('paddle-manage-subscription', { body: { action: 'payment_method' } });
      if (err) throw new Error(err.message);
      if (!data?.ok || !data.transaction_id) throw new Error(data?.message || 'No fue posible preparar el pago.');
      await openPaddlePaymentMethodCheckout({
        transactionId: data.transaction_id,
        onEvent: (event) => { if (event.name === 'checkout.completed') waitForActivation(); },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible abrir el pago.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0e0c] text-[#e8e3d8] font-sans">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-400"><ShieldCheck className="h-4 w-4 text-blue-400" /> {user.email}</div>
          <button type="button" onClick={() => void logout()} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"><LogOut className="h-3.5 w-3.5" /> Salir</button>
        </div>

        {expired ? (
          <div className="mx-auto mt-12 max-w-lg rounded-2xl border border-[#2a2620] bg-[#161412] p-8 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-blue-500/30 bg-blue-500/10"><CreditCard className="h-6 w-6 text-blue-400" /></div>
            <h1 className="mt-4 font-display text-2xl font-bold text-white">Tu prueba terminó</h1>
            <p className="mt-2 text-sm text-slate-400">Tus datos siguen ahí tal como los dejaste. Agrega un método de pago y sigues donde ibas, en el plan {catalog.find((p) => p.id === (subscription.periodo ? plan : plan))?.nombre ?? 'que elegiste'}.</p>
            <button type="button" onClick={addPaymentMethod} disabled={busy || waiting} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60">
              {busy || waiting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {waiting ? 'Confirmando con Paddle…' : 'Agregar método de pago'}
            </button>
            {error && <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
            <p className="mt-4 text-[11px] text-slate-500">Paddle calcula los impuestos de tu país en el pago. Cancelas cuando quieras.</p>
          </div>
        ) : (
          <>
            <div className="mt-10 text-center">
              <span className="inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-200">{TRIAL_DAYS} días gratis · sin tarjeta</span>
              <h1 className="mt-4 font-display text-3xl font-bold text-white">Elige con qué plan empiezas</h1>
              <p className="mt-2 text-sm text-slate-400">Pruebas el plan completo durante {TRIAL_DAYS} días. Si no agregas una tarjeta, se apaga solo: sin cobros sorpresa.</p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <div className="inline-flex rounded-full border border-[#2a2620] bg-[#161412] p-1 text-xs font-semibold">
                {(['mensual', 'anual'] as Periodo[]).map((p) => (
                  <button key={p} type="button" onClick={() => setPeriodo(p)} className={`rounded-full px-3 py-1.5 ${periodo === p ? 'bg-white text-slate-900' : 'text-slate-400'}`}>{p === 'mensual' ? 'Mensual' : 'Anual · −30 %'}</button>
                ))}
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-slate-400">País de facturación
                <select value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-lg border border-[#2a2620] bg-[#161412] px-2 py-1.5 text-sm text-white">
                  {PAISES.map(([code, nombre]) => <option key={code} value={code}>{nombre}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {catalog.map((p) => {
                const selected = plan === p.id;
                const precio = periodo === 'anual' ? p.precioAnualMes : p.precioMensual;
                return (
                  <button key={p.id} type="button" onClick={() => setPlan(p.id)} className={`flex flex-col rounded-2xl border p-5 text-left transition ${selected ? 'border-amber-300 bg-amber-300/10' : 'border-[#2a2620] bg-[#161412] hover:border-slate-500'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white">{p.nombre}</span>
                      {p.destacado && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-slate-900">Más elegido</span>}
                    </div>
                    <span className="mt-0.5 text-[11px] text-slate-400">{p.etiqueta}</span>
                    <div className="mt-3 flex items-baseline gap-1"><span className="font-display text-3xl font-bold text-white">USD {precio}</span><span className="text-xs text-slate-400">/ mes después de la prueba{periodo === 'anual' ? ` (USD ${p.precioAnualTotal} al año)` : ''}</span></div>
                    <ul className="mt-3 flex-1 space-y-1.5">
                      {p.incluye.slice(0, 5).map((f) => <li key={f} className="flex items-start gap-1.5 text-xs text-slate-300"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /> {f}</li>)}
                    </ul>
                  </button>
                );
              })}
            </div>

            <div className="mx-auto mt-6 max-w-md">
              <button type="button" onClick={startTrial} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Empezar {TRIAL_DAYS} días gratis con {catalog.find((p) => p.id === plan)?.nombre}
              </button>
              {error && <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
              <p className="mt-3 text-center text-[11px] text-slate-500">Sin tarjeta. Al terminar la prueba puedes agregar un método de pago o dejarla vencer.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Aviso dentro de la app mientras dura la prueba. */
export function TrialBanner({ trialEndsAt, onAddCard }: { trialEndsAt: string; onAddCard: () => void }) {
  const dias = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000));
  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,34rem)] -translate-x-1/2 rounded-2xl border border-amber-200 bg-white/95 px-4 py-3 shadow-[0_18px_45px_rgba(15,23,42,.18)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-800">
          <span className="font-semibold">{dias === 0 ? 'Tu prueba termina hoy' : dias === 1 ? 'Te queda 1 día de prueba' : `Te quedan ${dias} días de prueba`}.</span>
          <span className="text-slate-500"> Sin tarjeta, el acceso se apaga al vencer; tus datos se quedan.</span>
        </p>
        <button type="button" onClick={onAddCard} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"><CreditCard className="h-3.5 w-3.5" /> Agregar tarjeta</button>
      </div>
    </div>
  );
}
