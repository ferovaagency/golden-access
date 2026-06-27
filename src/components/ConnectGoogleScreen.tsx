import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { LogOut, Loader2, Link2, AlertCircle } from 'lucide-react';
import { signInWithGoogle, linkGoogleIdentity, signOut } from '../lib/supabase';

interface Props {
  user: User;
}

export default function ConnectGoogleScreen({ user }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGoogleUser = (user.app_metadata as any)?.provider === 'google';

  const handleConnect = async () => {
    setError(null);
    setLoading(true);
    try {
      // Si el usuario se registró con email, vinculamos Google a esa misma
      // cuenta (preserva user.id y la suscripción registrada en Supabase).
      // Si ya entró con Google pero el provider_token expiró, hacemos un
      // sign-in normal para refrescar el token con scopes de Sheets/Drive.
      const { error } = isGoogleUser
        ? await signInWithGoogle()
        : await linkGoogleIdentity();
      if (error) throw error;
    } catch (err: any) {
      setError(
        err?.message ??
          'No se pudo conectar Google. Revisa que el provider esté activo en Supabase.'
      );
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{ backgroundColor: '#0f0e0c' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center shadow-2xl"
        style={{ backgroundColor: '#1a1814', border: '1px solid #2a2620' }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{
            backgroundColor: 'rgba(201,169,97,0.12)',
            border: '1px solid #c9a961',
          }}
        >
          <Link2 className="w-8 h-8" style={{ color: '#c9a961' }} />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">
          Un paso más para entrar a Ferova OS
        </h1>
        <p className="text-sm text-zinc-400 mb-6">
          Tu pago está confirmado. Para sincronizar tus datos necesitamos
          conectar tu cuenta de <strong>Google Workspace</strong> con permisos
          de Sheets y Drive.
        </p>

        {error && (
          <div
            className="mb-4 p-2.5 rounded-lg text-xs flex items-start gap-2 text-left"
            style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#fca5a5',
            }}
          >
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleConnect}
          disabled={loading}
          className="w-full py-3 rounded-lg font-semibold transition disabled:opacity-50 mb-3"
          style={{ backgroundColor: '#c9a961', color: '#0f0e0c' }}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          ) : (
            'Conectar con Google Workspace'
          )}
        </button>

        <div className="flex items-center justify-between text-xs text-zinc-500 mt-4">
          <span>{user.email}</span>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1 hover:text-zinc-300 transition"
          >
            <LogOut className="w-3 h-3" /> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
