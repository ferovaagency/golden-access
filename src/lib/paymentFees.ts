import type { Venta } from '../types';

export interface PaymentFeeBreakdown {
  bruto: number;
  comisionPorcentaje: number;
  comisionFija: number;
  costoRetiro: number;
  totalDescuentos: number;
  netoOrigen: number;
  netoCop: number;
  tasaCop: number;
}

/**
 * Desglosa el dinero que realmente llega después de la pasarela. Los cargos
 * fijos y de retiro se registran en la misma moneda de la venta; la TRM solo
 * se aplica al final para no mezclar monedas durante el cálculo.
 */
export function calculatePaymentFees(
  sale: Pick<Venta, 'cantidad' | 'precio_venta_unitario' | 'moneda' | 'comision_pasarela_porcentaje' | 'comision_pasarela_fija' | 'comision_retiro' | 'trm_conversion'>,
  defaultTrm: number,
): PaymentFeeBreakdown {
  const bruto = Math.max(0, Number(sale.precio_venta_unitario || 0) * Number(sale.cantidad || 0));
  const rate = Math.max(0, Number(sale.comision_pasarela_porcentaje || 0));
  const comisionPorcentaje = bruto * rate / 100;
  const comisionFija = Math.max(0, Number(sale.comision_pasarela_fija || 0));
  const costoRetiro = Math.max(0, Number(sale.comision_retiro || 0));
  const totalDescuentos = Math.min(bruto, comisionPorcentaje + comisionFija + costoRetiro);
  const netoOrigen = Math.max(0, bruto - totalDescuentos);
  const tasaCop = sale.moneda === 'USD' ? Math.max(0, Number(sale.trm_conversion || defaultTrm || 0)) : 1;
  return { bruto, comisionPorcentaje, comisionFija, costoRetiro, totalDescuentos, netoOrigen, netoCop: netoOrigen * tasaCop, tasaCop };
}

/** Tarifas por defecto de la pasarela del usuario (personalizables). */
export interface GatewayDefaults {
  porcentaje: number;
  fija: number;
  retiro: number;
}

/** True si la venta ya trae tarifas de pasarela propias (no usar defaults). */
function saleHasExplicitFees(sale: Pick<Venta, 'pasarela_pago' | 'comision_pasarela_porcentaje' | 'comision_pasarela_fija' | 'comision_retiro'>): boolean {
  return Boolean(sale.pasarela_pago)
    || Number(sale.comision_pasarela_porcentaje || 0) > 0
    || Number(sale.comision_pasarela_fija || 0) > 0
    || Number(sale.comision_retiro || 0) > 0;
}

/**
 * Suma en COP lo que descuenta la pasarela en el período. Si se pasan tarifas
 * por defecto, se aplican a las ventas que no tienen tarifas propias (en la
 * misma moneda de cada venta), para estimar el neto real sin tener que cargar
 * la comisión venta por venta.
 */
export function totalGatewayFeesCop(ventas: Venta[], defaultTrm: number, defaults?: GatewayDefaults): number {
  return ventas.reduce((total, sale) => {
    const effective = !defaults || saleHasExplicitFees(sale)
      ? sale
      : { ...sale, comision_pasarela_porcentaje: defaults.porcentaje, comision_pasarela_fija: defaults.fija, comision_retiro: defaults.retiro };
    const fees = calculatePaymentFees(effective, defaultTrm);
    return total + fees.totalDescuentos * fees.tasaCop;
  }, 0);
}
