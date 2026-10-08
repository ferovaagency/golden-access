import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { initAuth, googleSignIn, logout, resolveAccess, type SubscriptionInfo } from '../lib/supabase';
import { isTeamMember } from '../lib/crmService';
import { getModules, type ModuleOverrides, PlanId } from '../lib/planService';
import { setCurrentPlan } from '../lib/planGate';
import { listMyOverrides } from '../lib/moduleOverridesService';

/**
 * Owns the Supabase auth session, paid-access resolution, team membership,
 * and the derived module set. Extracted from App.tsx (Fase 2 del roadmap)
 * so the shell component doesn't own auth bootstrapping directly.
 */
export function useAuthAndAccess() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [hasPaid, setHasPaid] = useState(false);
  const [isTeam, setIsTeam] = useState(false);
  const [plan, setPlan] = useState<PlanId>('free');
  const [subscription, setSubscription] = useState<SubscriptionInfo>({ estado: 'none', trial_ends_at: null, periodo: null });
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [moduleOverrides, setModuleOverrides] = useState<ModuleOverrides>({});
  const modules = useMemo(() => getModules(plan, isTeam, moduleOverrides), [plan, isTeam, moduleOverrides]);
  // Los servicios sin React (planner, finanzas) consultan el plan por aquí.
  useEffect(() => { setCurrentPlan(plan, isTeam); }, [plan, isTeam]);
  const loadedUserId = useRef<string | null>(null);
  const currentUser = useRef<User | null>(null);
  const lastAccessRefreshAt = useRef(0);

  // Tras un upgrade pagado, el modal pide releer el plan sin recargar la página.
  const reloadAccess = useRef<(() => void) | null>(null);
  useEffect(() => {
    const loadAccess = async (fUser: User, force = false) => {
      // Supabase fires onAuthStateChange for TOKEN_REFRESHED too, which
      // happens almost every time the tab regains focus. Avoid duplicate
      // requests, except for an explicit visibility refresh.
      if (!force && loadedUserId.current === fUser.id) return;
      loadedUserId.current = fUser.id;
      // El refresh en segundo plano (force, al volver a la pestaña) NO debe tapar
      // la app con la pantalla de "verificando licencia": eso desmontaría el
      // dashboard y borraría lo que la persona estaba haciendo. Solo mostramos el
      // loader en la carga INICIAL; el refresh actualiza permisos en silencio.
      if (!force) setCheckingPayment(true);
      const [access, team] = await Promise.all([
        resolveAccess(fUser.id, fUser.email || ''),
        isTeamMember(fUser.email || '').catch(() => false),
      ]);
      const overrides = await listMyOverrides(fUser.id).catch((error) => {
        console.error('[useAuthAndAccess] module overrides error:', error);
        return [];
      });
      setHasPaid(access.hasPaid || team);
      setPlan(access.plan);
      setSubscription(access.subscription);
      setIsTeam(team);
      setModuleOverrides(Object.fromEntries(overrides.map((override) => [override.module, override.enabled])) as ModuleOverrides);
      lastAccessRefreshAt.current = Date.now();
      if (!force) setCheckingPayment(false);
    };

    const unsubscribe = initAuth(
      async (fUser: User) => {
        currentUser.current = fUser;
        setUser(fUser);
        setAuthLoading(false);
        await loadAccess(fUser);
      },
      () => {
        loadedUserId.current = null;
        currentUser.current = null;
        setUser(null);
        setHasPaid(false);
        setIsTeam(false);
        setPlan('financiero');
        setModuleOverrides({});
        setAuthLoading(false);
      }
    );
    // Plan and per-module overrides can be changed from the admin portal
    // while the customer still has a tab open. Refresh on return so a stale
    // session does not keep hiding modules that were just granted.
    const refreshWhenVisible = () => {
      // Volver a la pestaña no debe sentirse como una recarga. Solo validamos
      // permisos si la última lectura ya tiene más de cinco minutos.
      if (document.visibilityState === 'visible' && currentUser.current && Date.now() - lastAccessRefreshAt.current > 300_000) {
        void loadAccess(currentUser.current, true);
      }
    };
    reloadAccess.current = () => { if (currentUser.current) void loadAccess(currentUser.current, true); };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      unsubscribe();
    };
  }, []);

  const handleLogin = async (onError: (message: string) => void) => {
    try {
      await googleSignIn();
    } catch (err) {
      console.error('Login error:', err);
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Signout error:', err);
    }
  };

  return {
    user, authLoading, hasPaid, isTeam, plan, subscription, checkingPayment, moduleOverrides, modules,
    setHasPaid, handleLogin, handleSignOut,
    refreshAccess: () => reloadAccess.current?.(),
  };
}
