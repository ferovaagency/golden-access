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
  /** Zona IANA usada para convertir el horario laboral y los bloques de agenda. */
  zona_horaria: string;
  /** URL pública de reservas del calendario del usuario. */
  booking_calendar_url: string | null;
  onboarding_completado: boolean;
  /** Fase 6: marcas de solicitud de eliminación con período de gracia. */
  deletion_requested_at: string | null;
  deletion_scheduled_for: string | null;
  created_at: string;
  updated_at: string;
}

/** Días de gracia antes de la purga real de la cuenta. */
export const ACCOUNT_DELETION_GRACE_DAYS = 15;

/** Solicita la eliminación de la cuenta: marca la intención y programa la purga
 *  para dentro del período de gracia. No destruye nada; es reversible con
 *  cancelAccountDeletion mientras no pase la fecha. */
export async function requestAccountDeletion(userId: string): Promise<{ scheduledFor: string }> {
  const now = new Date();
  const scheduled = new Date(now.getTime() + ACCOUNT_DELETION_GRACE_DAYS * 86_400_000);
  const { error } = await db('business_profile')
    .update({ deletion_requested_at: now.toISOString(), deletion_scheduled_for: scheduled.toISOString() })
    .eq('user_id', userId);
  if (error) throw new Error(`[businessProfileService] requestAccountDeletion: ${error.message}`);
  return { scheduledFor: scheduled.toISOString() };
}

/** Cancela una solicitud de eliminación pendiente. */
export async function cancelAccountDeletion(userId: string): Promise<void> {
  const { error } = await db('business_profile')
    .update({ deletion_requested_at: null, deletion_scheduled_for: null })
    .eq('user_id', userId);
  if (error) throw new Error(`[businessProfileService] cancelAccountDeletion: ${error.message}`);
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
