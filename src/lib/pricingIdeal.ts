import type { Servicio } from '../types';

/**
 * Precio ideal recomendado por servicio.
 *
 * Fórmula visible:
 *   overhead_por_unidad = costo fijo asignado al servicio (herramientas + nómina)
 *   costo_total_unitario = costo_entrega_estimado (o costo_unitario) + overhead_por_unidad
 *   precio_ideal = costo_total_unitario / (1 - margen_objetivo)
 *
 * Protecciones:
 * - Si no hay costo, retorna `null` con motivo "costo desconocido".
 * - Si margen >= 1 o negativo, se ignora y se marca "margen inválido".
 * - Nunca sobreescribe `precio_habitual` ni `precio_ofrecido` (solo sugiere).
 */
export interface PrecioIdealResult {
  precioIdeal: number | null;
  costoUnitario: number;
  overheadPorUnidad: number;
  costoTotalUnitario: number;
  margenAplicado: number;
  formulaHumana: string;
  notas: string[];
  vsHabitual: number | null;
  vsOfrecido: number | null;
}

export function calcularPrecioIdeal(
  servicio: Servicio,
  overheadPorUnidad: number,
  margenPorDefecto = 0.30,
): PrecioIdealResult {
  const notas: string[] = [];
  const costoUnitario = servicio.costo_entrega_estimado ?? servicio.costo_unitario ?? 0;
  const overhead = Math.max(overheadPorUnidad || 0, 0);
  const costoTotalUnitario = costoUnitario + overhead;

  const margenDefault = margenPorDefecto > 0 && margenPorDefecto < 1 ? margenPorDefecto : 0.30;
  const margenDefaultPct = `${(margenDefault * 100).toFixed(0)} %`;
  const margenRaw = servicio.margen_objetivo;
  let margenAplicado = margenDefault;
  if (margenRaw != null) {
    if (margenRaw <= 0) notas.push(`Margen objetivo en 0 o negativo — se usa ${margenDefaultPct} por defecto.`);
    else if (margenRaw >= 1) notas.push(`Margen objetivo ≥ 100 % — se usa ${margenDefaultPct} por defecto.`);
    else margenAplicado = margenRaw;
  } else {
    notas.push(`Sin margen objetivo configurado — se usa ${margenDefaultPct} por defecto (margen mínimo de tu configuración).`);
  }

  let precioIdeal: number | null = null;
  if (costoTotalUnitario <= 0) {
    notas.push('Costo total en cero — cargá costo de entrega para calcular el precio ideal.');
  } else {
    const denom = 1 - margenAplicado;
    if (denom > 0) precioIdeal = costoTotalUnitario / denom;
  }

  const vsHabitual = servicio.precio_habitual && precioIdeal ? precioIdeal - servicio.precio_habitual : null;
  const vsOfrecido = servicio.precio_ofrecido && precioIdeal ? precioIdeal - servicio.precio_ofrecido : null;

  const formulaHumana = `(${Math.round(costoUnitario)} costo entrega + ${Math.round(overhead)} overhead) ÷ (1 − ${(margenAplicado * 100).toFixed(0)}%)`;

  return {
    precioIdeal,
    costoUnitario,
    overheadPorUnidad: overhead,
    costoTotalUnitario,
    margenAplicado,
    formulaHumana,
    notas,
    vsHabitual,
    vsOfrecido,
  };
}
