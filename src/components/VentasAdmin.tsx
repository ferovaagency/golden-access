import React, { useState, useEffect } from 'react';
import { Venta, Cliente, Servicio, Config } from '../types';
import { convertToCop } from '../lib/calculations';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Search, 
  HelpCircle,
  FileSpreadsheet,
  Check,
  X,
  Edit2
} from 'lucide-react';

interface VentasAdminProps {
  ventas: Venta[];
  clientes: Cliente[];
  servicios: Servicio[];
  config: Config;
  onSaveVentas: (updated: Venta[]) => Promise<void>;
  formatCop: (val: number) => string;
  formatUsd: (val: number) => string;
}

export default function VentasAdmin({ 
  ventas, 
  clientes, 
  servicios, 
  config, 
  onSaveVentas, 
  formatCop, 
  formatUsd 
}: VentasAdminProps) {
  // Form states
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [clienteId, setClienteId] = useState('');
  const [servicioId, setServicioId] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [precioVentaUnitario, setPrecioVentaUnitario] = useState(0);
  const [costoUnitario, setCostoUnitario] = useState(0);
  const [moneda, setMoneda] = useState<'COP' | 'USD'>('COP');
  const [adelanto, setAdelanto] = useState(0);
  const [notas, setNotas] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingVentaId, setEditingVentaId] = useState<string | null>(null);

  const [activeAbonos, setActiveAbonos] = useState<any[]>([]);
  const [newAbonoMonto, setNewAbonoMonto] = useState<number | ''>('');
  const [newAbonoFecha, setNewAbonoFecha] = useState(new Date().toISOString().split('T')[0]);
  const [newAbonoNotas, setNewAbonoNotas] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  // Set defaults
  useEffect(() => {
    if (clientes.length > 0 && !clienteId && !editingVentaId) {
      const defaultClient = clientes.find(c => c.activo) || clientes[0];
      handleClientChange(defaultClient.id);
    }
  }, [clientes]);

  useEffect(() => {
    if (servicios.length > 0 && !servicioId && !editingVentaId) {
      handleServiceChange(servicios[0].id);
    }
  }, [servicios]);

  const handleClientChange = (cId: string) => {
    setClienteId(cId);
    const cli = clientes.find(c => c.id === cId);
    if (cli) {
      const realMoneda = cli.tipo === 'Internacional' ? 'USD' : 'COP';
      setMoneda(realMoneda);
    }
  };

  const handleServiceChange = (sId: string) => {
    setServicioId(sId);
    const srv = servicios.find(s => s.id === sId);
    if (srv) {
      setCostoUnitario(srv.costo_unitario);
    }
  };

  // Resolve active chosen client & service details
  const selectedClient = clientes.find(c => c.id === clienteId);
  const selectedService = servicios.find(s => s.id === servicioId);

  // Auto-derived type and declarante
  const tipoCliente = selectedClient ? selectedClient.tipo : 'Nacional';
  const esDeclarante = selectedClient ? selectedClient.declarante : true;

  // Live Calculations for Preview & Save
  const totalPactadoOriginal = precioVentaUnitario * cantidad;
  const isInt = tipoCliente === 'Internacional';
  
  // ReteFuente estimation
  const totalPactadoCop = convertToCop(totalPactadoOriginal, moneda, config.trm);
  const baseMinimaRetencionCop = config.retencion_servicio_min_uvt * config.uvt;
  
  let rateRentencion = 0;
  if (!isInt && totalPactadoCop >= baseMinimaRetencionCop) {
    rateRentencion = esDeclarante ? config.tarifa_ret_declarante : config.tarifa_ret_no_declarante;
  }
  
  const retencionCop = totalPactadoCop * rateRentencion;
  const retencionOriginalMoneda = retencionCop / (moneda === 'USD' ? config.trm : 1);
  const netoQueEntra = totalPactadoOriginal - retencionOriginalMoneda;

  const handleStartEdit = (v: Venta) => {
    setEditingVentaId(v.id);
    setFecha(v.fecha);
    setClienteId(v.cliente_id);
    setServicioId(v.servicio_id);
    setCantidad(v.cantidad);
    setPrecioVentaUnitario(v.precio_venta_unitario);
    setCostoUnitario(v.costo_unitario);
    setMoneda(v.moneda);
    setAdelanto(v.adelanto);
    setNotas(v.notas || '');
    setActiveAbonos(v.abonos || []);
    setNewAbonoMonto('');
    setNewAbonoNotas('');
  };

  const handleCancelEdit = () => {
    setEditingVentaId(null);
    setFecha(new Date().toISOString().split('T')[0]);
    const cleanActiveList = clientes.filter(c => c.activo);
    if (cleanActiveList.length > 0) {
      handleClientChange(cleanActiveList[0].id);
    } else {
      setClienteId('');
    }
    if (servicios.length > 0) {
      handleServiceChange(servicios[0].id);
    } else {
      setServicioId('');
    }
    setCantidad(1);
    setPrecioVentaUnitario(0);
    setAdelanto(0);
    setNotas('');
    setActiveAbonos([]);
    setNewAbonoMonto('');
    setNewAbonoNotas('');
  };

  const handleAddAbonoItem = () => {
    if (!newAbonoMonto || Number(newAbonoMonto) <= 0) {
      alert('Por favor introduce un monto de abono mayor a 0.');
      return;
    }
    const item = {
      fecha: newAbonoFecha,
      monto: Number(newAbonoMonto),
      notas: newAbonoNotas.trim() || 'Abono recibido'
    };
    const updated = [...activeAbonos, item];
    setActiveAbonos(updated);
    
    // Recalculate and update general adelanto state
    const newSum = updated.reduce((s, it) => s + it.monto, 0);
    setAdelanto(newSum);
    
    setNewAbonoMonto('');
    setNewAbonoNotas('');
  };

  const handleRemoveAbono = (idxToRemove: number) => {
    const updated = activeAbonos.filter((_, idx) => idx !== idxToRemove);
    setActiveAbonos(updated);
    const newSum = updated.reduce((s, it) => s + it.monto, 0);
    setAdelanto(newSum);
  };

  // Save Sale Handler
  const handleAddVenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId || !servicioId) {
      alert('Por favor selecciona un cliente y un servicio válidos.');
      return;
    }

    if (editingVentaId) {
      const updated = ventas.map(v => {
        if (v.id === editingVentaId) {
          const totalOriginal = precioVentaUnitario * cantidad;
          const currentClient = clientes.find(c => c.id === clienteId);
          const currentService = servicios.find(s => s.id === servicioId);
          return {
            ...v,
            fecha,
            cliente_id: clienteId,
            cliente_nombre: currentClient?.nombre || 'Cliente',
            servicio_id: servicioId,
            servicio_nombre: currentService?.nombre || 'Servicio',
            cantidad: Number(cantidad),
            precio_venta_unitario: Number(precioVentaUnitario),
            costo_unitario: Number(costoUnitario),
            moneda,
            tipo: currentClient ? currentClient.tipo : 'Nacional',
            adelanto: Number(adelanto),
            estado_pago: Number(adelanto) >= totalOriginal ? 'Pagado' : (Number(adelanto) > 0 ? 'Adelanto' : 'Pendiente') as 'Pagado' | 'Adelanto' | 'Pendiente',
            notas,
            abonos: activeAbonos,
          };
        }
        return v;
      });
      await onSaveVentas(updated);
      handleCancelEdit();
    } else {
      const initialAbonos = Number(adelanto) > 0 ? [{ fecha, monto: Number(adelanto), notas: 'Adelanto inicial' }] : [];
      const newVenta: Venta = {
        id: `v_${Date.now().toString().slice(-6)}`,
        fecha,
        cliente_id: clienteId,
        cliente_nombre: selectedClient?.nombre || 'Clientes',
        servicio_id: servicioId,
        servicio_nombre: selectedService?.nombre || 'Servicio',
        cantidad: Number(cantidad),
        precio_venta_unitario: Number(precioVentaUnitario),
        costo_unitario: Number(costoUnitario),
        moneda,
        tipo: tipoCliente,
        adelanto: Number(adelanto),
        estado_pago: Number(adelanto) >= totalPactadoOriginal ? 'Pagado' : (Number(adelanto) > 0 ? 'Adelanto' : 'Pendiente'),
        notas,
        abonos: initialAbonos
      };

      const updated = [newVenta, ...ventas];
      await onSaveVentas(updated);

      // Reset simple form bits
      setCantidad(1);
      setPrecioVentaUnitario(0);
      setAdelanto(0);
      setNotas('');
    }
  };

  const handleDelete = async (id: string) => {
    const updated = ventas.filter(v => v.id !== id);
    await onSaveVentas(updated);
    if (editingVentaId === id) {
      handleCancelEdit();
    }
    setConfirmDeleteId(null);
  };

  // Helper inside loop for history layout
  const calculateLoopRetention = (v: Venta) => {
    if (v.tipo === 'Internacional') return 0;
    const totalV = v.precio_venta_unitario * v.cantidad;
    const valCop = convertToCop(totalV, v.moneda, config.trm);
    if (valCop >= (config.retencion_servicio_min_uvt * config.uvt)) {
      // Find client
      const c = clientes.find(item => item.id === v.cliente_id);
      const isDec = c ? c.declarante : true;
      const rate = isDec ? config.tarifa_ret_declarante : config.tarifa_ret_no_declarante;
      return totalV * rate;
    }
    return 0;
  };

  // CSV Export
  const handleExportCSV = () => {
    const csvHeaders = [
      'ID', 'Fecha', 'Cliente', 'Tipo Cliente', 'Servicio', 'Cantidad', 
      'Precio Unitario', 'Moneda', 'Adelanto', 'Retención', 'Total Neto Entra', 'Notas'
    ];
    
    const rows = ventas.map(v => {
      const parentCli = clientes.find(c => c.id === v.cliente_id);
      const dec = parentCli ? parentCli.declarante : true;
      const totalV = v.precio_venta_unitario * v.cantidad;
      const loopRet = calculateLoopRetention(v);
      const loopNet = totalV - loopRet;

      return [
        v.id,
        v.fecha,
        `"${v.cliente_nombre.replace(/"/g, '""')}"`,
        v.tipo,
        `"${v.servicio_nombre.replace(/"/g, '""')}"`,
        v.cantidad,
        v.precio_venta_unitario,
        v.moneda,
        v.adelanto,
        loopRet,
        loopNet,
        `"${(v.notas || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [csvHeaders.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Ferova_Libro_Ventas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Feed filtration
  const filteredVentas = ventas.filter(v => 
    v.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.servicio_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in text-[#e8e3d8]">
      
      {/* Visual Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2a2620] pb-5">
        <div>
          <h2 className="text-xl font-display font-medium text-[#c9a961]">Registro de Ingresos (Ventas y Abonos)</h2>
          <p className="text-xs text-[#a39d8e] font-mono mt-1">Libro de cobranza, cobros anticipados, abonos y saldos de clientes de Ferova Agency</p>
        </div>
        <button 
          onClick={handleExportCSV}
          className="bg-white/[0.03] hover:bg-white/[0.08] transition px-4 py-2 text-xs font-mono tracking-wider font-semibold text-[#c9a961] border border-[#2a2620] rounded-lg flex items-center gap-2"
        >
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Form Container */}
        <form onSubmit={handleAddVenta} className="lg:col-span-4 bg-[#161412] border border-[#2a2620] pb-6 rounded-lg overflow-hidden space-y-4">
          <div className="bg-white/[0.02] border-b border-[#2a2620] px-5 py-4">
            <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold">
              {editingVentaId ? 'Editar Transacción / Abonos' : 'Nueva Transacción'}
            </h3>
          </div>

          <div className="px-5 space-y-4 text-xs font-sans">
            {clientes.length === 0 ? (
              <div className="bg-[#c97a61]/10 border border-[#c97a61]/30 p-4 rounded text-[#c97a61] leading-relaxed">
                No hay clientes registrados en este momento. Registra clientes en la pestaña de Clientes antes de iniciar la facturación.
              </div>
            ) : null}

            {/* Fecha */}
            <div>
              <label className="block text-[#a39d8e] font-semibold mb-1 uppercase tracking-wider font-mono text-[10px]">Fecha de Venta</label>
              <input 
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                className="w-full bg-[#0f0e0c]/50 text-[#e8e3d8] border border-[#2a2620] p-2.5 rounded font-mono focus:outline-none focus:border-[#c9a961]"
              />
            </div>

            {/* Cliente */}
            <div>
              <label className="block text-[#a39d8e] font-semibold mb-1 uppercase tracking-wider font-mono text-[10px]">Cliente</label>
              <select 
                value={clienteId}
                onChange={(e) => handleClientChange(e.target.value)}
                required
                className="w-full bg-[#0f0e0c]/50 text-[#e8e3d8] border border-[#2a2620] p-2.5 rounded focus:outline-none focus:border-[#c9a961]"
              >
                <option value="" disabled>Selecciona cliente...</option>
                {clientes.map((c, idx) => (
                  <option key={`${c.id || 'cli'}-${idx}`} value={c.id} className="bg-[#0f0e0c]">
                    {c.nombre} ({c.tipo}){!c.activo ? ' - [De Baja/Inactivo]' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Servicio */}
            <div>
              <label className="block text-[#a39d8e] font-semibold mb-1 uppercase tracking-wider font-mono text-[10px]">Servicio</label>
              <select 
                value={servicioId}
                onChange={(e) => handleServiceChange(e.target.value)}
                required
                className="w-full bg-[#0f0e0c]/50 text-[#e8e3d8] border border-[#2a2620] p-2.5 rounded focus:outline-none focus:border-[#c9a961]"
              >
                <option value="" disabled>Selecciona servicio...</option>
                {servicios.map((s, idx) => (
                  <option key={`${s.id || 'srv'}-${idx}`} value={s.id} className="bg-[#0f0e0c]">{s.nombre}</option>
                ))}
              </select>
            </div>

            {/* Cantidad y Precio Unitario */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[#a39d8e] font-semibold mb-1 uppercase tracking-wider font-mono text-[10px]">Cantidad</label>
                <input 
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value))}
                  required
                  className="w-full bg-[#0f0e0c]/50 text-[#e8e3d8] border border-[#2a2620] p-2.5 rounded font-mono focus:outline-none"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[#a39d8e] font-semibold mb-1 uppercase tracking-wider font-mono text-[10px]">P. Unitario ({moneda})</label>
                <input 
                  type="number"
                  min="0"
                  value={precioVentaUnitario}
                  onChange={(e) => setPrecioVentaUnitario(Number(e.target.value))}
                  required
                  className="w-full bg-[#0f0e0c]/50 text-[#e8e3d8] border border-[#2a2620] p-2.5 rounded font-mono focus:outline-none"
                />
              </div>
            </div>

            {/* Costo unitario (auto-filled) & Moneda */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#a39d8e] font-semibold mb-1 uppercase tracking-wider font-mono text-[10px]">Costo Unit. (COP)</label>
                <input 
                  type="number"
                  min="0"
                  value={costoUnitario}
                  onChange={(e) => setCostoUnitario(Number(e.target.value))}
                  className="w-full bg-[#0f0e0c]/50 text-[#e8e3d8] border border-[#2a2620] p-2.5 rounded font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#a39d8e] font-semibold mb-1 uppercase tracking-wider font-mono text-[10px]">Moneda</label>
                <input 
                  type="text"
                  readOnly
                  value={moneda}
                  className="w-full bg-[#0f0e0c]/30 text-[#8a8377] border border-[#2a2620]/70 p-2.5 rounded font-mono cursor-not-allowed text-center"
                />
              </div>
            </div>

            {/* Adelanto / Abonos */}
            <div className="space-y-4 p-4 bg-[#0f0e0c]/30 border border-[#2a2620]/60 rounded-lg">
              <div className="flex items-center justify-between border-b border-[#2a2620]/40 pb-2">
                <label className="block text-[#a39d8e] font-bold uppercase tracking-wider font-mono text-[10px]">
                  Abonado / Pagado ({moneda})
                </label>
                <span className="text-emerald-400 font-mono font-bold">
                  {moneda === 'USD' ? formatUsd(adelanto) : formatCop(adelanto)}
                </span>
              </div>

              {editingVentaId ? (
                // EDITING MODE: SHOW CHRONOLOGICAL ABONOS MANAGER
                <div className="space-y-4 text-xs">
                  <div>
                    <span className="block text-[#868074] font-mono text-[9px] uppercase tracking-wider mb-2 font-bold">
                      Historial de Abonos Recibidos:
                    </span>
                    
                    {activeAbonos.length === 0 ? (
                      <div className="text-center py-4 bg-[#0f0e0c]/10 rounded border border-dashed border-[#2a2620] text-[#8a8377] font-mono italic">
                        Sin abonos registrados en diferentes fechas.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                        {activeAbonos.map((ab, index) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-[#0f0e0c]/60 rounded border border-[#2a2620]/50 text-[11px] font-mono">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[#a39d8e]">{ab.fecha}:</span>
                                <span className="text-emerald-400 font-semibold">
                                  {moneda === 'USD' ? formatUsd(ab.monto) : formatCop(ab.monto)}
                                </span>
                              </div>
                              {ab.notas && <span className="block text-[10px] text-[#8a8377] pt-0.5">{ab.notas}</span>}
                            </div>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveAbono(index)}
                              className="text-[#c97a61] hover:text-[#e08970] font-bold px-1 rounded transition text-sm cursor-pointer"
                              title="Eliminar abono"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add dynamic sub-payment form */}
                  <div className="p-3 bg-white/[0.01] border border-[#2a2620]/75 rounded-lg space-y-3">
                    <span className="block font-mono text-[9px] uppercase tracking-widest text-[#c9a961] font-bold">
                      Registrar Abono en Otra Fecha:
                    </span>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] font-mono text-[#8a8377] uppercase mb-0.5">Monto de Abono</label>
                        <input 
                          type="number"
                          min="0"
                          placeholder="Monto..."
                          value={newAbonoMonto}
                          onChange={(e) => setNewAbonoMonto(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full bg-[#0f0e0c]/60 text-emerald-400 border border-[#2a2620]/80 p-1.5 rounded font-mono focus:outline-none text-xs"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[8px] font-mono text-[#8a8377] uppercase mb-0.5">Fecha del Pago</label>
                        <input 
                          type="date"
                          value={newAbonoFecha}
                          onChange={(e) => setNewAbonoFecha(e.target.value)}
                          className="w-full bg-[#0f0e0c]/60 text-[#a39d8e] border border-[#2a2620]/80 p-1.5 rounded font-mono text-[10px] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[8px] font-mono text-[#8a8377] uppercase mb-0.5">Referencia / Comentarios</label>
                      <input 
                        type="text"
                        placeholder="Ej. Transferencia Bancolombia #5541"
                        value={newAbonoNotas}
                        onChange={(e) => setNewAbonoNotas(e.target.value)}
                        className="w-full bg-[#0f0e0c]/60 text-[#e8e3d8] border border-[#2a2620]/80 p-1.5 rounded focus:outline-none placeholder-[#8a8377]/50 text-xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddAbonoItem}
                      className="w-full py-1.5 bg-[#c9a961]/10 hover:bg-[#c9a961]/25 border border-[#c9a961]/40 text-[#c9a961] text-[10px] font-mono font-bold rounded transition cursor-pointer"
                    >
                      + Sumar Abono a Cuenta
                    </button>
                  </div>
                </div>
              ) : (
                // NEW SALE CREATION MODE: SINGLE INITIAL FIELD
                <div className="space-y-2">
                  <input 
                    type="number"
                    min="0"
                    value={adelanto}
                    onChange={(e) => setAdelanto(Number(e.target.value))}
                    className="w-full bg-[#0f0e0c]/50 text-emerald-400 border border-[#2a2620] p-2 rounded font-mono focus:outline-none focus:border-[#a8c98a]"
                    placeholder="Monto pagado / anticipo..."
                  />
                  {totalPactadoOriginal > 0 && (
                    <button
                      type="button"
                      onClick={() => setAdelanto(totalPactadoOriginal)}
                      className="w-full py-1 bg-white/[0.02] hover:bg-white/[0.05] text-[10px] font-mono text-[#c9a961] border border-[#2a2620] rounded"
                    >
                      Saldar Totalmente
                    </button>
                  )}
                  <span className="text-[10px] text-[#8a8377] block leading-tight">
                    Introduce un adelanto si el cliente ya pagó una parte. Luego podrás gestionar abonos con fechas específicas al editar.
                  </span>
                </div>
              )}

              {totalPactadoOriginal > 0 && (
                <div className="pt-2 border-t border-[#2a2620]/30 space-y-1 text-[11px] font-mono">
                  <div className="flex justify-between items-center text-[#e8e3d8]">
                    <span>Saldo Pendiente:</span>
                    <span className={`font-bold ${totalPactadoOriginal - adelanto > 0 ? 'text-[#c97a61]' : 'text-emerald-400'}`}>
                      {moneda === 'USD' 
                        ? formatUsd(Math.max(0, totalPactadoOriginal - adelanto)) 
                        : formatCop(Math.max(0, totalPactadoOriginal - adelanto))}
                    </span>
                  </div>
                  
                  <div className="w-full bg-[#1c1916] h-1.5 rounded-full overflow-hidden mt-1">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${adelanto >= totalPactadoOriginal ? 'bg-emerald-400' : 'bg-[#c9a961]'}`}
                      style={{ width: `${Math.min(100, (adelanto / totalPactadoOriginal) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-[#8a8377] pt-0.5">
                    <span>Estado: {adelanto >= totalPactadoOriginal ? 'PAGADO TO.' : (adelanto > 0 ? 'CON ABONOS' : 'PENDIENTE')}</span>
                    <span>{Math.min(100, Math.round((adelanto / totalPactadoOriginal) * 100))}% Recibido</span>
                  </div>
                </div>
              )}
            </div>

            {/* Notas */}
            <div>
              <label className="block text-[#a39d8e] font-semibold mb-1 uppercase tracking-wider font-mono text-[10px]">Notas de Transacción</label>
              <input 
                type="text"
                placeholder="Ej: Cobro de kick-off inicial"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="w-full bg-[#0f0e0c]/50 text-[#e8e3d8] border border-[#2a2620] p-2.5 rounded focus:outline-none"
              />
            </div>

            {/* LIVE PREVIEW BAR */}
            <div className="bg-white/[0.01] border border-[#2a2620] p-3 rounded-lg leading-relaxed space-y-1">
              <span className="text-[9px] font-mono tracking-wider uppercase text-[#8a8377] block text-center border-b border-[#2a2620]/40 pb-1.5">
                Cómputo en Tiempo Real
              </span>
              <div className="flex flex-col gap-1 text-center font-mono text-[11px] pt-1 text-[#e8e3d8]">
                <div>
                  <span className="text-[#a39d8e]">Total Pactado:</span>{' '}
                  <span className="font-bold">{moneda === 'USD' ? formatUsd(totalPactadoOriginal) : formatCop(totalPactadoOriginal)}</span>
                </div>
                <div>
                  <span className="text-[#a39d8e]">Retención ({Math.round(rateRentencion * 100)}%):</span>{' '}
                  <span className="text-[#c97a61] font-bold">
                    -{moneda === 'USD' ? formatUsd(retencionOriginalMoneda) : formatCop(retencionOriginalMoneda)}
                  </span>
                </div>
                <div className="border-t border-[#2a2620]/50 pt-1 text-[#a8c98a]">
                  <span className="text-[#a39d8e]">Neto al Banco (Estimado):</span>{' '}
                  <span className="font-bold font-semibold">
                    {moneda === 'USD' ? formatUsd(netoQueEntra) : formatCop(netoQueEntra)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button 
                type="submit"
                disabled={clientes.length === 0}
                className="w-full bg-[#c9a961] hover:bg-[#b09252] disabled:bg-[#2a2620] disabled:text-[#8a8377] text-black font-semibold font-display tracking-wide py-3 rounded transition cursor-pointer"
              >
                {editingVentaId ? 'Guardar Cambios Venta' : 'Registrar Venta'}
              </button>
              {editingVentaId && (
                <button 
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-full bg-transparent border border-[#2a2620] hover:bg-white/[0.02] text-[#a39d8e] hover:text-white font-semibold font-display py-2.5 rounded transition cursor-pointer text-xs"
                >
                  Cancelar Edición
                </button>
              )}
            </div>
          </div>
        </form>

        {/* List Ledger */}
        <div className="lg:col-span-8 bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-white/[0.02] border-b border-[#2a2620] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold">
                Historial de Operaciones
              </h3>

              {/* Dynamic search bar */}
              <div className="relative text-xs">
                <input 
                  type="text"
                  placeholder="Buscar por cliente o servicio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-[#0f0e0c]/50 text-[#e8e3d8] border border-[#2a2620] max-w-sm pl-8 pr-4 py-1.5 rounded focus:outline-none focus:border-[#c9a961] font-sans"
                />
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#8a8377]" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#1c1916] text-[#a39d8e] uppercase tracking-wider font-semibold font-mono border-b border-[#2a2620]">
                  <tr>
                    <th className="px-5 py-3.5">Fecha</th>
                    <th className="px-5 py-3.5">Cliente</th>
                    <th className="px-5 py-3.5">Servicio</th>
                    <th className="px-5 py-3.5">Total Tarifa</th>
                    <th className="px-5 py-3.5 text-orange-400">Rete</th>
                    <th className="px-5 py-3.5 text-emerald-400">Neto Entra</th>
                    <th className="px-5 py-3.5">Adelanto</th>
                    <th className="px-5 py-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2620]/50">
                  {filteredVentas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-[#8a8377] font-mono">
                        No se encontraron registros de ventas en la base de datos de Sheets.
                      </td>
                    </tr>
                  ) : (
                    filteredVentas.map((v, idx) => {
                      const totalOriginal = v.precio_venta_unitario * v.cantidad;
                      const reteOrig = calculateLoopRetention(v);
                      const netOrig = totalOriginal - reteOrig;

                      const isEditing = editingVentaId === v.id;
                      const actualEstado = v.estado_pago || (v.adelanto >= totalOriginal ? 'Pagado' : (v.adelanto > 0 ? 'Adelanto' : 'Pendiente'));

                      return (
                        <tr key={`${v.id}-${idx}`} className={`hover:bg-white/[0.01]/70 transition ${isEditing ? 'bg-[#c9a961]/5 border-l-2 border-[#c9a961]' : ''}`}>
                          <td className="px-5 py-4 font-mono text-[#a39d8e]">{v.fecha}</td>
                          <td className="px-5 py-4">
                            <span className="font-medium text-[#e8e3d8] block">{v.cliente_nombre}</span>
                            <span className="text-[9px] font-mono uppercase text-[#8a8377]">
                              {v.tipo}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-[#e8e3d8]">
                             <span>{v.servicio_nombre}</span>
                            {v.cantidad > 1 && (
                              <span className="text-[10px] font-mono text-[#8a8377] block mt-0.5">({v.cantidad} x {v.moneda === 'USD' ? formatUsd(v.precio_venta_unitario) : formatCop(v.precio_venta_unitario)})</span>
                            )}
                          </td>
                          <td className="px-5 py-4 font-mono font-semibold">
                            {v.moneda === 'USD' ? formatUsd(totalOriginal) : formatCop(totalOriginal)}
                          </td>
                          <td className="px-5 py-4 font-mono text-[#c97a61]">
                            {reteOrig > 0 
                              ? `-${v.moneda === 'USD' ? formatUsd(reteOrig) : formatCop(reteOrig)}` 
                              : <span className="text-[#8a8377] italic">No ret.</span>}
                          </td>
                          <td className="px-5 py-4 font-mono font-bold text-[#a8c98a]">
                            {v.moneda === 'USD' ? formatUsd(netOrig) : formatCop(netOrig)}
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-mono text-[#e8e3d8]">
                              {v.adelanto > 0 ? (
                                v.moneda === 'USD' ? formatUsd(v.adelanto) : formatCop(v.adelanto)
                              ) : (
                                <span className="text-[#8a8377] italic">Sin abonos</span>
                              )}
                            </div>
                            <div className="mt-1">
                              {actualEstado === 'Pagado' ? (
                                <span className="inline-block text-[9px] px-1.5 py-0.5 rounded-full font-mono text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 font-semibold">
                                  Pagado
                                </span>
                              ) : actualEstado === 'Adelanto' ? (
                                <span className="inline-block text-[9px] px-1.5 py-0.5 rounded-full font-mono text-amber-400 bg-amber-500/15 border border-amber-500/30 font-semibold">
                                  Abono/Adelanto
                                </span>
                              ) : (
                                <span className="inline-block text-[9px] px-1.5 py-0.5 rounded-full font-mono text-red-400 bg-red-500/15 border border-red-500/30 font-semibold">
                                  Pendiente
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2 text-right">
                              <button 
                                onClick={() => handleStartEdit(v)}
                                className="bg-[#0f0e0c]/40 text-[#c9a961] hover:text-[#e8e3d8] p-1.5 transition rounded-lg hover:bg-[#c9a961]/10 cursor-pointer"
                                title="Editar venta / Registrar abonos"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {confirmDeleteId === v.id ? (
                                <div className="flex items-center justify-end gap-1 bg-[#1a1110] border border-[#c97a61]/30 p-1 rounded max-w-[70px] ml-auto">
                                  <button 
                                    onClick={() => handleDelete(v.id)}
                                    title="Confirmar"
                                    className="text-[#a8c98a] hover:text-[#bde89b] font-bold text-xs px-1 cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => setConfirmDeleteId(null)}
                                    title="Cancelar"
                                    className="text-[#c97a61] hover:text-[#e08970] font-bold text-xs px-1 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => setConfirmDeleteId(v.id)}
                                  className="text-[#c97a61] hover:text-[#e08970] p-1.5 transition rounded-lg hover:bg-[#c97a61]/10 bg-[#0f0e0c]/40 cursor-pointer"
                                  title="Borrar entrada"
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

    </div>
  );
}
