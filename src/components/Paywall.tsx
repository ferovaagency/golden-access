import React, { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, LogOut } from 'lucide-react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import type { User } from '@supabase/supabase-js';
import { logout, recordPaypalPayment } from '../lib/supabase';

interface PaywallProps {
  user: User;
  onPaid: () => void;
}

const PRICE_USD = Number(import.meta.env.VITE_PAYWALL_PRICE_USD || '29.00');
const CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || 'sb';

export default function Paywall({ user, onPaid }: PaywallProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.VITE_PAYPAL_CLIENT_ID) {
      console.warn('[Paywall] VITE_PAYPAL_CLIENT_ID no está definido; usando sandbox "sb".');
    }
  }, []);

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
            <span className="text-xs text-[#8a8377] font-mono">USD / pago único</span>
          </div>
          <ul className="text-xs text-[#a39d8e] space-y-1.5 pl-4">
            <li>• Dashboard ejecutivo + KPIs en tiempo real</li>
            <li>• Sincronización con Google Sheets / Drive</li>
            <li>• Módulo DIAN 2026 (IVA, alertas tributarias)</li>
            <li>• Respaldos automáticos en Drive</li>
          </ul>
        </div>

        <div className="space-y-3">
          {processing && (
            <div className="flex items-center justify-center gap-2 text-xs text-[#a39d8e]">
              <Loader2 className="w-4 h-4 animate-spin text-[#c9a961]" />
              Procesando pago...
            </div>
          )}
          {error && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded p-2">
              {error}
            </p>
          )}

          <PayPalScriptProvider
            options={{ clientId: CLIENT_ID, currency: 'USD', intent: 'capture' }}
          >
            <PayPalButtons
              style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }}
              createOrder={(_data, actions) =>
                actions.order.create({
                  intent: 'CAPTURE',
                  purchase_units: [
                    {
                      description: 'Ferova OS Financiero - Licencia',
                      amount: { currency_code: 'USD', value: PRICE_USD.toFixed(2) },
                    },
                  ],
                })
              }
              onApprove={async (_data, actions) => {
                setProcessing(true);
                setError(null);
                try {
                  const details = await actions.order!.capture();
                  await recordPaypalPayment(user.id, details.id!, PRICE_USD);
                  onPaid();
                } catch (e: any) {
                  console.error(e);
                  setError(`No se pudo registrar el pago: ${e.message || e}`);
                } finally {
                  setProcessing(false);
                }
              }}
              onError={(err) => {
                console.error(err);
                setError('Error en PayPal. Intenta de nuevo.');
              }}
            />
          </PayPalScriptProvider>
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
