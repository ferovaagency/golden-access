import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { googleSignIn, emailSignIn, emailSignUp } from '../lib/supabase';
import { trackEvent } from '../lib/analytics';

export default function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleGoogle = async () => {
    setError(null);
    // Google redirige la pagina de inmediato -- no hay forma de distinguir
    // signup vs login en este click (recien se sabe al volver, comparando
    // user.created_at). Se cuenta como login_click; signup_complete real
    // solo se rastrea hoy para el flujo de email.
    trackEvent('login_click', { method: 'google' });
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
        trackEvent('login_click', { method: 'email' });
        await emailSignIn(email, password);
      } else {
        trackEvent('signup_start', { method: 'email' });
        await emailSignUp(email, password);
        trackEvent('signup_complete', { method: 'email' });
        setInfo('Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.');
      }
    } catch (e: any) {
      setError(e.message || 'No se pudo procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--fv-canvas)] p-4 font-sans text-[var(--fv-ink)] sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,.12),transparent_70%)]" />
      <div className="relative w-full max-w-md space-y-6 rounded-[var(--fv-radius-xl)] border border-[var(--fv-line)] bg-[var(--fv-surface)] p-6 shadow-[var(--fv-shadow-lg)] sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-[var(--fv-radius-xl)] bg-[var(--fv-brand)]" />

        <div className="space-y-2.5 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[var(--ferova-brand)] font-display text-lg font-bold text-white shadow-sm">F</span>
          <h1 className="text-balance text-2xl font-bold font-display tracking-tight text-[var(--fv-ink)]">
            Ferova One
          </h1>
          <p className="text-sm text-slate-500">
            Finanzas, Growth CRM y asistente IA para operar con claridad
          </p>
        </div>

        <button
          onClick={handleGoogle}
          className="flex w-full items-center justify-center gap-3 rounded-[var(--fv-radius-md)] border border-[var(--fv-line)] bg-[var(--fv-surface)] py-3 font-sans font-semibold text-[var(--fv-ink)] shadow-sm transition-colors hover:border-blue-200 hover:bg-[var(--fv-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fv-brand)] focus-visible:ring-offset-2"
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

        <form onSubmit={handleEmail} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="auth-email" className="text-xs font-semibold text-[var(--fv-ink-2)]">Correo de trabajo</label>
            <input
            id="auth-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            spellCheck={false}
            placeholder="correo@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-[var(--fv-radius-md)] border border-[var(--fv-line)] bg-[var(--fv-surface)] px-3 py-3 text-sm text-[var(--fv-ink)] placeholder:text-[var(--fv-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fv-brand)] focus-visible:ring-offset-1"
          />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="auth-password" className="text-xs font-semibold text-[var(--fv-ink-2)]">Contraseña</label>
            <input
            id="auth-password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-[var(--fv-radius-md)] border border-[var(--fv-line)] bg-[var(--fv-surface)] px-3 py-3 text-sm text-[var(--fv-ink)] placeholder:text-[var(--fv-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fv-brand)] focus-visible:ring-offset-1"
          />
          </div>

          {error && (
            <p role="alert" className="rounded-[var(--fv-radius-xs)] border border-red-200 bg-[var(--fv-danger-soft)] p-2.5 text-xs text-[var(--fv-danger)]">
              {error}
            </p>
          )}
          {info && (
            <p role="status" aria-live="polite" className="rounded-[var(--fv-radius-xs)] border border-emerald-200 bg-[var(--fv-success-soft)] p-2.5 text-xs text-[var(--fv-success)]">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--fv-radius-md)] bg-[var(--fv-brand)] py-3 font-semibold text-white transition-colors hover:bg-[var(--fv-brand-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fv-brand)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
          className="w-full rounded-[var(--fv-radius-xs)] py-1 text-sm text-[var(--fv-muted)] transition-colors hover:text-[var(--fv-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fv-brand)]"
        >
          {mode === 'signin'
            ? '¿No tienes cuenta? Regístrate'
            : '¿Ya tienes cuenta? Inicia sesión'}
        </button>

        <p className="text-xs text-slate-400 text-center pt-2 leading-relaxed">
          Al usar Ferova One puedes consultar la <a href="/privacidad" target="_blank" rel="noreferrer" className="underline hover:text-blue-700">Política de Tratamiento de Datos</a> y los <a href="/terminos" target="_blank" rel="noreferrer" className="underline hover:text-blue-700">Términos y Condiciones</a>.<br />
          Mafe © 2026 · Bogotá D.C., Colombia
        </p>
      </div>
    </main>
  );
}
