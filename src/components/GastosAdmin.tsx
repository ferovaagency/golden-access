import React, { useState } from 'react';
import { Herramienta, OtroGasto, Servicio, Cliente, Config } from '../types';
import { convertToCop, calcularPrestaciones, calcularCostosHerramientas, isColombiaFiscal, type FiscalContext } from '../lib/calculations';
import { ShieldAlert, Plus, HelpCircle, PenTool, LayoutGrid, Edit2, Paperclip, Info } from 'lucide-react';
import ComprobanteUpload from './ComprobanteUpload';
import { InlineDeleteConfirm } from './ui/InlineDeleteConfirm';

interface GastosAdminProps {
  herramientas: Herramienta[];
  otrosGastos: OtroGasto[];
  servicios: Servicio[];
  clientes: Cliente[];
  config: Config;
  fiscalProfile?: FiscalContext;
  onSaveHerramientas: (updated: Herramienta[]) => Promise<void>;
  onSaveOtrosGastos: (updated: OtroGasto[]) => Promise<void>;
  onSaveConfig: (updated: Partial<Config>) => Promise<void>;
  formatCop: (val: number) => string;
  formatUsd: (val: number) => string;
}

export default function GastosAdmin({
  herramientas,
  otrosGastos,
  servicios,
  clientes,
  config,
  fiscalProfile,
  onSaveHerramientas,
  onSaveOtrosGastos,
  onSaveConfig,
  formatCop,
  formatUsd
}: GastosAdminProps) {
  // A. Mi Salario State
  const [salarioInput, setSalarioInput] = useState(config.salario_propuesto);
  const [isUpdatingSalario, setIsUpdatingSalario] = useState(false);

  // B. Herramientas Form State
  const [toolNombre, setToolNombre] = useState('');
  const [toolMonto, setToolMonto] = useState(0);
  const [toolMoneda, setToolMoneda] = useState<'COP' | 'USD'>('COP');
  const [toolTipoCobro, setToolTipoCobro] = useState<'global' | 'porCliente'>('global');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [confirmDeleteToolId, setConfirmDeleteToolId] = useState<string | null>(null);

  // C. Otros Gastos Form State
  const [otroNombre, setOtroNombre] = useState('');
  const [otroMonto, setOtroMonto] = useState(0);
  const [otroMoneda, setOtroMoneda] = useState<'COP' | 'USD'>('COP');
  const [otroCategoria, setOtroCategoria] = useState<'Operativo' | 'Administrativo' | 'Otros'>('Operativo');
  const [otroComprobanteUrl, setOtroComprobanteUrl] = useState<string | undefined>(undefined);
  const [otroComprobanteNombre, setOtroComprobanteNombre] = useState<string | undefined>(undefined);
  const [editingOtroId, setEditingOtroId] = useState<string | null>(null);
  const [confirmDeleteOtroId, setConfirmDeleteOtroId] = useState<string | null>(null);

  // --- CALCULATIONS ---
  const clientesActivosCount = clientes.filter(c => c.activo).length;

  // Prestaciones: sólo aplican en CO. Para otros países la función devuelve
  // ceros con applies=false y renderizamos un aviso de configuración pendiente.
  const prestaciones = calcularPrestaciones(config.salario_propuesto, config.smmlv, fiscalProfile);
  const fiscalCO = isColombiaFiscal(fiscalProfile);

  // Herramientas costs
  const toolsComputed = calcularCostosHerramientas(herramientas, clientesActivosCount, config.trm);
  const totalToolsCop = toolsComputed.reduce((sum, h) => sum + h.costoMensualTotal, 0);

  // Otros Gastos
  const totalOtrosCop = otrosGastos.reduce((sum, g) => sum + convertToCop(g.monto, g.moneda, config.trm), 0);

  const totalOverheadFijos = totalToolsCop + totalOtrosCop + config.salario_propuesto;

  // --- ACTIONS ---
  // A. Update Salario
  const handleUpdateSalario = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingSalario(true);
    try {
      await onSaveConfig({ salario_propuesto: Number(salarioInput) });
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingSalario(false);
    }
  };

  // B. Save Tool
  const handleAddTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toolNombre) return;

    if (editingToolId) {
      const updated = herramientas.map(h => {
        if (h.id === editingToolId) {
          return {
            ...h,
            nombre: toolNombre.trim(),
            monto: Number(toolMonto),
            moneda: toolMoneda,
            tipo_cobro: toolTipoCobro,
            servicios_ids: selectedServices.join(','),
            notas: `SaaS vinculado a ${selectedServices.length} servicios`
          };
        }
        return h;
      });
      await onSaveHerramientas(updated);
      handleCancelEditTool();
    } else {
      const newTool: Herramienta = {
        id: `tool_${Date.now().toString().slice(-4)}`,
        nombre: toolNombre.trim(),
        monto: Number(toolMonto),
        moneda: toolMoneda,
        tipo_cobro: toolTipoCobro,
        servicios_ids: selectedServices.join(','),
        notas: `SaaS vinculado a ${selectedServices.length} servicios`
      };

      const updated = [...herramientas, newTool];
      await onSaveHerramientas(updated);

      // Reset Form
      setToolNombre('');
      setToolMonto(0);
      setSelectedServices([]);
    }
  };

  const handleStartEditTool = (h: Herramienta) => {
    setEditingToolId(h.id);
    setToolNombre(h.nombre);
    setToolMonto(h.monto);
    setToolMoneda(h.moneda);
    setToolTipoCobro(h.tipo_cobro);
    setSelectedServices(h.servicios_ids ? h.servicios_ids.split(',').filter(Boolean) : []);
  };

  const handleCancelEditTool = () => {
    setEditingToolId(null);
    setToolNombre('');
    setToolMonto(0);
    setToolMoneda('COP');
    setToolTipoCobro('global');
    setSelectedServices([]);
  };

  const handleDeleteTool = async (id: string) => {
    const updated = herramientas.filter(h => h.id !== id);
    await onSaveHerramientas(updated);
    if (editingToolId === id) {
      handleCancelEditTool();
    }
    setConfirmDeleteToolId(null);
  };

  // C. Save Otro Gasto
  const handleAddOtro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otroNombre) return;

    if (editingOtroId) {
      const updated = otrosGastos.map(g => {
        if (g.id === editingOtroId) {
          return {
            ...g,
            nombre: otroNombre.trim(),
            monto: Number(otroMonto),
            moneda: otroMoneda,
            categoria: otroCategoria,
            comprobante_url: otroComprobanteUrl,
            comprobante_nombre: otroComprobanteNombre,
          };
        }
        return g;
      });
      await onSaveOtrosGastos(updated);
      handleCancelEditOtro();
    } else {
      const newGasto: OtroGasto = {
        id: `gasto_${Date.now().toString().slice(-4)}`,
        nombre: otroNombre.trim(),
        monto: Number(otroMonto),
        moneda: otroMoneda,
        categoria: otroCategoria,
        comprobante_url: otroComprobanteUrl,
        comprobante_nombre: otroComprobanteNombre,
      };

      const updated = [...otrosGastos, newGasto];
      await onSaveOtrosGastos(updated);

      // Reset Form
      setOtroNombre('');
      setOtroMonto(0);
      setOtroComprobanteUrl(undefined);
      setOtroComprobanteNombre(undefined);
    }
  };

  const handleStartEditOtro = (g: OtroGasto) => {
    setEditingOtroId(g.id);
    setOtroNombre(g.nombre);
    setOtroMonto(g.monto);
    setOtroMoneda(g.moneda);
    setOtroCategoria(g.categoria);
    setOtroComprobanteUrl(g.comprobante_url);
    setOtroComprobanteNombre(g.comprobante_nombre);
  };

  const handleCancelEditOtro = () => {
    setEditingOtroId(null);
    setOtroNombre('');
    setOtroMonto(0);
    setOtroMoneda('COP');
    setOtroCategoria('Operativo');
    setOtroComprobanteUrl(undefined);
    setOtroComprobanteNombre(undefined);
  };

  const handleDeleteOtro = async (id: string) => {
    const updated = otrosGastos.filter(o => o.id !== id);
    await onSaveOtrosGastos(updated);
    if (editingOtroId === id) {
      handleCancelEditOtro();
    }
    setConfirmDeleteOtroId(null);
  };

  // Toggle service selection in tools form
  const toggleServiceLabel = (srvId: string) => {
    if (selectedServices.includes(srvId)) {
      setSelectedServices(selectedServices.filter(id => id !== srvId));
    } else {
      setSelectedServices([...selectedServices, srvId]);
    }
  };

  // D. Costos de Herramientas Distribuidos por Servicio
  const distributedMap = new Map<string, number>();
  // Init all services
  servicios.forEach(s => distributedMap.set(s.id, 0));

  toolsComputed.forEach(t => {
    const linked = t.serviciosLinked;
    if (linked.length === 0) return;
    linked.forEach(sId => {
      const currentVal = distributedMap.get(sId) || 0;
      distributedMap.set(sId, currentVal + t.costoAsignadoPorServicio);
    });
  });

  return (
    <div className="space-y-8 animate-fade-in text-slate-900">
      
      {/* Visual Header */}
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-xl font-display font-medium text-blue-600">Gestión de Costos y Gastos Fijos</h2>
        <p className="text-xs text-slate-500 font-mono mt-1">Nómina personal, herramientas SaaS indexadas y fijos de operación</p>
      </div>

      {/* E. Resumen final (4 horizontal cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white border border-slate-200 p-5 rounded-lg border-l-3 border-l-[#c9a961]">
          <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase block">Mi Salario Base</span>
          <div className="text-2xl font-display font-semibold text-slate-900 mt-2">{formatCop(config.salario_propuesto)}</div>
          <span className="text-[10px] text-slate-400 font-mono block mt-1">Carga mensual de nómina</span>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-lg border-l-3 border-l-[#a8c98a]">
          <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase block">Carga Herramientas SaaS</span>
          <div className="text-2xl font-display font-semibold text-[#a8c98a] mt-2">{formatCop(totalToolsCop)}</div>
          <span className="text-[10px] text-slate-400 font-mono block mt-1">Herramientas globales y prorrateadas</span>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-lg border-l-3 border-l-[#c97a61]">
          <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase block">Otros Gastos Generales</span>
          <div className="text-2xl font-display font-semibold text-slate-900 mt-2">{formatCop(totalOtrosCop)}</div>
          <span className="text-[10px] text-slate-400 font-mono block mt-1">Overhead de oficina o administrativos</span>
        </div>

        <div className="bg-[#181512] border border-slate-200 p-5 rounded-lg border-l-3 border-l-[#c9a961] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-600/5 rounded-bl-full pointer-events-none" />
          <span className="text-[10px] font-mono tracking-wider text-blue-600 uppercase block font-semibold">Total Costos Fijos</span>
          <div className="text-2xl font-display font-bold text-blue-600 mt-2">{formatCop(totalOverheadFijos)}</div>
          <span className="text-[10px] text-slate-400 font-mono block mt-1">Gasto estructural mensual de Ferova</span>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* A. Mi salario y prestaciones */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
          <div>
            <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase flex items-center gap-2 font-semibold">
              <PenTool className="w-4 h-4 text-blue-600" /> Mi Salario y Liquidación de Prestaciones
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Define tu sueldo básico deseado en pesos colombianos. El sistema calculará el Ingreso Base de Cotización (IBC) reglamentario y las cotizaciones obligatorias de Ley 2026.
            </p>
          </div>

          <form onSubmit={handleUpdateSalario} className="flex gap-3">
            <div className="relative w-full">
              <input 
                type="number"
                min="0"
                value={salarioInput}
                onChange={(e) => setSalarioInput(Number(e.target.value))}
                className="w-full bg-[#0f0e0c]/60 text-slate-900 font-mono text-xs border border-slate-200 pl-10 pr-4 py-2.5 rounded focus:outline-none focus:border-[#c9a961]"
              />
              <span className="absolute left-3.5 top-3 text-slate-400 font-mono text-xs">COP</span>
            </div>
            <button 
              type="submit"
              className="bg-blue-600 hover:bg-[#b09252] text-black font-semibold font-display text-xs px-4 rounded transition cursor-pointer shrink-0"
            >
              {isUpdatingSalario ? 'Guardando...' : 'Fijar Sueldo'}
            </button>
          </form>

          {/* Prestaciones display box — sólo Colombia. */}
          {fiscalCO ? (
          <div className="bg-[#13110f] border border-slate-200 p-4 rounded-lg space-y-3.5 text-xs text-slate-500 font-sans">
            <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
              <span>Ingreso Base de Cotización (IBC 40%):</span>
              <span className="font-mono text-slate-900 font-medium">{formatCop(prestaciones.ibc)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Salud mensual aportes (12.5%):</span>
              <span className="font-mono text-[#c97a61]">{formatCop(prestaciones.salud)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200/40 pb-2">
              <span>Pensión pensión contribución (16%):</span>
              <span className="font-mono text-[#c97a61]">{formatCop(prestaciones.pension)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-900 font-bold">
              <span>Liquidación Prestaciones Totales:</span>
              <span className="font-mono text-[#c97a61]">{formatCop(prestaciones.totalPrestaciones)}</span>
            </div>
            <div className="bg-[#a8c98a]/5 border border-[#a8c98a]/10 p-3 rounded text-center text-[11px] leading-normal text-[#a8c98a]">
              <span>Salario Neto Retirable (Libre de prestaciones): <strong>{formatCop(prestaciones.salarioNeto)}</strong></span>
            </div>
            <div className="bg-blue-600/5 border border-[#c9a961]/10 p-3.5 rounded text-left text-[11px] leading-relaxed text-blue-600 space-y-1.5">
              <span className="font-semibold block font-mono uppercase tracking-wide text-[9px]">Diferencia de Concepto Salarial:</span>
              <p className="text-slate-500">
                Este sueldo fijado arriba es de carácter <strong>propuesto / proyectado</strong> (usado para diseñar las cotizaciones de precios, punto de equilibrio y alertar topes tributarios).
              </p>
              <p className="text-slate-500">
                El salario real que te transfieres mes a mes se registra como un <strong>desembolso definitivo (Egreso)</strong> con la categoría de "Salarios" dentro de la pestaña de <b className="text-slate-900">Pagos & Egresos</b>.
              </p>
            </div>
          </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg text-xs text-amber-800 flex gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Las prestaciones sociales (salud/pensión) se calculan sólo con reglas colombianas. Tu perfil fiscal está en <b>{(fiscalProfile?.country || '').toUpperCase() || 'otro país'}</b>: configura tus reglas locales para verlas.</span>
            </div>
          )}
        </div>

        {/* B. Herramientas form */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase font-semibold">
            {editingToolId ? 'Editar Herramienta SaaS' : 'Configurar Herramientas y Suscripciones SaaS'}
          </h3>
          
          <form onSubmit={handleAddTool} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Nombre SaaS</label>
                <input 
                  type="text"
                  placeholder="Ej: Google Workspace o Vercel"
                  value={toolNombre}
                  onChange={(e) => setToolNombre(e.target.value)}
                  required
                  className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Monto de Licencia</label>
                <input 
                  type="number"
                  placeholder="20"
                  value={toolMonto}
                  onChange={(e) => setToolMonto(Number(e.target.value))}
                  required
                  className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded font-mono focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Moneda</label>
                <select 
                  value={toolMoneda}
                  onChange={(e) => setToolMoneda(e.target.value as 'COP' | 'USD')}
                  className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded focus:outline-none"
                >
                  <option value="COP" className="bg-[#0f0e0c]">COP ($)</option>
                  <option value="USD" className="bg-[#0f0e0c]">USD ($.)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Tipo de Cobro</label>
                <select 
                  value={toolTipoCobro}
                  onChange={(e) => setToolTipoCobro(e.target.value as 'global' | 'porCliente')}
                  className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded focus:outline-none"
                >
                  <option value="global" className="bg-[#0f0e0c]">Global (Tarifa única)</option>
                  <option value="porCliente" className="bg-[#0f0e0c]">Por Cliente (monto x clientes activos)</option>
                </select>
              </div>
            </div>

            {/* Services multi-checkbox */}
            <div>
              <label className="block text-slate-500 text-[10px] uppercase font-mono mb-2">Prorratear entre Líneas de Servicio</label>
              <div className="grid grid-cols-2 gap-2 bg-[#0f0e0c]/40 border border-slate-200/60 p-3 rounded max-h-32 overflow-y-auto">
                {servicios.map(s => (
                  <label key={s.id} className="flex items-center gap-2 text-[11px] text-slate-900 cursor-pointer selection:bg-transparent">
                    <input 
                      type="checkbox"
                      checked={selectedServices.includes(s.id)}
                      onChange={() => toggleServiceLabel(s.id)}
                      className="accent-[#c9a961]"
                    />
                    <span>{s.nombre}</span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">El costo total del SaaS se dividirá equitativamente entre los servicios seleccionados.</p>
            </div>

            <div className="space-y-2">
              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-[#b09252] text-black font-semibold font-display py-2.5 rounded transition cursor-pointer"
              >
                {editingToolId ? 'Guardar Cambios SaaS' : 'Registrar Herramientas SaaS'}
              </button>
              {editingToolId && (
                <button 
                  type="button"
                  onClick={handleCancelEditTool}
                  className="w-full bg-transparent border border-slate-200 hover:bg-white/[0.02] text-slate-500 hover:text-slate-900 font-semibold font-display py-2.5 rounded transition cursor-pointer text-xs"
                >
                  Cancelar Edición
                </button>
              )}
            </div>
          </form>
        </div>

      </div>

      {/* B. Herramientas table display */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-white/[0.02] border-b border-slate-200 px-5 py-3.5">
          <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase font-semibold">
            Inventario General de Herramientas SaaS ({herramientas.length})
          </h3>
        </div>
        <div className="overflow-x-auto text-xs font-sans">
          <table className="w-full text-left">
            <thead className="bg-slate-100 text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Nombre Tool</th>
                <th className="px-5 py-3">Monto Base</th>
                <th className="px-5 py-3">Tipo Cobro</th>
                <th className="px-5 py-3 font-mono">Servicios Vinculados</th>
                <th className="px-5 py-3">Costo Prorrateado / Servicio</th>
                <th className="px-5 py-3">Costo Estructural Mensual</th>
                <th className="px-5 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2620]/40">
              {toolsComputed.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400 font-mono">Sin herramientas registradas.</td>
                </tr>
              ) : (
                toolsComputed.map(h => {
                  const originalTool = herramientas.find(item => item.id === h.id);
                  const baseMonto = originalTool ? originalTool.monto : 0;
                  const baseMoneda = originalTool ? originalTool.moneda : 'COP';
                  const isToolEditing = editingToolId === h.id;

                  return (
                    <tr key={h.id} className={`hover:bg-white/[0.01]/70 transition ${isToolEditing ? 'bg-blue-600/5 border-l-2 border-[#c9a961]' : ''}`}>
                      <td className="px-5 py-3.5 font-medium text-slate-900">{h.nombre}</td>
                      <td className="px-5 py-3.5 font-mono">
                        {baseMoneda === 'USD' ? formatUsd(baseMonto) : formatCop(baseMonto)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="uppercase text-[9px] font-mono font-bold text-slate-500">
                          {originalTool?.tipo_cobro === 'porCliente' ? 'POR CLIENTE (SaaS)' : 'GLOBALSTRUCT'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-500 max-w-xs truncate">
                        {h.serviciosLinked.length > 0 ? (
                          h.serviciosLinked.map(sId => servicios.find(s => s.id === sId)?.nombre || sId).join(', ')
                        ) : (
                          <span className="text-[#c97a61] font-semibold">Ninguno vinculado (No se deduce)</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-blue-600">
                        {formatCop(h.costoAsignadoPorServicio)}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-[#a8c98a]">
                        {formatCop(h.costoMensualTotal)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {originalTool && (
                            <button 
                              type="button"
                              onClick={() => handleStartEditTool(originalTool)}
                              title="Editar herramienta"
                              className="bg-[#0f0e0c]/40 text-blue-600 hover:text-slate-900 p-1.5 transition rounded-lg hover:bg-blue-600/10 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <InlineDeleteConfirm
                            confirming={confirmDeleteToolId === h.id}
                            onRequestConfirm={() => setConfirmDeleteToolId(h.id)}
                            onConfirm={() => handleDeleteTool(h.id)}
                            onCancel={() => setConfirmDeleteToolId(null)}
                            requestTitle="Eliminar herramienta"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* C. Otros gastos simples */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase font-semibold">
            {editingOtroId ? 'Editar Gasto Estructural' : 'Otros Gastos Operacionales (Fijos)'}
          </h3>

          <form onSubmit={handleAddOtro} className="space-y-4 text-xs font-sans">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Concepto o Destino</label>
                <input 
                  type="text"
                  placeholder="Ej: Hosting general o publicidad"
                  value={otroNombre}
                  onChange={(e) => setOtroNombre(e.target.value)}
                  required
                  className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Monto / Valor</label>
                <input 
                  type="number"
                  placeholder="50000"
                  value={otroMonto}
                  onChange={(e) => setOtroMonto(Number(e.target.value))}
                  required
                  className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded font-mono focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Moneda</label>
                <select 
                  value={otroMoneda}
                  onChange={(e) => setOtroMoneda(e.target.value as 'COP' | 'USD')}
                  className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded focus:outline-none"
                >
                  <option value="COP" className="bg-[#0f0e0c]">COP ($)</option>
                  <option value="USD" className="bg-[#0f0e0c]">USD ($/USD)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Categoría Gasto</label>
                <select 
                  value={otroCategoria}
                  onChange={(e) => setOtroCategoria(e.target.value as any)}
                  className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded focus:outline-none"
                >
                  <option value="Operativo" className="bg-[#0f0e0c]">Gasto Operativo</option>
                  <option value="Administrativo" className="bg-[#0f0e0c]">Gasto Administrativo</option>
                  <option value="Otros" className="bg-[#0f0e0c]">Varios</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Factura pagada (opcional)</label>
              <ComprobanteUpload
                currentUrl={otroComprobanteUrl}
                currentNombre={otroComprobanteNombre}
                onUploaded={(url, nombre) => { setOtroComprobanteUrl(url); setOtroComprobanteNombre(nombre); }}
                label="Adjuntar factura"
              />
            </div>

            <div className="space-y-2">
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-[#b09252] text-black font-semibold font-display py-2.5 rounded transition cursor-pointer"
              >
                {editingOtroId ? 'Guardar Cambios Gasto' : 'Registrar Gasto estructural'}
              </button>
              {editingOtroId && (
                <button 
                  type="button"
                  onClick={handleCancelEditOtro}
                  className="w-full bg-transparent border border-slate-200 hover:bg-white/[0.02] text-slate-500 hover:text-slate-900 font-semibold font-display py-2.5 rounded transition cursor-pointer text-xs"
                >
                  Cancelar Edición
                </button>
              )}
            </div>
          </form>

          {/* Otros Gastos Table */}
          <div className="overflow-x-auto text-[11px] pt-3 font-sans">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-500 font-mono uppercase text-[9px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2">Concepto</th>
                  <th className="px-4 py-2">Categoría</th>
                  <th className="px-4 py-2">Monto Base</th>
                  <th className="px-4 py-2 text-right">COP Equivalente</th>
                  <th className="px-4 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2620]/30">
                {otrosGastos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-5 text-center text-slate-400 font-mono">Sin otros gastos</td>
                  </tr>
                ) : (
                  otrosGastos.map(g => {
                    const isOtroEditing = editingOtroId === g.id;
                    return (
                      <tr key={g.id} className={`hover:bg-white/[0.01] ${isOtroEditing ? 'bg-blue-600/5 border-l-2 border-[#c9a961]' : ''}`}>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <span className="inline-flex items-center gap-1.5">
                            {g.nombre}
                            {g.comprobante_url && (
                              <a href={g.comprobante_url} target="_blank" rel="noreferrer" aria-label={`Ver comprobante de ${g.nombre}`} title={g.comprobante_nombre || 'Ver comprobante'} className="text-blue-500 hover:text-blue-700">
                                <Paperclip className="w-3 h-3" />
                              </a>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">{g.categoria}</td>
                        <td className="px-4 py-3 font-mono">
                          {g.moneda === 'USD' ? formatUsd(g.monto) : formatCop(g.monto)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-[#c97a61]">
                          {formatCop(convertToCop(g.monto, g.moneda, config.trm))}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              type="button"
                              onClick={() => handleStartEditOtro(g)}
                              title="Editar gasto"
                              className="text-blue-600 hover:text-slate-900 p-1 rounded cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            
                            <InlineDeleteConfirm
                              confirming={confirmDeleteOtroId === g.id}
                              onRequestConfirm={() => setConfirmDeleteOtroId(g.id)}
                              onConfirm={() => handleDeleteOtro(g.id)}
                              onCancel={() => setConfirmDeleteOtroId(null)}
                              requestTitle="Eliminar gasto"
                              size="sm"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* D. Costos de Herramientas Distribuidos por Servicio */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div>
            <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase flex items-center gap-2 font-semibold">
              <LayoutGrid className="w-4 h-4 text-[#a8c98a]" /> Distribuido Prorrateado por Línea de Servicio
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Consolidación del costo de suscripciones asignadas de forma equitativa por unidad o por contrato a cada línea de producto o servicio en Ferova:
            </p>
          </div>

          <div className="overflow-x-auto text-xs font-sans pt-2">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Línea de Servicio</th>
                  <th className="px-5 py-3 text-right">Sobrecarga Mensual Herramientas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2620]/40">
                {Array.from(distributedMap.entries()).map(([sId, weightCop]) => {
                  const srv = servicios.find(s => s.id === sId);
                  return (
                    <tr key={sId} className="hover:bg-white/[0.01]/70 transition">
                      <td className="px-5 py-3.5 font-medium text-slate-900">{srv?.nombre || sId}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-[#a8c98a]">
                        {formatCop(weightCop)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
