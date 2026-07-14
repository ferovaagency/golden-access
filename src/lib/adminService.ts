import { supabase } from './supabase';
import type { PlanId } from './planService';

export interface AdminCustomer {
  user_id: string;
  email: string;
  created_at: string;
  nombre_negocio: string | null;
  onboarding_completado: boolean;
  plan: PlanId;
  estado_suscripcion: 'activo' | 'cortesia' | 'sin_pago';
  es_cortesia: boolean;
  notas_cortesia: string | null;
}

export interface FeedbackItem {
  id: string;
  email: string | null;
  tipo: 'bug' | 'sugerencia' | 'otro';
  mensaje: string;
  estado: 'nuevo' | 'revisado' | 'resuelto';
  created_at: string;
}

export async function getMyTeamRole(email: string): Promise<string | null> {
  const { data, error } = await (supabase as any)
    .from('crm_team_members')
    .select('rol')
    .eq('email', email)
    .maybeSingle();
  if (error) {
    console.error('[adminService] getMyTeamRole error:', error);
    return null;
  }
  return data?.rol || null;
}

export async function listCustomers(): Promise<AdminCustomer[]> {
  const { data, error } = await supabase.functions.invoke('admin-list-customers', { body: {} });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo cargar la lista de clientes.');
  return data.customers as AdminCustomer[];
}

export async function setCustomerPlan(user_id: string, plan: PlanId): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-set-plan', { body: { user_id, plan } });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo cambiar el plan.');
}

export async function grantCourtesyAccess(email: string, plan: PlanId, notas?: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-grant-courtesy-access', { body: { email, plan, notas } });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo dar el acceso de cortesía.');
}

export async function listFeedback(): Promise<FeedbackItem[]> {
  const { data, error } = await supabase.functions.invoke('admin-list-feedback', { body: {} });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo cargar el feedback.');
  return data.feedback as FeedbackItem[];
}

export async function updateFeedbackStatus(id: string, estado: FeedbackItem['estado']): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-update-feedback-status', { body: { id, estado } });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo actualizar el estado.');
}
