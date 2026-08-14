import * as Sentry from '@sentry/react';
import { onError } from './logger';

let activo = false;

/**
 * Inicializa Sentry si hay DSN. Sin DSN es un no-op (dev y entornos sin
 * configurar), para no acoplar el arranque de la app a la observabilidad.
 *
 * Se engancha a `logger.onError` en vez de tocar los sitios de llamada: todo lo
 * que ya pasa por `logger.error` —incluido el ErrorBoundary de la aplicación—
 * llega a Sentry sin repetir código en cada módulo.
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
  activo = true;

  onError((scope, error, context) => {
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
      tags: { scope },
      extra: context,
    });
  });
}

/**
 * Quién estaba usando la aplicación cuando algo falló. Sin esto, un error en
 * producción no se puede reproducir: se sabe qué se rompió pero no a quién.
 *
 * Se envía el id y el correo, que es lo mínimo para poder responderle a esa
 * persona. Nada de contenido del negocio.
 */
export function identifyUser(user: { id: string; email?: string | null } | null) {
  if (!activo) return;
  if (!user) { Sentry.setUser(null); return; }
  Sentry.setUser({ id: user.id, email: user.email ?? undefined });
}

/** La empresa sobre la que se estaba trabajando: sin esto, un fallo del holding
 *  dentro de una empresa hija es indistinguible de uno en su propia cuenta. */
export function setActiveAccount(accountId: string | null) {
  if (!activo) return;
  Sentry.setTag('account_id', accountId ?? 'propia');
}
