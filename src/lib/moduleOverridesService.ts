import { supabase } from './supabase';

export interface ModuleOverride {
  id: string;
  user_id: string;
  module: string;
  enabled: boolean;
}

export async function listMyOverrides(userId: string): Promise<ModuleOverride[]> {
  const { data, error } = await (supabase as any).from('admin_module_overrides').select('*').eq('user_id', userId);
  if (error) throw error;
  return (data || []) as ModuleOverride[];
}

export async function upsertOverride(userId: string, module: string, enabled: boolean): Promise<void> {
  const { error } = await (supabase as any).from('admin_module_overrides').upsert(
    { user_id: userId, module, enabled, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,module' },
  );
  if (error) throw error;
}

export async function listCourtesyEmails(): Promise<Array<{ id: string; email: string; plan: string; notas: string | null }>> {
  const { data, error } = await (supabase as any).from('admin_courtesy_emails').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addCourtesyEmail(email: string, plan: string, notas?: string): Promise<void> {
  const { error } = await (supabase as any).from('admin_courtesy_emails').insert({ email: email.toLowerCase().trim(), plan, notas: notas || null });
  if (error) throw error;
}

export async function removeCourtesyEmail(id: string): Promise<void> {
  const { error } = await (supabase as any).from('admin_courtesy_emails').delete().eq('id', id);
  if (error) throw error;
}
