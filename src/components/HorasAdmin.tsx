import React, { useState, useEffect } from 'react';
import { Hora, Cliente, Servicio, Config, AppData } from '../types';
import { FinancialMetrics, calcularProductividadClientes, calcularProductividadServicios } from '../lib/calculations';
import { Clock, Plus, Trash2, Shield, Settings, Sliders, Check, X } from 'lucide-react';

interface HorasAdminProps {
  horas: Hora[];
  clientes: Cliente[];
  servicios: Servicio[];
  ventas: any[];
  config: Config;
  metrics: FinancialMetrics;
  selectedMonth: string;
  onSaveHoras: (updated: Hora[]) => Promise<void>;
  onSaveConfig: (updated: Partial<Config>) => Promise<void>;
  formatCop: (val: number) => string;
}

export default function HorasAdmin({
  horas,
  clientes,
  servicios,
  ventas,
  config,
  metrics,
  selectedMonth,
  onSaveHoras,
  onSaveConfig,
  formatCop
}: HorasAdminProps) {
  // Config state
  const [horasObjetivoMes, setHorasObjetivoMes] = useState(config.horas_objetivo_mes || 160);
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

  // Form states
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [clienteId, setClienteId] = useState('');
  const [servicioId, setServicioId] = useState('');
  const [horasDedicadas, setHorasDedicadas] = useState(1);
  const [descripcion, setDescripcion] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (clientes.length > 0 && !clienteId) {
      const defaultClient = clientes.find(c => c.activo) || clientes[0];
      setClienteId(defaultClient.id);
    }
  }, [clientes]);

  useEffect(() => {
    if (servicios.length > 0 && !servicioId) {
      setServicioId(servicios[0].id);
    }
  }, [servicios]);

  // 1. Calculations
  const currentHoras = selectedMonth === 'Todos' 
    ? horas 
    : horas.filter(h => h.fecha && h.fecha.startsWith(selectedMonth));

  // Filtered hours total
  const totalHorasLoggeadas = currentHoras.reduce((sum, h) => sum + h.horas, 0);

  // Metrics calculating
  const horaCobradaObj = totalHorasLoggeadas > 0 ? metrics.totalVentas / totalHorasLoggeadas : 0;
  const horaRealObj = totalHorasLoggeadas > 0 ? metrics.utilidadNeta / totalHorasLoggeadas : 0;
  const horaObjetivoMinima = config.salario_propuesto / (horasObjetivoMes || 160);

  // Render alerts / comparative colors
  const isHoraRealOptimal = horaRealObj >= horaObjetivoMinima;

  // Save Config handler
  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingConfig(true);
    try {
      await onSaveConfig({ horas_objetivo_mes: Number(horasObjetivoMes) });
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  // Add Hours handler
  const handleAddHora = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId || !servicioId) return;

    const chosenClient = clientes.find(c => c.id === clienteId);
    const chosenService = servicios.find(s => s.id === servicioId);

    const newH: Hora = {
      id: `ho_${Date.now().toString().slice(-6)}`,
      fecha,
      cliente_id: clienteId,
      cliente_nombre: chosenClient?.nombre || 'Cliente',
      servicio_id: servicioId,
      servicio_nombre: chosenService?.nombre || 'Servicio',
      horas: Number(horasDedicadas),
      descripcion
    };

    const updated = [newH, ...horas];
    await onSaveHoras(updated);

    // Reset simple values
    setHorasDedicadas(1);
    setDescripcion('');
  };

  const handleDeleteHora = async (id: string) => {
    const updated = horas.filter(h => h.id !== id);
    await onSaveHoras(updated);
    setConfirmDeleteId(null);
  };

  // 2. Rentabilidad por cliente
  const appFakeData: AppData = { 
    config, 
    ventas, 
    horas, 
    clientes, 
    servicios,
    herramientas: [],
    otrosGastos: [],
    respaldos: [],
    pagosEgresos: []
  };
  const clientProductivity = calcularProductividadClientes(appFakeData, selectedMonth, horaObjetivoMinima);

  // 3. Promedio de horas por servicio
  const serviceProductivity = calcularProductividadServicios(appFakeData, selectedMonth);

  // Last 30 hours entries
  const last30Horas = currentHoras.slice(0, 30);

  return (
    <div className="space-y-8 animate-fade-in text-[#e8e3d8]">
      
      {/* Visual Header */}
      <div className="border-b border-[#2a2620] pb-5">
        <h2 className="text-xl font-display font-medium text-[#c9a961]">Control de Horas de Trabajo</h2>
        <p className="text-xs text-[#a39d8e] font-mono mt-1">Bitácora de esfuerzo y valor del tiempo del consultor</p>
      </div>

      {/* A. Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <div className="bg-[#161412] border border-[#2a2620] border-l-3 border-l-[#a39d8e] p-5 rounded-lg">
          <span className="text-[10px] font-mono tracking-wider text-[#8a8377] uppercase block">Horas Logs del Periodo</span>
          <div className="text-2xl font-display font-semibold text-[#e8e3d8] mt-2">{totalHorasLoggeadas} hs</div>
          <span className="text-[10px] text-[#8a8377] font-mono block mt-1">Total acumulado registrado</span>
        </div>

        <div className="bg-[#161412] border border-[#2a2620] border-l-3 border-l-[#c9a961] p-5 rounded-lg">
          <span className="text-[10px] font-mono tracking-wider text-[#8a8377] uppercase block">Hora Cobrada Promedio</span>
          <div className="text-2xl font-display font-semibold text-[#c9a961] mt-2">{formatCop(horaCobradaObj)}</div>
          <span className="text-[10px] text-[#8a8377] font-mono block mt-1">Tarifa facturada promediada</span>
        </div>

        <div className={`border border-[#2a2620] border-l-3 p-5 rounded-lg ${isHoraRealOptimal ? 'border-l-[#a8c98a] bg-[#141812]' : 'border-l-[#c97a61] bg-[#181312]'}`}>
          <span className="text-[10px] font-mono tracking-wider text-[#8a8377] uppercase block">Valor Hora Real</span>
          <div className="text-2xl font-display font-semibold mt-2" style={{ color: isHoraRealOptimal ? '#a8c98a' : '#c97a61' }}>
            {formatCop(horaRealObj)}
          </div>
          <span className="text-[10px] text-[#8a8377] font-mono block mt-1">
            {isHoraRealOptimal ? 'Por encima de la meta' : 'Menor al valor rentable'}
          </span>
        </div>

        <div className="bg-[#161412] border border-[#2a2620] border-l-3 border-l-[#c9a961] p-5 rounded-lg">
          <span className="text-[10px] font-mono tracking-wider text-[#8a8377] uppercase block">Hora Mínima Objetivo</span>
          <div className="text-2xl font-display font-semibold text-[#e8e3d8] mt-2">{formatCop(horaObjetivoMinima)}</div>
          <span className="text-[10px] text-[#8a8377] font-mono block mt-1">Cálculo de cobertura básica</span>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left column: Reg Form & Configuration */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* B. Configuración del Mes */}
          <div className="bg-[#161412] border border-[#2a2620] p-5 rounded-lg space-y-4">
            <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase flex items-center gap-1.5 font-semibold">
              <Settings className="w-3.5 h-3.5 text-[#c9a961]" /> Parámetro Mensual
            </h3>
            
            <form onSubmit={handleConfigSubmit} className="space-y-3">
              <div>
                <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Horas Facturables Objetivo</label>
                <div className="flex gap-2">
                  <input 
                    type="number"
                    min="1"
                    value={horasObjetivoMes}
                    onChange={(e) => setHorasObjetivoMes(Number(e.target.value))}
                    className="bg-[#0f0e0c]/60 text-white font-mono text-xs border border-[#2a2620] px-3 py-2 rounded focus:outline-none w-full"
                  />
                  <button 
                    type="submit"
                    className="bg-[#c9a961] hover:bg-[#b09252] text-black text-xs font-semibold font-display px-3 py-2 rounded transition cursor-pointer"
                  >
                    {isUpdatingConfig ? '...' : 'Fijar'}
                  </button>
                </div>
                <p className="text-[10px] text-[#8a8377] mt-1.5">Usado para calcular el costo de tu hora objetivo.</p>
              </div>
            </form>
          </div>

          {/* C. Formulario registro */}
          <div className="bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden pb-6">
            <div className="bg-white/[0.02] border-b border-[#2a2620] px-5 py-3.5">
              <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold">
                Registrar Bitácora
              </h3>
            </div>

            <form onSubmit={handleAddHora} className="p-5 space-y-4 text-xs font-sans">
              
              {/* Alert guidance box */}
              <div className="bg-[#c9a961]/5 border border-[#c9a961]/20 p-3 rounded text-[11px] text-[#e8e3d8] leading-relaxed">
                <span className="text-[#c9a961] font-bold block mb-1">⏱️ Control de Tiempos</span>
                Esta sección es exclusiva para registrar las horas de trabajo. Si deseas facturar servicios o registrar abonos/adelantos de clientes, utiliza la pestaña <strong className="text-[#c9a961]">2. Ingresos (Ventas y Abonos)</strong>.
              </div>
              
              <div>
                <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Fecha</label>
                <input 
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2 rounded font-mono focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Cliente</label>
                <select 
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2 rounded focus:outline-none"
                  required
                >
                  <option value="" disabled>Selecciona cliente...</option>
                  {clientes.map((c, idx) => (
                    <option key={`${c.id || 'cli'}-${idx}`} value={c.id} className="bg-[#0f0e0c]">
                      {c.nombre} {!c.activo ? ' - [Inactivo]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Servicio</label>
                <select 
                  value={servicioId}
                  onChange={(e) => setServicioId(e.target.value)}
                  className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2 rounded focus:outline-none"
                  required
                >
                  <option value="" disabled>Selecciona servicio...</option>
                  {servicios.map((s, idx) => (
                    <option key={`${s.id || 'srv'}-${idx}`} value={s.id} className="bg-[#0f0e0c]">{s.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Horas Dedicadas (Pasos de 0.25)</label>
                <input 
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={horasDedicadas}
                  onChange={(e) => setHorasDedicadas(Number(e.target.value))}
                  className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2 rounded font-mono focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Hito / Descripción</label>
                <textarea 
                  rows={2}
                  placeholder="Ej: Maquetación de layouts con Tailwind"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2 rounded focus:outline-none"
                  required
                />
              </div>

              <button 
                type="submit"
                disabled={clientes.length === 0}
                className="w-full bg-[#c9a961] hover:bg-[#b09252] disabled:bg-[#2a2620] disabled:text-[#8a8377] text-black font-semibold font-display py-2.5 rounded transition cursor-pointer"
              >
                Loguear Horas
              </button>

            </form>
          </div>

        </div>

        {/* Right columns: Statistics & Tables */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* D. Tabla rentabilidad por cliente */}
          <div className="bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden">
            <div className="bg-white/[0.02] border-b border-[#2a2620] px-5 py-3.5">
              <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold">
                Rentabilidad Relativa por Cliente
              </h3>
            </div>
            <div className="overflow-x-auto text-xs font-sans">
              <table className="w-full text-left">
                <thead className="bg-[#1c1916] text-[#a39d8e] font-mono uppercase text-[10px] border-b border-[#2a2620]">
                  <tr>
                    <th className="px-5 py-3">Cliente</th>
                    <th className="px-5 py-3">Horas Logs</th>
                    <th className="px-5 py-3">Pautado (COP)</th>
                    <th className="px-5 py-3">Hora Cobrada</th>
                    <th className="px-5 py-3 text-right">Estatus Rentabilidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2620]/40">
                  {clientProductivity.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-[#8a8377] font-mono">Sin registros</td>
                    </tr>
                  ) : (
                    clientProductivity.map((item, idx) => {
                      const computedHourly = item.horasRegistradas > 0 ? item.ingresosCop / item.horasRegistradas : 0;
                      
                      let badge = { text: 'EQUILIBRIO', style: 'text-[#c9a961] bg-[#c9a961]/10 border border-[#c9a961]/25' };
                      if (computedHourly >= horaObjetivoMinima) {
                        badge = { text: 'GANANCIA', style: 'text-[#a8c98a] bg-[#a8c98a]/10 border border-[#a8c98a]/25' };
                      } else if (computedHourly < (horaObjetivoMinima * 0.75)) {
                        badge = { text: 'PÉRDIDA', style: 'text-[#c97a61] bg-[#c97a61]/10 border border-[#c97a61]/25' };
                      }

                      return (
                        <tr key={`${item.clienteId || 'cli'}-${idx}`} className="hover:bg-white/[0.01]/70 transition">
                          <td className="px-5 py-3.5 font-medium text-[#e8e3d8]">{item.clienteNombre}</td>
                          <td className="px-5 py-3.5 font-mono text-[#a39d8e]">{item.horasRegistradas.toFixed(1)} hs</td>
                          <td className="px-5 py-3.5 font-mono">{formatCop(item.ingresosCop)}</td>
                          <td className="px-5 py-3.5 font-mono text-[#c9a961] font-semibold">{formatCop(computedHourly)}</td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${badge.style}`}>
                              {badge.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* E. Tabla promedio de horas por servicio */}
          <div className="bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden">
            <div className="bg-white/[0.02] border-b border-[#2a2620] px-5 py-3.5">
              <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold">
                Promedio de Horas por Línea de Servicio
              </h3>
            </div>
            <div className="overflow-x-auto text-xs font-sans">
              <table className="w-full text-left">
                <thead className="bg-[#1c1916] text-[#a39d8e] font-mono uppercase text-[10px] border-b border-[#2a2620]">
                  <tr>
                    <th className="px-5 py-3">Línea Servicio</th>
                    <th className="px-5 py-3 font-mono">Horas Totales Dedicated</th>
                    <th className="px-5 py-3">Uds Vendidas</th>
                    <th className="px-5 py-3 font-mono">Horas / Unidad</th>
                    <th className="px-5 py-3 text-right">Tarifa Hora Cobrada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2620]/40">
                  {serviceProductivity.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-[#8a8377] font-mono">Sin registros</td>
                    </tr>
                  ) : (
                    serviceProductivity.map((item, idx) => {
                      const hourly = item.horasRegistradas > 0 ? item.ingresosCop / item.horasRegistradas : 0;
                      return (
                        <tr key={`${item.servicioId || 'srv'}-${idx}`} className="hover:bg-white/[0.01]/70 transition">
                          <td className="px-5 py-3.5 font-medium text-[#e8e3d8]">{item.servicioNombre}</td>
                          <td className="px-5 py-3.5 font-mono text-[#a39d8e]">{item.horasRegistradas.toFixed(1)} hs</td>
                          <td className="px-5 py-3.5 font-mono">{item.unidadesVendidas} uds</td>
                          <td className="px-5 py-3.5 font-mono font-medium text-[#c9a961]">
                            {item.promedioHorasPorUnidad.toFixed(1)} hs/ud
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono font-semibold text-[#a8c98a]">
                            {formatCop(hourly)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* F. Historial de bitácora */}
          <div className="bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden">
            <div className="bg-white/[0.02] border-b border-[#2a2620] px-5 py-3.5">
              <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold">
                Línea de Tiempo de Bitácora (Últimos 30 Registros)
              </h3>
            </div>
            <div className="overflow-x-auto text-xs font-sans">
              <table className="w-full text-left">
                <thead className="bg-[#1c1916] text-[#a39d8e] font-mono uppercase text-[10px] border-b border-[#2a2620]">
                  <tr>
                    <th className="px-5 py-3">Fecha</th>
                    <th className="px-5 py-3">Cliente</th>
                    <th className="px-5 py-3 font-mono">Horas</th>
                    <th className="px-5 py-3">Descripción de Actividad</th>
                    <th className="px-5 py-3 text-right">Eliminar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2620]/40">
                  {last30Horas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-[#8a8377] font-mono">Aún no hay registros de horas en este periodo</td>
                    </tr>
                  ) : (
                    last30Horas.map((h, idx) => (
                      <tr key={`${h.id || 'hr'}-${idx}`} className="hover:bg-white/[0.01]/70 transition">
                        <td className="px-5 py-3 font-mono text-[#a39d8e]">{h.fecha}</td>
                        <td className="px-5 py-3 font-medium text-[#e8e3d8]">
                          {h.cliente_nombre}
                          <span className="text-[10px] font-mono text-[#8a8377] block mt-0.5">{h.servicio_nombre}</span>
                        </td>
                        <td className="px-5 py-3 font-mono text-[#c9a961] font-semibold">{h.horas.toFixed(2)} hs</td>
                        <td className="px-5 py-3 text-[#a39d8e] max-w-xs truncate">{h.descripcion}</td>
                        <td className="px-5 py-3 text-right">
                          {confirmDeleteId === h.id ? (
                            <div className="flex items-center justify-end gap-1 bg-[#1a1110] border border-[#c97a61]/30 p-1 rounded max-w-[70px] ml-auto">
                              <button 
                                onClick={() => handleDeleteHora(h.id)}
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
                              onClick={() => setConfirmDeleteId(h.id)}
                              className="bg-[#0f0e0c]/40 text-[#c97a61] hover:text-[#e08970] p-1.5 transition rounded-lg hover:bg-[#c97a61]/10 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
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
