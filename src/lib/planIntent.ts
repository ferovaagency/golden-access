// Intención de plan: lo que la persona eligió en la landing o en /precios
// antes de tener cuenta. Viaja en la URL (/app?plan=intermedio&periodo=anual),
// se guarda al llegar a /app y se consume cuando la prueba arranca.
//
// Se guarda en sessionStorage (sobrevive la ida y vuelta de Google en la
// misma pestaña) y también en localStorage con caducidad, porque el enlace
// mágico del correo puede abrirse en otra pestaña o en otro navegador del
// mismo equipo, y ahí sessionStorage no existe.
import { PAID_TIERS, type PaidTier, type Periodo } from './planService';

export const PLAN_INTENT_KEY = 'ferova.intent_plan';
const TTL_MS = 24 * 60 * 60 * 1000;

export interface PlanIntent { plan: PaidTier; periodo: Periodo }

interface Stored extends PlanIntent { exp: number }

function isPaidTier(value: unknown): value is PaidTier {
  return typeof value === 'string' && (PAID_TIERS as readonly string[]).includes(value);
}

function isPeriodo(value: unknown): value is Periodo {
  return value === 'mensual' || value === 'anual';
}

/** Lee `plan`/`periodo` de una cadena de búsqueda. Devuelve null si no hay plan válido. */
export function parsePlanIntent(search: string): PlanIntent | null {
  const params = new URLSearchParams(search);
  const plan = params.get('plan');
  if (!isPaidTier(plan)) return null;
  const periodo = params.get('periodo');
  return { plan, periodo: isPeriodo(periodo) ? periodo : 'mensual' };
}

/** Enlace a /app con la intención codificada (lo usan la landing y /precios). */
export function planIntentPath(intent: PlanIntent): string {
  return `/app?plan=${intent.plan}&periodo=${intent.periodo}`;
}

export function savePlanIntent(intent: PlanIntent): void {
  const stored: Stored = { ...intent, exp: Date.now() + TTL_MS };
  const raw = JSON.stringify(stored);
  try { sessionStorage.setItem(PLAN_INTENT_KEY, raw); } catch { /* storage no disponible */ }
  try { localStorage.setItem(PLAN_INTENT_KEY, raw); } catch { /* storage no disponible */ }
}

function readFrom(storage: Storage): Stored | null {
  try {
    const raw = storage.getItem(PLAN_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (!isPaidTier(parsed.plan) || !isPeriodo(parsed.periodo)) return null;
    if (typeof parsed.exp === 'number' && parsed.exp < Date.now()) return null;
    return { plan: parsed.plan, periodo: parsed.periodo, exp: parsed.exp ?? 0 };
  } catch {
    return null;
  }
}

export function readPlanIntent(): PlanIntent | null {
  const found = readFrom(sessionStorage) ?? readFrom(localStorage);
  return found ? { plan: found.plan, periodo: found.periodo } : null;
}

export function clearPlanIntent(): void {
  try { sessionStorage.removeItem(PLAN_INTENT_KEY); } catch { /* noop */ }
  try { localStorage.removeItem(PLAN_INTENT_KEY); } catch { /* noop */ }
}

/** Lee y borra en un solo paso: la intención se usa una sola vez. */
export function consumePlanIntent(): PlanIntent | null {
  const intent = readPlanIntent();
  if (intent) clearPlanIntent();
  return intent;
}

/**
 * Al entrar a /app: si la URL trae plan, lo guarda y limpia los parámetros
 * (así un refresco o el redirect de Google no los vuelven a procesar).
 * Devuelve la intención vigente, venga de la URL o de un guardado previo.
 */
export function capturePlanIntentFromUrl(): PlanIntent | null {
  if (typeof window === 'undefined') return null;
  const fromUrl = parsePlanIntent(window.location.search);
  if (fromUrl) {
    savePlanIntent(fromUrl);
    const url = new URL(window.location.href);
    url.searchParams.delete('plan');
    url.searchParams.delete('periodo');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    return fromUrl;
  }
  return readPlanIntent();
}
