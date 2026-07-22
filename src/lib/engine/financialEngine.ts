/**
 * Motor financiero centralizado (Fase 2 del Manual maestro de implementación,
 * Apéndice A.2 y A.5). Fórmulas tomadas literalmente de la Parte 4 del
 * manual. Construido DELIBERADAMENTE junto a los cálculos existentes
 * (calculations.ts, cashflowService.ts, pricingIdeal.ts, roiCalc.ts), no en
 * su reemplazo -- el propio manual (sección 3.6) pide comparar resultados
 * viejo/nuevo en paralelo antes de centralizar, precisamente porque
 * docs/METRICS_CATALOG.md encontró 4 nociones de "ingreso" coexistiendo a
 * propósito (contratado/causado/cobrado/COGS-congelado) que deben
 * reconciliarse por decisión explícita, no por refactor automático.
 *
 * Cada función sigue el principio de "no calculable != 0" (sección 4.16):
 * cuando falta un dato o el resultado no tiene sentido matemático, devuelve
 * null/estado explícito en vez de fingir un cero.
 */

function safeDiv(numerator: number, denominator: number): number {
  return denominator === 0 || !Number.isFinite(denominator) ? 0 : numerator / denominator;
}

// ============================================================
// 4.3 — Tarifa mínima saludable
// ============================================================
export type PerfilNegocio = 'freelancer' | 'consultor' | 'agencia';

/** Proporción facturable inicial por perfil -- supuesto explícito, reemplazable por datos reales. */
export const PCT_FACTURABLE_POR_PERFIL: Record<PerfilNegocio, number> = {
  freelancer: 0.60,
  consultor: 0.55,
  agencia: 0.50,
};

export interface HealthyHourlyRateInput {
  horasDisponiblesSemanales: number;
  compensacionMensualDeseada: number;
  gastoMensualNegocio: number;
  /** 0-1. Si no se da, se usa el default del perfil. */
  pctFacturable?: number;
  perfil?: PerfilNegocio;
  /** 0-1, default 0.20 (sección 4.3: "puede ser 20%, estimación configurable"). */
  pctReserva?: number;
}

export interface HealthyHourlyRateResult {
  horasDisponiblesMensuales: number;
  horasFacturables: number;
  baseMensualMinima: number;
  reservaInicial: number;
  facturacionObjetivoMinima: number;
  tarifaMinimaSaludable: number | null;
  formulaHumana: string;
  notas: string[];
}

export function calculateHealthyHourlyRate(input: HealthyHourlyRateInput): HealthyHourlyRateResult {
  const notas: string[] = [];
  const pctFacturable = input.pctFacturable ?? (input.perfil ? PCT_FACTURABLE_POR_PERFIL[input.perfil] : PCT_FACTURABLE_POR_PERFIL.freelancer);
  const pctReserva = input.pctReserva ?? 0.20;

  const horasDisponiblesMensuales = input.horasDisponiblesSemanales * 4.33;
  const horasFacturables = horasDisponiblesMensuales * pctFacturable;
  const baseMensualMinima = input.compensacionMensualDeseada + input.gastoMensualNegocio;
  const reservaInicial = baseMensualMinima * pctReserva;
  const facturacionObjetivoMinima = baseMensualMinima + reservaInicial;

  let tarifaMinimaSaludable: number | null = null;
  if (horasFacturables <= 0) {
    notas.push('Horas facturables en cero o negativas -- no calculable.');
  } else {
    tarifaMinimaSaludable = facturacionObjetivoMinima / horasFacturables;
  }

  return {
    horasDisponiblesMensuales,
    horasFacturables,
    baseMensualMinima,
    reservaInicial,
    facturacionObjetivoMinima,
    tarifaMinimaSaludable,
    formulaHumana: `(${Math.round(baseMensualMinima)} base + ${Math.round(reservaInicial)} reserva) ÷ ${horasFacturables.toFixed(1)}h facturables/mes`,
    notas,
  };
}

// ============================================================
// 4.5 — Costo por hora, servicio y cliente
// ============================================================
export interface HourlyCostInput {
  costoMensualPersona: number;
  horasProductivasMensuales: number;
}

export function calculateHourlyCost({ costoMensualPersona, horasProductivasMensuales }: HourlyCostInput): number | null {
  if (horasProductivasMensuales <= 0) return null; // no calculable, no cero
  return costoMensualPersona / horasProductivasMensuales;
}

export interface ServiceProfitabilityInput {
  precioNeto: number;
  horasReales: number;
  costoInternoPorHora: number;
  costoTerceros?: number;
  costoHerramientasAtribuibles?: number;
  comisiones?: number;
  gastosDirectos?: number;
}

export interface ServiceProfitabilityResult {
  costoTiempo: number;
  costoRealServicio: number;
  tarifaEfectiva: number | null;
  margenServicio: number | null;
  semaforo: 'critico' | 'bajo' | 'saludable' | 'alto' | null;
  formulaHumana: string;
}

/** Semáforo de margen de la sección 4.5 (umbrales configurables, estos son el default del manual). */
export function semaforoMargen(margen: number | null): ServiceProfitabilityResult['semaforo'] {
  if (margen === null) return null;
  if (margen < 0.15) return 'critico';
  if (margen < 0.30) return 'bajo';
  if (margen < 0.50) return 'saludable';
  return 'alto';
}

export function calculateServiceProfitability(input: ServiceProfitabilityInput): ServiceProfitabilityResult {
  const costoTiempo = input.horasReales * input.costoInternoPorHora;
  const costoRealServicio = costoTiempo
    + (input.costoTerceros || 0)
    + (input.costoHerramientasAtribuibles || 0)
    + (input.comisiones || 0)
    + (input.gastosDirectos || 0);

  const tarifaEfectiva = input.horasReales > 0 ? input.precioNeto / input.horasReales : null;
  const margenServicio = input.precioNeto > 0 ? (input.precioNeto - costoRealServicio) / input.precioNeto : null;

  return {
    costoTiempo,
    costoRealServicio,
    tarifaEfectiva,
    margenServicio,
    semaforo: semaforoMargen(margenServicio),
    formulaHumana: `(${Math.round(input.precioNeto)} precio neto − ${Math.round(costoRealServicio)} costo real) ÷ ${Math.round(input.precioNeto)}`,
  };
}

export interface ClientProfitabilityInput {
  ingresoNetoCliente: number;
  horasRealesCliente: number;
  costoInternoPorHora: number;
  costoTercerosCliente?: number;
  gastosDirectosCliente?: number;
}

/** Misma fórmula que calculateServiceProfitability, aplicada a la agregación por cliente (sección 4.5). */
export function calculateClientProfitability(input: ClientProfitabilityInput): ServiceProfitabilityResult {
  return calculateServiceProfitability({
    precioNeto: input.ingresoNetoCliente,
    horasReales: input.horasRealesCliente,
    costoInternoPorHora: input.costoInternoPorHora,
    costoTerceros: input.costoTercerosCliente,
    gastosDirectos: input.gastosDirectosCliente,
  });
}

// ============================================================
// 4.6 — Capacidad y punto de equilibrio
// ============================================================
export interface CapacityInput {
  capacidadMensualHoras: number;
  pctFacturableReal: number;
  capacidadComprometidaHoras: number;
  horasFacturablesTrabajadas: number;
}

export interface CapacityResult {
  capacidadFacturable: number;
  disponibilidad: number;
  utilizacion: number | null;
  lectura: 'ociosa' | 'operativo' | 'saturacion' | 'alto_riesgo' | null;
}

export function calculateCapacity(input: CapacityInput): CapacityResult {
  const capacidadFacturable = input.capacidadMensualHoras * input.pctFacturableReal;
  const disponibilidad = capacidadFacturable - input.capacidadComprometidaHoras;
  const utilizacion = capacidadFacturable > 0 ? input.horasFacturablesTrabajadas / capacidadFacturable : null;

  let lectura: CapacityResult['lectura'] = null;
  if (utilizacion !== null) {
    if (utilizacion < 0.50) lectura = 'ociosa';
    else if (utilizacion <= 0.80) lectura = 'operativo';
    else if (utilizacion <= 0.90) lectura = 'saturacion';
    else lectura = 'alto_riesgo';
  }

  return { capacidadFacturable, disponibilidad, utilizacion, lectura };
}

export interface BreakEvenInput {
  gastosFijos: number;
  margenContribucion: number;
  ingresosNetos: number;
}

export interface BreakEvenResult {
  ratioContribucion: number | null;
  puntoEquilibrioVentas: number | null;
  notas: string[];
}

// ============================================================
// 4.7 — Caja, cartera y cobro esperado ponderado
// ============================================================
/**
 * Probabilidad de cobro por antigüedad (tabla exacta de la sección 4.7).
 * "Confirmado con fecha" y "en disputa" no tienen equivalente directo en el
 * modelo de datos actual (Receivable.estado no distingue esos casos), así
 * que se acercan por fecha de vencimiento -- ver notas en el resultado.
 */
export function estimateCollectionProbability(diasVencido: number | null, cancelada: boolean): number {
  if (cancelada) return 0;
  if (diasVencido === null) return 0.95; // sin fecha de vencimiento: se asume confirmado
  if (diasVencido <= 0) return 0.85; // aún dentro de plazo
  if (diasVencido <= 15) return 0.70;
  if (diasVencido <= 30) return 0.50;
  return 0.25;
}

export interface WeightedReceivableInput {
  saldo: number;
  vencimiento: string | null;
  cancelada: boolean;
  hoy?: string; // ISO date opcional, para que las pruebas no dependan de la fecha real del reloj
}

export interface WeightedReceivableResult {
  probabilidad: number;
  cobroEsperado: number;
  diasVencido: number | null;
}

export function calculateWeightedReceivable({ saldo, vencimiento, cancelada, hoy }: WeightedReceivableInput): WeightedReceivableResult {
  const today = hoy ? new Date(hoy) : new Date();
  const diasVencido = vencimiento ? Math.floor((today.getTime() - new Date(vencimiento).getTime()) / 86_400_000) : null;
  const probabilidad = estimateCollectionProbability(diasVencido, cancelada);
  return { probabilidad, cobroEsperado: saldo * probabilidad, diasVencido };
}

export function calculateBreakEven({ gastosFijos, margenContribucion, ingresosNetos }: BreakEvenInput): BreakEvenResult {
  const notas: string[] = [];
  const ratioContribucion = ingresosNetos > 0 ? margenContribucion / ingresosNetos : null;
  if (ratioContribucion === null) notas.push('Sin ingresos netos en el periodo -- ratio de contribución no calculable.');

  let puntoEquilibrioVentas: number | null = null;
  if (ratioContribucion === null) {
    // ya notado arriba
  } else if (ratioContribucion <= 0) {
    notas.push('Margen de contribución en cero o negativo -- el equilibrio es matemáticamente imposible con esta estructura de precios/costos, no "1 unidad".');
  } else {
    puntoEquilibrioVentas = gastosFijos / ratioContribucion;
  }

  return { ratioContribucion, puntoEquilibrioVentas, notas };
}
