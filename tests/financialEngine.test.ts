import assert from 'node:assert/strict';
import {
  calculateHealthyHourlyRate,
  calculateHourlyCost,
  calculateServiceProfitability,
  calculateClientProfitability,
  calculateCapacity,
  calculateBreakEven,
  semaforoMargen,
} from '../src/lib/engine/financialEngine';

// 4.3 — ejemplo literal del manual: 40h/semana, 60% facturable, 5.000.000
// compensación, 2.000.000 gastos -> ~81.000 COP/hora.
const rate = calculateHealthyHourlyRate({
  horasDisponiblesSemanales: 40,
  compensacionMensualDeseada: 5_000_000,
  gastoMensualNegocio: 2_000_000,
  pctFacturable: 0.60,
});
assert.ok(rate.tarifaMinimaSaludable !== null);
assert.ok(Math.abs(rate.tarifaMinimaSaludable! - 81_000) < 1_500, `esperado ~81.000, obtuvo ${rate.tarifaMinimaSaludable}`);

// Horas facturables en cero -> no calculable, no un cero falso.
const rateZero = calculateHealthyHourlyRate({
  horasDisponiblesSemanales: 0,
  compensacionMensualDeseada: 5_000_000,
  gastoMensualNegocio: 2_000_000,
  pctFacturable: 0.60,
});
assert.equal(rateZero.tarifaMinimaSaludable, null);
assert.ok(rateZero.notas.length > 0);

// 4.5 — costo por hora
assert.equal(calculateHourlyCost({ costoMensualPersona: 4_000_000, horasProductivasMensuales: 160 }), 25_000);
assert.equal(calculateHourlyCost({ costoMensualPersona: 4_000_000, horasProductivasMensuales: 0 }), null);

// 4.5 — margen de servicio + semáforo
const svc = calculateServiceProfitability({ precioNeto: 1_000_000, horasReales: 20, costoInternoPorHora: 25_000, costoTerceros: 100_000 });
assert.equal(svc.costoTiempo, 500_000);
assert.equal(svc.costoRealServicio, 600_000);
assert.ok(Math.abs(svc.margenServicio! - 0.4) < 0.001);
assert.equal(svc.semaforo, 'saludable');
assert.equal(semaforoMargen(0.10), 'critico');
assert.equal(semaforoMargen(0.20), 'bajo');
assert.equal(semaforoMargen(0.60), 'alto');
assert.equal(semaforoMargen(null), null);

// calculateClientProfitability reusa la misma fórmula que servicio.
const cli = calculateClientProfitability({ ingresoNetoCliente: 1_000_000, horasRealesCliente: 20, costoInternoPorHora: 25_000, costoTercerosCliente: 100_000 });
assert.equal(cli.margenServicio, svc.margenServicio);

// 4.6 — capacidad
const cap = calculateCapacity({ capacidadMensualHoras: 160, pctFacturableReal: 0.6, capacidadComprometidaHoras: 50, horasFacturablesTrabajadas: 60 });
assert.equal(cap.capacidadFacturable, 96);
assert.equal(cap.disponibilidad, 46);
assert.ok(Math.abs(cap.utilizacion! - 60 / 96) < 0.0001);
assert.equal(cap.lectura, 'operativo');

const capOciosa = calculateCapacity({ capacidadMensualHoras: 160, pctFacturableReal: 0.6, capacidadComprometidaHoras: 0, horasFacturablesTrabajadas: 10 });
assert.equal(capOciosa.lectura, 'ociosa');

// 4.6 — punto de equilibrio: margen <= 0 debe ser explícitamente "no calculable", no "1 unidad".
const beImposible = calculateBreakEven({ gastosFijos: 1_000_000, margenContribucion: -50_000, ingresosNetos: 500_000 });
assert.equal(beImposible.puntoEquilibrioVentas, null);
assert.ok(beImposible.notas.some((n) => n.includes('imposible')));

const beNormal = calculateBreakEven({ gastosFijos: 1_000_000, margenContribucion: 400_000, ingresosNetos: 1_000_000 });
assert.equal(beNormal.ratioContribucion, 0.4);
assert.equal(beNormal.puntoEquilibrioVentas, 2_500_000);

console.log('financialEngine: ok');
