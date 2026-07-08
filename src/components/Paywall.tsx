import React, { useState } from 'react';
import { Loader2, ShieldCheck, LogOut } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { logout, checkSubscription } from '../lib/supabase';

interface PaywallProps {
  user: User;
  onPaid: () => void;
}

const PRICE_USD = Number(import.meta.env.VITE_PAYWALL_PRICE_USD || '50.00');
const HOSTED_BUTTON_ID = '362RRUB6YWWNW';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const NOTIFY_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/paypal-ipn` : undefined;

export default function Paywall({ user, onPaid }: PaywallProps) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckPayment = async () => {
    setChecking(true);
    setError(null);
    try {
      const paid = await checkSubscription(user.id);
      if (paid) {
        onPaid();
      } else {
        setError('Todavía no vemos tu pago confirmado. PayPal puede tardar unos segundos en notificarnos — intenta de nuevo en un momento.');
      }
    } catch (e: any) {
      setError(`Error verificando el pago: ${e.message || e}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0e0c] flex flex-col justify-center items-center p-4 text-[#e8e3d8] font-sans">
      <div className="max-w-md w-full bg-[#161412] border border-[#2a2620] rounded-lg p-8 space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[3px] bg-[#c9a961]" />

        <div className="space-y-2 text-center">
          <div className="w-12 h-12 rounded-full bg-[#c9a961]/10 border border-[#c9a961]/30 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6 text-[#c9a961]" />
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-[#c9a961]">
            Activa tu Licencia
          </h1>
          <p className="text-xs text-[#a39d8e] font-mono uppercase tracking-wider">
            Acceso completo a Ferova OS Financiero
          </p>
        </div>

        <div className="border-t border-b border-[#2a2620] py-5 space-y-3">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold text-white">${PRICE_USD.toFixed(2)}</span>
            <span className="text-xs text-[#8a8377] font-mono">USD / mes</span>
          </div>
          <ul className="text-xs text-[#a39d8e] space-y-1.5 pl-4">
            <li>• Dashboard ejecutivo + KPIs en tiempo real</li>
            <li>• Sincronización con Google Sheets / Drive</li>
            <li>• Módulo DIAN 2026 (IVA, alertas tributarias)</li>
            <li>• Respaldos automáticos en Drive</li>
          </ul>
        </div>

        <div className="space-y-3">
          {error && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded p-2">
              {error}
            </p>
          )}

          <form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank" className="flex justify-center">
            <input type="hidden" name="cmd" value="_s-xclick" />
            <input type="hidden" name="hosted_button_id" value={HOSTED_BUTTON_ID} />
            <input type="hidden" name="currency_code" value="USD" />
            {/* Identifica al usuario de Supabase: el webhook de IPN lo usa para activar su suscripción */}
            <input type="hidden" name="custom" value={user.id} />
            {NOTIFY_URL && <input type="hidden" name="notify_url" value={NOTIFY_URL} />}
            <input type="hidden" name="return" value={typeof window !== 'undefined' ? window.location.origin : ''} />
            <input
              type="image"
              src="https://www.paypalobjects.com/es_XC/i/btn/btn_subscribe_LG.gif"
              style={{ border: 0 }}
              name="submit"
              title="PayPal es una forma segura y fácil de pagar en línea."
              alt="Suscribirse"
            />
          </form>

          <p className="text-[10px] text-[#8a8377] font-mono text-center leading-relaxed">
            Se abre PayPal en una pestaña nueva. Cuando termines de suscribirte, vuelve aquí y pulsa el botón de abajo.
          </p>

          <button
            onClick={handleCheckPayment}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 bg-[#c9a961] hover:bg-[#b09252] text-black font-semibold font-display py-2.5 rounded transition cursor-pointer disabled:opacity-60"
          >
            {checking && <Loader2 className="w-4 h-4 animate-spin" />}
            Ya me suscribí, verificar acceso
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#2a2620]">
          <span className="text-[10px] text-[#8a8377] font-mono truncate max-w-[60%]">
            {user.email}
          </span>
          <button
            onClick={() => logout()}
            className="text-[10px] text-[#8a8377] hover:text-[#c97a61] font-mono flex items-center gap-1"
          >
            <LogOut className="w-3 h-3" /> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
