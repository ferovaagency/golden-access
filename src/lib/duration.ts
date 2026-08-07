/**
 * Duración legible. Internamente el sistema siempre persiste horas decimales
 * (finance_horas.horas), pero la persona piensa en "90 min" o "1 h 30 min".
 * Estas utilidades traducen entre ambos mundos sin cambiar el formato de datos.
 */

/** Convierte horas decimales a minutos enteros. */
export function hoursToMinutes(hours: number): number {
  return Math.round((Number(hours) || 0) * 60);
}

/** Convierte minutos a horas decimales (formato de persistencia). */
export function minutesToHours(minutes: number): number {
  return (Number(minutes) || 0) / 60;
}

/** "1 h 30 min", "45 min", "2 h". */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

/** Igual que formatMinutes pero partiendo de horas decimales. */
export function formatHours(hours: number): string {
  return formatMinutes(hoursToMinutes(hours));
}

/** "90 min = 1 h 30 min" — equivalencia explícita para formularios. */
export function describeDuration(value: number, unit: 'horas' | 'minutos'): string {
  const minutes = unit === 'minutos' ? Math.round(Number(value) || 0) : hoursToMinutes(value);
  const decimal = (minutes / 60).toFixed(2);
  return unit === 'minutos'
    ? `${minutes} min = ${formatMinutes(minutes)} (${decimal} h decimales)`
    : `${Number(value) || 0} h = ${formatMinutes(minutes)} (${minutes} min)`;
}
