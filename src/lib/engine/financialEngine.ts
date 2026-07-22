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

export interface CashPositionInput {
  saldoActual: number;
  egresosComprometidos: number;
}

export interface CashPositionResult {
  cajaDisponible: number;
}

/** Caja que permanece después de obligaciones ya registradas, no una proyección. */
export function calculateCashPosition({ saldoActual, egresosComprometidos }: CashPositionInput): CashPositionResult {
  return { cajaDisponible: saldoActual - Math.max(0, egresosComprometidos) };
}

export interface CashForecastInput {
  saldoInicial: number;
  cobrosEsperados: number;
  pagosEsperados: number;
}

export interface CashForecastResult {
  cajaProyectada: number;
}

/** Proyección explícita: saldo inicial + cobros ponderados - pagos esperados. */
export function calculateCashForecast({ saldoInicial, cobrosEsperados, pagosEsperados }: CashForecastInput): CashForecastResult {
  return { cajaProyectada: saldoInicial + Math.max(0, cobrosEsperados) - Math.max(0, pagosEsperados) };
}

// ============================================================
// 4.8 — CRM y pronóstico comercial
// ============================================================
export interface PipelineForecastInput {
  oportunidades: Array<{ valor: number | null | undefined; probabilidad: number | null | undefined }>;
  metaIngresos?: number;
  ticketPromedio?: number | null;
  tasaCierre?: number | null;
  tasaCalificacion?: number | null;
}

export interface PipelineForecastResult {
  pipelinePonderado: number;
  ventasNecesarias: number | null;
  propuestasNecesarias: number | null;
  leadsCalificadosNecesarios: number | null;
  notas: string[];
}

/**
 * Acepta probabilidad como fracción (0..1) o porcentaje (0..100), porque el
 * CRM actual guarda porcentaje. Los faltantes no se transforman en cierres.
 */
export function calculatePipelineForecast(input: PipelineForecastInput): PipelineForecastResult {
  const notas: string[] = [];
  const pipelinePonderado = input.oportunidades.reduce((sum, opportunity) => {
    const value = Number(opportunity.valor || 0);
    const rawProbability = opportunity.probabilidad;
    if (!Number.isFinite(value) || value <= 0 || rawProbability == null) return sum;
    const probability = Math.max(0, Math.min(1, rawProbability > 1 ? rawProbability / 100 : rawProbability));
    return sum + value * probability;
  }, 0);

  const meta = Number(input.metaIngresos || 0);
  if (meta <= 0) return { pipelinePonderado, ventasNecesarias: null, propuestasNecesarias: null, leadsCalificadosNecesarios: null, notas: ['Sin meta de ingresos: el pipeline ponderado es calculable, pero no las necesidades comerciales.'] };
  if (!input.ticketPromedio || input.ticketPromedio <= 0) {
    return { pipelinePonderado, ventasNecesarias: null, propuestasNecesarias: null, leadsCalificadosNecesarios: null, notas: ['Falta ticket promedio para calcular ventas necesarias.'] };
  }
  const ventasNecesarias = Math.ceil(meta / input.ticketPromedio);
  const tasaCierre = input.tasaCierre;
  const propuestasNecesarias = tasaCierre && tasaCierre > 0 ? Math.ceil(ventasNecesarias / tasaCierre) : null;
  const tasaCalificacion = input.tasaCalificacion;
  const leadsCalificadosNecesarios = propuestasNecesarias !== null && tasaCalificacion && tasaCalificacion > 0
    ? Math.ceil(propuestasNecesarias / tasaCalificacion) : null;
  if (propuestasNecesarias === null) notas.push('Falta tasa de cierre para calcular propuestas necesarias.');
  if (leadsCalificadosNecesarios === null) notas.push('Falta tasa de calificación para calcular leads necesarios.');
  return { pipelinePonderado, ventasNecesarias, propuestasNecesarias, leadsCalificadosNecesarios, notas };
}

// ============================================================
// 4.10 / 4.16 — provisión y conciliación explicables
// ============================================================
export interface TaxProvisionRule {
  taxpayerType: string;
  taxType: string;
  rate: number | null;
  validFrom?: string;
  validTo?: string | null;
  version?: number;
}

export interface TaxProvisionInput {
  baseEstimada: number;
  taxpayerType: string;
  taxType: string;
  rules: TaxProvisionRule[];
  date?: string;
}

export interface TaxProvisionResult {
  provision: number | null;
  rate: number | null;
  status: 'estimado' | 'no_calculable';
  note: string;
}

/** Selects the latest active version supplied by tax_rules; it never falls back to a frontend rate. */
export function calculateTaxProvision(input: TaxProvisionInput): TaxProvisionResult {
  const date = input.date || new Date().toISOString().slice(0, 10);
  const candidates = input.rules.filter((rule) => rule.taxType === input.taxType && (rule.taxpayerType === input.taxpayerType || rule.taxpayerType === 'todos'))
    .filter((rule) => (!rule.validFrom || rule.validFrom <= date) && (!rule.validTo || rule.validTo >= date))
    .sort((a, b) => (b.version || 1) - (a.version || 1));
  const rule = candidates[0];
  if (!rule || rule.rate == null || input.baseEstimada < 0) return { provision: null, rate: null, status: 'no_calculable', note: 'No hay una regla tributaria vigente con tasa para esta provisión.' };
  return { provision: input.baseEstimada * rule.rate, rate: rule.rate, status: 'estimado', note: `Estimado con regla versionada ${rule.version || 1}; no reemplaza la validación contable.` };
}

export interface ReconciliationInput {
  invoices: Array<{ id: string; total: number }>;
  payments: Array<{ id: string; amount: number; invoiceId?: string | null }>;
}

export interface ReconciliationResult {
  invoiceBalances: Array<{ invoiceId: string; balance: number }>;
  unmatchedPaymentIds: string[];
  overpaidInvoiceIds: string[];
}

/** Deterministic invoice-payment reconciliation; unlinked payments are never silently assigned. */
export function reconcileTransactions(input: ReconciliationInput): ReconciliationResult {
  const invoices = new Map(input.invoices.map((invoice) => [invoice.id, Math.max(0, invoice.total)]));
  const paid = new Map<string, number>();
  const unmatchedPaymentIds: string[] = [];
  for (const payment of input.payments) {
    if (!payment.invoiceId || !invoices.has(payment.invoiceId)) { unmatchedPaymentIds.push(payment.id); continue; }
    paid.set(payment.invoiceId, (paid.get(payment.invoiceId) || 0) + Math.max(0, payment.amount));
  }
  const invoiceBalances = [...invoices].map(([invoiceId, total]) => ({ invoiceId, balance: Math.max(0, total - (paid.get(invoiceId) || 0)) }));
  const overpaidInvoiceIds = [...invoices].filter(([invoiceId, total]) => (paid.get(invoiceId) || 0) > total).map(([invoiceId]) => invoiceId);
  return { invoiceBalances, unmatchedPaymentIds, overpaidInvoiceIds };
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
