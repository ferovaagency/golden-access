import { supabase } from './supabase';

export type PersonType = 'natural' | 'juridica';
export type FiscalRegime = 'simple' | 'ordinario';

export interface FiscalProfile {
  country: string;
  person_type: PersonType;
  regime: FiscalRegime;
  currency_base: string;
}

const DEFAULT: FiscalProfile = {
  country: 'CO',
  person_type: 'natural',
  regime: 'simple',
  currency_base: 'COP',
};

export async function getFiscalProfile(userId: string): Promise<FiscalProfile> {
  const { data, error } = await (supabase as any)
    .from('user_fiscal_profile')
    .select('country, person_type, regime, currency_base')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT;
  return data as FiscalProfile;
}

export async function upsertFiscalProfile(userId: string, profile: Partial<FiscalProfile>): Promise<FiscalProfile> {
  const merged = { ...DEFAULT, ...profile };
  const { data, error } = await (supabase as any)
    .from('user_fiscal_profile')
    .upsert({ user_id: userId, ...merged, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select('country, person_type, regime, currency_base')
    .single();
  if (error) throw error;
  return data as FiscalProfile;
}
