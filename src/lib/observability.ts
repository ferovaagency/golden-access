import * as Sentry from '@sentry/react';

/**
 * Inicializa Sentry si hay DSN. Sin DSN es un no-op (dev y entornos sin
 * configurar), para no acoplar el arranque de la app a la observabilidad.
 */
export function initObservability() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
}
