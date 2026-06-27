import { Config, AppData, Cliente, Servicio, Herramienta, OtroGasto, Venta, Hora, Respaldo } from '../types';

/**
 * Calculates Independent Contractor (Persona Natural) Social Security obligations
 */
export interface PrestacionesSociales {
  ibc: number;
  salud: number;
  pension: number;
  totalPrestaciones: number;
  salarioNeto: number;
}

export function calcularPrestaciones(salarioPropuesto: number, smmlv: number): PrestacionesSociales {
  const ibc = Math.max(salarioPropuesto * 0.40, smmlv);
  const salud = ibc * 0.125;
  const pension = ibc * 0.16;
  const totalPrestaciones = salud + pension;
  const salarioNeto = salarioPropuesto - totalPrestaciones;

  return { ibc, salud, pension, totalPrestaciones, salarioNeto };
}

/**
 * Converts any numeric cash flow into COP based on the active TRM
 */
export function convertToCop(monto: number, moneda: 'COP' | 'USD', trm: number): number {
  return moneda === 'USD' ? monto * trm : monto;
}

/**
 * Computes individual tool costs, resolving global vs per-active-client and distributing among linked services.
 */
export interface HerramientaCostDetails {
  id: string;
  nombre: string;
  montoCop: number;
  costoMensualTotal: number;
  costoAsignadoPorServicio: number;
  serviciosLinked: string[];
}

export function calcularCostosHerramientas(
  herramientas: Herramienta[],
  clientesActivosCount: number,
  trm: number
): HerramientaCostDetails[] {
  return herramientas.map(h => {
    const montoCop = convertToCop(h.monto, h.moneda, trm);
    const costTotal = h.tipo_cobro === 'porCliente' ? montoCop * clientesActivosCount : montoCop;
    
    const serviciosLinked = h.servicios_ids
      ? h.servicios_ids.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    
    const costoAsignadoPorServicio = serviciosLinked.length > 0
      ? costTotal / serviciosLinked.length
      : costTotal;

    return {
      id: h.id,
      nombre: h.nombre,
      montoCop,
      costoMensualTotal: costTotal,
      costoAsignadoPorServicio,
      serviciosLinked
    };
  });
}

/**
 * Get list of unique months represented as "YYYY-MM" in the sales dataset
 */
export function getUniqueSalesMonths(ventas: Venta[]): string[] {
  const months = new Set<string>();
  ventas.forEach(v => {
    if (v.fecha) {
      const parts = v.fecha.split('-');
      if (parts.length >= 2) {
        months.add(`${parts[0]}-${parts[1]}`);
      }
    }
  });
  return Array.from(months).sort();
}

/**
 * Calculates everything for a selected month (or "Todos")
 */
export interface FinancialMetrics {
  totalVentas: number;
  costosVariables: number;
  utilidadBruta: number;
  gastosOperativos: number;
  utilidadOperacional: number;
  salarioPropuesto: number;
  utilidadAntesImpuestos: number;
  impuestoRentaEstimado: number;
  utilidadNeta: number;
  margenContribucion: number;
  puntoEquilibrioVentas: number;
  
  // Details for rendering
  herramientasCostoTotalCop: number;
  otrosGastosCostoTotalCop: number;
  prestaciones: PrestacionesSociales;
  activeMonthsCountScale: number;

  // New fields for distinguishing real paid wages vs proposed
  salariosRealesPagados: number;
  totalEgresosReales: number;
  egresosRealesPorCategoria: {
    Herramientas: number;
    Salarios: number;
    Contratistas: number;
    Administrativo: number;
    Otros: number;
  };
}

export function calcularMétricasFinancieras(
  data: AppData,
  selectedMonth: string // YYYY-MM or "Todos"
): FinancialMetrics {
  const { config, clientes, herramientas, otrosGastos, ventas, pagosEgresos = [] } = data;
  const { trm, smmlv, salario_propuesto } = config;

  // Filter sales and hours by selected period
  const isAll = selectedMonth === 'Todos';
  const filteredVentas = isAll 
    ? ventas 
    : ventas.filter(v => v.fecha && v.fecha.startsWith(selectedMonth));

  // Determine active months scale
  const uniqueMonths = getUniqueSalesMonths(ventas);
  const activeMonthsCountScale = isAll ? (uniqueMonths.length || 1) : 1;

  // 1. Core sales in COP
  let totalVentas = 0;
  let costosVariables = 0;
  filteredVentas.forEach(v => {
    const valCop = convertToCop(v.precio_venta_unitario, v.moneda, trm);
    totalVentas += valCop * v.cantidad;
    costosVariables += v.costo_unitario * v.cantidad; // Variable cost is in COP
  });

  // Calculate real disbursements (egresos) for the current period (filter by month if not 'Todos')
  const filteredEgresos = isAll 
    ? pagosEgresos 
    : pagosEgresos.filter(p => p.fecha && p.fecha.startsWith(selectedMonth));

  let salariosRealesPagados = 0;
  let totalEgresosReales = 0;
  const egresosRealesPorCategoria = {
    Herramientas: 0,
    Salarios: 0,
    Contratistas: 0,
    Administrativo: 0,
    Otros: 0,
  };

  filteredEgresos.forEach(p => {
    const valCop = convertToCop(p.monto, p.moneda, trm);
    totalEgresosReales += valCop;
    if (p.categoria in egresosRealesPorCategoria) {
      egresosRealesPorCategoria[p.categoria as keyof typeof egresosRealesPorCategoria] += valCop;
    } else {
      egresosRealesPorCategoria.Otros += valCop;
    }
  });
  salariosRealesPagados = egresosRealesPorCategoria.Salarios;

  // 2. Operating expenses (Tools + Other Monthly Expenses)
  const clientesActivosCount = clientes.filter(c => c.activo).length;
  const toolDetails = calcularCostosHerramientas(herramientas, clientesActivosCount, trm);
  const herramientasCostoTotalCop = toolDetails.reduce((sum, current) => sum + current.costoMensualTotal, 0);

  const otrosGastosCostoTotalCop = otrosGastos.reduce((sum, h) => {
    return sum + convertToCop(h.monto, h.moneda, trm);
  }, 0);

  // Scaled monthly expenses
  const mensualGastosOperativos = herramientasCostoTotalCop + otrosGastosCostoTotalCop;
  const gastosOperativos = mensualGastosOperativos * activeMonthsCountScale;
  const salarioPropuesto = salario_propuesto * activeMonthsCountScale;

  // 3. Four levels of utility
  const utilidadBruta = totalVentas - costosVariables;
  const utilidadOperacional = utilidadBruta - gastosOperativos;
  const utilidadAntesImpuestos = utilidadOperacional - salarioPropuesto;

  // Renta estimation
  // If annualized (meaning: our rate * 12) exceeds DIAN limit of 1090 UVT Rentable Tax Limit ($57.087.660)
  const monthlySalaryAndAdminUtility = utilidadAntesImpuestos / activeMonthsCountScale;
  const utilidadAnualizada = monthlySalaryAndAdminUtility * 12;
  const topeNoPagaRenta = config.tope_no_paga_renta_uvt * config.uvt;
  
  let impuestoRentaAnual = 0;
  if (utilidadAnualizada > topeNoPagaRenta) {
    impuestoRentaAnual = (utilidadAnualizada - topeNoPagaRenta) * 0.19;
  }
  
  const impuestoRentaEstimado = (impuestoRentaAnual / 12) * activeMonthsCountScale;
  const utilidadNeta = utilidadAntesImpuestos - impuestoRentaEstimado;

  // 4. Break even point
  const margenContribucion = totalVentas > 0 ? (utilidadBruta / totalVentas) : 0;
  const totalGastosFijos = gastosOperativos + salarioPropuesto;
  const puntoEquilibrioVentas = margenContribucion > 0 ? (totalGastosFijos / margenContribucion) : 0;

  // Social security summary of proposed salary
  const prestaciones = calcularPrestaciones(salario_propuesto, smmlv);

  return {
    totalVentas,
    costosVariables,
    utilidadBruta,
    gastosOperativos,
    utilidadOperacional,
    salarioPropuesto,
    utilidadAntesImpuestos,
    impuestoRentaEstimado,
    utilidadNeta,
    margenContribucion,
    puntoEquilibrioVentas,
    herramientasCostoTotalCop,
    otrosGastosCostoTotalCop,
    prestaciones,
    activeMonthsCountScale,
    salariosRealesPagados,
    totalEgresosReales,
    egresosRealesPorCategoria
  };
}

/**
 * Calculates hourly value performance by client
 */
export interface ProductividadCliente {
  clienteId: string;
  clienteNombre: string;
  horasRegistradas: number;
  ingresosCop: number;
  valorHoraCop: number;
  estado: 'GANANCIA' | 'EQUILIBRIO' | 'PÉRDIDA';
}

export function calcularProductividadClientes(
  data: AppData,
  selectedMonth: string,
  valorHoraObjetivo: number
): ProductividadCliente[] {
  const { config, clientes, ventas, horas } = data;

  const isAll = selectedMonth === 'Todos';
  const filteredVentas = isAll ? ventas : ventas.filter(v => v.fecha && v.fecha.startsWith(selectedMonth));
  const filteredHoras = isAll ? horas : horas.filter(h => h.fecha && h.fecha.startsWith(selectedMonth));

  // Compute stats per client
  const mapClientes = new Map<string, { id: string; nombre: string; horas: number; ingresos: number }>();

  // Init with actual client list to ensure active ones appear
  clientes.forEach(c => {
    if (c.activo) {
      mapClientes.set(c.id, { id: c.id, nombre: c.nombre, horas: 0, ingresos: 0 });
    }
  });

  // Aggregate hours
  filteredHoras.forEach(h => {
    if (!h.cliente_id) return;
    const existing = mapClientes.get(h.cliente_id);
    if (existing) {
      existing.horas += h.horas;
    } else {
      mapClientes.set(h.cliente_id, { id: h.cliente_id, nombre: h.cliente_nombre, horas: h.horas, ingresos: 0 });
    }
  });

  // Aggregate revenues
  filteredVentas.forEach(v => {
    if (!v.cliente_id) return;
    const copRev = convertToCop(v.precio_venta_unitario, v.moneda, config.trm) * v.cantidad;
    const existing = mapClientes.get(v.cliente_id);
    if (existing) {
      existing.ingresos += copRev;
    } else {
      mapClientes.set(v.cliente_id, { id: v.cliente_id, nombre: v.cliente_nombre, horas: 0, ingresos: copRev });
    }
  });

  return Array.from(mapClientes.values())
    .filter(item => item.horas > 0 || item.ingresos > 0)
    .map(item => {
      const valorHoraCop = item.horas > 0 ? (item.ingresos / item.horas) : 0;
      let estado: 'GANANCIA' | 'EQUILIBRIO' | 'PÉRDIDA' = 'PÉRDIDA';

      if (valorHoraCop >= valorHoraObjetivo) {
        estado = 'GANANCIA';
      } else if (valorHoraCop >= valorHoraObjetivo * 0.70) {
        estado = 'EQUILIBRIO';
      }

      return {
        clienteId: item.id,
        clienteNombre: item.nombre,
        horasRegistradas: item.horas,
        ingresosCop: item.ingresos,
        valorHoraCop,
        estado
      };
    });
}

/**
 * Calculates hourly performance by service
 */
export interface ProductividadServicio {
  servicioId: string;
  servicioNombre: string;
  horasRegistradas: number;
  unidadesVendidas: number;
  promedioHorasPorUnidad: number;
  ingresosCop: number;
  valorHoraServicioCop: number;
}

export function calcularProductividadServicios(
  data: AppData,
  selectedMonth: string
): ProductividadServicio[] {
  const { config, servicios, ventas, horas } = data;

  const isAll = selectedMonth === 'Todos';
  const filteredVentas = isAll ? ventas : ventas.filter(v => v.fecha && v.fecha.startsWith(selectedMonth));
  const filteredHoras = isAll ? horas : horas.filter(h => h.fecha && h.fecha.startsWith(selectedMonth));

  const mapServicios = new Map<string, { id: string; nombre: string; horas: number; cantidadVendida: number; ingresos: number }>();

  // Init with active services
  servicios.forEach(s => {
    mapServicios.set(s.id, { id: s.id, nombre: s.nombre, horas: 0, cantidadVendida: 0, ingresos: 0 });
  });

  // Aggregate hours
  filteredHoras.forEach(h => {
    if (!h.servicio_id) return;
    const existing = mapServicios.get(h.servicio_id);
    if (existing) {
      existing.horas += h.horas;
    } else {
      mapServicios.set(h.servicio_id, { id: h.servicio_id, nombre: h.servicio_nombre, horas: h.horas, cantidadVendida: 0, ingresos: 0 });
    }
  });

  // Aggregate sales
  filteredVentas.forEach(v => {
    if (!v.servicio_id) return;
    const copRev = convertToCop(v.precio_venta_unitario, v.moneda, config.trm) * v.cantidad;
    const existing = mapServicios.get(v.servicio_id);
    if (existing) {
      existing.cantidadVendida += v.cantidad;
      existing.ingresos += copRev;
    } else {
      mapServicios.set(v.servicio_id, { id: v.servicio_id, nombre: v.servicio_nombre, horas: 0, cantidadVendida: v.cantidad, ingresos: copRev });
    }
  });

  return Array.from(mapServicios.values())
    .filter(item => item.horas > 0 || item.cantidadVendida > 0 || item.ingresos > 0)
    .map(item => {
      const promedioHorasPorUnidad = item.cantidadVendida > 0 ? (item.horas / item.cantidadVendida) : 0;
      const valorHoraServicioCop = item.horas > 0 ? (item.ingresos / item.horas) : 0;

      return {
        servicioId: item.id,
        servicioNombre: item.nombre,
        horasRegistradas: item.horas,
        unidadesVendidas: item.cantidadVendida,
        promedioHorasPorUnidad,
        ingresosCop: item.ingresos,
        valorHoraServicioCop
      };
    });
}
