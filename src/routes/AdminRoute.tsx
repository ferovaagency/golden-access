import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { initAuth } from '../lib/supabase';
import { isTeamMember } from '../lib/crmService';
import AuthScreen from '../components/AuthScreen';
import AdminCRM from '../components/AdminCRM';
import NotFound from '../components/NotFound';
import { logger } from '../lib/logger';

// Protected route for the internal Ferova CRM. Uses the team-member whitelist
// enforced by RLS as the real authorization boundary.
export default function AdminRoute() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTeam, setIsTeam] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      async (fUser) => {
        setUser(fUser);
        try {
          const team = await isTeamMember(fUser.email || '');
          setIsTeam(team);
        } catch (err) {
          logger.error(err, { scope: 'AdminRoute' });
          setIsTeam(false);
        }
        setLoading(false);
      },
      () => {
        setUser(null);
        setIsTeam(null);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }
  if (!user) return <AuthScreen />;
  if (isTeam === false) return <NotFound />;
  return <AdminCRM user={user} />;
}
