/**
 * Primitives estandarizadas de estados asíncronos.
 *
 * Reemplazan strings sueltos como "Cargando..." o "Error:" que están dispersos
 * en componentes. Todos aceptan `className` para adaptarse al contenedor.
 *
 * Uso típico:
 *   if (loading) return <LoadingState label="Cargando finanzas" />;
 *   if (error) return <ErrorState error={error} onRetry={reload} />;
 *   if (!data.length) return <EmptyState title="Sin ventas" hint="Registra la primera" />;
 */

import type { ReactNode } from 'react';

interface LoadingStateProps {
  label?: string;
  className?: string;
  /** Compacto para inline dentro de tablas o cards. */
  inline?: boolean;
}

export function LoadingState({ label = 'Cargando…', className = '', inline = false }: LoadingStateProps) {
  if (inline) {
    return (
      <span role="status" aria-live="polite" className={`inline-flex items-center gap-2 text-sm text-neutral-500 ${className}`}>
        <Spinner />
        {label}
      </span>
    );
  }
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-3 py-10 text-neutral-500 ${className}`}>
      <Spinner />
      <p className="text-sm">{label}</p>
    </div>
  );
}

interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ error, title = 'Algo salió mal', onRetry, className = '' }: ErrorStateProps) {
  const message = normalizeError(error);
  return (
    <div role="alert" className={`flex flex-col items-start gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-red-800 ${className}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-sm">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, hint, action, icon, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 py-10 text-center text-neutral-500 ${className}`}>
      {icon}
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      {hint && <p className="max-w-md text-xs">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

export function normalizeError(err: unknown): string {
  if (!err) return 'Error desconocido.';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const anyErr = err as { message?: string; error?: string; error_description?: string };
    return anyErr.message || anyErr.error_description || anyErr.error || JSON.stringify(err);
  }
  return String(err);
}
