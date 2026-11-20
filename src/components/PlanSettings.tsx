import { SubscriptionManagement } from './billing/SubscriptionManagement';
import { useState } from 'react';
import { CreditCard, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { SubscriptionInfo } from '../lib/supabase';
import { FREE_PLAN_SUMMARY, getPlanCatalog, PAID_TIERS, type PaidTier, type PlanId } from '../lib/planService';
import { requestUpgrade } from '../lib/planGate';
import { openBillingPortal } from '../lib/billingActions';
import { errMsg, useToast } from './ui/toast';

// Configuración → Plan y suscripción: qué plan tiene la cuenta, en qué estado
// y los dos botones que importan: cambiar de plan (abre el modal de planes y,
// desde ahí, el checkout de Whop) y administrar el pago (portal de Whop).

const NOMBRES: Record<string, string> = {
  free: 'Gratis', medio: 'Medio', pro: 'Pro', basico: 'Básico', intermedio: 'Intermedio', full: 'Full',
  projects: 'Proyectos', finance: 'Finanzas', financiero: 'Finanzas', planner: 'Planner', crm: 'Ventas', crm_ventas: 'Ventas', completo: 'Todo incluido', custom: 'Personalizado',
};

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function PlanSettings({ plan, subscription, isTeam, onChanged }: { user: User; plan: PlanId; subscription: SubscriptionInfo; isTeam: boolean; onChanged: () => void }) {
  const { error: toastErr } = useToast();
  const [busy, setBusy] = useState(false);
  const catalog = getPlanCatalog();
  const actual = catalog.find((p) => p.id === plan);
  const enPrueba = subscription.estado === 'trial';
  const pagando = subscription.estado === 'active' || enPrueba;
  const diasRestantes = subscription.trial_ends_at ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86_400_000)) : null;
  const periodo = subscription.periodo === 'anual' ? 'anual' : 'mensual';
  const precio = actual ? (periodo === 'anual' ? `USD ${actual.precioAnualTotal} al año (USD ${actual.precioAnualMes}/mes)` : `USD ${actual.precioMensual}/mes`) : null;

  const estadoTexto = isTeam
    ? 'Cuenta del equipo Ferova: sin cobro.'
    : subscription.estado === 'courtesy'
      ? 'Acceso de cortesía: sin cobro mientras dure.'
      : enPrueba && subscription.trial_ends_at
        ? `En prueba · termina el ${fecha(subscription.trial_ends_at)}${diasRestantes !== null ? ` (${diasRestantes === 0 ? 'hoy' : diasRestantes === 1 ? 'queda 1 día' : `quedan ${diasRestantes} días`})` : ''}.`
        : subscription.estado === 'active'
          ? 'Suscripción activa con Whop. Abajo ves la renovación.'
          : subscription.estado === 'expired'
            ? 'Tu suscripción terminó: estás en el plan Gratis y tus datos siguen intactos.'
            : 'Plan Gratis, sin cobro.';

  const cambiarPlan = () => {
    const siguiente: PaidTier = plan === 'medio' || plan === 'basico' ? 'pro' : 'medio';
    requestUpgrade({ motivo: plan === 'free' ? 'Elige tu plan' : 'Cambia de plan', planSugerido: (PAID_TIERS as readonly string[]).includes(plan) || plan === 'basico' ? siguiente : 'medio', periodo });
  };

  const administrarPago = async () => {
    setBusy(true);
    try {
      await openBillingPortal('overview');
    } catch (e) {
      toastErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900">Plan y suscripción</h2>
        <p className="mt-1 text-sm text-slate-500">Tu plan de Ferova One y cómo se cobra.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Plan actual</p>
            <p className="mt-1 font-display text-2xl font-semibold text-slate-900">{actual?.nombre ?? NOMBRES[plan] ?? plan}</p>
            {actual && <p className="text-xs text-slate-500">{actual.etiqueta} · {precio}{enPrueba ? ' después de la prueba' : ''}</p>}
            {plan === 'free' && <p className="text-xs text-slate-500">{FREE_PLAN_SUMMARY.etiqueta} · USD 0</p>}
            <p className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${enPrueba ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><Sparkles className="h-3 w-3" /> {estadoTexto}</p>
          </div>
          {!isTeam && subscription.estado !== 'courtesy' && (
            <div className="flex flex-col gap-2 sm:items-end">
              <button type="button" onClick={cambiarPlan} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${plan === 'free' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-200 text-slate-800 hover:bg-slate-50'}`}><RefreshCw className="h-4 w-4" /> {plan === 'free' ? 'Mejorar plan' : 'Cambiar plan'}</button>
              {pagando && (
                <button type="button" onClick={administrarPago} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  Método de pago y facturas
                </button>
              )}
            </div>
          )}
        </div>
        {(actual?.incluye ?? (plan === 'free' ? FREE_PLAN_SUMMARY.incluye : null)) && (
          <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
            {(actual?.incluye ?? FREE_PLAN_SUMMARY.incluye).map((f) => <li key={f} className="text-xs text-slate-600">· {f}</li>)}
          </ul>
        )}
      </div>

      {(pagando || subscription.estado === 'expired') && !isTeam && <SubscriptionManagement onChanged={onChanged} />}
    </div>
  );
}
