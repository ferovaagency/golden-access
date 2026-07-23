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

/**
 * Suma en COP lo que descuenta la pasarela en el período, usando SOLO las
 * tarifas guardadas en cada venta. Las comisiones varían por medio de pago,
 * servicio y cliente, así que no se asume ninguna tarifa global: la pasarela
 * se elige al registrar el ingreso y queda congelada en la venta.
 */
export function totalGatewayFeesCop(ventas: Venta[], defaultTrm: number): number {
  return ventas.reduce((total, sale) => {
    const fees = calculatePaymentFees(sale, defaultTrm);
    return total + fees.totalDescuentos * fees.tasaCop;
  }, 0);
}

/** Cuántas ventas del período tienen (o no) una pasarela asignada. */
export function gatewayCoverage(ventas: Venta[]): { conPasarela: number; sinPasarela: number } {
  let conPasarela = 0;
  for (const sale of ventas) {
    const tiene = Boolean(sale.pasarela_pago)
      || Number(sale.comision_pasarela_porcentaje || 0) > 0
      || Number(sale.comision_pasarela_fija || 0) > 0
      || Number(sale.comision_retiro || 0) > 0;
    if (tiene) conPasarela += 1;
  }
  return { conPasarela, sinPasarela: ventas.length - conPasarela };
}
