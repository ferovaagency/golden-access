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
