import assert from 'node:assert/strict';
import {
  calculateHealthyHourlyRate,
  calculateHourlyCost,
  calculateServiceProfitability,
  calculateClientProfitability,
  calculateCapacity,
  calculateBreakEven,
  calculateWeightedReceivable,
  calculateCashPosition,
  calculateCashForecast,
  calculatePipelineForecast,
  calculateTaxProvision,
  reconcileTransactions,
  estimateCollectionProbability,
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

// 4.7 — cobro esperado ponderado, tabla exacta de probabilidades
assert.equal(estimateCollectionProbability(null, false), 0.95);
assert.equal(estimateCollectionProbability(-5, false), 0.85); // aún dentro de plazo
assert.equal(estimateCollectionProbability(10, false), 0.70);
assert.equal(estimateCollectionProbability(25, false), 0.50);
assert.equal(estimateCollectionProbability(45, false), 0.25);
assert.equal(estimateCollectionProbability(45, true), 0); // cancelada, sin importar antigüedad

const weighted = calculateWeightedReceivable({ saldo: 1_000_000, vencimiento: '2026-06-01', cancelada: false, hoy: '2026-06-20' });
assert.equal(weighted.diasVencido, 19);
assert.equal(weighted.probabilidad, 0.50);
assert.equal(weighted.cobroEsperado, 500_000);

// 4.7 — posición y proyección: la caja disponible no se confunde con el
// escenario futuro de cobros ponderados.
assert.equal(calculateCashPosition({ saldoActual: 2_000_000, egresosComprometidos: 750_000 }).cajaDisponible, 1_250_000);
assert.equal(calculateCashForecast({ saldoInicial: 2_000_000, cobrosEsperados: 800_000, pagosEsperados: 750_000 }).cajaProyectada, 2_050_000);

// 4.8 — pipeline: el CRM actual guarda probabilidad como porcentaje.
const forecast = calculatePipelineForecast({
  oportunidades: [{ valor: 1_000_000, probabilidad: 50 }, { valor: 2_000_000, probabilidad: 0.25 }, { valor: 900_000, probabilidad: null }],
  metaIngresos: 4_000_000, ticketPromedio: 1_000_000, tasaCierre: 0.25, tasaCalificacion: 0.5,
});
assert.equal(forecast.pipelinePonderado, 1_000_000);
assert.equal(forecast.ventasNecesarias, 4);
assert.equal(forecast.propuestasNecesarias, 16);
assert.equal(forecast.leadsCalificadosNecesarios, 32);

const provision = calculateTaxProvision({ baseEstimada: 1_000_000, taxpayerType: 'declarante', taxType: 'retencion', date: '2026-07-22', rules: [{ taxpayerType: 'declarante', taxType: 'retencion', rate: 0.04, validFrom: '2026-01-01', version: 2 }] });
assert.equal(provision.provision, 40_000);
assert.equal(calculateTaxProvision({ baseEstimada: 1_000_000, taxpayerType: 'declarante', taxType: 'retencion', rules: [] }).status, 'no_calculable');

const reconciliation = reconcileTransactions({ invoices: [{ id: 'f1', total: 100 }, { id: 'f2', total: 50 }], payments: [{ id: 'p1', amount: 70, invoiceId: 'f1' }, { id: 'p2', amount: 80, invoiceId: 'f2' }, { id: 'p3', amount: 10 }] });
assert.deepEqual(reconciliation.invoiceBalances, [{ invoiceId: 'f1', balance: 30 }, { invoiceId: 'f2', balance: 0 }]);
assert.deepEqual(reconciliation.unmatchedPaymentIds, ['p3']);
assert.deepEqual(reconciliation.overpaidInvoiceIds, ['f2']);

console.log('financialEngine: ok');
