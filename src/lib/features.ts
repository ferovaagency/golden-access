// Funciones por publicar: la app pregunta una vez por sesión qué llaves tiene
// habilitadas la cuenta (my_features) y los componentes consultan
// `useFeature('tablero_proyectos')`. Lo que no está habilitado no se
// renderiza; el servidor valida lo mismo (_shared/features.ts).
//
// El equipo Ferova ve todo; "beta" = equipo + correos elegidos; "publicado"
// = todos, respetando el plan mínimo si la función lo tiene.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { PlanId } from './planService';

export type FeatureEstado = 'interno' | 'beta' | 'publicado';
export interface FeatureGrant { key: string; plan_minimo: 'basico' | 'intermedio' | 'full' | null; estado: FeatureEstado }

const ORDEN: Record<string, number> = { free: 0, basico: 1, intermedio: 2, full: 3 };

let cache: FeatureGrant[] | null = null;
let inflight: Promise<FeatureGrant[]> | null = null;
const listeners = new Set<() => void>();

export async function loadFeatures(force = false): Promise<FeatureGrant[]> {
  if (cache && !force) return cache;
  if (inflight && !force) return inflight;
  inflight = (async () => {
    // Los tipos generados aún no conocen my_features (migración nueva).
    const { data, error } = await (supabase as any).rpc('my_features');
    if (error) { console.warn('[features] my_features', error.message); cache = cache ?? []; }
    else cache = (data ?? []) as FeatureGrant[];
    inflight = null;
    for (const l of listeners) l();
    return cache;
  })();
  return inflight;
}

export function resetFeatures() { cache = null; for (const l of listeners) l(); }

/** ¿La cuenta tiene la función y el plan alcanza? isTeam salta el plan mínimo. */
export function featureOn(key: string, plan: PlanId, isTeam: boolean, grants: FeatureGrant[] | null = cache): boolean {
  const g = (grants ?? []).find((f) => f.key === key);
  if (!g) return false;
  if (isTeam || !g.plan_minimo) return true;
  return (ORDEN[plan] ?? 3) >= (ORDEN[g.plan_minimo] ?? 0);
}

export function useFeatures(): FeatureGrant[] | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((v) => v + 1);
    listeners.add(l);
    if (!cache) void loadFeatures();
    return () => { listeners.delete(l); };
  }, []);
  return cache;
}

export function useFeature(key: string, plan: PlanId, isTeam: boolean): boolean {
  const grants = useFeatures();
  return featureOn(key, plan, isTeam, grants);
}
