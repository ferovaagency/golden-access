import { createClient, Session, User } from '@supabase/supabase-js';

/**
 * ============================================================================
 *  SUPABASE — Ferova OS
 * ============================================================================
 *
 *  Antes de usar la app ejecuta este SQL en el SQL Editor de Supabase:
 *
 *  ----------------------------------------------------------------------------
 *  create table public.user_subscriptions (
 *    id uuid primary key default gen_random_uuid(),
 *    user_id uuid references auth.users(id) on delete cascade not null,
 *    status text not null check (status in ('active','cancelled','expired')),
 *    paypal_order_id text not null,
 *    created_at timestamptz default now(),
 *    unique (user_id, paypal_order_id)
 *  );
 *
 *  grant select, insert on public.user_subscriptions to authenticated;
 *  grant all on public.user_subscriptions to service_role;
 *
 *  alter table public.user_subscriptions enable row level security;
 *
 *  create policy "users read own subs"
 *    on public.user_subscriptions for select to authenticated
 *    using (auth.uid() = user_id);
 *
 *  create policy "users insert own subs"
 *    on public.user_subscriptions for insert to authenticated
 *    with check (auth.uid() = user_id);
 *  ----------------------------------------------------------------------------
 *
 *  Y en Supabase Dashboard → Authentication → Providers → Google:
 *   - Activa Google y configura Client ID/Secret de Google Cloud.
 *   - En Google Cloud activa Google Sheets API y Google Drive API.
 *   - Añade tu dominio a "Site URL" y "Redirect URLs"
 *     (ej. https://<tu-app>.lovable.app y http://localhost:3000).
 * ============================================================================
 */

// Clave publishable (segura para el cliente).
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_b5j2ar7b9fz2XNr95JwYCQ_Eyasabcn';

// URL del proyecto Supabase. Se toma de la variable de entorno; si no existe
// se usa el placeholder de abajo (REEMPLAZA <project-ref> por el ref real de tu
// proyecto, p.ej. https://abcdxyzklmno.supabase.co).
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  'https://REPLACE-WITH-YOUR-PROJECT-REF.supabase.co';

if (SUPABASE_URL.includes('REPLACE-WITH-YOUR-PROJECT-REF')) {
  console.warn(
    '[Ferova] Falta configurar VITE_SUPABASE_URL con la URL real de tu proyecto Supabase.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const PROVIDER_TOKEN_KEY = 'ferova_provider_token';

export const getStoredProviderToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(PROVIDER_TOKEN_KEY);
};

export const setStoredProviderToken = (token: string | null) => {
  if (typeof window === 'undefined') return;
  if (token) sessionStorage.setItem(PROVIDER_TOKEN_KEY, token);
  else sessionStorage.removeItem(PROVIDER_TOKEN_KEY);
};

// --- Auth helpers ---------------------------------------------------------

export const signUpWithEmail = (email: string, password: string) =>
  supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });

export const signInWithEmail = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

/**
 * Login con Google con los scopes EXACTOS que necesita sheetsService.ts.
 * No los elimines: sin ellos provider_token no podrá llamar a Sheets/Drive.
 */
export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes:
        'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
      redirectTo: window.location.origin,
    },
  });

export const signOut = async () => {
  setStoredProviderToken(null);
  return supabase.auth.signOut();
};

export const getCurrentSession = async (): Promise<Session | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session;
};

export type AuthChange = {
  session: Session | null;
  user: User | null;
  providerToken: string | null;
};

/**
 * Suscríbete a cambios de auth. Persiste provider_token de Google en
 * sessionStorage porque Supabase no lo guarda entre refreshes.
 */
export const onAuthStateChange = (cb: (change: AuthChange) => void) => {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    // Cuando Supabase devuelve provider_token (login fresco de Google) lo cacheamos.
    if (session?.provider_token) {
      setStoredProviderToken(session.provider_token);
    }
    const providerToken = session?.provider_token ?? getStoredProviderToken();
    cb({
      session,
      user: session?.user ?? null,
      providerToken,
    });
  });
  return data.subscription;
};

// --- Subscriptions --------------------------------------------------------

export const hasActiveSubscription = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[Ferova] error consultando suscripción:', error);
    return false;
  }
  return !!data;
};

export const recordPaypalPayment = async (
  userId: string,
  paypalOrderId: string
) =>
  supabase.from('user_subscriptions').insert({
    user_id: userId,
    status: 'active',
    paypal_order_id: paypalOrderId,
  });
