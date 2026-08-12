import { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck, LogOut } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { logout, checkSubscription } from '../lib/supabase';
import { getPaddleStatus, openPaddleCheckout, PADDLE_LIST_PRICE_USD } from '../lib/paddle';

interface PaywallProps {
  user: User;
  onPaid: () => void;
}

export default function Paywall({ user, onPaid }: PaywallProps) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const paddleStatus = getPaddleStatus();
  const pollRef = useRef<number | null>(null);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  // Tras completar el checkout, Paddle notifica a la edge function por webhook.
  // Aquí solo esperamos a que la suscripción quede activa en la base.
  const waitForActivation = () => {
    setConfirming(true);
    setError(null);
    let attempts = 0;
    pollRef.current = window.setInterval(async () => {
      attempts += 1;
      const paid = await checkSubscription(user.id).catch(() => false);
      if (paid) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        setConfirming(false);
        onPaid();
      } else if (attempts >= 20) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        setConfirming(false);
        setError('Paddle recibió el pago pero la activación aún no llega. Se activará en unos segundos; puedes usar "Ya me suscribí, verificar acceso".');
      }
    }, 3000);
  };

  const handleSubscribe = async () => {
    setError(null);
    try {
      await openPaddleCheckout({
        userId: user.id,
        email: user.email ?? undefined,
        onEvent: (event) => {
          if (event.name === 'checkout.completed') waitForActivation();
        },
      });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'No fue posible abrir el checkout de Paddle.');
    }
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
        <div className="absolute top-0 inset-x-0 h-[3px] bg-blue-500" />
        <div className="space-y-2 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-blue-500">Activa tu Licencia</h1>
          <p className="text-xs text-[#a39d8e] font-mono uppercase tracking-wider">Acceso a Ferova One</p>
        </div>

        <div className="border-t border-b border-[#2a2620] py-5 space-y-3">
          <p className="text-center text-sm font-semibold text-white">
            USD ${PADDLE_LIST_PRICE_USD} / mes · impuestos calculados por Paddle en el checkout.
          </p>
          <ul className="text-xs text-[#a39d8e] space-y-1.5 pl-4">
            <li>• Dashboard ejecutivo + KPIs en tiempo real</li>
            <li>• Sincronización con Google Sheets / Drive</li>
            <li>• Módulo DIAN 2026 (IVA, alertas tributarias)</li>
            <li>• Respaldos automáticos en Drive</li>
          </ul>
        </div>

        <div className="space-y-3">
          {error && <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded p-2">{error}</p>}
          {confirming && (
            <p className="text-xs text-blue-500 flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Confirmando suscripción con Paddle…
            </p>
          )}
          <button
            onClick={handleSubscribe}
            disabled={paddleStatus !== 'ready' || confirming}
            className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-black font-semibold font-display py-2.5 rounded transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {paddleStatus === 'ready' ? 'Suscribirme con Paddle' : 'Paddle pendiente de configuración'}
          </button>
          <p className="text-[10px] text-[#8a8377] font-mono text-center leading-relaxed">
            Paddle actúa como comerciante registrado (Merchant of Record): procesa la suscripción, emite la factura y calcula los impuestos aplicables. Ferova One no recibe ni almacena datos de pago. Al continuar aceptas los <a href="/terminos" className="underline hover:text-white">Términos</a> y la <a href="/privacidad" className="underline hover:text-white">Política de Privacidad</a>.
          </p>
          <button
            onClick={handleCheckPayment}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold font-display py-2.5 rounded transition cursor-pointer disabled:opacity-60"
          >
            {checking && <Loader2 className="w-4 h-4 animate-spin" />}
            Ya me suscribí, verificar acceso
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#2a2620]">
          <span className="text-[10px] text-[#8a8377] font-mono truncate max-w-[60%]">{user.email}</span>
          <button onClick={() => logout()} className="text-[10px] text-[#8a8377] hover:text-rose-500 font-mono flex items-center gap-1">
            <LogOut className="w-3 h-3" /> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
