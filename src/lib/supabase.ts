/**
 * Cliente de Supabase / Lovable Cloud.
 *
 * IMPORTANTE: el proyecto migró de un Supabase externo a Lovable Cloud.
 * El cliente ahora se importa desde el módulo auto-generado; este archivo
 * solo re-exporta el cliente y expone helpers de auth compatibles con el
 * código existente (financeService, crmService, componentes).
 */

import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import { lovable } from '../integrations/lovable/index';
import type { PlanId } from './planService';

export { supabase };
export type AuthUser = User;

// ============================================================
// Token de Google solamente en memoria. Nunca se serializa en storage web ni
// se lee desde la base de datos; hacerlo convertiría un XSS en acceso a Drive,
// Gmail, Calendar y Sheets. La persistencia segura se hará desde Edge Functions.
// ============================================================
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

let cachedAccessToken: string | null = null;

const setEphemeralGoogleToken = (token: string | null) => {
  cachedAccessToken = token;
};

const captureGoogleProviderToken = (session: Session | null) => {
  if (session?.provider_token) setEphemeralGoogleToken(session.provider_token);
};

/** @deprecated Google credentials are no longer hydrated into the browser. */
export const hydrateGoogleWorkspaceConnection = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getAccessToken = (): string | null => cachedAccessToken;
export const hasGoogleWorkspaceConnection = (): boolean => Boolean(cachedAccessToken);
export const setAccessTokenCustom = (token: string | null) => setEphemeralGoogleToken(token);

// ============================================================
// Bootstrap de sesión
// ============================================================
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
    const session = data.session;
    captureGoogleProviderToken(session);
    if (session?.user) {
      onAuthSuccess?.(session.user, cachedAccessToken || '');
    }
    else onAuthFailure?.();
  });

  const { data: sub } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
    captureGoogleProviderToken(session);
    if (session?.user) {
      onAuthSuccess?.(session.user, cachedAccessToken || '');
    }
    else {
      setEphemeralGoogleToken(null);
      onAuthFailure?.();
    }
  });

  return () => sub.subscription.unsubscribe();
};

// ============================================================
// Google Sign-in (managed por Lovable Cloud)
// ============================================================
const GOOGLE_EXTRA_SCOPES = GOOGLE_SCOPES.join(' ');

export const googleSignIn = async () => {
  const result = await lovable.auth.signInWithOAuth('google', {
    redirect_uri: window.location.origin,
    extraParams: {
      access_type: 'offline',
      prompt: 'consent',
      scope: `openid email profile ${GOOGLE_EXTRA_SCOPES}`,
    },
  });
  if (result.error) throw result.error;
  return result;
};

// Alias: en Cloud, reautorizar = firmar de nuevo con el mismo helper.
export const linkGoogleIdentity = googleSignIn;

// ============================================================
// Email / Password
// ============================================================
export const emailSignIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const emailSignUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
  return data;
};

export const logout = async () => {
  await supabase.auth.signOut();
  setEphemeralGoogleToken(null);
};

// ============================================================
// Suscripciones (Paywall PayPal)
// ============================================================
export interface UserSubscription {
  id: string;
  user_id: string;
  status: 'active' | 'cancelled' | 'pending';
  provider: 'paypal' | string;
  provider_order_id: string | null;
  amount_usd: number | null;
  created_at: string;
  expires_at: string | null;
}

export const checkSubscription = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('id, status, expires_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[supabase] checkSubscription error:', error);
    return false;
  }
  if (!data) return false;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false;
  return true;
};

// Resuelve acceso + plan en un solo paso: primero una suscripcion activa
// (paga), y si no hay, un acceso de cortesia otorgado por email (cubre tanto
// clientes que ya se registraron como los que aun no -- ver
// courtesy_access_grants, RLS acotado a auth.email()). Deliberadamente
// separado de crm_team_members: esa tabla es el allowlist del equipo interno
// de Ferova y no debe mezclarse con el acceso de un cliente real.
export const resolveAccess = async (userId: string, email: string): Promise<{ hasPaid: boolean; plan: PlanId }> => {
  const { data: sub, error: subError } = await (supabase as any)
    .from('user_subscriptions')
    .select('id, status, expires_at, plan')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (subError) console.error('[supabase] resolveAccess subscription error:', subError);
  if (sub && !(sub.expires_at && new Date(sub.expires_at) < new Date())) {
    return { hasPaid: true, plan: (sub.plan || 'financiero') as PlanId };
  }

  if (email) {
    const { data: courtesy, error: courtesyError } = await (supabase as any)
      .from('courtesy_access_grants')
      .select('plan')
      .eq('email', email)
      .maybeSingle();
    if (courtesyError) console.error('[supabase] resolveAccess courtesy error:', courtesyError);
    if (courtesy) return { hasPaid: true, plan: (courtesy.plan || 'completo') as PlanId };
  }

  return { hasPaid: false, plan: 'financiero' };
};
