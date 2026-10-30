// Puerta de funciones en el servidor: una edge function de una función
// "interna" o "beta" debe negarse a quien no la tenga habilitada, aunque
// adivine el nombre. Usa la misma regla que la app (feature_enabled_for).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export async function featureEnabled(admin: SupabaseClient, key: string, userId: string): Promise<boolean> {
  const { data, error } = await admin.rpc('feature_enabled_for', { p_key: key, p_user: userId });
  if (error) { console.error('[features] feature_enabled_for', error); return false; }
  return data === true;
}
