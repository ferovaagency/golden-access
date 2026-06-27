import React, { useState } from 'react';
import { Loader2, AlertCircle, Mail, Lock, Building2 } from 'lucide-react';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
} from '../lib/supabase';

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signInWithEmail(email, password);
        if (error) throw error;
      } else {
        const { data, error } = await signUpWithEmail(email, password);
        if (error) throw error;
        if (!data.session) {
          setInfo('Revisa tu correo para confirmar tu cuenta.');
        }
      }
    } catch (err: any) {
      setError(err?.message ?? 'Ocurrió un error.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo iniciar con Google.');
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{ backgroundColor: '#0f0e0c' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 shadow-2xl"
        style={{ backgroundColor: '#1a1814', border: '1px solid #2a2620' }}
      >
        <div className="flex flex-col items-center text-center mb-6">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
            style={{
              backgroundColor: 'rgba(201,169,97,0.12)',
              border: '1px solid #c9a961',
            }}
          >
            <Building2 className="w-7 h-7" style={{ color: '#c9a961' }} />
          </div>
          <h1 className="text-2xl font-bold text-white">Ferova OS</h1>
          <p className="text-sm text-zinc-400 mt-1">
            {mode === 'login' ? 'Inicia sesión en tu cuenta' : 'Crea tu cuenta'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition mb-4 disabled:opacity-50"
          style={{
            backgroundColor: '#c9a961',
            color: '#0f0e0c',
          }}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 48 48">
              <path
                fill="#0f0e0c"
                d="M44.5 20H24v8.5h11.7C34.7 33 30 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l6-6C34.4 5.3 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.5 20-21 0-1.4-.2-2.7-.5-4z"
              />
            </svg>
          )}
          Continuar con Google
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1" style={{ backgroundColor: '#2a2620' }} />
          <span className="text-xs text-zinc-500">o con email</span>
          <div className="h-px flex-1" style={{ backgroundColor: '#2a2620' }} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@empresa.com"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-1"
              style={{
                backgroundColor: '#0f0e0c',
                border: '1px solid #2a2620',
              }}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-1"
              style={{
                backgroundColor: '#0f0e0c',
                border: '1px solid #2a2620',
              }}
            />
          </div>

          {error && (
            <div
              className="p-2.5 rounded-lg text-xs flex items-start gap-2"
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
          {info && (
            <div
              className="p-2.5 rounded-lg text-xs"
              style={{
                backgroundColor: 'rgba(201,169,97,0.1)',
                border: '1px solid rgba(201,169,97,0.4)',
                color: '#c9a961',
              }}
            >
              {info}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg font-medium text-white transition disabled:opacity-50"
            style={{ backgroundColor: '#2a2620', border: '1px solid #3a3530' }}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : mode === 'login' ? (
              'Iniciar sesión'
            ) : (
              'Crear cuenta'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-500 mt-4">
          {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
              setInfo(null);
            }}
            className="font-medium hover:underline"
            style={{ color: '#c9a961' }}
          >
            {mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>
        </p>
      </div>
    </div>
  );
}
