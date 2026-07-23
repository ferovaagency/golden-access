import assert from 'node:assert/strict';
import { calculatePaymentFees } from '../src/lib/paymentFees';

const withFees = calculatePaymentFees({ cantidad: 1, precio_venta_unitario: 100, moneda: 'USD', comision_pasarela_porcentaje: 5, comision_pasarela_fija: 0.5, comision_retiro: 2, trm_conversion: 4000 }, 3900);
assert.equal(withFees.totalDescuentos, 7.5);
assert.equal(withFees.netoOrigen, 92.5);
assert.equal(withFees.netoCop, 370000);

const defaultTrm = calculatePaymentFees({ cantidad: 2, precio_venta_unitario: 50, moneda: 'USD' }, 4100);
assert.equal(defaultTrm.netoCop, 410000);

const clamped = calculatePaymentFees({ cantidad: 1, precio_venta_unitario: 10, moneda: 'COP', comision_pasarela_fija: 20 }, 4000);
assert.equal(clamped.netoOrigen, 0);

console.log('paymentFees tests passed');
