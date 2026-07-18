// Central hook: exposes health snapshot + open blind spots and refresh actions
// for the current authenticated user. Any dashboard/home component should use
// this hook instead of calling biService directly, so refresh + loading states
// stay consistent across the app.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import {
  type BlindSpot,
  type HealthSnapshot,
  dismissBlindSpot,
  fetchLatestHealth,
  fetchOpenBlindSpots,
  recomputeHealth,
  refreshBlindSpots,
  resolveBlindSpot,
  urgencyRank,
} from '../lib/biService';
import { logger } from '../lib/logger';

const log = logger.child('useBusinessIntel');

export function useBusinessIntel() {
  const [userId, setUserId] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [blindspots, setBlindspots] = useState<BlindSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'health' | 'blindspots' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id || null);
    });
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [h, b] = await Promise.all([fetchLatestHealth(userId), fetchOpenBlindSpots(userId)]);
      setHealth(h);
      setBlindspots(b.sort((x, y) => urgencyRank[x.urgency] - urgencyRank[y.urgency]));
      setError(null);
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const refreshHealth = useCallback(async () => {
    if (!userId) return;
    setBusy('health'); setError(null);
    try {
      const snap = await recomputeHealth();
      if (snap) setHealth(snap);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(null); }
  }, [userId]);

  const refreshBlindspotsList = useCallback(async () => {
    if (!userId) return;
    setBusy('blindspots'); setError(null);
    try {
      const list = await refreshBlindSpots();
      setBlindspots(list.sort((x, y) => urgencyRank[x.urgency] - urgencyRank[y.urgency]));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(null); }
  }, [userId]);

  const dismiss = useCallback(async (id: string) => {
    setBlindspots((prev) => prev.filter((b) => b.id !== id));
    try { await dismissBlindSpot(id); } catch (err) { log.error(err instanceof Error ? err : new Error(String(err))); void load(); }
  }, [load]);

  const resolve = useCallback(async (id: string) => {
    setBlindspots((prev) => prev.filter((b) => b.id !== id));
    try { await resolveBlindSpot(id); } catch (err) { log.error(err instanceof Error ? err : new Error(String(err))); void load(); }
  }, [load]);

  return { userId, loading, busy, error, health, blindspots, refreshHealth, refreshBlindspots: refreshBlindspotsList, dismiss, resolve };
}
