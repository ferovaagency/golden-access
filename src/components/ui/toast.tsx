// Lightweight toast + confirm system. Replaces native alert()/confirm() so the
// app has consistent, non-blocking success/error UX and accessible modal
// confirmations. Zero external deps.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; kind: ToastKind; message: string; ttl: number };
type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type ToastCtx = {
  toast: (message: string, kind?: ToastKind, ttl?: number) => number;
  success: (message: string) => number;
  error: (message: string) => number;
  info: (message: string) => number;
  dismiss: (id: number) => void;
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>;
};

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

/** Convenience: normalizes any error/exception into a readable string. */
export function errMsg(err: unknown, fallback = 'Ocurrió un error inesperado.'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || fallback;
  const anyErr = err as { message?: unknown };
  if (typeof anyErr.message === 'string' && anyErr.message) return anyErr.message;
  try { return JSON.stringify(err); } catch { return fallback; }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<
    (ConfirmOptions & { resolve: (value: boolean) => void }) | null
  >(null);
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const push = useCallback((message: string, kind: ToastKind, ttl: number) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, kind, message, ttl }]);
    if (ttl > 0) {
      const t = setTimeout(() => dismiss(id), ttl);
      timers.current.set(id, t);
    }
    return id;
  }, [dismiss]);

  const value = useMemo<ToastCtx>(() => ({
    toast: (message, kind = 'info', ttl = 4500) => push(message, kind, ttl),
    success: (message) => push(message, 'success', 4000),
    error: (message) => push(message, 'error', 7000),
    info: (message) => push(message, 'info', 4500),
    dismiss,
    confirm: (opts) => new Promise<boolean>((resolve) => {
      const normalized: ConfirmOptions = typeof opts === 'string' ? { description: opts } : opts;
      setConfirmState({ ...normalized, resolve });
    }),
  }), [push, dismiss]);

  // Cleanup timers on unmount
  useEffect(() => () => { timers.current.forEach((t) => clearTimeout(t)); timers.current.clear(); }, []);

  const onConfirmClose = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };

  // Escape closes confirm as "cancel"
  useEffect(() => {
    if (!confirmState) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onConfirmClose(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmState]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      {confirmState && <ConfirmModal state={confirmState} onClose={onConfirmClose} />}
    </Ctx.Provider>
  );
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:top-6 sm:items-end sm:px-6"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => {
        const palette = {
          success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
          error: 'border-rose-200 bg-rose-50 text-rose-900',
          info: 'border-slate-200 bg-white text-slate-900',
        }[t.kind];
        const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertCircle : Info;
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 shadow-lg shadow-slate-900/5 backdrop-blur ${palette}`}
          >
            <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <p className="flex-1 whitespace-pre-line text-sm leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="rounded-md p-1 text-current/60 transition hover:bg-black/5"
              aria-label="Cerrar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ConfirmModal({
  state,
  onClose,
}: {
  state: ConfirmOptions & { resolve: (value: boolean) => void };
  onClose: (value: boolean) => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { confirmRef.current?.focus(); }, []);
  const title = state.title ?? '¿Confirmar acción?';
  const confirmText = state.confirmText ?? 'Continuar';
  const cancelText = state.cancelText ?? 'Cancelar';
  const confirmClass = state.destructive
    ? 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500'
    : 'bg-slate-900 hover:bg-slate-800 focus-visible:ring-slate-700';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(false); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="confirm-title" className="text-lg font-semibold text-slate-900">{title}</h2>
        {state.description && (
          <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{state.description}</p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onClose(true)}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition focus:outline-none focus-visible:ring-2 ${confirmClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Small inline spinner for buttons/status rows. */
export function InlineSpinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`h-4 w-4 animate-spin ${className}`} aria-hidden="true" />;
}
