// Período seleccionable para filtrar datos financieros.
// Compatible hacia atrás: un string suelto se interpreta como 'Todos' (histórico)
// o como prefijo 'YYYY-MM' (mes, formato antiguo). El formato nuevo es un rango
// inclusivo día-a-día { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }.
export type Period = string | { from: string; to: string };

/** ¿La fecha ('YYYY-MM-DD' o ISO) cae dentro del período? */
export function inPeriod(fecha: string | undefined | null, period: Period): boolean {
  if (!fecha) return false;
  if (period === 'Todos') return true;
  if (typeof period === 'string') return fecha.startsWith(period); // legacy 'YYYY-MM'
  const d = fecha.slice(0, 10);
  return d >= period.from && d <= period.to;
}

/** Clave estable (para keys de React, memos, animaciones) según el período. */
export function periodKey(period: Period): string {
  return typeof period === 'string' ? period : `${period.from}_${period.to}`;
}

export function samePeriod(a: Period, b: Period): boolean {
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  return a.from === b.from && a.to === b.to;
}

function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Atajos de período relativos a una fecha de referencia (hoy). */
export function periodPresets(today: Date): { key: string; label: string; period: Period }[] {
  const y = today.getFullYear();
  const m = today.getMonth();
  const q = Math.floor(m / 3);
  return [
    { key: 'month', label: 'Este mes', period: { from: isoLocal(new Date(y, m, 1)), to: isoLocal(new Date(y, m + 1, 0)) } },
    { key: 'quarter', label: 'Trimestre', period: { from: isoLocal(new Date(y, q * 3, 1)), to: isoLocal(new Date(y, q * 3 + 3, 0)) } },
    { key: 'year', label: 'Año', period: { from: isoLocal(new Date(y, 0, 1)), to: isoLocal(new Date(y, 11, 31)) } },
    { key: 'all', label: 'Todo', period: 'Todos' },
  ];
}
