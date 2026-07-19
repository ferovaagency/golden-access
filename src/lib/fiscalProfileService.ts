import { db } from './db';

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

/** Row shape for writes: adds the columns that aren't part of the public FiscalProfile shape. */
type FiscalProfileRow = FiscalProfile & { user_id: string; updated_at: string };

export async function getFiscalProfile(userId: string): Promise<FiscalProfile> {
  const { data, error } = await db<FiscalProfile>('user_fiscal_profile')
    .select('country, person_type, regime, currency_base')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? DEFAULT;
}

export async function upsertFiscalProfile(userId: string, profile: Partial<FiscalProfile>): Promise<FiscalProfile> {
  const merged = { ...DEFAULT, ...profile };
  const { data, error } = await db<FiscalProfileRow>('user_fiscal_profile')
    .upsert({ user_id: userId, ...merged, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select('country, person_type, regime, currency_base')
    .single();
  if (error) throw error;
  if (!data) throw new Error('No se pudo guardar el perfil fiscal.');
  return data;
}
