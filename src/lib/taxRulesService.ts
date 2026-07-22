/**
 * Reglas tributarias versionadas (tabla `tax_rules`, Manual maestro secciones
 * 4.10/17). Dato de referencia compartido -- no por-usuario -- de solo
 * lectura para clientes normales (RLS: SELECT para authenticated, escritura
 * reservada al service role del equipo Ferova).
 */
import { db } from './db';

export interface TaxRule {
  id: string;
  country: string;
  jurisdiction: string | null;
  taxpayer_type: string;
  tax_type: string;
  effective_year: number;
  threshold: number | null;
  rate: number | null;
  base: string | null;
  source: string | null;
  valid_from: string;
  valid_to: string | null;
  version: number;
  created_at: string;
}

/** Todas las reglas vigentes para un país/año (la versión más alta por regla). */
export async function listActiveTaxRules(country: string, effectiveYear: number): Promise<TaxRule[]> {
  const { data, error } = await db<TaxRule>('tax_rules')
    .select('*')
    .eq('country', country)
    .eq('effective_year', effectiveYear)
    .order('tax_type');
  if (error) throw new Error(`[taxRulesService] listActiveTaxRules: ${error.message}`);
  // Si hay más de una versión de la misma regla, se queda con la más alta.
  const byKey = new Map<string, TaxRule>();
  for (const rule of data || []) {
    const key = `${rule.taxpayer_type}:${rule.tax_type}`;
    const existing = byKey.get(key);
    if (!existing || rule.version > existing.version) byKey.set(key, rule);
  }
  return Array.from(byKey.values());
}

/** Busca una regla puntual por tipo de contribuyente + tipo de impuesto. */
export function findTaxRule(rules: TaxRule[], taxpayerType: string, taxType: string): TaxRule | null {
  return rules.find((r) => r.taxpayer_type === taxpayerType && r.tax_type === taxType)
    || rules.find((r) => r.taxpayer_type === 'todos' && r.tax_type === taxType)
    || null;
}
