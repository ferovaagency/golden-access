/**
 * Cliente Supabase con cast único para tablas del proyecto.
 *
 * El módulo generado `integrations/supabase/types.ts` no incluye las tablas
 * del usuario (finance_accounts, saas_plans, crm_*, etc.), así que sin este
 * helper cada servicio hace `(supabase as any).from(...)` y pierde todo el
 * tipado del resto de la respuesta (data/error).
 *
 * Uso:
 *   const { data, error } = await db<AccountRow>('finance_accounts')
 *     .select('*').eq('user_id', uid);
 *   // data: AccountRow[] | null, error tipado.
 */

// Import the raw client directly (not from ./supabase) to avoid a circular
// dependency: ./supabase itself uses db() for a couple of queries.
import { supabase } from '../integrations/supabase/client';
import type { PostgrestError } from '@supabase/supabase-js';

// Interface mínima que refleja lo que efectivamente usamos del builder.
// Devuelve promesas tipadas manteniendo `data`/`error` correctos por tabla.
export interface TableBuilder<TRow> {
  select: (cols?: string) => TableQuery<TRow>;
  insert: (values: Partial<TRow> | Partial<TRow>[]) => TableMutation<TRow>;
  update: (values: Partial<TRow>) => TableMutation<TRow>;
  delete: () => TableMutation<TRow>;
  upsert: (values: Partial<TRow> | Partial<TRow>[], opts?: { onConflict?: string }) => TableMutation<TRow>;
}

export interface TableQuery<TRow> extends PromiseLike<{ data: TRow[] | null; error: PostgrestError | null }> {
  eq: (col: string, val: unknown) => TableQuery<TRow>;
  neq: (col: string, val: unknown) => TableQuery<TRow>;
  in: (col: string, vals: unknown[]) => TableQuery<TRow>;
  gt: (col: string, val: unknown) => TableQuery<TRow>;
  gte: (col: string, val: unknown) => TableQuery<TRow>;
  lt: (col: string, val: unknown) => TableQuery<TRow>;
  lte: (col: string, val: unknown) => TableQuery<TRow>;
  is: (col: string, val: unknown) => TableQuery<TRow>;
  ilike: (col: string, pattern: string) => TableQuery<TRow>;
  order: (col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => TableQuery<TRow>;
  limit: (n: number) => TableQuery<TRow>;
  range: (from: number, to: number) => TableQuery<TRow>;
  maybeSingle: () => PromiseLike<{ data: TRow | null; error: PostgrestError | null }>;
  single: () => PromiseLike<{ data: TRow | null; error: PostgrestError | null }>;
}

export interface TableMutation<TRow> extends PromiseLike<{ data: TRow[] | null; error: PostgrestError | null }> {
  eq: (col: string, val: unknown) => TableMutation<TRow>;
  in: (col: string, vals: unknown[]) => TableMutation<TRow>;
  select: (cols?: string) => TableQuery<TRow>;
}

export function db<TRow = Record<string, unknown>>(table: string): TableBuilder<TRow> {
  // Cast único a un builder estructural. Los tipos above garantizan que los
  // consumidores nunca ven `any` en `data`/`error`.
  return (supabase as unknown as { from: (t: string) => TableBuilder<TRow> }).from(table);
}
