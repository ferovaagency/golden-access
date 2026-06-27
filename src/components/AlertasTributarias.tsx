import React from 'react';
import { Config, Venta } from '../types';
import { FinancialMetrics } from '../lib/calculations';
import { ShieldAlert, BookOpen, AlertCircle, Sparkles, Milestone } from 'lucide-react';

interface AlertasTributariasProps {
  metrics: FinancialMetrics;
  config: Config;
  ventas: Venta[];
  formatCop: (val: number) => string;
}

export default function AlertasTributarias({ metrics, config, ventas, formatCop }: AlertasTributariasProps) {
  const uniqueMonths = Array.from(new Set(ventas.map(v => v.fecha?.substring(0, 7)).filter(Boolean)));
  const recordsMonthsCount = uniqueMonths.length || 1;
  const avgMonthlySales = metrics.totalVentas / recordsMonthsCount;
  const projectedAnnualSales = avgMonthlySales * 12;

  // Limits
  const limiteRentaVentas = config.tope_no_declarante_uvt * config.uvt; // 1400 uvt
  const limiteResponsableIva = config.tope_responsable_iva_uvt * config.uvt; // 3500 uvt
  const limitePagaRenta = config.tope_no_paga_renta_uvt * config.uvt; // 1090 uvt

  const pctRentaVentas = Math.min((projectedAnnualSales / limiteRentaVentas) * 100, 150);
  const pctIvaVentas = Math.min((projectedAnnualSales / limiteResponsableIva) * 100, 150);

  // Scaled monthly net
  const avgMonthlyNet = (metrics.utilidadAntesImpuestos / recordsMonthsCount);
  const projectedAnnualNet = avgMonthlyNet * 12;
  const pctPagaRenta = projectedAnnualNet > 0 
    ? Math.min((projectedAnnualNet / limitePagaRenta) * 100, 150) 
    : 0;

  // Resolve visual indicators
  const resolveAlertLevel = (pct: number) => {
    if (pct < 70) {
      return { 
        bar: '#a8c98a', 
        bg: 'bg-[#141812]/40', 
        border: 'border-[#a8c98a]/30 border-l-[#a8c98a]', 
        text: 'Nivel Seguro', 
        desc: 'Operas holgadamente por debajo de las obligaciones DIAN para este tope. Continúa parametrizando en calma.' 
      };
    } else if (pct < 100) {
      return { 
        bar: '#c9a961', 
        bg: 'bg-[#181611]/40', 
        border: 'border-[#c9a961]/30 border-l-[#c9a961]', 
        text: 'Alerta Preventiva', 
        desc: 'Te aproximas a la banda de transición del tope legal. Consulta con tu contador de confianza para organizar tus extractos bancarios.' 
      };
    } else {
      return { 
        bar: '#c97a61', 
        bg: 'bg-[#181312]/40', 
        border: 'border-[#c97a61]/30 border-l-[#c97a61]', 
        text: 'Obligación Superada', 
        desc: 'Tope legal superado según tu proyección anualizada de ventas en COP. Requieres tomar medidas fiscales inmediatas en tu RUT.' 
      };
    }
  };

  const alertDeclRenta = resolveAlertLevel(pctRentaVentas);
  const alertIva = resolveAlertLevel(pctIvaVentas);
  const alertPagoRenta = resolveAlertLevel(pctPagaRenta);

  return (
    <div className="space-y-8 animate-fade-in text-[#e8e3d8]">

      {/* Header */}
      <div className="border-b border-[#2a2620] pb-5">
        <h2 className="text-xl font-display font-medium text-[#c9a961]">Semáforo Ampliado de Alertas Tributarias</h2>
        <p className="text-xs text-[#a39d8e] font-mono mt-1">Simulación preventiva anualizada para evitar requerimientos o multas con la DIAN</p>
      </div>

      {/* Intro info box */}
      <div className="bg-[#13110f] border border-[#2a2620] p-5 rounded-lg flex gap-4 leading-relaxed text-xs">
        <AlertCircle className="w-5 h-5 text-[#c9a961] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-[#e8e3d8] block">Metodología de Proyección Anual</span>
          <p className="text-[#a39d8e]">
            Las alertas toman tu promedio de facturación real acumulado mensual (<b className="text-white">{formatCop(avgMonthlySales)}/mes</b>) multiplicándolo por 12 meses. Esto permite anticipar con meses de anticipación qué topes romperás a fin de año bajo tu volumen actual de operación.
          </p>
        </div>
      </div>

      <div className="space-y-6">

        {/* Alarm 1: Declarante de Renta */}
        <div className={`p-6 rounded-lg border-l-4 border ${alertDeclRenta.border} ${alertDeclRenta.bg}`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#8a8377] block">Tope 1 · DIAN 1.400 UVT</span>
              <h4 className="text-sm font-display font-semibold text-[#e8e3d8] mt-0.5">Obligación de Declarar Renta como Persona Natural</h4>
            </div>
            <span className="px-2 py-0.5 font-mono text-[10px] rounded uppercase font-bold tracking-wider" style={{ color: alertDeclRenta.bar, backgroundColor: `${alertDeclRenta.bar}10` }}>
              {alertDeclRenta.text}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
            <div className="md:col-span-3 space-y-3.5">
              <div className="w-full bg-[#2a2620] h-3 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(pctRentaVentas, 100)}%`, backgroundColor: alertDeclRenta.bar }}
                />
              </div>
              <p className="text-xs text-[#a39d8e] leading-snug">{alertDeclRenta.desc}</p>
            </div>
            
            <div className="bg-[#0f0e0c]/50 p-3 rounded border border-white/[0.01]/80 text-center font-mono shrink-0">
              <span className="text-[9px] text-[#8a8377] block">PROYECTADO ANUAL</span>
              <span className="font-bold text-sm block mt-1">{formatCop(projectedAnnualSales)}</span>
              <span className="text-[10px] text-[#8a8377] block mt-1">Tope: {formatCop(limiteRentaVentas)}</span>
            </div>
          </div>
        </div>

        {/* Alarm 2: Responsable de IVA */}
        <div className={`p-6 rounded-lg border-l-4 border ${alertIva.border} ${alertIva.bg}`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#8a8377] block">Tope 2 · DIAN 3.500 UVT</span>
              <h4 className="text-sm font-display font-semibold text-[#e8e3d8] mt-0.5">Responsabilidad de IVA (Art. 437 - Régimen Común)</h4>
            </div>
            <span className="px-2 py-0.5 font-mono text-[10px] rounded uppercase font-bold tracking-wider" style={{ color: alertIva.bar, backgroundColor: `${alertIva.bar}10` }}>
              {alertIva.text}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
            <div className="md:col-span-3 space-y-3.5">
              <div className="w-full bg-[#2a2620] h-3 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(pctIvaVentas, 100)}%`, backgroundColor: alertIva.bar }}
                />
              </div>
              <p className="text-xs text-[#a39d8e] leading-snug">{alertIva.desc}</p>
            </div>
            
            <div className="bg-[#0f0e0c]/50 p-3 rounded border border-white/[0.01]/80 text-center font-mono shrink-0">
              <span className="text-[9px] text-[#8a8377] block">COBRADO ANUAL EST.</span>
              <span className="font-bold text-sm block mt-1">{formatCop(projectedAnnualSales)}</span>
              <span className="text-[10px] text-[#8a8377] block mt-1">Tope: {formatCop(limiteResponsableIva)}</span>
            </div>
          </div>
        </div>

        {/* Alarm 3: Consignación / Tarifa renta */}
        <div className={`p-6 rounded-lg border-l-4 border ${alertPagoRenta.border} ${alertPagoRenta.bg}`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#8a8377] block">Tope 3 · DIAN 1.090 UVT RETA</span>
              <h4 className="text-sm font-display font-semibold text-[#e8e3d8] mt-0.5">Tarifa a Pagar de Renta (Banda Exenta vs Gravable)</h4>
            </div>
            <span className="px-2 py-0.5 font-mono text-[10px] rounded uppercase font-bold tracking-wider" style={{ color: alertPagoRenta.bar, backgroundColor: `${alertPagoRenta.bar}10` }}>
              {alertPagoRenta.text}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
            <div className="md:col-span-3 space-y-3.5">
              <div className="w-full bg-[#2a2620] h-3 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(pctPagaRenta, 100)}%`, backgroundColor: alertPagoRenta.bar }}
                />
              </div>
              <p className="text-xs text-[#a39d8e] leading-snug">{alertPagoRenta.desc}</p>
            </div>
            
            <div className="bg-[#0f0e0c]/50 p-3 rounded border border-white/[0.01]/80 text-center font-mono shrink-0">
              <span className="text-[9px] text-[#8a8377] block">UTILIDAD ANUAL EST.</span>
              <span className="font-bold text-sm block mt-1">{formatCop(projectedAnnualNet)}</span>
              <span className="text-[10px] text-[#8a8377] block mt-1">Exento: {formatCop(limitePagaRenta)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Visual Executive Summary and Informative guidelines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        
        <div className="bg-[#161412] border border-[#2a2620] p-6 rounded-lg space-y-4">
          <h4 className="text-sm font-display font-semibold text-[#c9a961] flex items-center gap-1.5 border-b border-[#2a2620] pb-3">
            <BookOpen className="w-4 h-4 text-[#c9a961]" /> Resumen Ejecutivo de Riesgos
          </h4>
          <p className="text-xs text-[#a39d8e] leading-relaxed">
            Como Persona Natural Comerciante en Colombia, el mayor riesgo fiscal proviene del <strong>artículo 364 del estatuto tributario</strong> que contempla sanciones por omisión de activos o ingresos.
          </p>
          <p className="text-xs text-[#a39d8e] leading-relaxed">
            Si superas las 1.400 UVT anuales en ingresos o consignaciones bancarias, estarás obligada a presentar la Declaración de Renta Cedular al año siguiente. Tu impuesto de renta se calcula de forma progresiva según las tarifas de la tabla de retenciones de personas naturales una vez deducidas las depuraciones.
          </p>
        </div>

        <div className="bg-[#161412] border border-[#2a2620] p-6 rounded-lg space-y-4">
          <h4 className="text-sm font-display font-semibold text-[#a8c98a] flex items-center gap-1.5 border-b border-[#2a2620] pb-3">
            <Milestone className="w-4 h-4 text-[#a8c98a]" /> Recomendaciones Prácticas DIAN
          </h4>
          <ul className="list-disc pl-4 text-xs text-[#a39d8e] space-y-3 leading-relaxed">
            <li>
              <strong>Cuentas separadas</strong>: Nunca mezcles consignaciones familiares o de terceros en tu cuenta corporativa. DIAN evalúa consignaciones totales brutas sin discriminar su origen.
            </li>
            <li>
              <strong>Límite de IVA</strong>: Si estás por acercarte al tope de 3.500 UVT, planifica con tu contador la conveniencia de constituir una S.A.S para separar tu patrimonio personal y facturar con IVA corporativo.
            </li>
            <li>
              <strong>Recaudo a favor</strong>: Guarda todas tus cuentas de cobro emitidas junto a los comprobantes de retención en la fuente practicados para restarlos como abonos en tu declaración anual.
            </li>
          </ul>
        </div>

      </div>

    </div>
  );
}
