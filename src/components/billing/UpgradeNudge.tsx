import { useEffect, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { PLAN_RANK, type PlanId } from '../../lib/planService';
import { requestUpgrade } from '../../lib/planGate';
import { trackEvent } from '../../lib/analytics';

/**
 * Invitación discreta a subir de plan (Gratis → Medio, Medio → Pro).
 *
 * Reglas para que no estorbe:
 * · Tarjeta pequeña en la esquina inferior izquierda, sin fondo oscuro ni
 *   bloqueo: la app sigue usable detrás.
 * · Sale sólo después de un rato de uso en la sesión (no al entrar).
 * · Una vez cerrada, no vuelve en 7 días; si la persona pulsa "Ver planes",
 *   tampoco (ya vio la oferta).
 * · Nunca para Pro, planes antiguos de nivel alto, equipo Ferova, en prueba,
 *   ni en la pantalla de plan.
 * · Si la persona está cerca del tope de clientes, lo menciona; si no, habla
 *   de lo que suma el plan siguiente.
 */

const DELAY_MS = 90_000;
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export interface NudgeUsage {
  clientesActivos: number;
  limiteClientes: number | null;
}

export function UpgradeNudge({ userId, plan, isTeam, enPrueba, activeTab, usage }: {
  userId: string;
  plan: PlanId;
  isTeam: boolean;
  enPrueba: boolean;
  activeTab: string;
  usage: NudgeUsage;
}) {
  const key = `ferova.upgrade-nudge.${userId}`;
  const nivel = PLAN_RANK[plan] ?? 3;
  const elegible = !isTeam && !enPrueba && nivel < 3;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!elegible) return;
    let snoozedUntil = 0;
    try { snoozedUntil = Number(localStorage.getItem(key)) || 0; } catch { /* storage no disponible */ }
    if (snoozedUntil > Date.now()) return;
    // No compite con el recorrido guiado: mientras no se haya terminado, no sale.
    try { if (localStorage.getItem(`ferova.product-tour.${userId}`) !== 'done') return; } catch { /* noop */ }
    const timer = window.setTimeout(() => setVisible(true), DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [elegible, key, userId]);

  useEffect(() => {
    if (visible) trackEvent('upgrade_nudge_view', { plan });
  }, [visible, plan]);

  if (!visible || !elegible || activeTab === 'plan') return null;

  const snooze = () => {
    try { localStorage.setItem(key, String(Date.now() + SNOOZE_MS)); } catch { /* noop */ }
    setVisible(false);
  };

  const haciaPro = nivel >= 1;
  const cercaDelTope = usage.limiteClientes !== null && usage.clientesActivos >= usage.limiteClientes - 1;
  const titulo = haciaPro ? '¿Vendes con equipo?' : 'Lleva el control completo';
  const texto = cercaDelTope
    ? `Tienes ${usage.clientesActivos} de ${usage.limiteClientes} clientes activos. ${haciaPro ? 'Pro no tiene tope.' : 'Medio llega a 10.'}`
    : haciaPro
      ? 'Pro suma CRM, WhatsApp, reportes CEO y varias empresas. 7 días de prueba.'
      : 'Medio suma caja, cobros, impuestos y presupuesto por USD 20 al mes.';

  const verPlanes = () => {
    trackEvent('upgrade_nudge_click', { plan });
    snooze();
    requestUpgrade({ motivo: haciaPro ? 'Pasa a Pro' : 'Pasa a Medio', planSugerido: haciaPro ? 'pro' : 'medio' });
  };

  return (
    <aside
      aria-label="Sugerencia de plan"
      className="fixed bottom-4 left-4 z-[60] w-[min(calc(100vw-2rem),300px)] rounded-lg border border-slate-200 bg-white p-3.5 shadow-md sm:bottom-6 sm:left-6 lg:left-72"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold text-slate-900">{titulo}</p>
        <button type="button" onClick={snooze} aria-label="Cerrar sugerencia" title="No mostrar por 7 días" className="-mr-1 -mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-600">{texto}</p>
      <div className="mt-2.5 flex items-center gap-3">
        <button type="button" onClick={verPlanes} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
          Ver planes <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={snooze} className="text-xs text-slate-400 hover:text-slate-600">Ahora no</button>
      </div>
    </aside>
  );
}

export default UpgradeNudge;
