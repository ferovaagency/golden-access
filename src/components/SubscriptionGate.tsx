import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, LogOut, ShieldCheck, CreditCard, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { logout, type SubscriptionInfo } from '../lib/supabase';
import { getPlanCatalog, TRIAL_DAYS, type PaidTier, type Periodo } from '../lib/planService';
import { addPaymentMethod as addPaymentMethodAction, invokeFn } from '../lib/subscriptionActions';
import { trackEvent } from '../lib/analytics';
import { clearPlanIntent, type PlanIntent } from '../lib/planIntent';

// Pantalla previa a la app cuando no hay acceso:
//   · estado none    → elegir plan y empezar 7 días gratis sin tarjeta
//                      (el servidor crea la prueba en Paddle: paddle-start-trial).
//   · estado expired → la prueba venció sin tarjeta (o se canceló): agregar
//                      método de pago con el checkout de una página de Paddle.
//   · con `intent`   → la persona ya eligió plan en la landing: se preselecciona
//                      y la prueba arranca sola, sin volver a preguntar.

const PAISES: Array<[string, string]> = [['CO', 'Colombia'], ['MX', 'México'], ['AR', 'Argentina'], ['CL', 'Chile'], ['PE', 'Perú'], ['EC', 'Ecuador'], ['ES', 'España'], ['US', 'Estados Unidos'], ['BR', 'Brasil'], ['UY', 'Uruguay'], ['PA', 'Panamá'], ['CR', 'Costa Rica'], ['DO', 'República Dominicana'], ['GT', 'Guatemala'], ['BO', 'Bolivia'], ['PY', 'Paraguay'], ['VE', 'Venezuela']];

/**
 * País probable por el idioma del navegador, solo si es español con región
 * (es-MX → MX). Un navegador en en-US no dice nada del país de quien lo usa
 * (muchos freelancers en Latinoamérica lo tienen así), así que ahí va Colombia.
 */
function guessCountry(): string {
  const [lang, region] = (navigator.language || '').split('-');
  const code = region?.toUpperCase();
  return lang === 'es' && code && PAISES.some(([c]) => c === code) ? code : 'CO';
}

export default function SubscriptionGate({ user, subscription, intent = null, onReady, onManageSubscription }: { user: User; subscription: SubscriptionInfo; intent?: PlanIntent | null; onReady: () => void; onManageSubscription?: () => void }) {
  const [plan, setPlan] = useState<PaidTier>(intent?.plan ?? 'intermedio');
  const [periodo, setPeriodo] = useState<Periodo>(intent?.periodo ?? 'mensual');
  const [country, setCountry] = useState(guessCountry);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Arranque automático: solo una vez y solo si viene con plan y nunca tuvo prueba.
  const autoStart = !!intent && subscription.estado === 'none';
  const [auto, setAuto] = useState(autoStart);
  const autoFired = useRef(false);
  const catalog = getPlanCatalog();
  const expired = subscription.estado === 'expired';


  const startTrial = async () => {
    setBusy(true); setError(null);
    trackEvent('signup_start', { plan, periodo, country, auto });
    try {
      const data = await invokeFn('paddle-start-trial', { plan, periodo, country });
      if (!data.ok) {
        if (data.code === 'already_active') { clearPlanIntent(); onReady(); return; }
        throw new Error(data.message || 'No fue posible iniciar la prueba.');
      }
      trackEvent('signup_complete', { plan, periodo, auto });
      clearPlanIntent();
      onReady();
    } catch (caught) {
      // Si el arranque automático falla, se muestra la pantalla normal con el
      // plan ya seleccionado y el error, para que la persona lo reintente.
      setAuto(false);
      setError(caught instanceof Error ? caught.message : 'No fue posible iniciar la prueba.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!autoStart || autoFired.current) return;
    autoFired.current = true;
    void startTrial();
  }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const addPaymentMethod = async () => {
    setBusy(true); setError(null);
    try {
      await addPaymentMethodAction(user.id, () => onReady(), { email: user.email, plan, periodo });
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

        {onManageSubscription && <div className="mt-5 flex justify-end"><button type="button" onClick={onManageSubscription} className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700">Administrar mi suscripción</button></div>}
        {auto ? (
          <div className="mx-auto mt-16 max-w-md rounded-2xl border border-[#2a2620] bg-[#161412] p-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-300" />
            <h1 className="mt-4 font-display text-2xl font-bold text-white">Activando tu prueba de {catalog.find((p) => p.id === plan)?.nombre}</h1>
            <p className="mt-2 text-sm text-slate-400">{TRIAL_DAYS} días gratis, sin tarjeta. En un momento pasas a configurar tu negocio.</p>
          </div>
        ) : expired ? (
          <div className="mx-auto mt-12 max-w-lg rounded-2xl border border-[#2a2620] bg-[#161412] p-8 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-blue-500/30 bg-blue-500/10"><CreditCard className="h-6 w-6 text-blue-400" /></div>
            <h1 className="mt-4 font-display text-2xl font-bold text-white">Tu prueba terminó</h1>
            <p className="mt-2 text-sm text-slate-400">Tus datos siguen ahí tal como los dejaste. Agrega un método de pago y sigues donde ibas, en el plan {catalog.find((p) => p.id === plan)?.nombre ?? 'que elegiste'}.</p>
            <button type="button" onClick={addPaymentMethod} disabled={busy} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Agregar método de pago
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

/**
 * Franja fina arriba del contenido mientras dura la prueba. Se puede cerrar;
 * vuelve a salir al día siguiente (y siempre el último día).
 */
export function TrialBanner({ userId, trialEndsAt, onAddCard }: { userId: string; trialEndsAt: string; onAddCard: () => void }) {
  const dias = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000));
  const key = `ferova.trial-banner.dismissed.${userId}`;
  const hoy = new Date().toISOString().slice(0, 10);
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(key) === hoy; } catch { return false; } });
  if (hidden && dias > 1) return null;
  const close = () => { try { localStorage.setItem(key, hoy); } catch { /* noop */ } setHidden(true); };
  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
      <p className="min-w-0 truncate">
        <span className="font-semibold">{dias === 0 ? 'Tu prueba termina hoy' : dias === 1 ? 'Te queda 1 día de prueba' : `Te quedan ${dias} días de prueba`}.</span>
        <span className="hidden text-amber-800/80 sm:inline"> Sin tarjeta, el acceso se apaga al vencer; tus datos se quedan.</span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={onAddCard} className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"><CreditCard className="h-3 w-3" /> Agregar tarjeta</button>
        {dias > 1 && <button type="button" onClick={close} aria-label="Ocultar por hoy" title="Ocultar por hoy" className="grid h-6 w-6 place-items-center rounded-md text-amber-700 hover:bg-amber-100"><X className="h-3.5 w-3.5" /></button>}
      </div>
    </div>
  );
}


