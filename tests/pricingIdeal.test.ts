import assert from 'node:assert/strict';
import { calcularPrecioIdeal } from '../src/lib/pricingIdeal';
import type { Servicio } from '../src/types';

const base: Servicio = { id: 's', nombre: 'Test', costo_unitario: 0 };

// Costo cero → precioIdeal null
const cero = calcularPrecioIdeal({ ...base }, 0);
assert.equal(cero.precioIdeal, null);
assert.ok(cero.notas.some(n => n.toLowerCase().includes('costo total en cero')));

// Fórmula base: costo 100 + overhead 50, margen 0.5 → 300
const r1 = calcularPrecioIdeal({ ...base, costo_entrega_estimado: 100, margen_objetivo: 0.5 }, 50);
assert.equal(r1.costoUnitario, 100);
assert.equal(r1.overheadPorUnidad, 50);
assert.equal(r1.costoTotalUnitario, 150);
assert.equal(r1.margenAplicado, 0.5);
assert.equal(r1.precioIdeal, 300);

// Fallback a costo_unitario cuando no hay costo_entrega_estimado
const r2 = calcularPrecioIdeal({ ...base, costo_unitario: 200, margen_objetivo: 0.2 }, 0);
assert.equal(r2.costoUnitario, 200);
assert.ok(Math.abs(r2.precioIdeal! - 250) < 0.001);

// Margen inválido → 30 % default
const rNeg = calcularPrecioIdeal({ ...base, costo_entrega_estimado: 70, margen_objetivo: -0.1 }, 30);
assert.equal(rNeg.margenAplicado, 0.3);
assert.ok(rNeg.notas.some(n => n.toLowerCase().includes('negativo')));

const rTop = calcularPrecioIdeal({ ...base, costo_entrega_estimado: 70, margen_objetivo: 1 }, 30);
assert.equal(rTop.margenAplicado, 0.3);

// Overhead negativo se clampa a 0
const rNegOverhead = calcularPrecioIdeal({ ...base, costo_entrega_estimado: 100, margen_objetivo: 0.5 }, -50);
assert.equal(rNegOverhead.overheadPorUnidad, 0);
assert.equal(rNegOverhead.precioIdeal, 200);

// vsHabitual y vsOfrecido
const rVs = calcularPrecioIdeal({ ...base, costo_entrega_estimado: 100, margen_objetivo: 0.5, precio_habitual: 250, precio_ofrecido: 220 }, 0);
assert.equal(rVs.precioIdeal, 200);
assert.equal(rVs.vsHabitual, -50);
assert.equal(rVs.vsOfrecido, -20);

console.log('pricingIdeal: ok');
