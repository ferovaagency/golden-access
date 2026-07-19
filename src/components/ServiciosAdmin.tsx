import React, { useState } from 'react';
import { Servicio, Venta, Hora, Config } from '../types';
import { convertToCop } from '../lib/calculations';
import { Plus, Tag, Percent, Clock, Briefcase, Edit2 } from 'lucide-react';
import { useToast, errMsg } from './ui/toast';
import { InlineDeleteConfirm } from './ui/InlineDeleteConfirm';

interface ServiciosAdminProps {
  servicios: Servicio[];
  ventas: Venta[];
  horas: Hora[];
  config: Config;
  onSaveServicios: (updated: Servicio[]) => Promise<void>;
  formatCop: (val: number) => string;
}

export default function ServiciosAdmin({
  servicios,
  ventas,
  horas,
  config,
  onSaveServicios,
  formatCop
}: ServiciosAdminProps) {
  const { success: toastOk, error: toastErr, confirm: askConfirm } = useToast();
  // Form State
  const [srvNombre, setSrvNombre] = useState('');
  const [srvId, setSrvId] = useState('');
  const [srvCostoUnitario, setSrvCostoUnitario] = useState(0);
  const [srvMargenPct, setSrvMargenPct] = useState(''); // vacío = sin margen propio, usa el 30% por defecto
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [confirmDeleteSrvId, setConfirmDeleteSrvId] = useState<string | null>(null);

  const handleStartEdit = (s: Servicio) => {
    setEditingServiceId(s.id);
    setSrvId(s.id);
    setSrvNombre(s.nombre);
    setSrvCostoUnitario(s.costo_unitario);
    setSrvMargenPct(s.margen_objetivo != null ? String(Math.round(s.margen_objetivo * 100)) : '');
  };

  const handleCancelEdit = () => {
    setEditingServiceId(null);
    setSrvId('');
    setSrvNombre('');
    setSrvCostoUnitario(0);
    setSrvMargenPct('');
  };

  const handleCreateServicio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvNombre.trim()) return;

    const margenObjetivo = srvMargenPct.trim() === '' ? null : Number(srvMargenPct) / 100;

    if (editingServiceId) {
      // Mode Edit
      const updated = servicios.map(s => {
        if (s.id === editingServiceId) {
          return {
            ...s,
            nombre: srvNombre.trim(),
            costo_unitario: Number(srvCostoUnitario),
            margen_objetivo: margenObjetivo,
            descripcion: s.descripcion || `Línea de servicio general para ${srvNombre.trim()}`
          };
        }
        return s;
      });

      await onSaveServicios(updated);
      handleCancelEdit();
    } else {
      // Mode Create
      if (servicios.some(s => s.id.toLowerCase() === srvId.trim().toLowerCase())) {
        toastErr('Ya existe un servicio configurado con este identificador.');
        return;
      }

      const uniqueId = srvId.trim() || `srv_${Date.now().toString().slice(-4)}`;

      const newSrv: Servicio = {
        id: uniqueId,
        nombre: srvNombre.trim(),
        costo_unitario: Number(srvCostoUnitario),
        margen_objetivo: margenObjetivo,
        descripcion: `Línea de servicio general para ${srvNombre.trim()}`
      };

      const updated = [...servicios, newSrv];
      await onSaveServicios(updated);

      // Reset Form
      setSrvNombre('');
      setSrvId('');
      setSrvCostoUnitario(0);
      setSrvMargenPct('');
    }
  };

  const handleDeleteServicio = async (id: string) => {
    const updated = servicios.filter(s => s.id !== id);
    await onSaveServicios(updated);
    if (editingServiceId === id) {
      handleCancelEdit();
    }
    setConfirmDeleteSrvId(null);
  };

  // Derive total physical sales and hours for each service
  const getServiceStats = (service: Servicio) => {
    // Sales Revenue in COP
    const srvSales = ventas.filter(v => v.servicio_id === service.id);
    const totalQty = srvSales.reduce((sum, v) => sum + v.cantidad, 0);
    const srvRevenueCop = srvSales.reduce((sum, v) => {
      return sum + convertToCop(v.precio_venta_unitario * v.cantidad, v.moneda, config.trm);
    }, 0);

    // Cost of goods sold (COGS)
    const srvCogsCop = srvSales.reduce((sum, v) => sum + (v.costo_unitario * v.cantidad), 0);

    // Profit
    const srvMarginCop = srvRevenueCop - srvCogsCop;
    const marginPct = srvRevenueCop > 0 ? (srvMarginCop / srvRevenueCop) * 100 : 0;

    // Total hours logged to this service
    const totalHrs = horas
      .filter(h => h.servicio_id === service.id)
      .reduce((sum, h) => sum + h.horas, 0);

    return {
      totalQty,
      srvRevenueCop,
      srvCogsCop,
      srvMarginCop,
      marginPct,
      totalHrs,
      // A sale stores the direct cost agreed at the moment it was recorded.
      // Its weighted average is the actual unit cost and is never rewritten by
      // later catalogue changes; before any sale, show the configured estimate.
      unitDirectCost: totalQty > 0 ? srvCogsCop / totalQty : service.costo_unitario,
    };
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-900">

      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-xl font-display font-medium text-blue-600">Portafolio de Líneas de Servicio</h2>
        <p className="text-xs text-slate-500 font-mono mt-1">Configuración de precios de referencia, costos directos y rentabilidades por servicio</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Registration & Edit Form */}
        <form onSubmit={handleCreateServicio} className="lg:col-span-4 bg-white border border-slate-200 pb-6 rounded-lg overflow-hidden space-y-4">
          <div className="bg-white/[0.02] border-b border-slate-200 px-5 py-4">
            <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase font-semibold">
              {editingServiceId ? 'Editar Línea de Servicio' : 'Nuevo Catálogo de Servicio'}
            </h3>
          </div>

          <div className="px-5 space-y-4 text-xs font-sans">
            <div>
              <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Identificador Corto</label>
              <input 
                type="text"
                placeholder="Ej: SERV_SEO o DES_WEB"
                value={srvId}
                onChange={(e) => setSrvId(e.target.value)}
                required
                disabled={!!editingServiceId}
                className={`w-full font-mono border border-slate-200 p-2.5 rounded focus:outline-none focus:border-[#c9a961] ${
                  editingServiceId 
                    ? 'bg-neutral-900 border-slate-200/50 text-neutral-500 cursor-not-allowed opacity-70' 
                    : 'bg-slate-50 text-slate-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Nombre Comercial de Línea</label>
              <input 
                type="text"
                placeholder="Ej: Posicionamiento GEO & SEO"
                value={srvNombre}
                onChange={(e) => setSrvNombre(e.target.value)}
                required
                className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded focus:outline-none focus:border-[#c9a961]"
              />
            </div>

            <div>
              <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Costo Unitario Directo (COP)</label>
              <input 
                type="number"
                min="0"
                placeholder="Ej: 300000"
                value={srvCostoUnitario}
                onChange={(e) => setSrvCostoUnitario(Number(e.target.value))}
                required
                className="w-full bg-slate-50 text-slate-900 font-mono border border-slate-200 p-2.5 rounded focus:outline-none focus:border-[#c9a961]"
              />
              <p className="text-[10px] text-slate-400 mt-1">Costo de entrega de un desarrollador externo o aprovisionamiento técnico.</p>
            </div>

            <div>
              <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Margen objetivo (%) — opcional</label>
              <input
                type="number"
                min="0"
                max="99"
                placeholder="Ej: 40"
                value={srvMargenPct}
                onChange={(e) => setSrvMargenPct(e.target.value)}
                className="w-full bg-slate-50 text-slate-900 font-mono border border-slate-200 p-2.5 rounded focus:outline-none focus:border-[#c9a961]"
              />
              <p className="text-[10px] text-slate-400 mt-1">Define el precio ideal sugerido en Equilibrio por Servicio. Cada servicio puede tener su propio %; si lo dejas vacío, se usa 30% por defecto.</p>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-[#b09252] text-black font-semibold font-display py-3 rounded transition cursor-pointer"
            >
              {editingServiceId ? 'Guardar Cambios' : 'Registrar Línea'}
            </button>

            {editingServiceId && (
              <button 
                type="button"
                onClick={handleCancelEdit}
                className="w-full bg-transparent border border-slate-200 hover:bg-white/[0.02] text-slate-500 hover:text-slate-900 font-semibold font-display py-2.5 rounded transition cursor-pointer text-xs"
              >
                Cancelar Edición
              </button>
            )}
          </div>
        </form>

        {/* Directory Table */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-white/[0.02] border-b border-slate-200 px-5 py-4">
            <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase font-semibold">
              Estructura Corporativa de Servicios ({servicios.length})
            </h3>
          </div>

          <div className="overflow-x-auto text-xs font-sans">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">ID Servicio</th>
                  <th className="px-5 py-3">Nombre Comercial</th>
                  <th className="px-5 py-3 font-mono text-right">Costo Unitario Directo</th>
                  <th className="px-5 py-3 font-mono text-right">Venta Acumulada Periodo</th>
                  <th className="px-5 py-3 font-mono text-right">Horas de dedicación</th>
                  <th className="px-5 py-3 font-mono text-right">Margen Bruto (%)</th>
                  <th className="px-5 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2620]/40">
                {servicios.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-400 font-mono">
                      No hay servicios configurados.
                    </td>
                  </tr>
                ) : (
                  servicios.map(s => {
                    const stats = getServiceStats(s);
                    const isServiceEditing = editingServiceId === s.id;
                    return (
                      <tr key={s.id} className={`hover:bg-white/[0.01]/70 transition ${isServiceEditing ? 'bg-blue-600/5 border-l-2 border-[#c9a961]' : ''}`}>
                        <td className="px-5 py-4 font-mono text-slate-500">{s.id}</td>
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {s.nombre}
                          <span className="block text-[9px] font-normal text-slate-400">
                            Margen objetivo: {s.margen_objetivo != null ? `${Math.round(s.margen_objetivo * 100)}%` : '30% (por defecto)'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-slate-900">
                          {formatCop(stats.unitDirectCost)}
                          <span className="block text-[9px] text-slate-400">{stats.totalQty > 0 ? 'real según ventas' : 'estimado configurado'}</span>
                        </td>
                        <td className="px-5 py-4 text-right font-mono font-bold text-blue-600">
                          {formatCop(stats.srvRevenueCop)}
                          <span className="text-[9px] text-slate-400 block font-mono">({stats.totalQty} uds vendidas)</span>
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-slate-500">
                          {stats.totalHrs > 0 ? (
                            <span className="text-slate-900 font-medium flex items-center justify-end gap-1">
                              <Clock className="w-3.5 h-3.5 text-blue-600" /> {stats.totalHrs.toFixed(1)} hs
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right font-mono font-bold" style={{ color: stats.marginPct >= 50 ? '#a8c98a' : (stats.marginPct > 0 ? '#c9a961' : '#8a8377') }}>
                          {stats.srvRevenueCop > 0 ? `${stats.marginPct.toFixed(0)}%` : 'Sin ventas'}
                          {stats.srvRevenueCop > 0 && <span className="block text-[9px] font-normal text-slate-400">{formatCop(stats.srvMarginCop)}</span>}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleStartEdit(s)}
                              title="Editar servicio"
                              className="bg-[#0f0e0c]/40 text-blue-600 hover:text-slate-900 p-1.5 transition rounded-lg hover:bg-blue-600/10 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <InlineDeleteConfirm
                              confirming={confirmDeleteSrvId === s.id}
                              onRequestConfirm={() => setConfirmDeleteSrvId(s.id)}
                              onConfirm={() => handleDeleteServicio(s.id)}
                              onCancel={() => setConfirmDeleteSrvId(null)}
                              requestTitle="Eliminar servicio"
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

      </div>

    </div>
  );
}
