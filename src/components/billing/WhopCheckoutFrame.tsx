import { useMemo } from 'react';
import type { User } from '@supabase/supabase-js';
import { loadWhop } from '@whop/elements';
import { Checkout, CheckoutElement, WhopElements } from '@whop/elements-react';
import type { PaidTier, Periodo } from '../../lib/planService';
import { getAffiliateCode, whopPlanIdFor, WHOP_ENVIRONMENT } from '../../lib/whop';

// El checkout embebido de Whop (@whop/elements-react). Se carga aparte (lazy)
// para no sumar el SDK al resto de la app.
//
// metadata.supabase_user_id es lo que el webhook usa para saber de quién es el
// pago; plan/periodo van sólo como referencia (el plan real sale del plan_ de
// Whop). El código de afiliado, si la persona llegó con ?a=…, atribuye la
// venta para que Whop pague la comisión.

let whopLoader: ReturnType<typeof loadWhop> | null = null;
function getLoader() {
  if (!whopLoader) whopLoader = loadWhop();
  return whopLoader;
}

export default function WhopCheckoutFrame({ user, plan, periodo, onPaid, onLoadError }: {
  user: User;
  plan: PaidTier;
  periodo: Periodo;
  onPaid: () => void;
  onLoadError: (message: string) => void;
}) {
  const loader = useMemo(() => getLoader(), []);
  const affiliateCode = useMemo(() => getAffiliateCode() ?? undefined, []);
  const returnUrl = `${window.location.origin}/app?checkout=whop`;

  return (
    <WhopElements
      elements={loader}
      environment={WHOP_ENVIRONMENT}
      locale="es"
      onLoadError={(error) => onLoadError(`No se pudo cargar el pago de Whop: ${error.message}`)}
    >
      <Checkout
        plan={whopPlanIdFor(plan, periodo)}
        metadata={{ supabase_user_id: user.id, plan, periodo }}
        affiliateCode={affiliateCode}
        returnUrl={returnUrl}
        onComplete={(result) => { if (result.result === 'payment' || result.result === 'setup') onPaid(); }}
      >
        <CheckoutElement buyerEmail={user.email ?? ''} />
      </Checkout>
    </WhopElements>
  );
}
