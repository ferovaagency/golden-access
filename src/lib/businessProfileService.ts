import { supabase } from './supabase';

export interface BusinessProfile {
  user_id: string;
  nombre_negocio: string | null;
  industria: string | null;
  tipo_negocio: string | null;
  tamano_equipo: string | null;
  ciudad: string | null;
  telefono_contacto: string | null;
  onboarding_completado: boolean;
  created_at: string;
  updated_at: string;
}

export async function getBusinessProfile(userId: string): Promise<BusinessProfile | null> {
  const { data, error } = await (supabase as any)
    .from('business_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`[businessProfileService] getBusinessProfile: ${error.message}`);
  return data as BusinessProfile | null;
}

export async function upsertBusinessProfile(userId: string, patch: Partial<BusinessProfile>): Promise<BusinessProfile> {
  const { data, error } = await (supabase as any)
    .from('business_profile')
    .upsert({ ...patch, user_id: userId, updated_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw new Error(`[businessProfileService] upsertBusinessProfile: ${error.message}`);
  return data as BusinessProfile;
}

export async function skipOnboarding(userId: string): Promise<BusinessProfile> {
  return upsertBusinessProfile(userId, { onboarding_completado: true });
}
