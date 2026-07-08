import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { googleSignIn, emailSignIn, emailSignUp } from '../lib/supabase';

export default function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleGoogle = async () => {
    setError(null);
    try {
      await googleSignIn();
    } catch (e: any) {
      setError(e.message || 'Error al autenticar con Google.');
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'signin') {
        await emailSignIn(email, password);
      } else {
        await emailSignUp(email, password);
        setInfo('Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.');
      }
    } catch (e: any) {
      setError(e.message || 'No se pudo procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] bg-[linear-gradient(135deg,#f7f8fb_0%,#eef6ff_52%,#f8fbf4_100%)] flex flex-col justify-center items-center p-4 text-slate-900 font-sans">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 space-y-6 shadow-2xl shadow-slate-200/70 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-blue-600" />

        <div className="space-y-2.5 text-center">
          <h1 className="text-2xl font-bold font-display tracking-tight text-slate-950">
            Ferova OS Financiero
          </h1>
          <p className="text-sm text-slate-500">
            Finanzas, Growth CRM y asistente IA para operar con claridad
          </p>
        </div>

        <button
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 font-semibold font-sans py-3 rounded-2xl transition cursor-pointer shadow-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5.04c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24.5 12 .5c-4.7 0-8.75 2.69-10.72 6.61l3.99 3.09C6.21 7.15 8.87 5.04 12 5.04z" />
            <path fill="#4285F4" d="M23.25 12c0-.78-.07-1.62-.23-2.39H12v4.52h6.38c-.28 1.47-1.11 2.7-2.35 3.53l3.65 2.83c2.13-1.97 3.57-4.87 3.57-8.49z" />
            <path fill="#FBBC05" d="M5.27 14.3c-.24-.72-.38-1.5-.38-2.3s.14-1.58.38-2.3L1.28 6.61C.46 8.23 0 10.06 0 12s.46 3.77 1.28 5.39l3.99-3.09z" />
            <path fill="#34A853" d="M12 23.5c3.24 0 5.96-1.07 7.94-2.91l-3.65-2.83c-1.04.7-2.38 1.11-4.29 1.11-3.13 0-5.79-2.11-6.74-5.2l-3.99 3.09C3.25 20.81 7.3 23.5 12 23.5z" />
          </svg>
          <span>Continuar con Google</span>
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="flex-1 h-px bg-slate-200" />o<div className="flex-1 h-px bg-slate-200" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <input
            type="email"
            required
            placeholder="correo@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl px-3 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl px-3 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />

          {error && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded p-2">
              {error}
            </p>
          )}
          {info && (
            <p className="text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 rounded p-2">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-2xl transition disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setInfo(null);
          }}
          className="w-full text-sm text-slate-500 hover:text-blue-700"
        >
          {mode === 'signin'
            ? '¿No tienes cuenta? Regístrate'
            : '¿Ya tienes cuenta? Inicia sesión'}
        </button>

        <p className="text-xs text-slate-400 text-center pt-2">
          Mafe © 2026 | Bogotá D.C., Colombia
        </p>
      </div>
    </div>
  );
}
