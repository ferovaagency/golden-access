import { useEffect, useState } from 'react';
import { useFiscalProfile } from '../hooks/useFiscalProfile';
import { supabase } from '../lib/supabase';

export default function FiscalProfileSection({ userId: userIdProp }: { userId?: string } = {}) {
  const [userId, setUserId] = useState<string | undefined>(userIdProp);
  useEffect(() => {
    if (userIdProp) return;
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, [userIdProp]);
  const { profile, save, loading } = useFiscalProfile(userId);
  if (loading || !profile) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-slate-900">Perfil fiscal</h3>
      <p className="text-xs text-slate-500 mb-3">Determina qué reglas fiscales aplican a tus cálculos. Por ahora solo Colombia tiene reglas cargadas; otros países quedan disponibles para configuración futura.</p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="block">
          <span className="text-[11px] font-semibold text-slate-500">País</span>
          <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" value={profile.country} onChange={(e) => save({ country: e.target.value })}>
            <option value="CO">Colombia</option>
            <option value="MX">México (próximamente)</option>
            <option value="AR">Argentina (próximamente)</option>
            <option value="ES">España (próximamente)</option>
            <option value="US">Estados Unidos (próximamente)</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold text-slate-500">Tipo de persona</span>
          <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" value={profile.person_type} onChange={(e) => save({ person_type: e.target.value as any })}>
            <option value="natural">Persona natural</option>
            <option value="juridica">Persona jurídica</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold text-slate-500">Régimen</span>
          <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" value={profile.regime} onChange={(e) => save({ regime: e.target.value as any })}>
            <option value="simple">Régimen simple</option>
            <option value="ordinario">Régimen ordinario</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold text-slate-500">Moneda base</span>
          <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" value={profile.currency_base} onChange={(e) => save({ currency_base: e.target.value })}>
            <option>COP</option><option>USD</option><option>MXN</option><option>ARS</option><option>EUR</option>
          </select>
        </label>
      </div>
    </div>
  );
}
