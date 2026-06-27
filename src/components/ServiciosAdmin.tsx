import React, { useState } from 'react';
import { Servicio, Venta, Hora, Config } from '../types';
import { convertToCop } from '../lib/calculations';
import { Plus, Trash2, Tag, Percent, Clock, Briefcase, Edit2, Check, X } from 'lucide-react';

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
  // Form State
  const [srvNombre, setSrvNombre] = useState('');
  const [srvId, setSrvId] = useState('');
  const [srvCostoUnitario, setSrvCostoUnitario] = useState(0);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [confirmDeleteSrvId, setConfirmDeleteSrvId] = useState<string | null>(null);

  const handleStartEdit = (s: Servicio) => {
    setEditingServiceId(s.id);
    setSrvId(s.id);
    setSrvNombre(s.nombre);
    setSrvCostoUnitario(s.costo_unitario);
  };

  const handleCancelEdit = () => {
    setEditingServiceId(null);
    setSrvId('');
    setSrvNombre('');
    setSrvCostoUnitario(0);
  };

  const handleCreateServicio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvNombre.trim()) return;

    if (editingServiceId) {
      // Mode Edit
      const updated = servicios.map(s => {
        if (s.id === editingServiceId) {
          return {
            ...s,
            nombre: srvNombre.trim(),
            costo_unitario: Number(srvCostoUnitario),
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
        alert('Ya existe un servicio configurado con este identificador.');
        return;
      }

      const uniqueId = srvId.trim() || `srv_${Date.now().toString().slice(-4)}`;

      const newSrv: Servicio = {
        id: uniqueId,
        nombre: srvNombre.trim(),
        costo_unitario: Number(srvCostoUnitario),
        descripcion: `Línea de servicio general para ${srvNombre.trim()}`
      };

      const updated = [...servicios, newSrv];
      await onSaveServicios(updated);

      // Reset Form
      setSrvNombre('');
      setSrvId('');
      setSrvCostoUnitario(0);
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
  const getServiceStats = (id: string) => {
    // Sales Revenue in COP
    const srvSales = ventas.filter(v => v.servicio_id === id);
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
      .filter(h => h.servicio_id === id)
      .reduce((sum, h) => sum + h.horas, 0);

    return {
      totalQty,
      srvRevenueCop,
      srvCogsCop,
      srvMarginCop,
      marginPct,
      totalHrs
    };
  };

  return (
    <div className="space-y-8 animate-fade-in text-[#e8e3d8]">

      {/* Header */}
      <div className="border-b border-[#2a2620] pb-5">
        <h2 className="text-xl font-display font-medium text-[#c9a961]">Portafolio de Líneas de Servicio</h2>
        <p className="text-xs text-[#a39d8e] font-mono mt-1">Configuración de precios de referencia, costos directos y rentabilidades por servicio</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Registration & Edit Form */}
        <form onSubmit={handleCreateServicio} className="lg:col-span-4 bg-[#161412] border border-[#2a2620] pb-6 rounded-lg overflow-hidden space-y-4">
          <div className="bg-white/[0.02] border-b border-[#2a2620] px-5 py-4">
            <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold">
              {editingServiceId ? 'Editar Línea de Servicio' : 'Nuevo Catálogo de Servicio'}
            </h3>
          </div>

          <div className="px-5 space-y-4 text-xs font-sans">
            <div>
              <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Identificador Corto</label>
              <input 
                type="text"
                placeholder="Ej: SERV_SEO o DES_WEB"
                value={srvId}
                onChange={(e) => setSrvId(e.target.value)}
                required
                disabled={!!editingServiceId}
                className={`w-full font-mono border border-[#2a2620] p-2.5 rounded focus:outline-none focus:border-[#c9a961] ${
                  editingServiceId 
                    ? 'bg-neutral-900 border-[#2a2620]/50 text-neutral-500 cursor-not-allowed opacity-70' 
                    : 'bg-[#0f0e0c]/50 text-white'
                }`}
              />
            </div>

            <div>
              <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Nombre Comercial de Línea</label>
              <input 
                type="text"
                placeholder="Ej: Posicionamiento GEO & SEO"
                value={srvNombre}
                onChange={(e) => setSrvNombre(e.target.value)}
                required
                className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2.5 rounded focus:outline-none focus:border-[#c9a961]"
              />
            </div>

            <div>
              <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Costo Unitario Directo (COP)</label>
              <input 
                type="number"
                min="0"
                placeholder="Ej: 300000"
                value={srvCostoUnitario}
                onChange={(e) => setSrvCostoUnitario(Number(e.target.value))}
                required
                className="w-full bg-[#0f0e0c]/50 text-white font-mono border border-[#2a2620] p-2.5 rounded focus:outline-none focus:border-[#c9a961]"
              />
              <p className="text-[10px] text-[#8a8377] mt-1">Costo de entrega de un desarrollador externo o aprovisionamiento técnico.</p>
            </div>

            <button 
              type="submit"
              className="w-full bg-[#c9a961] hover:bg-[#b09252] text-black font-semibold font-display py-3 rounded transition cursor-pointer"
            >
              {editingServiceId ? 'Guardar Cambios' : 'Registrar Línea'}
            </button>

            {editingServiceId && (
              <button 
                type="button"
                onClick={handleCancelEdit}
                className="w-full bg-transparent border border-[#2a2620] hover:bg-white/[0.02] text-[#a39d8e] hover:text-white font-semibold font-display py-2.5 rounded transition cursor-pointer text-xs"
              >
                Cancelar Edición
              </button>
            )}
          </div>
        </form>

        {/* Directory Table */}
        <div className="lg:col-span-8 bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden">
          <div className="bg-white/[0.02] border-b border-[#2a2620] px-5 py-4">
            <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold">
              Estructura Corporativa de Servicios ({servicios.length})
            </h3>
          </div>

          <div className="overflow-x-auto text-xs font-sans">
            <table className="w-full text-left">
              <thead className="bg-[#1c1916] text-[#a39d8e] font-mono uppercase text-[10px] border-b border-[#2a2620]">
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
                    <td colSpan={7} className="px-5 py-10 text-center text-[#8a8377] font-mono">
                      No hay servicios configurados.
                    </td>
                  </tr>
                ) : (
                  servicios.map(s => {
                    const stats = getServiceStats(s.id);
                    const isServiceEditing = editingServiceId === s.id;
                    return (
                      <tr key={s.id} className={`hover:bg-white/[0.01]/70 transition ${isServiceEditing ? 'bg-[#c9a961]/5 border-l-2 border-[#c9a961]' : ''}`}>
                        <td className="px-5 py-4 font-mono text-[#a39d8e]">{s.id}</td>
                        <td className="px-5 py-4 font-semibold text-[#e8e3d8]">{s.nombre}</td>
                        <td className="px-5 py-4 text-right font-mono text-white">{formatCop(s.costo_unitario)}</td>
                        <td className="px-5 py-4 text-right font-mono font-bold text-[#c9a961]">
                          {formatCop(stats.srvRevenueCop)}
                          <span className="text-[9px] text-[#8a8377] block font-mono">({stats.totalQty} uds vendidas)</span>
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-[#a39d8e]">
                          {stats.totalHrs > 0 ? (
                            <span className="text-white font-medium flex items-center justify-end gap-1">
                              <Clock className="w-3.5 h-3.5 text-[#c9a961]" /> {stats.totalHrs.toFixed(1)} hs
                            </span>
                          ) : (
                            <span className="text-[#8a8377] italic">-</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right font-mono font-bold" style={{ color: stats.marginPct >= 50 ? '#a8c98a' : (stats.marginPct > 0 ? '#c9a961' : '#8a8377') }}>
                          {stats.srvRevenueCop > 0 ? `${stats.marginPct.toFixed(0)}%` : 'No vendida'}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleStartEdit(s)}
                              title="Editar servicio"
                              className="bg-[#0f0e0c]/40 text-[#c9a961] hover:text-[#e8e3d8] p-1.5 transition rounded-lg hover:bg-[#c9a961]/10 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {confirmDeleteSrvId === s.id ? (
                              <div className="flex items-center gap-1 bg-[#1a1110] border border-[#c97a61]/30 p-1 rounded">
                                <button 
                                  onClick={() => handleDeleteServicio(s.id)}
                                  title="Confirmar eliminación"
                                  className="text-[#a8c98a] hover:text-[#bde89b] font-bold text-xs px-1 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => setConfirmDeleteSrvId(null)}
                                  title="Cancelar"
                                  className="text-[#c97a61] hover:text-[#e08970] font-bold text-xs px-1 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setConfirmDeleteSrvId(s.id)}
                                title="Eliminar servicio"
                                className="bg-[#0f0e0c]/40 text-[#c97a61] hover:text-[#e08970] p-1.5 transition rounded-lg hover:bg-[#c97a61]/10 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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
