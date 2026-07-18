import { useEffect, useState } from 'react';
import { getFiscalProfile, upsertFiscalProfile, type FiscalProfile } from '../lib/fiscalProfileService';

export function useFiscalProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<FiscalProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    getFiscalProfile(userId)
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch((e) => { if (!cancelled) setError(String(e?.message || e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  const save = async (patch: Partial<FiscalProfile>) => {
    if (!userId) return;
    const next = await upsertFiscalProfile(userId, { ...(profile || {}), ...patch });
    setProfile(next);
  };

  return { profile, loading, error, save };
}
