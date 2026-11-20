import { useState } from 'react';
import { CreditCard, X } from 'lucide-react';

/**
 * Franja fina arriba del contenido mientras dura una prueba de Whop (si el
 * plan en Whop tiene días de prueba). Se puede cerrar; vuelve a salir al día
 * siguiente (y siempre el último día).
 */
export function TrialBanner({ userId, trialEndsAt, onManage }: { userId: string; trialEndsAt: string; onManage: () => void }) {
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
        <span className="hidden text-amber-800/80 sm:inline"> Al terminar se cobra tu plan; si cancelas antes, pasas al plan Gratis con tus datos intactos.</span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={onManage} className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"><CreditCard className="h-3 w-3" /> Administrar</button>
        {dias > 1 && <button type="button" onClick={close} aria-label="Ocultar por hoy" title="Ocultar por hoy" className="grid h-6 w-6 place-items-center rounded-md text-amber-700 hover:bg-amber-100"><X className="h-3.5 w-3.5" /></button>}
      </div>
    </div>
  );
}

export default TrialBanner;
