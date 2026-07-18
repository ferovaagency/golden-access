import React, { useState } from 'react';
import { Loader2, ShieldCheck, LogOut } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { logout, checkSubscription } from '../lib/supabase';
import { createPaddleCheckoutIntent, getPaddleStatus, openPaddleCheckout } from '../lib/paymentProvider';

interface PaywallProps {
  user: User;
  onPaid: () => void;
}

export default function Paywall({ user, onPaid }: PaywallProps) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paddleStatus = getPaddleStatus();

  const handleCheckout = async () => {
    setError(null);
    const intent = await createPaddleCheckoutIntent('completo');
    if (intent.status !== 'ready' || !intent.transactionId) {
      setError(intent.message || 'No fue posible iniciar el checkout.');
      return;
    }
    const result = await openPaddleCheckout(intent.transactionId);
    if (result.status !== 'ready') setError(result.message || 'No fue posible abrir el checkout.');
  };

  const handleCheckPayment = async () => {
    setChecking(true);
    setError(null);
    try {
      const paid = await checkSubscription(user.id);
      if (paid) onPaid();
      else setError('Todavía no vemos una suscripción confirmada. Cuando Paddle confirme el pago, tu acceso se activará automáticamente.');
    } catch (caught: unknown) {
      setError(`Error verificando el pago: ${caught instanceof Error ? caught.message : String(caught)}`);
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
          <h1 className="text-2xl font-bold font-display tracking-tight text-[#c9a961]">Activa tu Licencia</h1>
          <p className="text-xs text-[#a39d8e] font-mono uppercase tracking-wider">Acceso a Ferova OS</p>
        </div>

        <div className="border-t border-b border-[#2a2620] py-5 space-y-3">
          <p className="text-center text-sm font-semibold text-white">El precio y los impuestos se muestran de forma segura en Paddle.</p>
          <ul className="text-xs text-[#a39d8e] space-y-1.5 pl-4">
            <li>• Dashboard ejecutivo + KPIs en tiempo real</li>
            <li>• Sincronización con Google Sheets / Drive</li>
            <li>• Módulo DIAN 2026 (IVA, alertas tributarias)</li>
            <li>• Respaldos automáticos en Drive</li>
          </ul>
        </div>

        <div className="space-y-3">
          {error && <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded p-2">{error}</p>}
          <button
            onClick={handleCheckout}
            disabled={paddleStatus !== 'ready'}
            className="w-full flex items-center justify-center gap-2 bg-[#c9a961] hover:bg-[#b09252] text-black font-semibold font-display py-2.5 rounded transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            {paddleStatus === 'ready' ? 'Continuar con Paddle' : 'Paddle pendiente de configuración'}
          </button>
          <p className="text-[10px] text-[#8a8377] font-mono text-center leading-relaxed">
            Paddle procesa la suscripción, factura y calcula los impuestos aplicables. Ferova OS no recibe ni almacena datos de pago. Al continuar aceptas los <a href="/terminos" className="underline hover:text-white">Términos</a> y la <a href="/privacidad" className="underline hover:text-white">Política de Privacidad</a>.
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
          <span className="text-[10px] text-[#8a8377] font-mono truncate max-w-[60%]">{user.email}</span>
          <button onClick={() => logout()} className="text-[10px] text-[#8a8377] hover:text-[#c97a61] font-mono flex items-center gap-1">
            <LogOut className="w-3 h-3" /> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
