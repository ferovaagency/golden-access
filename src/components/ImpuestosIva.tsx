import React, { useState, useEffect } from 'react';
import { AppData } from '../types';
import { FinancialMetrics } from '../lib/calculations';
import { ShieldCheck, HelpCircle, ArrowRightLeft, AlertTriangle } from 'lucide-react';

interface ImpuestosIvaProps {
  data: AppData;
  metrics: FinancialMetrics;
  formatCop: (val: number) => string;
}

export default function ImpuestosIva({ data, metrics, formatCop }: ImpuestosIvaProps) {
  const { config, ventas } = data;

  // Calculamos ingresos anualizados proyectados para evaluar tope del Art 437 (3500 uvt)
  const uniqueMonths = Array.from(new Set(ventas.map(v => v.fecha?.substring(0, 7)).filter(Boolean)));
  const recordsMonthsCount = uniqueMonths.length || 1;
  const avgMonthlySales = metrics.totalVentas / recordsMonthsCount;
  const proyeccionAnualIngresos = avgMonthlySales * 12;

  const limite3500Uvt = 3500 * config.uvt; // $183.309.000 COP

  // Checklist state for DIAN Art. 437 criteria (simplificando obligaciones)
  const isIngresosTopeSuperado = proyeccionAnualIngresos >= limite3500Uvt;

  const [criteria1, setCriteria1] = useState(!isIngresosTopeSuperado);
  const [criteria2, setCriteria2] = useState(true); // No más de un establecimiento
  const [criteria3, setCriteria3] = useState(true); // No franquicias en local
  const [criteria4, setCriteria4] = useState(true); // No usuario aduanero
  const [criteria5, setCriteria5] = useState(true); // No contratos individuales >= 3500 uvt
  const [criteria6, setCriteria6] = useState(true); // No consignaciones totales >= 3500 uvt

  useEffect(() => {
    setCriteria1(!isIngresosTopeSuperado);
  }, [isIngresosTopeSuperado]);

  // Cruce de IVA Simulator State
  const [ivaGeneradoInput, setIvaGeneradoInput] = useState<number>(0);
  const [ivaDescontableInput, setIvaDescontableInput] = useState<number>(0);

  const saldoIvaNettoValue = ivaGeneradoInput - ivaDescontableInput;
  const esSaldoAPagar = saldoIvaNettoValue > 0;
  const esSaldoAFavor = saldoIvaNettoValue < 0;

  return (
    <div className="space-y-8 animate-fade-in text-[#e8e3d8]">

      {/* Header */}
      <div className="border-b border-[#2a2620] pb-5">
        <h2 className="text-xl font-display font-medium text-[#c9a961]">Control de IVA y Obligaciones DIAN</h2>
        <p className="text-xs text-[#a39d8e] font-mono mt-1">Evaluación de responsabilidad tributaria bajo el Estatuto Colombiano 2026</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* A. Criterios de responsabilidad Art. 437 ET */}
        <div className="lg:col-span-6 bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden pb-6">
          <div className="bg-white/[0.02] border-b border-[#2a2620] px-5 py-4 flex items-center justify-between">
            <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold">
              Chequeo del Art. 437 del Estatuto Tributario
            </h3>
            <span className="text-[10px] font-mono bg-amber-500/10 text-[#c9a961] px-2 py-0.5 rounded uppercase font-bold">
              Límite: 3.500 UVT ({formatCop(limite3500Uvt)})
            </span>
          </div>

          <div className="p-5 space-y-4 text-xs font-sans">
            <p className="text-[11px] text-[#a39d8e] leading-relaxed">
              Para permanecer en el **Régimen Simplificado (No responsable de IVA)** en Colombia, Mafe debe cumplir con TODOS los siguientes requisitos simultáneos. Si alguno falla, pasas a Régimen Común.
            </p>

            <div className="space-y-3 pt-2">
              
              {/* Criterion 1 */}
              <div className={`p-3 rounded border flex items-start gap-3 transition ${criteria1 ? 'bg-white/[0.01] border-[#2a2620]' : 'bg-[#c97a61]/5 border-[#c97a61]/35'}`}>
                <input 
                  type="checkbox"
                  checked={criteria1}
                  onChange={(e) => setCriteria1(e.target.checked)}
                  className="w-4 h-4 accent-[#c9a961] mt-0.5"
                />
                <div className="space-y-1">
                  <span className="font-semibold block text-[#e8e3d8]">1. Ventas anuales por debajo de 3.500 UVT</span>
                  <span className="text-[11px] text-[#8a8377] block">
                    Tus ventas anualizadas estimadas son de <b className={isIngresosTopeSuperado ? 'text-[#c97a61]' : 'text-white'}>{formatCop(proyeccionAnualIngresos)}</b>. Límite: {formatCop(limite3500Uvt)}.
                  </span>
                  {isIngresosTopeSuperado && (
                    <span className="text-[10px] text-[#c97a61] font-mono font-bold block">
                      ⚠ ALERTA: Has superado el tope automático legal del periodo.
                    </span>
                  )}
                </div>
              </div>

              {/* Criterion 2 */}
              <div className="p-3 rounded border bg-white/[0.01] border-[#2a2620] flex items-start gap-3">
                <input 
                  type="checkbox"
                  checked={criteria2}
                  onChange={(e) => setCriteria2(e.target.checked)}
                  className="w-4 h-4 accent-[#c9a961] mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="font-semibold block text-[#e8e3d8]">2. Establecimientos de comercio</span>
                  <span className="text-[11px] text-[#8a8377] block">No poseer más de un establecimiento de comercio, oficina o local físico comercial.</span>
                </div>
              </div>

              {/* Criterion 3 */}
              <div className="p-3 rounded border bg-white/[0.01] border-[#2a2620] flex items-start gap-3">
                <input 
                  type="checkbox"
                  checked={criteria3}
                  onChange={(e) => setCriteria3(e.target.checked)}
                  className="w-4 h-4 accent-[#c9a961] mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="font-semibold block text-[#e8e3d8]">3. Actividades operadas bajo Franquicia</span>
                  <span className="text-[11px] text-[#8a8377] block">Que en el local no se desarrollen actividades bajo franquicia, regalía ni concesión marcaria.</span>
                </div>
              </div>

              {/* Criterion 4 */}
              <div className="p-3 rounded border bg-white/[0.01] border-[#2a2620] flex items-start gap-3">
                <input 
                  type="checkbox"
                  checked={criteria4}
                  onChange={(e) => setCriteria4(e.target.checked)}
                  className="w-4 h-4 accent-[#c9a961] mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="font-semibold block text-[#e8e3d8]">4. Calidad de Usuario Aduanero</span>
                  <span className="text-[11px] text-[#8a8377] block">No ser calificado como usuario aduanero (los exportadores de servicios exentos Art. 481 están autorizados).</span>
                </div>
              </div>

              {/* Criterion 5 */}
              <div className="p-3 rounded border bg-white/[0.01] border-[#2a2620] flex items-start gap-3">
                <input 
                  type="checkbox"
                  checked={criteria5}
                  onChange={(e) => setCriteria5(e.target.checked)}
                  className="w-4 h-4 accent-[#c9a961] mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="font-semibold block text-[#e8e3d8]">5. Contratos individuales menores a 3.500 UVT</span>
                  <span className="text-[11px] text-[#8a8377] block">No haber celebrado contratos de venta individuales mayor o igual a {formatCop(limite3500Uvt)} en este ejercicio fiscal.</span>
                </div>
              </div>

              {/* Criterion 6 */}
              <div className="p-3 rounded border bg-white/[0.01] border-[#2a2620] flex items-start gap-3">
                <input 
                  type="checkbox"
                  checked={criteria6}
                  onChange={(e) => setCriteria6(e.target.checked)}
                  className="w-4 h-4 accent-[#c9a961] mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="font-semibold block text-[#e8e3d8]">6. Consignaciones bancarias anuales</span>
                  <span className="text-[11px] text-[#8a8377] block">Consignaciones, depósitos o inversiones financieras totales en el año deben ser menores a 3.500 UVT.</span>
                </div>
              </div>

            </div>

            {/* General compliance recommendation */}
            {criteria1 && criteria2 && criteria3 && criteria4 && criteria5 && criteria6 ? (
              <div className="p-3 bg-[#a8c98a]/10 border border-[#a8c98a]/30 rounded text-[#a8c98a] flex items-center gap-2 mt-4 font-mono text-[11px]">
                <ShieldCheck className="w-4.5 h-4.5 text-[#a8c98a] shrink-0" />
                <span>Cumples con todo el estatuto simplificado. No eres responsable de IVA.</span>
              </div>
            ) : (
              <div className="p-3 bg-[#c97a61]/10 border border-[#c97a61]/30 rounded text-[#c97a61] flex items-center gap-2 mt-4 font-mono text-[11px]">
                <AlertTriangle className="w-4.5 h-4.5 text-[#c97a61] shrink-0" />
                <span>Déficit normativo: Eres o debes registrarte legalmente como responsable de IVA.</span>
              </div>
            )}

          </div>
        </div>

        {/* B. Cruce de IVA (Simulator) */}
        <div className="lg:col-span-6 bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden pb-6">
          <div className="bg-white/[0.02] border-b border-[#2a2620] px-5 py-4 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-[#c9a961]" />
            <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold">
              Simulador del Cruce de IVA Bimestral
            </h3>
          </div>

          <div className="p-5 space-y-5 text-xs font-sans">
            <p className="text-[11px] text-[#a39d8e] leading-relaxed">
              En el régimen común, debes realizar una declaración bimestral restando el IVA que pagas en tus compras de servicios o insumos (IVA Descontable) del IVA que le cobraste a tus clientes nacionales (IVA Generado).
            </p>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1.5">IVA Generado (Tus Ventas)</label>
                <input 
                  type="number"
                  min="0"
                  value={ivaGeneradoInput}
                  onChange={(e) => setIvaGeneradoInput(Number(e.target.value))}
                  className="w-full bg-[#0f0e0c]/50 text-white font-mono p-2.5 rounded border border-[#2a2620] focus:outline-none"
                  placeholder="300000"
                />
              </div>

              <div>
                <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1.5">IVA Descontable (Tus Compras)</label>
                <input 
                  type="number"
                  min="0"
                  value={ivaDescontableInput}
                  onChange={(e) => setIvaDescontableInput(Number(e.target.value))}
                  className="w-full bg-[#0f0e0c]/50 text-white font-mono p-2.5 rounded border border-[#2a2620] focus:outline-none"
                  placeholder="100000"
                />
              </div>
            </div>

            {/* Calculations Balance Block */}
            <div className="bg-[#13110f] border border-[#2a2620] p-4 rounded-lg space-y-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#8a8377] block text-center border-b border-[#2a2620]/50 pb-2">Resultado Matemático Fiscal</span>
              
              <div className="flex justify-between items-center text-[#e8e3d8]">
                <span>Saldo Bruto Netiado:</span>
                <span className="font-mono font-bold text-lg" style={{ color: esSaldoAPagar ? '#c97a61' : (esSaldoAFavor ? '#a8c98a' : '#e8e3d8') }}>
                  {formatCop(Math.abs(saldoIvaNettoValue))}
                </span>
              </div>

              {esSaldoAPagar && (
                <div className="p-3 bg-[#c97a61]/10 border border-[#c97a61]/20 rounded text-[#c97a61] leading-relaxed text-[11px]">
                  <strong>📋 Pago a la DIAN</strong>: Debes presentar declaración de IVA y consignar un saldo de <strong>{formatCop(saldoIvaNettoValue)}</strong>. Esto es dinero recaudado de tus clientes, no un costo directo de Ferova.
                </div>
              )}

              {esSaldoAFavor && (
                <div className="p-3 bg-[#a8c98a]/10 border border-[#a8c98a]/20 rounded text-[#a8c98a] leading-relaxed text-[11px]">
                  <strong>🌟 Saldo a Favor</strong>: Tienes un saldo a favor de <strong>{formatCop(Math.abs(saldoIvaNettoValue))}</strong>. Puedes compensarlo o arrastrarlo en el próximo bimestre para pagar menos IVA descontando compras futuras.
                </div>
              )}

              {saldoIvaNettoValue === 0 && (
                <div className="p-3 bg-white/[0.02] border border-[#2a2620] rounded text-[#8a8377] text-center text-[11px]">
                  Ingresa montos simulados de IVA para evaluar el cruce.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
