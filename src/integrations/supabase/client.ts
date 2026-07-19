// Runtime Supabase client. Environment values take precedence so local and
// preview deployments can override the production project when necessary.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Publishable keys are intentionally safe to expose in a browser. This
// fallback keeps the Lovable deployment operational while it does not inject
// VITE_* values into the built client. Never place a secret/service-role key here.
//
// This MUST always match the Supabase project Lovable Cloud actually manages
// for this app (confirmed by extracting it directly from a working preview
// build). A previous version of this fallback pointed at an abandoned
// external Supabase project and silently sent all traffic there whenever a
// deploy didn't inject VITE_SUPABASE_URL -- that's what broke Google login
// on the custom domain while the Lovable preview kept working fine.
const DEFAULT_SUPABASE_URL = 'https://izkhdzzyqfopjveaagwk.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_xqtnBMKSFDZkMX1gN-N33A_s3ivXEwI';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

const missingSupabaseVariables = [
  !SUPABASE_URL && 'VITE_SUPABASE_URL',
  !SUPABASE_PUBLISHABLE_KEY && 'VITE_SUPABASE_PUBLISHABLE_KEY',
].filter(Boolean) as string[];

export const supabaseConfigurationError = missingSupabaseVariables.length
  ? `Falta configurar ${missingSupabaseVariables.join(' y ')} en este despliegue.`
  : null;

export const isSupabaseConfigured = !supabaseConfigurationError;


function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createUnconfiguredClient(message: string): SupabaseClient<Database> {
  return new Proxy({} as SupabaseClient<Database>, {
    get() {
      throw new Error(message);
    },
  });
}

export function getSupabaseFunctionUrl(functionName: string): string {
  if (!SUPABASE_URL) {
    throw new Error(supabaseConfigurationError ?? 'Falta configurar Supabase.');
  }
  return `${SUPABASE_URL}/functions/v1/${functionName}`;
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase: SupabaseClient<Database> = isSupabaseConfigured
  ? createClient<Database>(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
      global: { fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY!) },
      auth: { storage: localStorage, persistSession: true, autoRefreshToken: true },
    })
  : createUnconfiguredClient(supabaseConfigurationError!);
