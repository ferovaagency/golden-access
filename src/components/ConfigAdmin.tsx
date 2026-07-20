import React, { useState } from 'react';
import { Config, Venta, Cliente, Hora } from '../types';
import { convertToCop } from '../lib/calculations';
import { fetchOfficialTrm } from '../lib/financeService';
import { Settings, Save, RefreshCw, FolderSync, Clipboard, Landmark, Route } from 'lucide-react';
import { copyText } from '../lib/clipboard';
import FiscalProfileSection from './FiscalProfileSection';
import BusinessProfileSettings from './BusinessProfileSettings';
import type { BusinessProfile } from '../lib/businessProfileService';
import { useToast, errMsg } from './ui/toast';

interface ConfigAdminProps {
  userId: string;
  businessProfile: BusinessProfile | null;
  onBusinessProfileUpdated: (profile: BusinessProfile) => void;
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
  userId,
  businessProfile,
  onBusinessProfileUpdated,
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
  onImportFromSheetsUrl,
  formatCop
}: ConfigAdminProps) {
  const { success: toastOk, error: toastErr, confirm: askConfirm } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [fetchingTrm, setFetchingTrm] = useState(false);
  const [trmNotice, setTrmNotice] = useState<string | null>(null);

  // Form State
  const [trm, setTrm] = useState(config.trm);
  const [uvt, setUvt] = useState(config.uvt);
  const [smmlv, setSmmlv] = useState(config.smmlv);
  const [salarioPropuesto, setSalarioPropuesto] = useState(config.salario_propuesto);
  const [metaVentasMensual, setMetaVentasMensual] = useState(config.meta_ventas_mensual);
  const [horasObjetivoMes, setHorasObjetivoMes] = useState(config.horas_objetivo_mes);
  const [margenMinimoPct, setMargenMinimoPct] = useState(Math.round((config.margen_minimo ?? 0.30) * 100));

  const [topeNoDeclaranteUvt, setTopeNoDeclaranteUvt] = useState(config.tope_no_declarante_uvt || 1400);
  const [topeNoPagaRentaUvt, setTopeNoPagaRentaUvt] = useState(config.tope_no_paga_renta_uvt || 1090);
  const [topeResponsableIvaUvt, setTopeResponsableIvaUvt] = useState(config.tope_responsable_iva_uvt || 3500);

  const [tarifaRetDeclarante, setTarifaRetDeclarante] = useState(config.tarifa_ret_declarante || 0.04);
  const [tarifaRetNoDeclarante, setTarifaRetNoDeclarante] = useState(config.tarifa_ret_no_declarante || 0.06);

  const handleFetchOfficialTrm = async () => {
    setFetchingTrm(true);
    setTrmNotice(null);
    try {
      const official = await fetchOfficialTrm();
      setTrm(official.trm);
      setTrmNotice(`TRM oficial: $${official.trm.toLocaleString('es-CO')} (${official.source}${official.vigente_desde ? `, vigente desde ${official.vigente_desde.slice(0, 10)}` : ''}). Revisa y pulsa "Actualizar Parámetros" para guardarla.`);
    } catch (err: any) {
      setTrmNotice(`No se pudo obtener la TRM oficial: ${errMsg(err)}`);
    } finally {
      setFetchingTrm(false);
    }
  };

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
        margen_minimo: Math.min(Math.max(Number(margenMinimoPct) / 100, 0), 0.99),
        tarifa_salud: config.tarifa_salud ?? 0.125,
        tarifa_pension: config.tarifa_pension ?? 0.16,
        ibc_porcentaje: config.ibc_porcentaje ?? 0.40,
        tarifa_iva: config.tarifa_iva ?? 0.19
      };
      await onSaveConfig(updated);
      toastOk('Configuración y variables DIAN 2026 actualizadas correctamente.');
    } catch (err: any) {
      toastErr(`Ocurrió un error al guardar: ${errMsg(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // TSV Clipboard triggers
  const triggerCopy = async (text: string, label: string) => {
    await copyText(text);
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
    <div className="space-y-8 animate-fade-in text-slate-900">
      
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="text-xl font-display font-medium text-[#c9a961]">Configuración de Ferova One</h2>
        <p className="text-xs text-slate-500 font-mono mt-1">Identidad, perfil fiscal, personalización y conexiones del negocio.</p></div>
        <button type="button" onClick={() => window.dispatchEvent(new Event('ferova:start-tour'))} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Route className="h-4 w-4" />Repetir recorrido</button>
      </div>

      <BusinessProfileSettings userId={userId} profile={businessProfile} onUpdated={onBusinessProfileUpdated} />

      <FiscalProfileSection />


      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Main Parameters Panel */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden pb-4">
          <div className="bg-white/[0.02] border-b border-slate-200 px-5 py-4 flex items-center justify-between">
            <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#c9a961]" /> Parámetros de Tributación Colombiana (DIAN 2026)
            </h3>
          </div>

          <form onSubmit={handleFormSubmit} className="p-5 space-y-6 text-xs font-sans">
            
            {/* Constantes 2026 */}
            <div className="space-y-4">
              <h4 className="font-semibold text-[#c9a961] border-b border-slate-200 pb-1.5 uppercase font-mono text-[10px] tracking-wider">
                1. Constantes DIAN oficiales Ley 2026
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans">
                <div>
                  <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Unidad Valor Tributario (UVT)</label>
                  <input 
                    type="number" 
                    value={uvt}
                    onChange={(e) => setUvt(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">Oficial 2026: $52.374 COP</span>
                </div>

                <div>
                  <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Salario Mínimo (SMMLV)</label>
                  <input 
                    type="number" 
                    value={smmlv}
                    onChange={(e) => setSmmlv(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">Oficial 2026: $1.750.905 COP</span>
                </div>

                <div>
                  <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">TRM Dolar Estimada</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      value={trm}
                      onChange={(e) => setTrm(Number(e.target.value))}
                      required
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded font-mono focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleFetchOfficialTrm}
                      disabled={fetchingTrm}
                      title="Traer TRM oficial de datos.gov.co"
                      className="shrink-0 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded text-slate-600 disabled:opacity-50"
                    >
                      <Landmark className={`w-4 h-4 ${fetchingTrm ? 'animate-pulse' : ''}`} />
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">COP por cada USD</span>
                  {trmNotice && (
                    <p className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 rounded p-1.5 mt-1.5 leading-relaxed">{trmNotice}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Topes en UVT */}
            <div className="space-y-4">
              <h4 className="font-semibold text-[#c9a961] border-b border-slate-200 pb-1.5 uppercase font-mono text-[10px] tracking-wider">
                2. Topes Anuales de Control (En UVT)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans">
                <div>
                  <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Declarar Renta (Ventas)</label>
                  <input 
                    type="number" 
                    value={topeNoDeclaranteUvt}
                    onChange={(e) => setTopeNoDeclaranteUvt(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">Normalmente: 1.400 UVT</span>
                </div>

                <div>
                  <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Exento Pago de Renta</label>
                  <input 
                    type="number" 
                    value={topeNoPagaRentaUvt}
                    onChange={(e) => setTopeNoPagaRentaUvt(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">Normalmente: 1.090 UVT</span>
                </div>

                <div>
                  <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Tope Responsable IVA</label>
                  <input 
                    type="number" 
                    value={topeResponsableIvaUvt}
                    onChange={(e) => setTopeResponsableIvaUvt(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">Normalmente: 3.500 UVT</span>
                </div>
              </div>
            </div>

            {/* Tarifas retencion */}
            <div className="space-y-4">
              <h4 className="font-semibold text-[#c9a961] border-b border-slate-200 pb-1.5 uppercase font-mono text-[10px] tracking-wider">
                3. Porcentajes de Retención en la Fuente
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans">
                <div>
                  <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Cliente Declarante (Servicios)</label>
                  <input 
                    type="number" 
                    value={tarifaRetDeclarante}
                    onChange={(e) => setTarifaRetDeclarante(Number(e.target.value))}
                    step="0.01"
                    required
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">Porcentaje: 0.04 (4%)</span>
                </div>

                <div>
                  <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Cliente NO Declarante</label>
                  <input 
                    type="number" 
                    value={tarifaRetNoDeclarante}
                    onChange={(e) => setTarifaRetNoDeclarante(Number(e.target.value))}
                    step="0.01"
                    required
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">Porcentaje: 0.06 (6%)</span>
                </div>
              </div>
            </div>

            {/* Metas Ferova */}
            <div className="space-y-4">
              <h4 className="font-semibold text-[#c9a961] border-b border-slate-200 pb-1.5 uppercase font-mono text-[10px] tracking-wider">
                4. Parámetros de Operación Ferova Agency
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
                <div>
                  <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Sueldo Base Deseado</label>
                  <input
                    type="number"
                    value={salarioPropuesto}
                    onChange={(e) => setSalarioPropuesto(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Cuota Comercial Ventas / Mes</label>
                  <input
                    type="number"
                    value={metaVentasMensual}
                    onChange={(e) => setMetaVentasMensual(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Objetivo Capacidad Horas / Mes</label>
                  <input
                    type="number"
                    value={horasObjetivoMes}
                    onChange={(e) => setHorasObjetivoMes(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Margen Mínimo por Defecto (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={margenMinimoPct}
                    onChange={(e) => setMargenMinimoPct(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">Se usa en Equilibrio por Servicio cuando ese servicio no tiene su propio margen objetivo.</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200/60 flex items-center justify-end">
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
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden pb-5">
            <div className="bg-white/[0.02] border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase font-semibold flex items-center gap-2">
                <FolderSync className="w-4 h-4 text-[#a8c98a]" /> Respaldo en Google Sheets
              </h3>
              <div className={`w-2 h-2 rounded-full ${hasGoogleToken ? 'bg-emerald-500 animate-pulse' : 'bg-[#8a8377]'}`} />
            </div>

            <div className="p-5 space-y-4 font-sans text-xs">
              <p className="text-slate-500 leading-relaxed text-[11px]">
                Tu contabilidad vive en Ferova One. Este respaldo es opcional: copia todo lo actual hacia tu propia hoja "Ferova_OS_Financiero" en Google Drive.
              </p>

              {!hasGoogleToken && (
                <p className="text-[10px] text-slate-400 italic">
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

              <div className="border-t border-slate-200 pt-4 mt-2 space-y-2">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Importar desde Sheets</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
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

              <div className="border-t border-slate-200 pt-4 mt-2 space-y-2">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Importar pegando link</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Pega la URL de un Google Sheet con la misma estructura de la plantilla <span className="font-medium text-slate-700">Ferova_OS_Financiero</span>. Debe incluir estas pestañas, con estos nombres exactos: <span className="font-mono text-[#c9a961]">Config, Clientes, Servicios, Herramientas, OtrosGastos, Ventas, Horas, Respaldos y PagosEgresos</span>.
                </p>
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/XXXXXXX/edit"
                  className="w-full bg-[#0f0e0c]/70 text-slate-900 border border-slate-200 p-2.5 rounded font-mono text-[11px] focus:outline-none focus:border-[#c9a961]"
                />
                <button
                  onClick={async () => {
                    setIsImportingUrl(true);
                    try { await onImportFromSheetsUrl(sheetUrl); }
                    finally { setIsImportingUrl(false); }
                  }}
                  disabled={isImportingUrl || !sheetUrl.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#a8c98a] hover:bg-[#96b579] text-black rounded font-bold font-display shadow transition cursor-pointer text-[11px] disabled:bg-neutral-800 disabled:text-neutral-500"
                >
                  <FolderSync className={`w-4 h-4 ${isImportingUrl ? 'animate-spin' : ''}`} />
                  {isImportingUrl ? 'Importando...' : 'Importar desde este link'}
                </button>
              </div>
            </div>
          </div>

          {/* TSV Accountant copiers */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden pb-5">
            <div className="bg-white/[0.02] border-b border-slate-200 px-5 py-3.5">
              <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase font-semibold flex items-center gap-2">
                <Clipboard className="w-4 h-4 text-[#c9a961]" /> Portapapeles contable rápido (TSV)
              </h3>
            </div>

            <div className="p-5 space-y-4 font-sans text-xs">
              <p className="text-slate-500 leading-relaxed text-[11px]">
                Herramienta ágil sin descargas: copia las tres planillas principales en formato tabular listo para pegar directo en Microsoft Excel o Numbers para tu contador general:
              </p>

              <div className="space-y-2">
                <button 
                  onClick={exportVentasTsv}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 hover:bg-[#0f0e0c] border border-slate-200 text-slate-900 rounded text-xs font-mono transition cursor-pointer"
                >
                  Planilla de Ventas ({ventas.length} registros)
                </button>

                <button 
                  onClick={exportClientesTsv}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 hover:bg-[#0f0e0c] border border-slate-200 text-slate-900 rounded text-xs font-mono transition cursor-pointer"
                >
                  Directorio Clientes ({clientes.length} perfiles)
                </button>

                <button 
                  onClick={exportHorasTsv}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 hover:bg-[#0f0e0c] border border-slate-200 text-slate-900 rounded text-xs font-mono transition cursor-pointer"
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
