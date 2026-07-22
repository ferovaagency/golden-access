import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { initAuth, googleSignIn, logout, resolveAccess } from '../lib/supabase';
import { isTeamMember } from '../lib/crmService';
import { getModules, type ModuleOverrides, PlanId } from '../lib/planService';
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
  const [plan, setPlan] = useState<PlanId>('financiero');
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [moduleOverrides, setModuleOverrides] = useState<ModuleOverrides>({});
  const modules = useMemo(() => getModules(plan, isTeam, moduleOverrides), [plan, isTeam, moduleOverrides]);
  const loadedUserId = useRef<string | null>(null);
  const currentUser = useRef<User | null>(null);

  useEffect(() => {
    const loadAccess = async (fUser: User, force = false) => {
      // Supabase fires onAuthStateChange for TOKEN_REFRESHED too, which
      // happens almost every time the tab regains focus. Avoid duplicate
      // requests, except for an explicit visibility refresh.
      if (!force && loadedUserId.current === fUser.id) return;
      loadedUserId.current = fUser.id;
      setCheckingPayment(true);
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
      setIsTeam(team);
      setModuleOverrides(Object.fromEntries(overrides.map((override) => [override.module, override.enabled])) as ModuleOverrides);
      setCheckingPayment(false);
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
      if (document.visibilityState === 'visible' && currentUser.current) {
        void loadAccess(currentUser.current, true);
      }
    };
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
    user, authLoading, hasPaid, isTeam, plan, checkingPayment, moduleOverrides, modules,
    setHasPaid, handleLogin, handleSignOut,
  };
}
