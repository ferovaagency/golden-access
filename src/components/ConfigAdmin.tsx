import React, { useState } from 'react';
import { Config, Respaldo, Venta, Cliente, Hora } from '../types';
import { convertToCop } from '../lib/calculations';
import { Settings, Save, RefreshCw, FolderSync, Clipboard, CheckCircle, ShieldAlert, Database, Link, Loader2 } from 'lucide-react';

interface ConfigAdminProps {
  config: Config;
  respaldos: Respaldo[];
  ventas: Venta[];
  clientes: Cliente[];
  horas: Hora[];
  spreadsheetId: string | null;
  spreadsheetLink: string | null;
  onSaveConfig: (updated: Config) => Promise<void>;
  onTriggerBackup: () => Promise<void>;
  onWipeDatabase: () => Promise<void>;
  onRestoreBackup: (backupId: string) => Promise<void>;
  onConnectCustomSheet: (urlOrId: string) => Promise<void>;
  formatCop: (val: number) => string;
}

export default function ConfigAdmin({ 
  config, 
  respaldos, 
  ventas,
  clientes,
  horas,
  spreadsheetId,
  spreadsheetLink,
  onSaveConfig, 
  onTriggerBackup, 
  onWipeDatabase,
  onRestoreBackup,
  onConnectCustomSheet,
  formatCop 
}: ConfigAdminProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);

  // Custom Sheet Input State
  const [customSheetInput, setCustomSheetInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Restore & Wipe State
  const [restoreSnapshotId, setRestoreSnapshotId] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [isClearing, setIsClearing] = useState(false);

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

  const handleBackupBtn = async () => {
    setIsBackingUp(true);
    try {
      await onTriggerBackup();
      alert('✨ ¡Respaldo de Planilla en Google Drive realizado con éxito!');
    } catch (err: any) {
      alert(`Fallo en el respaldo: ${err.message || err}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleLinkCustomSheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSheetInput.trim()) return;
    setIsConnecting(true);
    try {
      await onConnectCustomSheet(customSheetInput);
      setCustomSheetInput('');
    } catch (err) {
      // Error handled or alerted in App
    } finally {
      setIsConnecting(false);
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

  const handleRestore = async () => {
    if (!restoreSnapshotId) return;
    if (!window.confirm(`⚠️ ¿Estás seguro de que deseas sobreescribir COMPLETAMENTE los datos actuales de todas las tablas con el respaldo "${restoreSnapshotId}"? Esta operación no se puede deshacer.`)) {
      return;
    }

    setIsRestoring(true);
    try {
      await onRestoreBackup(restoreSnapshotId);
      setRestoreSnapshotId('');
    } catch (err) {
      // already alert in App
    } finally {
      setIsRestoring(false);
    }
  };

  const handleClearAllData = async () => {
    if (confirmDeleteText !== 'BORRAR FEROVA') return;
    if (!window.confirm('⚠️ ATENCIÓN: ¿Deseas inicializar/limpiar por completo los datos en Google Sheets de Ferova Financiero? Esta acción recreará todas las tablas con su configuración por defecto.')) {
      return;
    }

    setIsClearing(true);
    try {
      await onWipeDatabase();
      setConfirmDeleteText('');
    } catch (err) {
      // already alert in App
    } finally {
      setIsClearing(false);
    }
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
          
          {/* ACTIVE GOOGLE SHEET CONTROLLER */}
          <div className="bg-[#161412] border border-[#c9a961]/35 rounded-lg overflow-hidden pb-5 shadow-lg shadow-black/30">
            <div className="bg-[#1a1714] border-b border-[#2a2620] px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-xs font-mono tracking-widest text-[#c9a961] uppercase font-bold flex items-center gap-2">
                <Database className="w-4 h-4 text-[#c9a961]" /> Base de Datos Activa
              </h3>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="p-5 space-y-4 font-sans text-xs">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono font-bold text-[#8a8377] block">Clave Única (ID)</span>
                <span className="font-mono text-white text-[11px] block bg-black/40 px-2 py-1.5 rounded select-all truncate border border-[#2a2620]" title={spreadsheetId || 'Ninguno'}>
                  {spreadsheetId || 'Desconectado'}
                </span>
              </div>

              {spreadsheetLink && (
                <a
                  href={spreadsheetLink}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded font-mono font-semibold transition cursor-pointer text-[11px]"
                >
                  Abrir Spreadsheet Directo ↗
                </a>
              )}

              <hr className="border-[#2a2620]" />

              <form onSubmit={handleLinkCustomSheetSubmit} className="space-y-3">
                <div>
                  <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1 font-semibold">
                    🔌 Conectar Planilla Existente (Google Sheets/Excel)
                  </label>
                  <p className="text-[10px] text-[#8a8377] leading-relaxed mb-1.5">
                    Pega el enlace de tu Google Sheet (ej. el que estabas usando antes) para sincronizar inmediatamente toda la contabilidad histórica:
                  </p>
                  <input
                    type="text"
                    value={customSheetInput}
                    onChange={(e) => setCustomSheetInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full bg-[#0f0e0c]/50 text-white placeholder-neutral-700 border border-[#2a2620] p-2 rounded font-mono text-xs focus:outline-none focus:border-[#c9a961]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isConnecting || !customSheetInput.trim()}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#c9a961] hover:bg-[#b09252] text-black font-bold text-xs rounded transition cursor-pointer disabled:bg-neutral-800 disabled:text-neutral-500"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Conectando planilla...
                    </>
                  ) : (
                    '🔌 Conectar Planilla'
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Backups Panel */}
          <div className="bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden pb-5">
            <div className="bg-white/[0.02] border-b border-[#2a2620] px-5 py-3.5">
              <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold flex items-center gap-2">
                <FolderSync className="w-4 h-4 text-[#a8c98a]" /> Respaldo de Seguridad manual
              </h3>
            </div>

            <div className="p-5 space-y-4 font-sans text-xs">
              <p className="text-[#a39d8e] leading-relaxed text-[11px]">
                La base de datos corre de forma persistente en tu Google Sheet "Ferova_OS_Financiero". Al accionar esta copia de resguardo, duplicas toda la información contable estructurada como un archivo de respaldo manual en la carpeta "Ferova/Respaldos" de tu Google Drive personal:
              </p>

              <button 
                onClick={handleBackupBtn}
                disabled={isBackingUp}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#a8c98a] hover:bg-[#96b579] text-black rounded font-bold font-display shadow transition cursor-pointer disabled:bg-neutral-800 disabled:text-neutral-500"
              >
                <RefreshCw className={`w-4 h-4 ${isBackingUp ? 'animate-spin' : ''}`} />
                {isBackingUp ? 'Prorrogando copia...' : 'Generar Copia en Drive'}
              </button>

              <div className="border-t border-[#2a2620] pt-4.5 space-y-3">
                <span className="text-[9px] uppercase font-mono font-bold text-[#8a8377] block">Historial de Respaldos (Drive)</span>
                
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {respaldos.length === 0 ? (
                    <span className="text-[11px] text-[#8a8377] italic block text-center font-mono py-2">Sin respaldos anteriores</span>
                  ) : (
                    respaldos.slice(0, 10).map((resp, idx) => (
                      <div key={idx} className="bg-[#0f0e0c]/60 border border-[#2a2620] rounded p-2.5 space-y-0.5">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-white font-semibold">{resp.fecha}</span>
                          <span className="text-[#a8c98a] text-[9px] bg-[#a8c98a]/10 border border-[#a8c98a]/20 font-bold px-1 rounded uppercase tracking-wider">OK</span>
                        </div>
                        <span className="text-[10px] text-[#8a8377] block truncate">
                          File ID: {resp.snapshot_drive_id || 'N/A'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
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

          {/* Danger Zone: restore snapshot & double-confirm wipe */}
          <div className="bg-[#161412] border border-[#c97a61]/30 rounded-lg overflow-hidden pb-5">
            <div className="bg-[#1c1211] border-b border-[#c97a61]/20 px-5 py-3.5 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#c97a61]" />
              <h3 className="text-xs font-mono tracking-widest text-[#c97a61] uppercase font-bold">
                Zona de Peligro y Restauración
              </h3>
            </div>

            <div className="p-5 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1 font-semibold">
                  Restaurar desde Snapshot ID:
                </label>
                <p className="text-[10px] text-[#8a8377] leading-relaxed mb-1.5">
                  Reemplazará todo el contenido actual del Google Sheet con los datos del archivo de respaldo ingresado.
                </p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={restoreSnapshotId}
                    onChange={(e) => setRestoreSnapshotId(e.target.value)}
                    placeholder="ID del archivo de respaldo"
                    className="flex-1 bg-[#0f0e0c]/50 text-white placeholder-neutral-700 border border-[#2a2620] p-2 rounded font-mono text-xs focus:outline-none focus:border-[#c9a961]"
                  />
                  <button
                    onClick={handleRestore}
                    disabled={isRestoring || !restoreSnapshotId}
                    className="px-3 py-2 bg-[#c9a961] hover:bg-[#b09252] text-black font-bold text-xs rounded transition disabled:bg-neutral-800 disabled:text-neutral-500 cursor-pointer"
                  >
                    {isRestoring ? 'Refrescando...' : 'Restaurar'}
                  </button>
                </div>
              </div>

              <div className="border-t border-[#2a2620] pt-4">
                <label className="block text-[#c97a61] text-[10px] uppercase font-mono mb-1 font-bold">
                  Borrar Todos los Datos:
                </label>
                <p className="text-[10px] text-[#8a8377] leading-relaxed mb-2">
                  Esta acción eliminará de forma irreversible todas las ventas, horas, clientes, herramientas y gastos, re-sembrando la hoja de cálculo con la configuración limpia deseada para 2026.
                </p>
                <div className="space-y-2">
                  <input 
                    type="text" 
                    value={confirmDeleteText}
                    onChange={(e) => setConfirmDeleteText(e.target.value)}
                    placeholder="Escribe BORRAR FEROVA para habilitar"
                    className="w-full bg-[#0f0e0c]/50 text-white placeholder-neutral-700 border border-[#2a2620] p-2 rounded font-mono text-xs text-center focus:outline-none focus:border-[#c97a61]"
                  />
                  <button
                    onClick={handleClearAllData}
                    disabled={confirmDeleteText !== 'BORRAR FEROVA' || isClearing}
                    className="w-full py-2.5 bg-[#c97a61] hover:bg-[#b5654e] text-black font-bold uppercase rounded tracking-wider text-[11px] transition disabled:bg-neutral-800 disabled:text-neutral-500 cursor-pointer"
                  >
                    {isClearing ? 'Reiniciando...' : 'Borrar Todos los Datos'}
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
