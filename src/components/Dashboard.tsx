import React from 'react';
import { AppData } from '../types';
import { FinancialMetrics, calcularProductividadClientes, calcularProductividadServicios } from '../lib/calculations';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  CartesianGrid,
  Legend
} from 'recharts';
import { 
  ShieldAlert, 
  TrendingUp, 
  Globe, 
  Clock, 
  Briefcase, 
  ChevronRight, 
  PiggyBank, 
  AlertTriangle 
} from 'lucide-react';

interface DashboardProps {
  data: AppData;
  metrics: FinancialMetrics;
  selectedMonth: string;
  formatCop: (val: number) => string;
  formatUsd: (val: number) => string;
}

export default function Dashboard({ data, metrics, selectedMonth, formatCop, formatUsd }: DashboardProps) {
  const { config, ventas, horas, clientes } = data;
  const { 
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
    puntoEquilibrioVentas
  } = metrics;

  // Clientes activos count
  const clientesActivos = clientes.filter(c => c.activo).length;

  // National vs International sales calculation
  let ventasNacionales = 0;
  let ventasNacionalesCosto = 0;
  let ventasInternacionales = 0;

  const currentVentas = selectedMonth === 'Todos' 
    ? ventas 
    : ventas.filter(v => v.fecha && v.fecha.startsWith(selectedMonth));

  currentVentas.forEach(v => {
    const isInt = v.tipo === 'Internacional';
    const valCop = v.precio_venta_unitario * v.cantidad * (v.moneda === 'USD' ? config.trm : 1);
    const costCop = v.costo_unitario * v.cantidad;
    if (isInt) {
      ventasInternacionales += valCop;
    } else {
      ventasNacionales += valCop;
      ventasNacionalesCosto += costCop;
    }
  });

  const margenNacional = ventasNacionales > 0 
    ? ((ventasNacionales - ventasNacionalesCosto) / ventasNacionales) * 100 
    : 0;

  // Retenciones aplicadas, lo que entra al banco, adelantos recibidos
  let totalRetencion = 0;
  let totalAdelanto = 0;
  
  currentVentas.forEach(v => {
    const isInt = v.tipo === 'Internacional';
    const valCop = v.precio_venta_unitario * v.cantidad * (v.moneda === 'USD' ? config.trm : 1);
    
    // Find client to get declarante status
    const clientobj = clientes.find(c => c.id === v.cliente_id);
    const esDeclarante = clientobj ? clientobj.declarante : true;
    
    // ReteFuente
    let reterate = 0;
    if (!isInt) {
      // Nacional: if exceeds min limit
      const minLimitCop = config.retencion_servicio_min_uvt * config.uvt;
      if (valCop >= minLimitCop) {
        reterate = esDeclarante ? config.tarifa_ret_declarante : config.tarifa_ret_no_declarante;
      }
    }
    const retencionCop = valCop * reterate;
    totalRetencion += retencionCop;
    totalAdelanto += (v.adelanto || 0);
  });

  const loQueEntraAlBanco = totalVentas - totalRetencion;
  const miSalarioNeto = metrics.prestaciones.salarioNeto;

  // Hourly value section (only if hours exist)
  const totalHoras = horas.reduce((sum, h) => {
    if (selectedMonth === 'Todos' || (h.fecha && h.fecha.startsWith(selectedMonth))) {
      return sum + h.horas;
    }
    return sum;
  }, 0);

  const horaCobradaObj = totalHoras > 0 ? totalVentas / totalHoras : 0;
  const horaRealObj = totalHoras > 0 ? utilidadNeta / totalHoras : 0;
  const horaObjetivoMinima = config.salario_propuesto / (config.horas_objetivo_mes || 160);

  // Semáforo Alertas Tributarias Anualizadas
  // Average monthly calculation based on all records
  const uniqueMonths = Array.from(new Set(ventas.map(v => v.fecha?.substring(0, 7)).filter(Boolean)));
  const recordsMonthsCount = uniqueMonths.length || 1;

  let totalAllTimeRevenues = 0;
  ventas.forEach(v => {
    totalAllTimeRevenues += v.precio_venta_unitario * v.cantidad * (v.moneda === 'USD' ? config.trm : 1);
  });
  const avgMonthlySales = totalAllTimeRevenues / recordsMonthsCount;
  const projectedAnnualSales = avgMonthlySales * 12;

  // Fiscal Limits 2026
  const limiteRentaVentas = config.tope_no_declarante_uvt * config.uvt;
  const limiteResponsableIva = config.tope_responsable_iva_uvt * config.uvt;
  const limitePagaRenta = config.tope_no_paga_renta_uvt * config.uvt;

  const pctRentaVentas = Math.min((projectedAnnualSales / limiteRentaVentas) * 100, 150);
  const pctIvaVentas = Math.min((projectedAnnualSales / limiteResponsableIva) * 100, 150);

  // Annualized profits projection
  const avgMonthlyNet = (utilidadAntesImpuestos / (selectedMonth === 'Todos' ? recordsMonthsCount : 1));
  const projectedAnnualNet = avgMonthlyNet * 12;
  const pctPagaRenta = projectedAnnualNet > 0 
    ? Math.min((projectedAnnualNet / limitePagaRenta) * 100, 150) 
    : 0;

  const getFiscalAlertColor = (pct: number) => {
    if (pct < 70) return { bar: '#a8c98a', text: 'bajo control', border: 'border-l-[#a8c98a] bg-[#141812]' }; // green
    if (pct < 100) return { bar: '#c9a961', text: 'alerta preventiva', border: 'border-l-[#c9a961] bg-[#181611]' }; // gold
    return { bar: '#c97a61', text: 'tope superado', border: 'border-l-[#c97a61] bg-[#181312]' }; // terracota/red
  };

  const alertRenta = getFiscalAlertColor(pctRentaVentas);
  const alertIva = getFiscalAlertColor(pctIvaVentas);
  const alertPagoRenta = getFiscalAlertColor(pctPagaRenta);

  // --- RECHARTS DATA PREPARATION ---
  // 1. Sales & Profit by Service
  const serviceProd = calcularProductividadServicios(data, selectedMonth);
  const chartServiceData = serviceProd.map(s => ({
    name: s.servicioNombre.length > 15 ? s.servicioNombre.substring(0, 12) + '...' : s.servicioNombre,
    fullName: s.servicioNombre,
    ventas: s.ingresosCop,
    utilidad: s.ingresosCop - (s.horasRegistradas * (s.ingresosCop > 0 ? (vcostByServiceId(s.servicioId) || 0) : 0)) // estimation
  }));

  function vcostByServiceId(id: string) {
    return data.servicios.find(s => s.id === id)?.costo_unitario || 0;
  }

  // 2. Monthly Evolution (ventas, costos, utilidad)
  // Group by month
  const monthlyMap = new Map<string, { ventas: number; costos: number }>();
  ventas.forEach(v => {
    if (!v.fecha) return;
    const m = v.fecha.substring(0, 7);
    const existing = monthlyMap.get(m) || { ventas: 0, costos: 0 };
    const valCop = v.precio_venta_unitario * v.cantidad * (v.moneda === 'USD' ? config.trm : 1);
    existing.ventas += valCop;
    existing.costos += v.costo_unitario * v.cantidad;
    monthlyMap.set(m, existing);
  });

  const evolutionData = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, val]) => ({
      month,
      ventas: val.ventas,
      costos: val.costos + (gastosOperativos / (recordsMonthsCount || 1)), // operational cost weight
      utilidad: val.ventas - val.costos - (gastosOperativos / (recordsMonthsCount || 1))
    }));

  return (
    <div className="space-y-8 animate-fade-in text-[#e8e3d8]">

      {/* 5-Level Utility Step Banner */}
      <div>
        <h3 className="text-xs font-mono tracking-[0.2em] text-[#a39d8e] uppercase mb-4 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-[#c9a961]" /> Niveles de Utilidad
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          
          <div className="bg-[#161412] border border-[#2a2620] border-l-4 border-l-[#a39d8e] p-5 rounded-lg">
            <span className="text-[10px] font-mono tracking-wider text-[#8a8377] block uppercase">Nivel 0</span>
            <span className="text-sm font-sans font-medium text-[#a39d8e] block mt-1">Ventas Totales</span>
            <div className="text-xl font-display font-semibold text-[#e8e3d8] mt-3">{formatCop(totalVentas)}</div>
            <div className="text-[10px] text-[#8a8377] font-mono mt-1">100% de ingresos</div>
          </div>

          <div className="bg-[#161412] border border-[#2a2620] border-l-4 border-l-[#c9a961] p-5 rounded-lg">
            <span className="text-[10px] font-mono tracking-wider text-[#8a8377] block uppercase">Nivel 1</span>
            <span className="text-sm font-sans font-medium text-[#a39d8e] block mt-1">Utilidad Bruta</span>
            <div className="text-xl font-display font-semibold text-[#c9a961] mt-3">{formatCop(utilidadBruta)}</div>
            <div className="text-[10px] text-[#8a8377] font-mono mt-1">Menos costos directos</div>
          </div>

          <div className="bg-[#161412] border border-[#2a2620] border-l-4 border-l-[#a8c98a] p-5 rounded-lg">
            <span className="text-[10px] font-mono tracking-wider text-[#8a8377] block uppercase">Nivel 2</span>
            <span className="text-sm font-sans font-medium text-[#a39d8e] block mt-1">Utilidad Operacional</span>
            <div className="text-xl font-display font-semibold text-[#a8c98a] mt-3">{formatCop(utilidadOperacional)}</div>
            <div className="text-[10px] text-[#8a8377] font-mono mt-1">Menos herramientas y fijos</div>
          </div>

          <div className="bg-[#161412] border border-[#2a2620] border-l-4 border-l-[#c97a61] p-5 rounded-lg">
            <span className="text-[10px] font-mono tracking-wider text-[#8a8377] block uppercase">Nivel 3</span>
            <span className="text-sm font-sans font-medium text-[#a39d8e] block mt-1">Antes de Impuestos</span>
            <div className="text-xl font-display font-semibold text-[#e8e3d8] mt-3">{formatCop(utilidadAntesImpuestos)}</div>
            <div className="text-[10px] text-[#8a8377] font-mono mt-1">Menos salario Mafe</div>
          </div>

          <div className="bg-[#181512] border border-[#2a2620] border-l-4 border-l-[#c9a961] p-5 rounded-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#c9a961]/5 rounded-bl-full pointer-events-none" />
            <span className="text-[10px] font-mono tracking-wider text-[#c9a961] block uppercase">Nivel 4 · Neto</span>
            <span className="text-sm font-sans font-medium text-[#e8e3d8] block mt-1 font-semibold">Utilidad Neta Real</span>
            <div className="text-xl font-display font-bold text-[#a8c98a] mt-3">{formatCop(utilidadNeta)}</div>
            <div className="text-[10px] text-[#8a8377] font-mono mt-1">Menos Renta DIAN Est.</div>
          </div>

        </div>
      </div>

      {/* 4 Cards: Retenciones, Banco, Salario Neto, Adelantos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-[#13110f] border border-[#2a2620] p-5 rounded-lg">
          <span className="text-[10px] font-mono tracking-wider text-[#8a8377] uppercase block">Retenciones Aplicadas</span>
          <div className="text-2xl font-display font-medium text-[#c97a61] mt-2">{formatCop(totalRetencion)}</div>
          <p className="text-[11px] text-[#8a8377] font-sans mt-2">Deducido en la fuente por declarar.</p>
        </div>

        <div className="bg-[#13110f] border border-[#2a2620] p-5 rounded-lg">
          <span className="text-[10px] font-mono tracking-wider text-[#8a8377] uppercase block">Lo que entra al Banco</span>
          <div className="text-2xl font-display font-medium text-[#a8c98a] mt-2">{formatCop(loQueEntraAlBanco)}</div>
          <p className="text-[11px] text-[#8a8377] font-sans mt-2">Valor neto sin retenciones.</p>
        </div>

        <div className="bg-[#13110f] border border-[#2a2620] p-5 rounded-lg flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-mono tracking-wider text-[#8a8377] uppercase block">Control Salarial (Socio)</span>
            <div className="flex items-baseline justify-between mt-2.5">
              <span className="text-xs text-[#a39d8e]">Real Pagado:</span>
              <span className="text-xl font-display font-semibold text-[#a8c98a]">{formatCop(metrics.salariosRealesPagados)}</span>
            </div>
          </div>
          <div className="border-t border-[#2a2620]/50 pt-2 mt-2 space-y-1 text-[10px] font-mono">
            <div className="flex justify-between text-[#a39d8e]">
              <span>Propuesto:</span>
              <span className="text-[#c9a961]">{formatCop(salarioPropuesto)}</span>
            </div>
            <div className="flex justify-between text-[#8a8377]">
              <span>Neto Retirable Est:</span>
              <span className="text-[#e8e3d8]">{formatCop(miSalarioNeto)}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#13110f] border border-[#2a2620] p-5 rounded-lg">
          <span className="text-[10px] font-mono tracking-wider text-[#8a8377] uppercase block">Adelantos Recibidos</span>
          <div className="text-2xl font-display font-medium text-[#e8e3d8] mt-2">{formatCop(totalAdelanto)}</div>
          <p className="text-[11px] text-[#8a8377] font-sans mt-2">Suma de anticipos de clientes.</p>
        </div>

      </div>

      {/* Ventas Nacionales vs Internacionales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="bg-[#161412] border border-[#2a2620] border-l-3 border-l-[#c9a961] p-6 rounded-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase">Ventas Nacionales</span>
              <span className="text-[10px] bg-[#c9a961]/10 text-[#c9a961] px-2 py-0.5 rounded font-mono font-semibold">CO</span>
            </div>
            <div className="text-2xl font-display font-bold text-[#e8e3d8] mt-4">{formatCop(ventasNacionales)}</div>
            <p className="text-xs text-[#a39d8e] mt-2 leading-relaxed">
              Ventas en territorio colombiano. Sujetas a cobro de IVA y retenciones en la fuente según el estatuto.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-[#2a2620] flex items-center justify-between text-xs font-mono text-[#8a8377]">
            <span>Margen de contribución nacional:</span>
            <span className="font-bold text-[#a8c98a]">{margenNacional.toFixed(1)}%</span>
          </div>
        </div>

        <div className="bg-[#161412] border border-[#2a2620] border-l-3 border-[#8a8377] p-6 rounded-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase">Ventas Internacionales</span>
              <span className="text-[10px] bg-emerald-500/10 text-[#a8c98a] px-2 py-0.5 rounded font-mono font-semibold">GOB</span>
            </div>
            <div className="text-2xl font-display font-bold text-[#e8e3d8] mt-4">{formatCop(ventasInternacionales)}</div>
            <p className="text-xs text-[#a39d8e] mt-2 leading-relaxed">
              Exportación de servicios digitales. Exentas de IVA por ley especial de exportación.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-[#2a2620] flex items-center justify-between text-xs font-mono text-[#8a8377]">
            <span>Nota de régimen tributario:</span>
            <span className="text-[#a8c98a] font-semibold">Exenta de IVA (Art. 481 ET)</span>
          </div>
        </div>

      </div>

      {/* Hour analysis (visible only if there are recorded hours) */}
      {totalHoras > 0 && (
        <div className="bg-[#13110f] border border-[#2a2620] p-6 rounded-lg">
          <h4 className="text-xs font-mono tracking-[0.2em] text-[#a39d8e] uppercase mb-4 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#c9a961]" /> Análisis del Valor de Mi Hora
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="bg-white/[0.01] border border-[#2a2620] p-4 rounded-lg">
              <span className="text-[10px] font-mono text-[#8a8377] uppercase block">Hora Cobrada Promedio</span>
              <div className="text-xl font-display font-semibold text-[#e8e3d8] mt-2">{formatCop(horaCobradaObj)}</div>
              <p className="text-[11px] text-[#8a8377] mt-1 font-mono">Factura general / Total horas registradas</p>
            </div>

            <div className="bg-white/[0.01] border border-[#2a2620] p-4 rounded-lg">
              <span className="text-[10px] font-mono text-[#8a8377] uppercase block">Hora Real</span>
              <div className="text-xl font-display font-semibold text-[#a8c98a] mt-2">{formatCop(horaRealObj)}</div>
              <p className="text-[11px] text-[#8a8377] mt-1 font-mono">Utilidad neta real / Total horas registradas</p>
            </div>

            <div className="bg-white/[0.01] border border-[#2a2620] p-4 rounded-lg">
              <span className="text-[10px] font-mono text-[#c9a961] uppercase block font-semibold">Hora Mínima Objetivo</span>
              <div className="text-xl font-display font-semibold text-[#c9a961] mt-2">{formatCop(horaObjetivoMinima)}</div>
              <p className="text-[11px] text-[#8a8377] mt-1 font-mono">Salario / Horas objetivo ({config.horas_objetivo_mes || 160})</p>
            </div>

          </div>
        </div>
      )}

      {/* Tax alert progress lines (Anualizadas) */}
      <div className="bg-[#161412] border border-[#2a2620] p-6 rounded-lg">
        <h4 className="text-xs font-mono tracking-[0.2em] text-[#a39d8e] uppercase mb-6 flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-[#c97a61]" /> Proyecciones de Carga e Impuestos DIAN 2026
        </h4>

        <div className="space-y-6">
          
          {/* Card 1: Declarar Renta */}
          <div className={`border-l-3 p-4 rounded ${alertRenta.border}`}>
            <div className="flex flex-col sm:flex-row justify-between text-xs font-mono mb-2">
              <span className="text-[#e8e3d8] uppercase font-semibold">1. Declaración de Renta Persona Natural</span>
              <span className="text-[#a39d8e]">Ventas Anuales Proyectadas: <b className="text-white">{formatCop(projectedAnnualSales)}</b> / {formatCop(limiteRentaVentas)} (1.400 UVT)</span>
            </div>
            <div className="w-full bg-[#2a2620] rounded-full h-2 overflow-hidden mt-2">
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(pctRentaVentas, 100)}%`, backgroundColor: alertRenta.bar }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono text-[#a39d8e] mt-2">
              <span>Porcentaje de cumplimiento del tope: {pctRentaVentas.toFixed(0)}%</span>
              <span className="uppercase tracking-wider font-semibold" style={{ color: alertRenta.bar }}>[{alertRenta.text}]</span>
            </div>
          </div>

          {/* Card 2: Responsante IVA */}
          <div className={`border-l-3 p-4 rounded ${alertIva.border}`}>
            <div className="flex flex-col sm:flex-row justify-between text-xs font-mono mb-2">
              <span className="text-[#e8e3d8] uppercase font-semibold">2. Responsabilidad de IVA (Art. 437 ET)</span>
              <span className="text-[#a39d8e]">Tope de Ingresos: <b className="text-white">{formatCop(projectedAnnualSales)}</b> / {formatCop(limiteResponsableIva)} (3.500 UVT)</span>
            </div>
            <div className="w-full bg-[#2a2620] rounded-full h-2 overflow-hidden mt-2">
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(pctIvaVentas, 100)}%`, backgroundColor: alertIva.bar }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono text-[#a39d8e] mt-2">
              <span>Porcentaje de cumplimiento del tope: {pctIvaVentas.toFixed(0)}%</span>
              <span className="uppercase tracking-wider font-semibold" style={{ color: alertIva.bar }}>[{alertIva.text}]</span>
            </div>
          </div>

          {/* Card 3: Pagar Renta */}
          <div className={`border-l-3 p-4 rounded ${alertPagoRenta.border}`}>
            <div className="flex flex-col sm:flex-row justify-between text-xs font-mono mb-2">
              <span className="text-[#e8e3d8] uppercase font-semibold">3. Impuesto de Renta a Pagar</span>
              <span className="text-[#a39d8e]">Utilidad Gravable Anual: <b className="text-white">{formatCop(projectedAnnualNet)}</b> / Exento hasta {formatCop(limitePagaRenta)} (1.090 UVT)</span>
            </div>
            <div className="w-full bg-[#2a2620] rounded-full h-2 overflow-hidden mt-2">
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(pctPagaRenta, 100)}%`, backgroundColor: alertPagoRenta.bar }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono text-[#a39d8e] mt-2">
              <span>Porcentaje de exención utilizado: {pctPagaRenta.toFixed(0)}%</span>
              <span className="uppercase tracking-wider font-semibold" style={{ color: alertPagoRenta.bar }}>[{alertPagoRenta.text}]</span>
            </div>
          </div>

        </div>
      </div>

      {/* RECHARTS CHANNELS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Ventas por servicio */}
        <div className="bg-[#161412] border border-[#2a2620] p-6 rounded-lg">
          <h4 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase mb-6">
            Ventas por Servicio
          </h4>
          <div className="h-64">
            {chartServiceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartServiceData}>
                  <XAxis dataKey="name" stroke="#8a8377" fontSize={11} tickLine={false} />
                  <YAxis stroke="#8a8377" fontSize={11} tickFormatter={(v) => `$${(v/1e6).toFixed(1)}M`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#161412', borderColor: '#2a2620', color: '#e8e3d8' }}
                    formatter={(v: any) => [formatCop(v), 'Facturado']}
                  />
                  <Bar dataKey="ventas" fill="#c9a961" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#8a8377] font-mono">Sin información</div>
            )}
          </div>
        </div>

        {/* Utilidad por servicio */}
        <div className="bg-[#161412] border border-[#2a2620] p-6 rounded-lg">
          <h4 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase mb-6">
            Utilidad Operativa Estimada por Servicio
          </h4>
          <div className="h-64">
            {chartServiceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartServiceData}>
                  <XAxis dataKey="name" stroke="#8a8377" fontSize={11} tickLine={false} />
                  <YAxis stroke="#8a8377" fontSize={11} tickFormatter={(v) => `$${(v/e6TotalOr1(v)).toFixed(1)}M`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#161412', borderColor: '#2a2620', color: '#e8e3d8' }}
                    formatter={(v: any) => [formatCop(v), 'Utilidad']}
                  />
                  <Bar dataKey="utilidad" fill="#a8c98a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#8a8377] font-mono">Sin información</div>
            )}
          </div>
        </div>

      </div>

      {/* Evolución Mensual (Ventas, Costos, Utilidad) */}
      <div className="bg-[#161412] border border-[#2a2620] p-6 rounded-lg">
        <h4 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase mb-6">
          Evolución Mensual (Ventas vs Costos vs Utilidad Neta)
        </h4>
        <div className="h-72">
          {evolutionData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData}>
                <CartesianGrid stroke="#2a2620" strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="#8a8377" fontSize={11} />
                <YAxis stroke="#8a8377" fontSize={11} tickFormatter={(v) => `$${(v/1e6).toFixed(1)}M`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#161412', borderColor: '#2a2620', color: '#e8e3d8' }}
                  formatter={(v: any) => [formatCop(v)]}
                />
                <Legend textAnchor="middle" wrapperStyle={{ fontSize: 11, color: '#e8e3d8', pt: 10 }} />
                <Line type="monotone" dataKey="ventas" name="Ventas" stroke="#c9a961" strokeWidth={2} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="costos" name="Costos + Fijos" stroke="#c97a61" strokeWidth={1.5} />
                <Line type="monotone" dataKey="utilidad" name="Utilidad Estimada" stroke="#a8c98a" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-[#8a8377] font-mono">Sin información histórica suficiente</div>
          )}
        </div>
      </div>

    </div>
  );
}

function e6TotalOr1(v: number) {
  return 1e6;
}
