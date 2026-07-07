import { createClient, Session, User } from '@supabase/supabase-js';

/**
 * SUPABASE CLIENT - Reemplaza a Firebase Auth
 *
 * Requiere variables de entorno:
 *   VITE_SUPABASE_URL          -> https://<project-ref>.supabase.co
 *   VITE_SUPABASE_PUBLISHABLE_KEY -> sb_publishable_...
 *
 * El SQL para crear la tabla de suscripciones está en
 *   src/lib/supabase.sql
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  'sb_publishable_b5j2ar7b9fz2XNr95JwYCQ_Eyasabcn';

if (!SUPABASE_URL) {
  console.error(
    '[supabase] Falta VITE_SUPABASE_URL. Defínela en tu .env o en los Build Secrets del workspace.'
  );
}

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

// ============================================================
// Cache del provider_token de Google (Sheets + Drive)
// ============================================================
const TOKEN_KEY = 'ferova_oauth_token';

let cachedAccessToken: string | null =
  typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_KEY) : null;

const persistToken = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof window === 'undefined') return;
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
};

export const getAccessToken = (): string | null => cachedAccessToken;

export const setAccessTokenCustom = (token: string | null) => persistToken(token);

// ============================================================
// API compatible con el código existente (firebase shim)
// ============================================================
export type AuthUser = User;

const GOOGLE_SCOPES =
  'openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Captura del provider_token desde la sesión actual (al cargar la página)
  supabase.auth.getSession().then(({ data }) => {
    const session = data.session;
    if (session?.provider_token) persistToken(session.provider_token);
    if (session?.user) {
      onAuthSuccess?.(session.user, cachedAccessToken || '');
    } else {
      onAuthFailure?.();
    }
  });

  const { data: sub } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
    if (session?.provider_token) persistToken(session.provider_token);
    if (session?.user) {
      onAuthSuccess?.(session.user, cachedAccessToken || '');
    } else {
      persistToken(null);
      onAuthFailure?.();
    }
  });

  return () => sub.subscription.unsubscribe();
};

export const googleSignIn = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: GOOGLE_SCOPES,
      redirectTo: window.location.origin,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw error;
  return data;
};

export const linkGoogleIdentity = async () => {
  // @ts-ignore - linkIdentity existe en supabase-js >= 2.30
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: {
      scopes: GOOGLE_SCOPES,
      redirectTo: window.location.origin,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw error;
  return data;
};

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
  persistToken(null);
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

/**
 * Verifica la orden de PayPal en el servidor (Edge Function `paypal-capture-order`)
 * antes de activar la suscripción. No se inserta nada directo desde el cliente:
 * la función usa el service_role y re-verifica el pago contra la API de PayPal,
 * derivando el user_id del JWT ya autenticado (no de lo que envíe el navegador).
 */
export const recordPaypalPayment = async (orderId: string) => {
  const { data, error } = await supabase.functions.invoke('paypal-capture-order', {
    body: { orderId },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'PayPal no confirmó el pago.');
  return data;
};
