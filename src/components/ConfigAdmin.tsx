import React, { useState } from 'react';
import { Config, Venta, Cliente, Hora } from '../types';
import { convertToCop } from '../lib/calculations';
import { Settings, Save, RefreshCw, FolderSync, Clipboard } from 'lucide-react';

interface ConfigAdminProps {
  config: Config;
  ventas: Venta[];
  clientes: Cliente[];
  horas: Hora[];
  hasGoogleToken: boolean;
  lastSheetBackupLink: string | null;
  isBackingUpToSheets: boolean;
  onSaveConfig: (updated: Config) => Promise<void>;
  onBackupToSheets: () => Promise<void>;
  onImportFromSheets: () => Promise<void>;
  onImportFromSheetsUrl: (url: string) => Promise<void>;
  formatCop: (val: number) => string;
}

export default function ConfigAdmin({
  config,
  ventas,
  clientes,
  horas,
  hasGoogleToken,
  lastSheetBackupLink,
  isBackingUpToSheets,
  onSaveConfig,
  onBackupToSheets,
  onImportFromSheets,
  formatCop
}: ConfigAdminProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);

  // Form State
  const [trm, setTrm] = useState(config.trm);
  const [uvt, setUvt] = useState(config.uvt);
  const [smmlv, setSmmlv] = useState(config.smmlv);
  const [salarioPropuesto, setSalarioPropuesto] = useState(config.salario_propuesto);
  const [metaVentasMensual, setMetaVentasMensual] = useState(config.meta_ventas_mensual);
  const [horasObjetivoMes, setHorasObjetivoMes] = useState(config.horas_objetivo_mes);

  const [topeNoDeclaranteUvt, setTopeNoDeclaranteUvt] = useState(config.tope_no_declarante_uvt || 1400);
  const [topeNoPagaRentaUvt, setTopeNoPagaRentaUvt] = useState(config.tope_no_paga_renta_uvt || 1090);
  const [topeResponsableIvaUvt, setTopeResponsableIvaUvt] = useState(config.tope_responsable_iva_uvt || 3500);

  const [tarifaRetDeclarante, setTarifaRetDeclarante] = useState(config.tarifa_ret_declarante || 0.04);
  const [tarifaRetNoDeclarante, setTarifaRetNoDeclarante] = useState(config.tarifa_ret_no_declarante || 0.06);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const updated: Config = {
        trm: Number(trm),
        uvt: Number(uvt),
        smmlv: Number(smmlv),
        tope_no_declarante_uvt: Number(topeNoDeclaranteUvt),
        tope_no_paga_renta_uvt: Number(topeNoPagaRentaUvt),
        tope_responsable_iva_uvt: Number(topeResponsableIvaUvt),
        tarifa_ret_declarante: Number(tarifaRetDeclarante),
        tarifa_ret_no_declarante: Number(tarifaRetNoDeclarante),
        retencion_servicio_min_uvt: config.retencion_servicio_min_uvt || 4,
        salario_propuesto: Number(salarioPropuesto),
        meta_ventas_mensual: Number(metaVentasMensual),
        horas_objetivo_mes: Number(horasObjetivoMes),
        tarifa_salud: config.tarifa_salud ?? 0.125,
        tarifa_pension: config.tarifa_pension ?? 0.16,
        ibc_porcentaje: config.ibc_porcentaje ?? 0.40,
        tarifa_iva: config.tarifa_iva ?? 0.19
      };
      await onSaveConfig(updated);
      alert('Configuración y variables DIAN 2026 actualizadas correctamente.');
    } catch (err: any) {
      alert(`Ocurrió un error al guardar: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // TSV Clipboard triggers
  const triggerCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStatus(label);
    setTimeout(() => setCopiedStatus(null), 2500);
  };

  const exportVentasTsv = () => {
    const headers = ['Ref ID', 'Fecha', 'Cliente', 'Servicio', 'Cantidad', 'Precio Unitario', 'Moneda', 'Monto COP', 'Estado Cobro', 'Rete Fuente COP'];
    const rows = ventas.map(v => {
      const subOriginal = v.precio_venta_unitario * v.cantidad;
      const valCop = convertToCop(subOriginal, v.moneda, config.trm);
      
      let rCop = 0;
      if (v.tipo === 'Nacional' && valCop >= (config.retencion_servicio_min_uvt * config.uvt)) {
        const cliDef = clientes.find(c => c.id === v.cliente_id);
        const fee = cliDef?.declarante ? config.tarifa_ret_declarante : config.tarifa_ret_no_declarante;
        rCop = valCop * fee;
      }

      return [
        v.id,
        v.fecha,
        v.cliente_nombre,
        v.servicio_nombre,
        v.cantidad,
        v.precio_venta_unitario,
        v.moneda,
        valCop.toFixed(0),
        v.estado_pago,
        rCop.toFixed(0)
      ];
    });

    const body = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    triggerCopy(body, 'Ventas (TSV)');
  };

  const exportClientesTsv = () => {
    const headers = ['ID', 'Nombre', 'Tipo', 'Localidad', 'Declarante CO', 'Estado'];
    const rows = clientes.map(c => [
      c.id,
      c.nombre,
      c.tipo,
      c.tipo === 'Nacional' ? 'Colombia' : 'Internacional',
      c.declarante ? 'SI' : 'NO',
      c.activo ? 'ACTIVO' : 'INACTIVO'
    ]);
    const body = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    triggerCopy(body, 'Clientes (TSV)');
  };

  const exportHorasTsv = () => {
    const headers = ['Código', 'Fecha', 'Cliente ID', 'Cliente', 'Servicio', 'Horas Logged', 'Actividad'];
    const rows = horas.map(h => [
      h.id,
      h.fecha,
      h.cliente_id,
      h.cliente_nombre,
      h.servicio_nombre,
      h.horas,
      h.descripcion
    ]);
    const body = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    triggerCopy(body, 'Horas (TSV)');
  };

  return (
    <div className="space-y-8 animate-fade-in text-[#e8e3d8]">
      
      {/* Header */}
      <div className="border-b border-[#2a2620] pb-5">
        <h2 className="text-xl font-display font-medium text-[#c9a961]">Configuración del Sistema</h2>
        <p className="text-xs text-[#a39d8e] font-mono mt-1">Límites DIAN, constantes 2026, respaldos y copias contables para fijos de operación</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Main Parameters Panel */}
        <div className="lg:col-span-8 bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden pb-4">
          <div className="bg-white/[0.02] border-b border-[#2a2620] px-5 py-4 flex items-center justify-between">
            <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#c9a961]" /> Parámetros de Tributación Colombiana (DIAN 2026)
            </h3>
          </div>

          <form onSubmit={handleFormSubmit} className="p-5 space-y-6 text-xs font-sans">
            
            {/* Constantes 2026 */}
            <div className="space-y-4">
              <h4 className="font-semibold text-[#c9a961] border-b border-[#2a2620] pb-1.5 uppercase font-mono text-[10px] tracking-wider">
                1. Constantes DIAN oficiales Ley 2026
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans">
                <div>
                  <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Unidad Valor Tributario (UVT)</label>
                  <input 
                    type="number" 
                    value={uvt}
                    onChange={(e) => setUvt(Number(e.target.value))}
                    required
                    className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2.5 rounded font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-[#8a8377] block mt-1">Oficial 2026: $52.374 COP</span>
                </div>

                <div>
                  <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Salario Mínimo (SMMLV)</label>
                  <input 
                    type="number" 
                    value={smmlv}
                    onChange={(e) => setSmmlv(Number(e.target.value))}
                    required
                    className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2.5 rounded font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-[#8a8377] block mt-1">Oficial 2026: $1.750.905 COP</span>
                </div>

                <div>
                  <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">TRM Dolar Estimada</label>
                  <input 
                    type="number" 
                    value={trm}
                    onChange={(e) => setTrm(Number(e.target.value))}
                    required
                    className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2.5 rounded font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-[#8a8377] block mt-1">COP por cada USD</span>
                </div>
              </div>
            </div>

            {/* Topes en UVT */}
            <div className="space-y-4">
              <h4 className="font-semibold text-[#c9a961] border-b border-[#2a2620] pb-1.5 uppercase font-mono text-[10px] tracking-wider">
                2. Topes Anuales de Control (En UVT)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans">
                <div>
                  <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Declarar Renta (Ventas)</label>
                  <input 
                    type="number" 
                    value={topeNoDeclaranteUvt}
                    onChange={(e) => setTopeNoDeclaranteUvt(Number(e.target.value))}
                    required
                    className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2.5 rounded font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-[#8a8377] block mt-1">Normalmente: 1.400 UVT</span>
                </div>

                <div>
                  <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Exento Pago de Renta</label>
                  <input 
                    type="number" 
                    value={topeNoPagaRentaUvt}
                    onChange={(e) => setTopeNoPagaRentaUvt(Number(e.target.value))}
                    required
                    className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2.5 rounded font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-[#8a8377] block mt-1">Normalmente: 1.090 UVT</span>
                </div>

                <div>
                  <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Tope Responsable IVA</label>
                  <input 
                    type="number" 
                    value={topeResponsableIvaUvt}
                    onChange={(e) => setTopeResponsableIvaUvt(Number(e.target.value))}
                    required
                    className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2.5 rounded font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-[#8a8377] block mt-1">Normalmente: 3.500 UVT</span>
                </div>
              </div>
            </div>

            {/* Tarifas retencion */}
            <div className="space-y-4">
              <h4 className="font-semibold text-[#c9a961] border-b border-[#2a2620] pb-1.5 uppercase font-mono text-[10px] tracking-wider">
                3. Porcentajes de Retención en la Fuente
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans">
                <div>
                  <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Cliente Declarante (Servicios)</label>
                  <input 
                    type="number" 
                    value={tarifaRetDeclarante}
                    onChange={(e) => setTarifaRetDeclarante(Number(e.target.value))}
                    step="0.01"
                    required
                    className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2.5 rounded font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-[#8a8377] block mt-1">Porcentaje: 0.04 (4%)</span>
                </div>

                <div>
                  <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Cliente NO Declarante</label>
                  <input 
                    type="number" 
                    value={tarifaRetNoDeclarante}
                    onChange={(e) => setTarifaRetNoDeclarante(Number(e.target.value))}
                    step="0.01"
                    required
                    className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2.5 rounded font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-[#8a8377] block mt-1">Porcentaje: 0.06 (6%)</span>
                </div>
              </div>
            </div>

            {/* Metas Ferova */}
            <div className="space-y-4">
              <h4 className="font-semibold text-[#c9a961] border-b border-[#2a2620] pb-1.5 uppercase font-mono text-[10px] tracking-wider">
                4. Parámetros de Operación Ferova Agency
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans">
                <div>
                  <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Sueldo Base Deseado</label>
                  <input 
                    type="number" 
                    value={salarioPropuesto}
                    onChange={(e) => setSalarioPropuesto(Number(e.target.value))}
                    required
                    className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2.5 rounded font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Cuota Comercial Ventas / Mes</label>
                  <input 
                    type="number" 
                    value={metaVentasMensual}
                    onChange={(e) => setMetaVentasMensual(Number(e.target.value))}
                    required
                    className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2.5 rounded font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Objetivo Capacidad Horas / Mes</label>
                  <input 
                    type="number" 
                    value={horasObjetivoMes}
                    onChange={(e) => setHorasObjetivoMes(Number(e.target.value))}
                    required
                    className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2.5 rounded font-mono focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#2a2620]/60 flex items-center justify-end">
              <button 
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-[#c9a961] hover:bg-[#b09252] text-black font-semibold rounded font-display text-xs transition cursor-pointer"
              >
                <Save className="w-4 h-4" /> {isSubmitting ? 'Guardando...' : 'Actualizar Parámetros'}
              </button>
            </div>

          </form>
        </div>

        {/* Backups & Portapapeles side columns */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Google Sheets backup panel (optional, manual) */}
          <div className="bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden pb-5">
            <div className="bg-white/[0.02] border-b border-[#2a2620] px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold flex items-center gap-2">
                <FolderSync className="w-4 h-4 text-[#a8c98a]" /> Respaldo en Google Sheets
              </h3>
              <div className={`w-2 h-2 rounded-full ${hasGoogleToken ? 'bg-emerald-500 animate-pulse' : 'bg-[#8a8377]'}`} />
            </div>

            <div className="p-5 space-y-4 font-sans text-xs">
              <p className="text-[#a39d8e] leading-relaxed text-[11px]">
                Tu contabilidad vive en Ferova OS (Supabase). Este respaldo es opcional: copia todo lo actual hacia tu propia hoja "Ferova_OS_Financiero" en Google Drive.
              </p>

              {!hasGoogleToken && (
                <p className="text-[10px] text-[#8a8377] italic">
                  Necesitas conectar tu cuenta de Google la primera vez.
                </p>
              )}

              <button
                onClick={onBackupToSheets}
                disabled={isBackingUpToSheets}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#a8c98a] hover:bg-[#96b579] text-black rounded font-bold font-display shadow transition cursor-pointer disabled:bg-neutral-800 disabled:text-neutral-500"
              >
                <RefreshCw className={`w-4 h-4 ${isBackingUpToSheets ? 'animate-spin' : ''}`} />
                {isBackingUpToSheets ? 'Respaldando...' : hasGoogleToken ? 'Respaldar ahora' : 'Conectar Google y respaldar'}
              </button>

              {lastSheetBackupLink && (
                <a
                  href={lastSheetBackupLink}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded font-mono font-semibold transition cursor-pointer text-[11px]"
                >
                  Abrir última hoja respaldada ↗
                </a>
              )}

              <div className="border-t border-[#2a2620] pt-4 mt-2 space-y-2">
                <p className="text-[10px] text-[#8a8377] uppercase tracking-widest font-mono">Importar desde Sheets</p>
                <p className="text-[11px] text-[#a39d8e] leading-relaxed">
                  Trae toda tu información financiera desde la hoja "Ferova_OS_Financiero" de tu Drive hacia Ferova OS. Reemplazará los datos actuales.
                </p>
                <button
                  onClick={onImportFromSheets}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#c9a961] hover:bg-[#b09252] text-black rounded font-bold font-display shadow transition cursor-pointer text-[11px]"
                >
                  <FolderSync className="w-4 h-4" />
                  {hasGoogleToken ? 'Importar mi Google Sheet' : 'Conectar Google e importar'}
                </button>
              </div>
            </div>
          </div>

          {/* TSV Accountant copiers */}
          <div className="bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden pb-5">
            <div className="bg-white/[0.02] border-b border-[#2a2620] px-5 py-3.5">
              <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold flex items-center gap-2">
                <Clipboard className="w-4 h-4 text-[#c9a961]" /> Portapapeles contable rápido (TSV)
              </h3>
            </div>

            <div className="p-5 space-y-4 font-sans text-xs">
              <p className="text-[#a39d8e] leading-relaxed text-[11px]">
                Herramienta ágil sin descargas: copia las tres planillas principales en formato tabular listo para pegar directo en Microsoft Excel o Numbers para tu contador general:
              </p>

              <div className="space-y-2">
                <button 
                  onClick={exportVentasTsv}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#0f0e0c]/50 hover:bg-[#0f0e0c] border border-[#2a2620] text-[#e8e3d8] rounded text-xs font-mono transition cursor-pointer"
                >
                  Planilla de Ventas ({ventas.length} registros)
                </button>

                <button 
                  onClick={exportClientesTsv}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#0f0e0c]/50 hover:bg-[#0f0e0c] border border-[#2a2620] text-[#e8e3d8] rounded text-xs font-mono transition cursor-pointer"
                >
                  Directorio Clientes ({clientes.length} perfiles)
                </button>

                <button 
                  onClick={exportHorasTsv}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#0f0e0c]/50 hover:bg-[#0f0e0c] border border-[#2a2620] text-[#e8e3d8] rounded text-xs font-mono transition cursor-pointer"
                >
                  Bitácora de Horas ({horas.length} registros)
                </button>
              </div>

              {copiedStatus && (
                <div className="mt-2 text-center p-2 bg-[#c9a961]/10 text-[#c9a961] border border-[#c9a961]/25 text-[10px] font-mono font-semibold rounded animate-pulse">
                  📋 Planilla de "{copiedStatus}" copiada. ¡Pégala en Excel!
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
