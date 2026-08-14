import { supabase } from '../integrations/supabase/client';
import { GOOGLE_SCOPES } from './supabase';

// Recuerda que conectaste Google, aunque el token ya no esté vivo.
//
// `provider_token` lo entrega Supabase UNA vez al volver del OAuth y vive en
// memoria: al recargar la página desaparece. Como la pantalla se guiaba sólo por
// él, la conexión parecía no funcionar nunca. Aquí se guarda el HECHO de haber
// conectado (correo y permisos), nunca el token — no hay tokens de terceros en
// reposo, y esa decisión no cambia.

export interface GoogleConnection {
  connected: boolean;
  connected_email: string | null;
  scopes: string[] | null;
  last_error: string | null;
  updated_at: string | null;
}

async function call<T>(body: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await supabase.functions.invoke('google-connection', { body });
  if (error) { console.error('[googleConnection]', error.message); return null; }
  if (!data?.ok) { console.error('[googleConnection]', data?.message); return null; }
  return data as T;
}

export async function fetchGoogleConnection(): Promise<GoogleConnection | null> {
  const res = await call<{ connection: GoogleConnection | null }>({ action: 'status' });
  return res?.connection ?? null;
}

/** Se llama al volver del OAuth, cuando hay token vivo: deja constancia. */
export async function recordGoogleConnected(email?: string | null): Promise<void> {
  await call({ action: 'connected', email: email ?? null, scopes: GOOGLE_SCOPES });
}

export async function recordGoogleDisconnected(): Promise<void> {
  await call({ action: 'disconnect' });
}
