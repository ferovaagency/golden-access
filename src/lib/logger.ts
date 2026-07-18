// Centralized logger. Replaces scattered console.log/error usage.
// - In dev: pretty console output at all levels.
// - In prod: only warn/error reach console; info/debug are dropped unless VITE_LOG_LEVEL is set.
// - Every log includes a scope so we can grep by module (e.g. "[finance]", "[whatsapp]").
// - Exposes hook points (onError) that future error-reporting integrations can subscribe to
//   without touching call sites.

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function resolveMinLevel(): Level {
  const raw = (import.meta.env.VITE_LOG_LEVEL as string | undefined)?.toLowerCase();
  if (raw && raw in LEVEL_ORDER) return raw as Level;
  return import.meta.env.PROD ? 'warn' : 'debug';
}

const MIN_LEVEL = resolveMinLevel();

type ErrorHook = (scope: string, error: unknown, context?: Record<string, unknown>) => void;
const errorHooks: ErrorHook[] = [];

export function onError(hook: ErrorHook) {
  errorHooks.push(hook);
  return () => {
    const i = errorHooks.indexOf(hook);
    if (i >= 0) errorHooks.splice(i, 1);
  };
}

function shouldLog(level: Level) {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

function emit(level: Level, scope: string, args: unknown[]) {
  if (!shouldLog(level)) return;
  const tag = `[${scope}]`;
  // eslint-disable-next-line no-console
  const fn = level === 'debug' ? console.debug : level === 'info' ? console.info : level === 'warn' ? console.warn : console.error;
  fn(tag, ...args);
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (err: unknown, context?: Record<string, unknown>) => void;
  child: (subScope: string) => Logger;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (...args) => emit('debug', scope, args),
    info: (...args) => emit('info', scope, args),
    warn: (...args) => emit('warn', scope, args),
    error: (err, context) => {
      emit('error', scope, context ? [err, context] : [err]);
      for (const hook of errorHooks) {
        try { hook(scope, err, context); } catch { /* hook failures must not cascade */ }
      }
    },
    child: (subScope) => createLogger(`${scope}:${subScope}`),
  };
}

export const logger = createLogger('app');
