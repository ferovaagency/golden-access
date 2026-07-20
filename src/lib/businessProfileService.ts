import { db } from './db';

export interface BusinessProfile {
  user_id: string;
  nombre_negocio: string | null;
  industria: string | null;
  tipo_negocio: string | null;
  tamano_equipo: string | null;
  ciudad: string | null;
  telefono_contacto: string | null;
  /** 0=domingo..6=sábado, mismo formato que planner_tasks.recurrence_days. */
  dias_laborales: number[];
  /** "HH:MM" */
  horario_inicio: string;
  /** "HH:MM" */
  horario_fin: string;
  onboarding_completado: boolean;
  created_at: string;
  updated_at: string;
}

export async function getBusinessProfile(userId: string): Promise<BusinessProfile | null> {
  const { data, error } = await db<BusinessProfile>('business_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`[businessProfileService] getBusinessProfile: ${error.message}`);
  return data;
}

export async function upsertBusinessProfile(userId: string, patch: Partial<BusinessProfile>): Promise<BusinessProfile> {
  const { data, error } = await db<BusinessProfile>('business_profile')
    .upsert({ ...patch, user_id: userId, updated_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw new Error(`[businessProfileService] upsertBusinessProfile: ${error.message}`);
  if (!data) throw new Error('[businessProfileService] upsertBusinessProfile: sin datos de respuesta.');
  return data;
}

export async function skipOnboarding(userId: string): Promise<BusinessProfile> {
  return upsertBusinessProfile(userId, { onboarding_completado: true });
}
