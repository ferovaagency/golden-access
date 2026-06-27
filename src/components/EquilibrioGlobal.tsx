import React from 'react';
import { FinancialMetrics } from '../lib/calculations';
import { Shield, Sparkles, Scale, Percent } from 'lucide-react';

interface EquilibrioGlobalProps {
  metrics: FinancialMetrics;
  formatCop: (val: number) => string;
}

export default function EquilibrioGlobal({ metrics, formatCop }: EquilibrioGlobalProps) {
  const { 
    totalVentas, 
    costosVariables, 
    utilidadBruta, 
    gastosOperativos, 
    salarioPropuesto, 
    margenContribucion, 
    puntoEquilibrioVentas 
  } = metrics;

  // Expenses total
  const gastosFijosTotales = gastosOperativos + salarioPropuesto;

  // Sales vs breakeven
  const diferenciaBreakeven = totalVentas - puntoEquilibrioVentas;
  const haSuperadoBreakeven = totalVentas >= puntoEquilibrioVentas;
  const porcentajeAvance = puntoEquilibrioVentas > 0 
    ? (totalVentas / puntoEquilibrioVentas) * 100 
    : 0;

  return (
    <div className="space-y-8 animate-fade-in text-[#e8e3d8]">

      {/* Header */}
      <div className="border-b border-[#2a2620] pb-5">
        <h2 className="text-xl font-display font-medium text-[#c9a961]">Estudio del Punto de Equilibrio Global</h2>
        <p className="text-xs text-[#a39d8e] font-mono mt-1">¿Cuánto necesita vender Ferova S.A.S para operar de forma segura?</p>
      </div>

      {/* 4 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        <div className="bg-[#161412] border border-[#2a2620] p-5 rounded-lg border-l-3 border-l-[#c97a61]">
          <span className="text-[10px] font-mono tracking-wider text-[#8a8377] uppercase block">Gastos Estructurales</span>
          <div className="text-xl font-display font-semibold text-[#e8e3d8] mt-2">{formatCop(gastosFijosTotales)}</div>
          <span className="text-[10px] text-[#8a8377] font-mono block mt-1">Gastos operativos + Salario Mafe</span>
        </div>

        <div className="bg-[#161412] border border-[#2a2620] p-5 rounded-lg border-l-3 border-l-[#c9a961]">
          <span className="text-[10px] font-mono tracking-wider text-[#8a8377] uppercase block">Margen Contribución Prom.</span>
          <div className="text-xl font-display font-semibold text-[#c9a961] mt-2">{(margenContribucion * 100).toFixed(1)}%</div>
          <span className="text-[10px] text-[#8a8377] font-mono block mt-1">Ingresos promedio menos variables</span>
        </div>

        <div className="bg-[#161412] border border-[#2a2620] p-5 rounded-lg border-l-3 border-l-[#c9a961]">
          <span className="text-[10px] font-mono tracking-wider text-[#c9a961] uppercase block font-semibold">Punto de Equilibrio</span>
          <div className="text-xl font-display font-bold text-[#c9a961] mt-2">{formatCop(puntoEquilibrioVentas)}</div>
          <span className="text-[10px] text-[#8a8377] font-mono block mt-1">Ventas netas mínimas requeridas</span>
        </div>

        <div className={`border p-5 rounded-lg border-l-3 ${haSuperadoBreakeven ? 'border-l-[#a8c98a] bg-[#141812] border-[#2a2620]' : 'border-l-[#c97a61] bg-[#181312] border-[#2a2620]'}`}>
          <span className="text-[10px] font-mono tracking-wider text-[#8a8377] uppercase block">Diagnóstico Financiero</span>
          <div className="text-xl font-display font-bold mt-2" style={{ color: haSuperadoBreakeven ? '#a8c98a' : '#c97a61' }}>
            {haSuperadoBreakeven ? 'ZONA GANANCIA' : 'ZONA DÉFICIT'}
          </div>
          <span className="text-[10px] text-[#8a8377] font-mono block mt-1">
            {haSuperadoBreakeven 
              ? `${formatCop(diferenciaBreakeven)} sobre mínimo` 
              : `Faltan ${formatCop(Math.abs(diferenciaBreakeven))} para sanear`}
          </span>
        </div>

      </div>

      {/* Visual meter bar vs point of equilibrium */}
      <div className="bg-[#161412] border border-[#2a2620] p-6 rounded-lg space-y-4">
        <h4 className="text-xs font-mono tracking-[0.2em] text-[#a39d8e] uppercase flex items-center gap-1.5">
          <Scale className="w-4 h-4 text-[#c9a961]" /> Estado de Cumplimiento de Operaciones
        </h4>
        
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono text-[#a39d8e]">
            <span>Volumen de Ventas de este Periodo: <b className="text-[#e8e3d8]">{formatCop(totalVentas)}</b></span>
            <span>Meta de Equilibrio General: <b className="text-[#e8e3d8]">{formatCop(puntoEquilibrioVentas)}</b></span>
          </div>
          
          <div className="w-full bg-[#2a2620] h-3.5 rounded-full overflow-hidden flex">
            <div 
              className="h-full rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.min(porcentajeAvance, 100)}%`, 
                backgroundColor: haSuperadoBreakeven ? '#a8c98a' : '#c9a961' 
              }}
            />
          </div>
          
          <p className="text-[11px] font-mono text-[#8a8377] text-right">
            Nivel de auto-cobertura estructural: <span className="text-white font-bold">{porcentajeAvance.toFixed(0)}%</span>
          </p>
        </div>
      </div>

      {/* Informative educational sector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="bg-[#13110f] border border-[#2a2620] p-6 rounded-lg space-y-3">
          <h4 className="text-xs font-mono text-[#c9a961] uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-[#c9a961]" /> ¿Por Qué es Importante este Punto?
          </h4>
          <p className="text-xs text-[#a39d8e] leading-relaxed">
            Como empresaria digital uniplersonal de <strong>Ferova Agency</strong>, no toda la facturación es ganancia pura.
          </p>
          <p className="text-xs text-[#a39d8e] leading-relaxed">
            El punto de equilibrio global suma tanto los costos directos de tus servicios (desarrollo web, analíticas) como tu salario mensual fijado con sus prestaciones liquidadas. Vender por debajo de este monto significa que estás absorbiendo pérdidas en tu patrimonio propio o sub-cotizando tu mano de obra.
          </p>
        </div>

        <div className="bg-[#13110f] border border-[#2a2620] p-6 rounded-lg space-y-3">
          <h4 className="text-xs font-mono text-[#c97a61] uppercase tracking-wider flex items-center gap-1">
            <Shield className="w-4 h-4 text-[#c97a61]" /> Planes de Contingencia Estricta
          </h4>
          <p className="text-xs text-[#a39d8e] leading-relaxed">
            Si notas que tus ventas están recurrentemente por debajo de la meta de equilibrio del mes, evalúa:
          </p>
          <ul className="list-disc pl-4 text-xs text-[#a39d8e] space-y-1.5 leading-snug">
            <li>Reducir el número de licencias SaaS globales redundantes.</li>
            <li>Re-negociar fijos o reevaluar la asignación de horas en proyectos de bajo margen.</li>
            <li>Ajustar tu tarifa mínima por hora objetivo subiendo el valor base en tus cuentas de cobro recurrentes.</li>
          </ul>
        </div>

      </div>

    </div>
  );
}
