import assert from 'node:assert/strict';
import {
  calcularPrestaciones,
  convertToCop,
  calcularCostosHerramientas,
  getUniqueSalesMonths,
  calcularMétricasFinancieras,
  calcularProductividadClientes,
  calcularProductividadServicios,
  isColombiaFiscal,
} from '../src/lib/calculations';
import type { AppData, Config, Cliente, Servicio, Herramienta, Venta, Hora } from '../src/types';

const config: Config = {
  trm: 4000,
  uvt: 47065,
  smmlv: 1_423_500,
  tope_no_declarante_uvt: 1400,
  tope_no_paga_renta_uvt: 1090,
  tope_responsable_iva_uvt: 3500,
  retencion_servicio_min_uvt: 4,
  tarifa_ret_declarante: 0.04,
  tarifa_ret_no_declarante: 0.06,
  tarifa_salud: 0.125,
  tarifa_pension: 0.16,
  ibc_porcentaje: 0.4,
  tarifa_iva: 0.19,
  salario_propuesto: 5_000_000,
  horas_objetivo_mes: 160,
  meta_ventas_mensual: 30_000_000,
};

const clientes: Cliente[] = [
  { id: 'c1', nombre: 'Cliente Uno', tipo: 'Nacional', declarante: true, activo: true, fecha_creacion: '2025-01-01' },
  { id: 'c2', nombre: 'Cliente Dos', tipo: 'Nacional', declarante: false, activo: true, fecha_creacion: '2025-01-01' },
  { id: 'c3', nombre: 'Inactivo', tipo: 'Nacional', declarante: false, activo: false, fecha_creacion: '2025-01-01' },
];
const servicios: Servicio[] = [
  { id: 's1', nombre: 'SEO', costo_unitario: 500_000 },
  { id: 's2', nombre: 'Ads', costo_unitario: 300_000 },
];
const herramientas: Herramienta[] = [
  { id: 'h1', nombre: 'Ahrefs', monto: 100, moneda: 'USD', tipo_cobro: 'global', servicios_ids: 's1,s2' },
  { id: 'h2', nombre: 'Software local', monto: 200_000, moneda: 'COP', tipo_cobro: 'porCliente', servicios_ids: '' },
];
const ventas: Venta[] = [
  { id: 'v1', fecha: '2025-05-10', cliente_id: 'c1', cliente_nombre: 'Cliente Uno', servicio_id: 's1', servicio_nombre: 'SEO', cantidad: 1, precio_venta_unitario: 3_000_000, costo_unitario: 500_000, moneda: 'COP', tipo: 'Nacional', adelanto: 0, estado_pago: 'Pagado' },
  { id: 'v2', fecha: '2025-06-10', cliente_id: 'c2', cliente_nombre: 'Cliente Dos', servicio_id: 's2', servicio_nombre: 'Ads', cantidad: 2, precio_venta_unitario: 500, costo_unitario: 300_000, moneda: 'USD', tipo: 'Internacional', adelanto: 0, estado_pago: 'Pagado' },
];
const horas: Hora[] = [
  { id: 'hr1', fecha: '2025-05-11', cliente_id: 'c1', cliente_nombre: 'Cliente Uno', servicio_id: 's1', servicio_nombre: 'SEO', horas: 10, descripcion: '' },
  { id: 'hr2', fecha: '2025-06-11', cliente_id: 'c2', cliente_nombre: 'Cliente Dos', servicio_id: 's2', servicio_nombre: 'Ads', horas: 20, descripcion: '' },
];

const data: AppData = { config, clientes, servicios, herramientas, otrosGastos: [], ventas, horas, respaldos: [], pagosEgresos: [] };

// --- convertToCop ---
assert.equal(convertToCop(100, 'USD', 4000), 400_000);
assert.equal(convertToCop(100, 'COP', 4000), 100);

// --- isColombiaFiscal ---
assert.equal(isColombiaFiscal(null), true, 'default histórico CO');
assert.equal(isColombiaFiscal({ country: 'MX', person_type: null, regime: null } as any), false);
assert.equal(isColombiaFiscal({ country: 'co', person_type: null, regime: null } as any), true, 'case-insensitive');

// --- calcularPrestaciones (CO) ---
const p = calcularPrestaciones(5_000_000, 1_423_500);
assert.equal(p.applies, true);
assert.equal(p.ibc, Math.max(5_000_000 * 0.4, 1_423_500));
assert.ok(Math.abs(p.salud - p.ibc * 0.125) < 0.001);
assert.ok(Math.abs(p.pension - p.ibc * 0.16) < 0.001);
assert.equal(p.salarioNeto, 5_000_000 - p.totalPrestaciones);

// --- calcularPrestaciones piso SMMLV ---
const pFloor = calcularPrestaciones(1_000_000, 1_423_500);
assert.equal(pFloor.ibc, 1_423_500, 'IBC no puede bajar del SMMLV');

// --- calcularPrestaciones fuera de CO ---
const pMx = calcularPrestaciones(5_000_000, 1_423_500, { country: 'MX', person_type: null, regime: null } as any);
assert.equal(pMx.applies, false);
assert.equal(pMx.totalPrestaciones, 0);
assert.equal(pMx.salarioNeto, 5_000_000);

// --- calcularCostosHerramientas ---
const costos = calcularCostosHerramientas(herramientas, 2, 4000);
const ahrefs = costos.find(c => c.id === 'h1')!;
assert.equal(ahrefs.montoCop, 400_000);
assert.equal(ahrefs.costoMensualTotal, 400_000, 'global no se multiplica por clientes');
assert.equal(ahrefs.costoAsignadoPorServicio, 200_000, 'se distribuye entre 2 servicios');
const local = costos.find(c => c.id === 'h2')!;
assert.equal(local.costoMensualTotal, 400_000, 'porCliente x 2 activos');
assert.equal(local.costoAsignadoPorServicio, 400_000, 'sin servicios linkeados no se distribuye');

// --- getUniqueSalesMonths ---
const months = getUniqueSalesMonths(ventas);
assert.deepEqual(months, ['2025-05', '2025-06']);

// --- calcularMétricasFinancieras ---
const metricsMayo = calcularMétricasFinancieras(data, '2025-05');
assert.equal(metricsMayo.totalVentas, 3_000_000);
assert.equal(metricsMayo.costosVariables, 500_000);
assert.equal(metricsMayo.utilidadBruta, 2_500_000);
assert.equal(metricsMayo.fiscalApplies, true);
assert.equal(metricsMayo.fiscalCountry, 'CO');

const metricsAll = calcularMétricasFinancieras(data, 'Todos');
assert.equal(metricsAll.activeMonthsCountScale, 2);
assert.equal(metricsAll.totalVentas, 3_000_000 + 2 * 500 * 4000); // 3M + 4M USD

// --- Fiscal fuera de CO: impuesto renta 0 ---
const metricsMx = calcularMétricasFinancieras(data, '2025-05', { country: 'MX', person_type: null, regime: null } as any);
assert.equal(metricsMx.impuestoRentaEstimado, 0, 'fuera de CO no calcula renta');
assert.equal(metricsMx.fiscalApplies, false);
assert.ok(metricsMx.fiscalNotice && metricsMx.fiscalNotice.includes('MX'));

// --- Productividad clientes ---
const prodC = calcularProductividadClientes(data, 'Todos', 100_000);
assert.equal(prodC.length, 2);
const c1 = prodC.find(x => x.clienteId === 'c1')!;
assert.equal(c1.horasRegistradas, 10);
assert.equal(c1.ingresosCop, 3_000_000);
assert.equal(c1.valorHoraCop, 300_000);
assert.equal(c1.estado, 'GANANCIA');

// --- Productividad servicios ---
const prodS = calcularProductividadServicios(data, 'Todos');
assert.equal(prodS.length, 2);
const s1 = prodS.find(x => x.servicioId === 's1')!;
assert.equal(s1.unidadesVendidas, 1);
assert.equal(s1.promedioHorasPorUnidad, 10);

console.log('calculations: ok');
