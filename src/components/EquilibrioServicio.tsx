import React from 'react';
import { Servicio, Herramienta, Cliente, Venta, Config } from '../types';
import { convertToCop, calcularCostosHerramientas } from '../lib/calculations';
import { Box, CheckSquare, Target, Activity } from 'lucide-react';

interface EquilibrioServicioProps {
  servicios: Servicio[];
  herramientas: Herramienta[];
  clientes: Cliente[];
  ventas: Venta[];
  config: Config;
  selectedMonth: string;
  formatCop: (val: number) => string;
}

export default function EquilibrioServicio({
  servicios,
  herramientas,
  clientes,
  ventas,
  config,
  selectedMonth,
  formatCop
}: EquilibrioServicioProps) {
  const currentVentas = selectedMonth === 'Todos'
    ? ventas
    : ventas.filter(v => v.fecha && v.fecha.startsWith(selectedMonth));

  const clientesActivosCount = clientes.filter(c => c.activo).length;

  // Calculamos el costo global mensual de herramientas por servicio
  const toolsComputed = calcularCostosHerramientas(herramientas, clientesActivosCount, config.trm);
  
  // Distribute other overheads (Salario Mafe + Otros Gastos) equally among services
  const totalOtrosOverheads = config.salario_propuesto; // simple base
  const overheadSocioPorServicio = servicios.length > 0 
    ? totalOtrosOverheads / servicios.length 
    : totalOtrosOverheads;

  return (
    <div className="space-y-8 animate-fade-in text-[#e8e3d8]">
      
      {/* Visual Header */}
      <div className="border-b border-[#2a2620] pb-5">
        <h2 className="text-xl font-display font-medium text-[#c9a961]">Equilibrio por Línea de Servicio</h2>
        <p className="text-xs text-[#a39d8e] font-mono mt-1">Análisis de autosuficiencia y metas de venta física unitarias</p>
      </div>

      {servicios.length === 0 ? (
        <div className="bg-[#161412] border border-[#2a2620] p-8 text-center rounded text-[#8a8377] font-mono">
          No hay líneas de servicio creadas en el sistema. Agrégalas en Configuración.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {servicios.map(srv => {
            // Find tools assigned to this specific service
            const assignedTools = toolsComputed.filter(t => t.serviciosLinked.includes(srv.id));
            const toolsCostSrv = assignedTools.reduce((sum, current) => sum + current.costoAsignadoPorServicio, 0);

            // Total fijos asignados a este servicio = Tools cost mapped + overhead share
            const costoFijoAsignadoSrv = toolsCostSrv + overheadSocioPorServicio;

            // Average sales price of this service in our ledger
            const srvSales = currentVentas.filter(v => v.servicio_id === srv.id);
            const totalQuantitySoldSrv = srvSales.reduce((sum, v) => sum + v.cantidad, 0);
            
            const totalRevenueCopSrv = srvSales.reduce((sum, v) => {
              return sum + convertToCop(v.precio_venta_unitario * v.cantidad, v.moneda, config.trm);
            }, 0);

            // Average price per unit, if none sold, use a conservative default (e.g. 10 UVT or basic value)
            const averagePriceCop = totalQuantitySoldSrv > 0 
              ? totalRevenueCopSrv / totalQuantitySoldSrv 
              : 3500000; // default COP helper value

            // Margin of contribution per unit = Average Price - Direct Cost
            const directCostCop = srv.costo_unitario; // in COP
            const margenContribucionUnitario = averagePriceCop - directCostCop;

            // Break-even units
            const unidadesEquilibrioEstimadas = margenContribucionUnitario > 0 
              ? Math.max(Math.ceil(costoFijoAsignadoSrv / margenContribucionUnitario), 1)
              : 1;

            const porcentajeCumplido = Math.min((totalQuantitySoldSrv / unidadesEquilibrioEstimadas) * 100, 150);
            const metBreakeven = totalQuantitySoldSrv >= unidadesEquilibrioEstimadas;

            return (
              <div key={srv.id} className="bg-[#161412] border border-[#2a2620] pb-6 rounded-lg overflow-hidden flex flex-col justify-between">
                
                {/* Header */}
                <div className="bg-white/[0.02] border-b border-[#2a2620] px-5 py-4 flex justify-between items-center">
                  <h3 className="text-sm font-display font-semibold text-[#e8e3d8]">
                    {srv.nombre}
                  </h3>
                  <span className="text-[10px] font-mono bg-[#c9a961]/10 text-[#c9a961] px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                    Análisis
                  </span>
                </div>

                {/* Main statistics body */}
                <div className="p-5 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/[0.01] border border-[#2a2620]/80 p-3 rounded">
                      <span className="font-mono text-[#8a8377] text-[10px] uppercase block">Unidades Equilibrio</span>
                      <span className="font-display font-bold text-[#c9a961] text-lg mt-1 block">
                        {unidadesEquilibrioEstimadas} <span className="text-xs font-sans text-[#a39d8e]">uds/mes</span>
                      </span>
                    </div>

                    <div className="bg-white/[0.01] border border-[#2a2620]/80 p-3 rounded">
                      <span className="font-mono text-[#8a8377] text-[10px] uppercase block">Unidades Vendidas</span>
                      <span className="font-display font-bold text-white text-lg mt-1 block" style={{ color: metBreakeven ? '#a8c98a' : '#e8e3d8' }}>
                        {totalQuantitySoldSrv} <span className="text-xs font-sans text-[#a39d8e]">uds</span>
                      </span>
                    </div>
                  </div>

                  {/* Progressive indicator */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between font-mono text-[10px] text-[#a39d8e]">
                      <span>Avance de Equilibrio por Contrato:</span>
                      <span className={`font-semibold ${metBreakeven ? 'text-[#a8c98a]' : 'text-[#c99a61]'}`}>
                        {porcentajeCumplido.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-[#2a2620] h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.min(porcentajeCumplido, 100)}%`, 
                          backgroundColor: metBreakeven ? '#a8c98a' : '#c9a961' 
                        }}
                      />
                    </div>
                  </div>

                  {/* Direct costs table */}
                  <div className="border-t border-[#2a2620] pt-4.5 space-y-2">
                    <h4 className="text-[10px] font-mono uppercase tracking-wider text-[#a39d8e]">Matriz de Estructura de Costos del Servicio (Mensual)</h4>
                    <div className="bg-[#0f0e0c]/40 border border-[#2a2620]/80 rounded p-3 space-y-2 font-mono text-[11px] text-[#a39d8e]">
                      <div className="flex justify-between">
                        <span>Costo Directo Unitario (Entrega / Infra):</span>
                        <span className="text-white">{formatCop(directCostCop)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Herramientas SaaS Asignadas:</span>
                        <span className="text-white">{formatCop(toolsCostSrv)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Gastos y Nómina Prorrateada:</span>
                        <span className="text-white">{formatCop(overheadSocioPorServicio)}</span>
                      </div>
                      <div className="flex justify-between border-t border-[#2a2620]/60 pt-1.5 text-[#e8e3d8] font-semibold">
                        <span>Total Carga Estructural:</span>
                        <span>{formatCop(costoFijoAsignadoSrv)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer note */}
                <div className="px-5 py-3 border-t border-[#2a2620]/75 text-[11px] font-mono text-[#8a8377] flex items-center justify-between">
                  <span>Precio de venta de referencia:</span>
                  <span className="text-white font-medium">{formatCop(averagePriceCop)}</span>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
