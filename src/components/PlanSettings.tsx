import { SubscriptionManagement } from './billing/SubscriptionManagement';
import { useState } from 'react';
import { CreditCard, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { SubscriptionInfo } from '../lib/supabase';
import { getPlanCatalog, TRIAL_DAYS, type PlanId } from '../lib/planService';
import { requestUpgrade } from '../lib/planGate';
import { addPaymentMethod } from '../lib/subscriptionActions';
import { errMsg, useToast } from './ui/toast';

// Configuración → Mi plan: qué plan tiene la cuenta, en qué estado (prueba,
// activa, cortesía) y los dos botones que importan: cambiar de plan (abre el
// modal de planes) y agregar/actualizar tarjeta (checkout de Paddle).

const NOMBRES: Record<string, string> = {
  free: 'Gratis', basico: 'Básico', intermedio: 'Intermedio', full: 'Full',
  projects: 'Proyectos', finance: 'Finanzas', financiero: 'Finanzas', planner: 'Planner', crm: 'Ventas', crm_ventas: 'Ventas', completo: 'Todo incluido', custom: 'Personalizado',
};

type PaidTier = 'basico' | 'intermedio' | 'full';
const PAGADOS: readonly string[] = ['basico', 'intermedio', 'full'];

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function PlanSettings({ user, plan, subscription, isTeam, onChanged }: { user: User; plan: PlanId; subscription: SubscriptionInfo; isTeam: boolean; onChanged: () => void }) {
  const { success: toastOk, error: toastErr } = useToast();
  const [busy, setBusy] = useState(false);
  const catalog = getPlanCatalog();
  const actual = catalog.find((p) => p.id === plan);
  const enPrueba = subscription.estado === 'trial';
  const diasRestantes = subscription.trial_ends_at ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86_400_000)) : null;
  const periodo = subscription.periodo === 'anual' ? 'anual' : 'mensual';
  const precio = actual ? (periodo === 'anual' ? `USD ${actual.precioAnualTotal} al año (USD ${actual.precioAnualMes}/mes)` : `USD ${actual.precioMensual}/mes`) : null;

  const estadoTexto = isTeam
    ? 'Cuenta del equipo Ferova: sin cobro.'
    : subscription.estado === 'courtesy'
      ? 'Acceso de cortesía: sin cobro mientras dure.'
      : enPrueba && subscription.trial_ends_at
        ? `Prueba gratis de ${TRIAL_DAYS} días · termina el ${fecha(subscription.trial_ends_at)}${diasRestantes !== null ? ` (${diasRestantes === 0 ? 'hoy' : diasRestantes === 1 ? 'queda 1 día' : `quedan ${diasRestantes} días`})` : ''}.`
        : subscription.estado === 'active'
          ? 'Consulta abajo el estado de renovación en Paddle.'
          : subscription.estado === 'expired'
            ? 'El acceso no está activo. Revisa tu suscripción o elige cómo continuar.'
            : 'Sin suscripción.';

  const cambiarPlan = () => {
    const siguiente: PaidTier = plan === 'basico' ? 'intermedio' : plan === 'intermedio' ? 'full' : 'intermedio';
    requestUpgrade({ motivo: enPrueba ? 'Elige el plan con el que quieres seguir' : 'Elige tu plan', planSugerido: PAGADOS.includes(plan) ? siguiente : 'intermedio', periodo });
  };

  const agregarTarjeta = async () => {
    setBusy(true);
    try {
      await addPaymentMethod(user.id, () => { onChanged(); toastOk('Método de pago agregado. Tu plan sigue sin interrupciones.'); }, {
        email: user.email,
        plan: PAGADOS.includes(plan) ? (plan as PaidTier) : undefined,
        periodo,
      });
    } catch (e) {
      toastErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900">Mi plan</h2>
        <p className="mt-1 text-sm text-slate-500">Tu suscripción a Ferova One y cómo se cobra.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Plan actual</p>
            <p className="mt-1 font-display text-2xl font-semibold text-slate-900">{actual?.nombre ?? NOMBRES[plan] ?? plan}</p>
            {actual && <p className="text-xs text-slate-500">{actual.etiqueta} · {precio}{enPrueba ? ' después de la prueba' : ''}</p>}
            <p className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${enPrueba ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><Sparkles className="h-3 w-3" /> {estadoTexto}</p>
          </div>
          {!isTeam && subscription.estado !== 'courtesy' && (
            <div className="flex flex-col gap-2 sm:items-end">
              <button type="button" onClick={cambiarPlan} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Cambiar plan</button>
              <button type="button" onClick={agregarTarjeta} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {enPrueba || subscription.estado === 'expired' ? 'Pagar suscripción' : 'Actualizar tarjeta'}
              </button>
            </div>
          )}
        </div>
        {actual && (
          <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
            {actual.incluye.map((f) => <li key={f} className="text-xs text-slate-600">· {f}</li>)}
          </ul>
        )}
      </div>

      {enPrueba && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-xs leading-5 text-amber-900">
          Durante la prueba puedes cambiar de plan las veces que quieras sin pagar. Cuando pagues, Paddle cobra el plan que tengas elegido en ese momento. Si no agregas tarjeta antes del {subscription.trial_ends_at ? fecha(subscription.trial_ends_at) : 'final'}, el acceso se apaga y tus datos se quedan guardados.
        </div>
      )}
      <SubscriptionManagement onChanged={onChanged} />
    </div>
  );
}

