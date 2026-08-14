import assert from 'node:assert/strict';
import { repartirAdelanto } from '../src/lib/invoiceLines';

// Factura de 3 ítems: 900.000 + 90.000 + 150.000 = 1.140.000
const totales = [900_000, 90_000, 150_000];

// Sin pago: todo pendiente y nada repartido.
const nada = repartirAdelanto(totales, 0);
assert.deepEqual(nada.map((l) => l.estado_pago), ['Pendiente', 'Pendiente', 'Pendiente']);
assert.equal(nada.reduce((s, l) => s + l.adelanto, 0), 0);

// Pago total: las tres líneas quedan pagadas y la suma cuadra con la factura.
const completo = repartirAdelanto(totales, 1_140_000);
assert.deepEqual(completo.map((l) => l.estado_pago), ['Pagado', 'Pagado', 'Pagado']);
assert.equal(completo.reduce((s, l) => s + l.adelanto, 0), 1_140_000);

// Pago parcial: se llena en orden. Es el caso que se veía mal antes — la
// factura a medias no puede dejar una línea pagada y el resto intactas por
// accidente, sino exactamente hasta donde alcanzó el dinero.
const parcial = repartirAdelanto(totales, 950_000);
assert.deepEqual(parcial.map((l) => l.adelanto), [900_000, 50_000, 0]);
assert.deepEqual(parcial.map((l) => l.estado_pago), ['Pagado', 'Adelanto', 'Pendiente']);

// Nunca se reparte más de lo recibido, aunque el pago supere la factura.
const excedido = repartirAdelanto(totales, 2_000_000);
assert.equal(excedido.reduce((s, l) => s + l.adelanto, 0), 1_140_000);

// Una línea sin importe no se queda "Pendiente" para siempre: no hay nada que cobrar.
assert.equal(repartirAdelanto([0, 100], 0)[0].estado_pago, 'Pagado');

// Entradas basura no producen NaN en el libro.
const sucio = repartirAdelanto([Number('x'), 100], Number('y'));
assert.equal(sucio.every((l) => Number.isFinite(l.adelanto)), true);

console.log('invoiceLines: ok');
