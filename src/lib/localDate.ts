// Fecha civil (YYYY-MM-DD) en la zona del negocio. Evita toISOString(),
// que usa UTC y adelanta el día después de las 7 p.m. en Bogotá.
export const DEFAULT_TZ = 'America/Bogota';

export function todayLocal(timeZone: string = DEFAULT_TZ, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  }
}
