import assert from 'node:assert/strict';
import { computeRoi, reverseRoi } from '../src/lib/roiCalc';

// Denominadores en 0 nunca devuelven Infinity/NaN
const zero = computeRoi({
  inversion: 0, impresiones: 0, clics: 0, leads: 0, leads_calificados: 0,
  citas: 0, citas_efectivas: 0, ventas: 0, ticket_promedio: 0,
  costo_entrega: 0, comision: 0, costo_profesional: 0, ltv: 0,
});
for (const [k, v] of Object.entries(zero)) {
  assert.ok(Number.isFinite(v), `${k} debería ser finito, fue ${v}`);
}

// Caso feliz
const r = computeRoi({
  inversion: 1000, impresiones: 100_000, clics: 1000, leads: 100, leads_calificados: 50,
  citas: 30, citas_efectivas: 20, ventas: 10, ticket_promedio: 500,
  costo_entrega: 50, comision: 25, costo_profesional: 500, ltv: 1500,
});
assert.equal(r.cpm, 10);          // 1000/100_000 * 1000
assert.equal(r.ctr, 0.01);
assert.equal(r.cpc, 1);
assert.equal(r.cpl, 10);
assert.equal(r.cpl_calificado, 20);
assert.equal(r.tasa_lead_a_calificado, 0.5);
assert.equal(r.tasa_calificado_a_cita, 0.6);
assert.equal(r.tasa_cita_a_efectiva, 20 / 30);
assert.equal(r.tasa_efectiva_a_venta, 0.5);
assert.equal(r.fuga_leads, 50);
assert.equal(r.fuga_citas, 10);
assert.equal(r.cpa, 100);
assert.equal(r.ingresos_brutos, 5000);
assert.equal(r.roas, 5);
assert.equal(r.costos_totales, 1000 + 50 * 10 + 25 * 10 + 500); // 2250
assert.equal(r.utilidad_neta, 5000 - 2250);
assert.equal(r.margen_neto, r.utilidad_neta / r.ingresos_brutos);
assert.equal(r.roi, r.utilidad_neta / 1000);
assert.equal(r.ltv_total, 15_000);

// reverseRoi
const rev = reverseRoi({
  meta_facturacion: 10_000,
  ticket_promedio: 500,
  tasa_efectiva_a_venta: 0.5,
  tasa_cita_a_efectiva: 0.5,
  tasa_calificado_a_cita: 0.5,
  tasa_lead_a_calificado: 0.5,
  ctr: 0.02,
  cpc: 2,
});
assert.equal(rev.ventas, 20);
assert.equal(rev.citas_efectivas, 40);
assert.equal(rev.citas, 80);
assert.equal(rev.leads_calificados, 160);
assert.equal(rev.leads, 320);
assert.equal(rev.clics, 320);
assert.equal(rev.impresiones, 16_000);
assert.equal(rev.inversion, 640);

// reverseRoi: ticket 0 → devuelve 0 sin dividir
const revZero = reverseRoi({
  meta_facturacion: 10_000, ticket_promedio: 0, tasa_efectiva_a_venta: 0,
  tasa_cita_a_efectiva: 0, tasa_calificado_a_cita: 0, tasa_lead_a_calificado: 0,
  ctr: 0, cpc: 0,
});
assert.equal(revZero.ventas, 0);
assert.equal(revZero.impresiones, 0);

console.log('roiCalc: ok');
