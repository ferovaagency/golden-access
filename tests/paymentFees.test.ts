import assert from 'node:assert/strict';
import { calculatePaymentFees, gatewayCoverage, totalGatewayFeesCop } from '../src/lib/paymentFees';
import type { Venta } from '../src/types';

const withFees = calculatePaymentFees({ cantidad: 1, precio_venta_unitario: 100, moneda: 'USD', comision_pasarela_porcentaje: 5, comision_pasarela_fija: 0.5, comision_retiro: 2, trm_conversion: 4000 }, 3900);
assert.equal(withFees.totalDescuentos, 7.5);
assert.equal(withFees.netoOrigen, 92.5);
assert.equal(withFees.netoCop, 370000);

const defaultTrm = calculatePaymentFees({ cantidad: 2, precio_venta_unitario: 50, moneda: 'USD' }, 4100);
assert.equal(defaultTrm.netoCop, 410000);

const clamped = calculatePaymentFees({ cantidad: 1, precio_venta_unitario: 10, moneda: 'COP', comision_pasarela_fija: 20 }, 4000);
assert.equal(clamped.netoOrigen, 0);

// Cada venta descuenta SOLO con las tarifas que quedaron guardadas en ella:
// la comisión depende del medio de pago, el servicio y el cliente.
const sale = (over: Partial<Venta>): Venta => ({
  id: over.id || 'v', fecha: '2026-07-01', cliente_id: 'c', servicio_id: 's',
  cantidad: 1, precio_venta_unitario: 100, moneda: 'COP', ...over,
} as Venta);

// Una venta sin pasarela asignada no descuenta nada (no se inventa una tarifa).
assert.equal(totalGatewayFeesCop([sale({ id: 'a' })], 4000), 0);

// Dos ventas con pasarelas distintas descuentan cada una lo suyo: 5% y 10%+1.
const mixtas = [
  sale({ id: 'b', pasarela_pago: 'Wompi', comision_pasarela_porcentaje: 5 }),
  sale({ id: 'c', pasarela_pago: 'PayPal', comision_pasarela_porcentaje: 10, comision_pasarela_fija: 1 }),
];
assert.equal(totalGatewayFeesCop(mixtas, 4000), 5 + 11);

// En USD el descuento se convierte a COP con la TRM congelada de la venta.
const usd = [sale({ id: 'd', moneda: 'USD', precio_venta_unitario: 100, comision_pasarela_porcentaje: 10, trm_conversion: 4000 })];
assert.equal(totalGatewayFeesCop(usd, 3900), 40000);

// Cobertura: cuántas ventas del período ya tienen pasarela asignada.
const coverage = gatewayCoverage([sale({ id: 'e' }), ...mixtas]);
assert.equal(coverage.conPasarela, 2);
assert.equal(coverage.sinPasarela, 1);

console.log('paymentFees tests passed');
