import { supabase } from '../integrations/supabase/client';

/**
 * Registro diario de KPIs y metas del tablero de Seguimiento. Antes vivía en
 * localStorage (un solo dispositivo); ahora se guarda en Supabase para que la
 * misma cuenta vea lo mismo en computador y celular. La primera carga sube lo
 * que hubiera quedado en el navegador y luego limpia esa copia local.
 */

export type MetricKey = 'contactos' | 'seguimientos' | 'calificadas' | 'respuestas';
export type DailyValues = Record<MetricKey, number>;
export type DailyTargets = Record<MetricKey, number>;
export interface StoredDay extends DailyValues { date: string }

export const METRIC_KEYS: MetricKey[] = ['contactos', 'seguimientos', 'calificadas', 'respuestas'];
export const defaultTargets = (): DailyTargets => ({ contactos: 20, seguimientos: 10, calificadas: 5, respuestas: 8 });
export const emptyValues = (): DailyValues => ({ contactos: 0, seguimientos: 0, calificadas: 0, respuestas: 0 });

export interface OperatingKpiState {
  days: StoredDay[];
  targets: DailyTargets;
  annualMrrTarget: number;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTargets(raw: unknown): DailyTargets {
  const base = defaultTargets();
  if (!raw || typeof raw !== 'object') return base;
  const source = raw as Record<string, unknown>;
  METRIC_KEYS.forEach((key) => { base[key] = Math.max(0, toNumber(source[key], base[key])); });
  return base;
}

export async function loadOperatingKpis(userId: string): Promise<OperatingKpiState> {
  await migrateLocalStorage(userId);

  const [daysResult, settingsResult] = await Promise.all([
    supabase.from('operating_kpi_days').select('*').eq('user_id', userId).order('fecha'),
    supabase.from('operating_kpi_settings').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  if (daysResult.error) console.error('[operatingKpi] days load error:', daysResult.error);
  if (settingsResult.error) console.error('[operatingKpi] settings load error:', settingsResult.error);

  const days: StoredDay[] = (daysResult.data ?? []).map((row: Record<string, unknown>) => ({
    date: String(row.fecha),
    contactos: toNumber(row.contactos),
    seguimientos: toNumber(row.seguimientos),
    calificadas: toNumber(row.calificadas),
    respuestas: toNumber(row.respuestas),
  }));

  const settings = settingsResult.data as Record<string, unknown> | null;
  return {
    days,
    targets: normalizeTargets(settings?.metas),
    annualMrrTarget: toNumber(settings?.meta_anual_mrr),
  };
}

export async function saveDay(userId: string, date: string, values: DailyValues): Promise<void> {
  const { error } = await supabase
    .from('operating_kpi_days')
    .upsert({ user_id: userId, fecha: date, ...values, updated_at: new Date().toISOString() }, { onConflict: 'user_id,fecha' });
  if (error) { console.error('[operatingKpi] saveDay error:', error); throw error; }
}

export async function saveTargets(userId: string, targets: DailyTargets): Promise<void> {
  const { error } = await supabase
    .from('operating_kpi_settings')
    .upsert({ user_id: userId, metas: targets, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) { console.error('[operatingKpi] saveTargets error:', error); throw error; }
}

export async function saveAnnualTarget(userId: string, value: number): Promise<void> {
  const { error } = await supabase
    .from('operating_kpi_settings')
    .upsert({ user_id: userId, meta_anual_mrr: Math.max(0, value), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) { console.error('[operatingKpi] saveAnnualTarget error:', error); throw error; }
}

/**
 * Sube una sola vez lo que haya quedado en localStorage de la versión anterior
 * y borra la copia local. Nunca pisa datos que ya estén en la base: los días
 * existentes en Supabase se conservan (ignoreDuplicates).
 */
async function migrateLocalStorage(userId: string): Promise<void> {
  const flagKey = `ferova.kpi.migrated.${userId}`;
  if (typeof localStorage === 'undefined' || localStorage.getItem(flagKey) === '1') return;

  const daysKey = `ferova.kpi.daily.${userId}`;
  const targetsKey = `ferova.kpi.targets.${userId}`;
  const annualKey = `ferova.kpi.annualMrr.${userId}`;

  try {
    const rawDays = localStorage.getItem(daysKey);
    const legacyDays: StoredDay[] = rawDays ? JSON.parse(rawDays) : [];
    if (Array.isArray(legacyDays) && legacyDays.length) {
      const rows = legacyDays
        .filter((day) => typeof day?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day.date))
        .map((day) => ({
          user_id: userId,
          fecha: day.date,
          contactos: Math.max(0, toNumber(day.contactos)),
          seguimientos: Math.max(0, toNumber(day.seguimientos)),
          calificadas: Math.max(0, toNumber(day.calificadas)),
          respuestas: Math.max(0, toNumber(day.respuestas)),
        }));
      if (rows.length) {
        const { error } = await supabase
          .from('operating_kpi_days')
          .upsert(rows, { onConflict: 'user_id,fecha', ignoreDuplicates: true });
        if (error) { console.error('[operatingKpi] migrate days error:', error); return; }
      }
    }

    const rawTargets = localStorage.getItem(targetsKey);
    const legacyAnnual = toNumber(localStorage.getItem(annualKey));
    if (rawTargets || legacyAnnual > 0) {
      const { data: existing } = await supabase
        .from('operating_kpi_settings').select('user_id').eq('user_id', userId).maybeSingle();
      if (!existing) {
        const { error } = await supabase.from('operating_kpi_settings').upsert({
          user_id: userId,
          metas: rawTargets ? normalizeTargets(JSON.parse(rawTargets)) : defaultTargets(),
          meta_anual_mrr: legacyAnnual > 0 ? legacyAnnual : 0,
        }, { onConflict: 'user_id' });
        if (error) { console.error('[operatingKpi] migrate settings error:', error); return; }
      }
    }

    localStorage.setItem(flagKey, '1');
    [daysKey, targetsKey, annualKey, `ferova.kpi.gateway.${userId}`, `ferova.kpi.gatewayName.${userId}`]
      .forEach((key) => localStorage.removeItem(key));
  } catch (err) {
    console.error('[operatingKpi] migration skipped:', err);
  }
}
