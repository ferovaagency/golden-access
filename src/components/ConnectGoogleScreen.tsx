import React, { useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { googleSignIn, linkGoogleIdentity, logout } from '../lib/supabase';

interface Props {
  user: User;
}

export default function ConnectGoogleScreen({ user }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasGoogleIdentity = user.identities?.some((i) => i.provider === 'google');

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      if (hasGoogleIdentity) {
        await googleSignIn();
      } else {
        await linkGoogleIdentity();
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'No se pudo iniciar el flujo de Google.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] bg-[linear-gradient(135deg,#f7f8fb_0%,#eef6ff_52%,#f8fbf4_100%)] flex flex-col justify-center items-center p-4 text-slate-900 font-sans">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-6 shadow-2xl shadow-slate-200/70 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-blue-600" />

        <div className="space-y-2.5">
          <h1 className="text-2xl font-bold font-display tracking-tight text-slate-950">
            Conecta Google Workspace
          </h1>
          <p className="text-sm text-slate-500">
            Permisos: Sheets, Drive, Calendar y Gmail para reseñas
          </p>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed border-t border-b border-slate-100 py-4">
          Ferova OS guarda la operación en la base de datos y usa Google para importar/respaldar Sheets,
          crear citas en Calendar y leer notificaciones de reseñas en Gmail.
        </p>

        {error && (
          <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded p-2">
            {error}
          </p>
        )}

        <button
          onClick={handleConnect}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 font-semibold font-sans py-3 rounded-2xl transition cursor-pointer disabled:opacity-60 shadow-sm"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24.5 12 .5c-4.7 0-8.75 2.69-10.72 6.61l3.99 3.09C6.21 7.15 8.87 5.04 12 5.04z" />
              <path fill="#4285F4" d="M23.25 12c0-.78-.07-1.62-.23-2.39H12v4.52h6.38c-.28 1.47-1.11 2.7-2.35 3.53l3.65 2.83c2.13-1.97 3.57-4.87 3.57-8.49z" />
              <path fill="#FBBC05" d="M5.27 14.3c-.24-.72-.38-1.5-.38-2.3s.14-1.58.38-2.3L1.28 6.61C.46 8.23 0 10.06 0 12s.46 3.77 1.28 5.39l3.99-3.09z" />
              <path fill="#34A853" d="M12 23.5c3.24 0 5.96-1.07 7.94-2.91l-3.65-2.83c-1.04.7-2.38 1.11-4.29 1.11-3.13 0-5.79-2.11-6.74-5.2l-3.99 3.09C3.25 20.81 7.3 23.5 12 23.5z" />
            </svg>
          )}
          <span>
            {hasGoogleIdentity ? 'Reautorizar Google Workspace' : 'Conectar con Google Workspace'}
          </span>
        </button>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-500 truncate max-w-[60%]">
            {user.email}
          </span>
          <button
            onClick={() => logout()}
            className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1"
          >
            <LogOut className="w-3 h-3" /> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
