import React, { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { User } from '@supabase/supabase-js';
import { Check, LogOut, Loader2, AlertCircle, Crown } from 'lucide-react';
import { recordPaypalPayment, signOut } from '../lib/supabase';

interface PaywallProps {
  user: User;
  onPaid: () => void;
}

const PRICE_USD = '29.00';
const PAYPAL_CLIENT_ID =
  (import.meta.env.VITE_PAYPAL_CLIENT_ID as string | undefined) ?? 'test';

const BENEFITS = [
  'Dashboard financiero completo de Ferova OS',
  'Sincronización en tiempo real con tu Google Sheets',
  'Equilibrio global y por servicio',
  'Alertas tributarias e impuestos IVA',
  'Gestión de clientes, ventas, horas y gastos',
  'Respaldos automáticos en Google Drive',
];

export default function Paywall({ user, onPaid }: PaywallProps) {
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{ backgroundColor: '#0f0e0c' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-8 shadow-2xl"
        style={{
          backgroundColor: '#1a1814',
          border: '1px solid #2a2620',
        }}
      >
        <div className="flex flex-col items-center text-center mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{
              backgroundColor: 'rgba(201,169,97,0.12)',
              border: '1px solid #c9a961',
            }}
          >
            <Crown className="w-8 h-8" style={{ color: '#c9a961' }} />
          </div>
          <h1 className="text-2xl font-bold text-white">Acceso Premium Ferova OS</h1>
          <p className="text-sm text-zinc-400 mt-2">
            Desbloquea el sistema operativo financiero de tu agencia.
          </p>
        </div>

        <div className="text-center mb-6">
          <div className="text-4xl font-bold" style={{ color: '#c9a961' }}>
            ${PRICE_USD}
            <span className="text-base text-zinc-500 font-normal"> USD / mes</span>
          </div>
        </div>

        <ul className="space-y-2 mb-6">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-zinc-300">
              <Check
                className="w-4 h-4 mt-0.5 flex-shrink-0"
                style={{ color: '#c9a961' }}
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {errorMsg && (
          <div
            className="mb-4 p-3 rounded-lg text-sm flex items-start gap-2"
            style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#fca5a5',
            }}
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div
          className="rounded-lg p-4 mb-4"
          style={{ backgroundColor: '#0f0e0c', border: '1px solid #2a2620' }}
        >
          {status === 'processing' ? (
            <div className="flex items-center justify-center py-6 text-zinc-300">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Registrando tu pago…
            </div>
          ) : (
            <PayPalScriptProvider
              options={{
                clientId: PAYPAL_CLIENT_ID,
                currency: 'USD',
                intent: 'capture',
              }}
            >
              <PayPalButtons
                style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }}
                createOrder={(_data, actions) =>
                  actions.order.create({
                    intent: 'CAPTURE',
                    purchase_units: [
                      {
                        description: 'Ferova OS — Acceso Premium',
                        amount: { value: PRICE_USD, currency_code: 'USD' },
                      },
                    ],
                  })
                }
                onApprove={async (_data, actions) => {
                  try {
                    setStatus('processing');
                    setErrorMsg(null);
                    const details = await actions.order!.capture();
                    const orderId = details.id ?? _data.orderID;
                    const { error } = await recordPaypalPayment(user.id, orderId);
                    if (error) throw error;
                    onPaid();
                  } catch (err: any) {
                    console.error('[Paywall] error:', err);
                    setErrorMsg(
                      err?.message ?? 'No pudimos registrar tu pago. Intenta de nuevo.'
                    );
                    setStatus('error');
                  }
                }}
                onError={(err) => {
                  console.error('[Paywall] PayPal error:', err);
                  setErrorMsg('Error en PayPal. Intenta de nuevo.');
                  setStatus('error');
                }}
              />
            </PayPalScriptProvider>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Sesión: {user.email}</span>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1 hover:text-zinc-300 transition"
          >
            <LogOut className="w-3 h-3" /> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
