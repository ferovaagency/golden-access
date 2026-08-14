import React, { useState, useEffect } from 'react';
import { Hora, Cliente, Servicio, Config, AppData } from '../types';
import { FinancialMetrics, calcularProductividadClientes, calcularProductividadServicios } from '../lib/calculations';
import { calculateHourlyCost, calculateCapacity } from '../lib/engine/financialEngine';
import { type Period, inPeriod } from '../lib/period';
import { plannerService } from '../lib/plannerService';
import { Settings, HelpCircle } from 'lucide-react';
import { InlineDeleteConfirm } from './ui/InlineDeleteConfirm';
import { describeDuration, formatHours } from '../lib/duration';

interface HorasAdminProps {
  horas: Hora[];
  clientes: Cliente[];
  servicios: Servicio[];
  ventas: any[];
  config: Config;
  metrics: FinancialMetrics;
  period: Period;
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
  period,
  onSaveHoras,
  onSaveConfig,
  formatCop
}: HorasAdminProps) {
  // Config state
  const [horasObjetivoMes, setHorasObjetivoMes] = useState(config.horas_objetivo_mes || 160);
  const [umbralPerdidaPct, setUmbralPerdidaPct] = useState(Math.round((config.umbral_perdida_horas ?? 0.75) * 100));
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

  // Form states
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [clienteId, setClienteId] = useState('');
  const [servicioId, setServicioId] = useState('');
  const [horasDedicadas, setHorasDedicadas] = useState(1);
  const [duracionUnidad, setDuracionUnidad] = useState<'horas' | 'minutos'>('horas');
  const [descripcion, setDescripcion] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [capacidadComprometidaHoras, setCapacidadComprometidaHoras] = useState(0);

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

  useEffect(() => {
    let active = true;
    void plannerService.listTasks().then((tasks) => {
      if (!active) return;
      const committed = tasks
        .filter((task) => ['backlog', 'scheduled', 'in_progress', 'postponed'].includes(task.status))
        .filter((task) => {
          const periodDate = task.scheduled_for || task.deadline;
          return Boolean(periodDate && inPeriod(periodDate, period));
        })
        .reduce((total, task) => total + Math.max(0, (task.estimated_minutes - (task.actual_minutes || 0)) / 60), 0);
      setCapacidadComprometidaHoras(committed);
    }).catch(() => { if (active) setCapacidadComprometidaHoras(0); });
    return () => { active = false; };
  }, [period]);

  // 1. Calculations
  const currentHoras = horas.filter(h => inPeriod(h.fecha, period));

  // Filtered hours total
  const totalHorasLoggeadas = currentHoras.reduce((sum, h) => sum + h.horas, 0);

  // Metrics calculating
  const horaCobradaObj = totalHorasLoggeadas > 0 ? metrics.totalVentas / totalHorasLoggeadas : 0;
  const horaRealObj = totalHorasLoggeadas > 0 ? metrics.utilidadNeta / totalHorasLoggeadas : 0;
  // Motor centralizado (Fase 2/3 del manual, Parte 4.5) -- antes calculado
  // inline, sin el mismo tratamiento explicable que pricingIdeal.ts.
  const horaObjetivoMinima = calculateHourlyCost({ costoMensualPersona: config.salario_propuesto, horasProductivasMensuales: horasObjetivoMes || 160 }) ?? 0;
  const umbralPerdida = umbralPerdidaPct / 100;

  // Fase 5 del manual (Parte 4.6) -- capacidad y utilización del mes.
  // capacidadComprometidaHoras queda en 0: hoy no hay una fuente confiable de
  // "horas pendientes de proyectos activos" conectada a esta pantalla (eso
  // vive en Proyectos/Planner, no en la bitácora de horas) -- se muestra
  // explícito como limitación, no se inventa un número.
  const capacidad = calculateCapacity({
    capacidadMensualHoras: horasObjetivoMes || 160,
    pctFacturableReal: 1,
    capacidadComprometidaHoras,
    horasFacturablesTrabajadas: totalHorasLoggeadas,
  });
  // Colores via variables del tema (los estilos inline no pasan por el remap
  // CSS de .ferova-light-theme, así que se referencia la paleta unificada).
  const LECTURA_CAPACIDAD: Record<string, { label: string; color: string }> = {
    ociosa: { label: 'Capacidad ociosa', color: 'var(--muted)' },
    operativo: { label: 'Rango operativo razonable', color: 'var(--success)' },
    saturacion: { label: 'Riesgo de saturación', color: 'var(--warning)' },
    alto_riesgo: { label: 'Alto riesgo de agotamiento', color: 'var(--danger)' },
  };

  // Render alerts / comparative colors
  const isHoraRealOptimal = horaRealObj >= horaObjetivoMinima;

  // Save Config handler
  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingConfig(true);
    try {
      await onSaveConfig({ horas_objetivo_mes: Number(horasObjetivoMes), umbral_perdida_horas: Math.min(Math.max(Number(umbralPerdidaPct) / 100, 0.01), 0.99) });
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
      // La persistencia mantiene horas decimales, pero la persona puede pensar
      // y registrar en minutos sin hacer conversiones mentales.
      horas: duracionUnidad === 'minutos' ? Number(horasDedicadas) / 60 : Number(horasDedicadas),
      descripcion
    };

    const updated = [newH, ...horas];
    await onSaveHoras(updated);

    // Reset simple values
    setHorasDedicadas(duracionUnidad === 'minutos' ? 60 : 1);
    setDescripcion('');
  };

  const handleDeleteHora = async (id: string) => {
    const updated = horas.filter(h => h.id !== id);
    await onSaveHoras(updated);
    setConfirmDeleteId(null);
  };

  // --- Editar un registro de la bitácora ------------------------------------
  //
  // Se edita EN LA FILA y no subiendo al formulario de arriba: en una línea de
  // tiempo lo normal es corregir el renglón que se está mirando (una hora mal
  // puesta, una descripción a medias), y mandar a la persona al formulario de
  // alta se confunde con crear un registro nuevo.
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<{ fecha: string; clienteId: string; servicioId: string; horas: number; descripcion: string } | null>(null);

  const empezarEdicion = (h: Hora) => {
    setConfirmDeleteId(null);
    setEditandoId(h.id);
    setEdicion({
      fecha: h.fecha,
      clienteId: h.cliente_id || '',
      servicioId: h.servicio_id || '',
      horas: h.horas,
      descripcion: h.descripcion || '',
    });
  };

  const cancelarEdicion = () => { setEditandoId(null); setEdicion(null); };

  const guardarEdicion = async () => {
    if (!editandoId || !edicion) return;
    if (!(edicion.horas > 0)) return;
    const cliente = clientes.find((c) => c.id === edicion.clienteId);
    const servicio = servicios.find((s) => s.id === edicion.servicioId);
    const updated = horas.map((h) => h.id === editandoId ? {
      ...h,
      fecha: edicion.fecha,
      cliente_id: edicion.clienteId,
      // El nombre se recalcula del catálogo: guardar el que estaba dejaría la
      // fila mostrando un cliente y apuntando a otro.
      cliente_nombre: cliente?.nombre || h.cliente_nombre,
      servicio_id: edicion.servicioId,
      servicio_nombre: servicio?.nombre || h.servicio_nombre,
      horas: Number(edicion.horas),
      descripcion: edicion.descripcion,
    } : h);
    await onSaveHoras(updated);
    cancelarEdicion();
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
  const clientProductivity = calcularProductividadClientes(appFakeData, period, horaObjetivoMinima);

  // 3. Promedio de horas por servicio
  const serviceProductivity = calcularProductividadServicios(appFakeData, period);

  // Last 30 hours entries
  const last30Horas = currentHoras.slice(0, 30);

  return (
    <div className="space-y-8 animate-fade-in text-slate-900">
      
      {/* Visual Header */}
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-xl font-display font-medium text-blue-700">Control de Horas de Trabajo</h2>
        <p className="text-xs text-slate-500 font-mono mt-1">Bitácora de esfuerzo y valor del tiempo del consultor</p>
      </div>

      {/* A. Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <div className="bg-white border border-slate-200 border-l-3 border-l-slate-300 p-5 rounded-lg">
          <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase block">Horas Logs del Periodo</span>
          <div className="text-2xl font-display font-semibold text-slate-900 mt-2">{totalHorasLoggeadas} hs</div>
          <span className="text-[10px] text-slate-500 font-mono block mt-1">Total acumulado registrado</span>
        </div>

        <div className="bg-white border border-slate-200 border-l-3 border-l-blue-500 p-5 rounded-lg">
          <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase block">Hora Cobrada Promedio</span>
          <div className="text-2xl font-display font-semibold text-blue-700 mt-2">{formatCop(horaCobradaObj)}</div>
          <span className="text-[10px] text-slate-500 font-mono block mt-1">Tarifa facturada promediada</span>
        </div>

        <div className={`border border-slate-200 border-l-3 p-5 rounded-lg ${isHoraRealOptimal ? 'border-l-emerald-500 bg-white' : 'border-l-rose-500 bg-white'}`}>
          <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase block">Valor Hora Real</span>
          <div className="text-2xl font-display font-semibold mt-2" style={{ color: isHoraRealOptimal ? 'var(--success)' : 'var(--danger)' }}>
            {formatCop(horaRealObj)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono block mt-1">
            {isHoraRealOptimal ? 'Por encima de la meta' : 'Menor al valor rentable'}
          </span>
        </div>

        <div className="bg-white border border-slate-200 border-l-3 border-l-blue-500 p-5 rounded-lg group relative">
          <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase flex items-center gap-1">
            Hora Mínima Objetivo <HelpCircle className="w-3 h-3 text-slate-500" />
          </span>
          <div className="text-2xl font-display font-semibold text-slate-900 mt-2">{formatCop(horaObjetivoMinima)}</div>
          <span className="text-[10px] text-slate-500 font-mono block mt-1">Sueldo deseado ÷ horas objetivo/mes</span>
          <div className="hidden group-hover:block absolute z-10 top-full left-0 mt-1 w-64 bg-slate-50 border border-slate-200 rounded-lg p-3 text-[10px] text-slate-500 leading-relaxed shadow-xl">
            {formatCop(config.salario_propuesto)} sueldo deseado ÷ {horasObjetivoMes || 160}h objetivo/mes = {formatCop(horaObjetivoMinima)}/hora. Es lo mínimo que necesitas cobrar por hora para cubrir tu sueldo objetivo, sin contar gastos del negocio ni reserva de impuestos.
          </div>
        </div>

      </div>

      {/* Fase 5 del manual: Capacidad y utilización del mes */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase font-semibold">Capacidad y Utilización del Mes</h3>
            <p className="text-[10px] text-slate-500 mt-1">Horas registradas y horas pendientes del Planner con fecha o entrega en este período.</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-500 uppercase block">Comprometidas</span>
              <span className="text-lg font-display font-semibold text-blue-700">{capacidadComprometidaHoras.toFixed(0)} hs</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-500 uppercase block">Disponibilidad</span>
              <span className="text-lg font-display font-semibold text-slate-900">{Math.max(0, capacidad.disponibilidad).toFixed(0)} hs</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-500 uppercase block">Utilización</span>
              <span className="text-lg font-display font-semibold" style={{ color: LECTURA_CAPACIDAD[capacidad.lectura || 'operativo'].color }}>
                {capacidad.utilizacion != null ? `${(capacidad.utilizacion * 100).toFixed(0)}%` : '—'}
              </span>
              <span className="text-[9px] font-mono block" style={{ color: LECTURA_CAPACIDAD[capacidad.lectura || 'operativo'].color }}>
                {capacidad.lectura ? LECTURA_CAPACIDAD[capacidad.lectura].label : 'Sin datos'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left column: Reg Form & Configuration */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* B. Configuración del Mes */}
          <div className="bg-white border border-slate-200 p-5 rounded-lg space-y-4">
            <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase flex items-center gap-1.5 font-semibold">
              <Settings className="w-3.5 h-3.5 text-blue-700" /> Parámetro Mensual
            </h3>
            
            <form onSubmit={handleConfigSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Horas Facturables Objetivo</label>
                <div className="flex gap-2">
                  <input 
                    type="number"
                    min="1"
                    value={horasObjetivoMes}
                    onChange={(e) => setHorasObjetivoMes(Number(e.target.value))}
                    className="bg-white text-slate-900 font-mono text-xs border border-slate-200 px-3 py-2 rounded focus:outline-none w-full"
                  />
                  <button 
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold font-display px-3 py-2 rounded transition cursor-pointer"
                  >
                    {isUpdatingConfig ? '...' : 'Fijar'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">Usado para calcular el costo de tu hora objetivo.</p>
              </div>
              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Umbral de "Pérdida" (% de la hora mínima)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={umbralPerdidaPct}
                    onChange={(e) => setUmbralPerdidaPct(Number(e.target.value))}
                    className="bg-white text-slate-900 font-mono text-xs border border-slate-200 px-3 py-2 rounded focus:outline-none w-full"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold font-display px-3 py-2 rounded transition cursor-pointer"
                  >
                    {isUpdatingConfig ? '...' : 'Fijar'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">Un cliente se marca "PÉRDIDA" cuando su hora cobrada cae debajo de este % de la hora mínima objetivo. Default 75%.</p>
              </div>
            </form>
          </div>

          {/* C. Formulario registro */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden pb-6">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5">
              <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase font-semibold">
                Registrar Bitácora
              </h3>
            </div>

            <form onSubmit={handleAddHora} className="p-5 space-y-4 text-xs font-sans">
              
              {/* Alert guidance box */}
              <div className="bg-blue-50 border border-blue-300 p-3 rounded text-[11px] text-slate-900 leading-relaxed">
                <span className="text-blue-700 font-bold block mb-1">⏱️ Control de Tiempos</span>
                Esta sección es exclusiva para registrar las horas de trabajo. Si deseas facturar servicios o registrar abonos/adelantos de clientes, utiliza la pestaña <strong className="text-blue-700">2. Ingresos (Ventas y Abonos)</strong>.
              </div>
              
              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Fecha</label>
                <input 
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full bg-white text-slate-900 border border-slate-200 p-2 rounded font-mono focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Cliente</label>
                <select 
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  className="w-full bg-white text-slate-900 border border-slate-200 p-2 rounded focus:outline-none"
                  required
                >
                  <option value="" disabled>Selecciona cliente...</option>
                  {clientes.map((c, idx) => (
                    <option key={`${c.id || 'cli'}-${idx}`} value={c.id} className="bg-slate-50">
                      {c.nombre} {!c.activo ? ' - [Inactivo]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Servicio</label>
                <select 
                  value={servicioId}
                  onChange={(e) => setServicioId(e.target.value)}
                  className="w-full bg-white text-slate-900 border border-slate-200 p-2 rounded focus:outline-none"
                  required
                >
                  <option value="" disabled>Selecciona servicio...</option>
                  {servicios.map((s, idx) => (
                    <option key={`${s.id || 'srv'}-${idx}`} value={s.id} className="bg-slate-50">{s.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-slate-500 text-[10px] uppercase font-mono">Tiempo dedicado</label>
                  <div className="flex rounded-md border border-slate-200 p-0.5 text-[10px]">
                    {(['horas', 'minutos'] as const).map((unidad) => (
                      <button key={unidad} type="button" onClick={() => { setDuracionUnidad(unidad); setHorasDedicadas(unidad === 'minutos' ? Math.round(horasDedicadas * 60) : horasDedicadas / 60); }} className={`rounded px-2 py-1 ${duracionUnidad === unidad ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>
                        {unidad === 'horas' ? 'Horas' : 'Minutos'}
                      </button>
                    ))}
                  </div>
                </div>
                <input 
                  type="number"
                  step={duracionUnidad === 'horas' ? '0.25' : '1'}
                  min={duracionUnidad === 'horas' ? '0.25' : '1'}
                  value={horasDedicadas}
                  onChange={(e) => setHorasDedicadas(Number(e.target.value))}
                  className="w-full bg-white text-slate-900 border border-slate-200 p-2 rounded font-mono focus:outline-none"
                  required
                />
                <p className="mt-1 text-[10px] text-slate-500">Se guardará como {describeDuration(horasDedicadas, duracionUnidad)}.</p>
              </div>

              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Hito / Descripción</label>
                <textarea 
                  rows={2}
                  placeholder="Ej: Maquetación de layouts con Tailwind"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full bg-white text-slate-900 border border-slate-200 p-2 rounded focus:outline-none"
                  required
                />
              </div>

              <button 
                type="submit"
                disabled={clientes.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 text-white font-semibold font-display py-2.5 rounded transition cursor-pointer"
              >
                Loguear Horas
              </button>

            </form>
          </div>

        </div>

        {/* Right columns: Statistics & Tables */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* D. Tabla rentabilidad por cliente */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5">
              <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase font-semibold">
                Rentabilidad Relativa por Cliente
              </h3>
            </div>
            <div className="overflow-x-auto text-xs font-sans">
              <table className="w-full text-left">
                <thead className="bg-white text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Cliente</th>
                    <th className="px-5 py-3">Horas Logs</th>
                    <th className="px-5 py-3">Pautado (COP)</th>
                    <th className="px-5 py-3">Hora Cobrada</th>
                    <th className="px-5 py-3 text-right">Estatus Rentabilidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {clientProductivity.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-500 font-mono">Sin registros</td>
                    </tr>
                  ) : (
                    clientProductivity.map((item, idx) => {
                      const computedHourly = item.horasRegistradas > 0 ? item.ingresosCop / item.horasRegistradas : 0;
                      
                      let badge = { text: 'EQUILIBRIO', style: 'text-blue-700 bg-blue-50 border border-blue-300' };
                      if (computedHourly >= horaObjetivoMinima) {
                        badge = { text: 'GANANCIA', style: 'text-emerald-600 bg-emerald-50 border border-emerald-200' };
                      } else if (computedHourly < (horaObjetivoMinima * umbralPerdida)) {
                        badge = { text: 'PÉRDIDA', style: 'text-rose-600 bg-rose-50 border border-rose-200' };
                      }

                      return (
                        <tr key={`${item.clienteId || 'cli'}-${idx}`} className="hover:bg-slate-50 transition">
                          <td className="px-5 py-3.5 font-medium text-slate-900">{item.clienteNombre}</td>
                          <td className="px-5 py-3.5 font-mono text-slate-500">{formatHours(item.horasRegistradas)}</td>
                          <td className="px-5 py-3.5 font-mono">{formatCop(item.ingresosCop)}</td>
                          <td className="px-5 py-3.5 font-mono text-blue-700 font-semibold">{formatCop(computedHourly)}</td>
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
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5">
              <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase font-semibold">
                Promedio de Horas por Línea de Servicio
              </h3>
            </div>
            <div className="overflow-x-auto text-xs font-sans">
              <table className="w-full text-left">
                <thead className="bg-white text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Línea Servicio</th>
                    <th className="px-5 py-3 font-mono">Horas Totales Dedicated</th>
                    <th className="px-5 py-3">Uds Vendidas</th>
                    <th className="px-5 py-3 font-mono">Horas / Unidad</th>
                    <th className="px-5 py-3 text-right">Tarifa Hora Cobrada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {serviceProductivity.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-500 font-mono">Sin registros</td>
                    </tr>
                  ) : (
                    serviceProductivity.map((item, idx) => {
                      const hourly = item.horasRegistradas > 0 ? item.ingresosCop / item.horasRegistradas : 0;
                      return (
                        <tr key={`${item.servicioId || 'srv'}-${idx}`} className="hover:bg-slate-50 transition">
                          <td className="px-5 py-3.5 font-medium text-slate-900">{item.servicioNombre}</td>
                          <td className="px-5 py-3.5 font-mono text-slate-500">{formatHours(item.horasRegistradas)}</td>
                          <td className="px-5 py-3.5 font-mono">{item.unidadesVendidas} uds</td>
                          <td className="px-5 py-3.5 font-mono font-medium text-blue-700">
                            {item.promedioHorasPorUnidad.toFixed(1)} hs/ud
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono font-semibold text-emerald-600">
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
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5">
              <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase font-semibold">
                Línea de Tiempo de Bitácora (Últimos 30 Registros)
              </h3>
            </div>
            <div className="overflow-x-auto text-xs font-sans">
              <table className="w-full text-left">
                <thead className="bg-white text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Fecha</th>
                    <th className="px-5 py-3">Cliente</th>
                    <th className="px-5 py-3 font-mono">Horas</th>
                    <th className="px-5 py-3">Descripción de Actividad</th>
                    <th className="px-5 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {last30Horas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-slate-500 font-mono">Aún no hay registros de horas en este periodo</td>
                    </tr>
                  ) : (
                    last30Horas.map((h, idx) => (
                      editandoId === h.id && edicion ? (
                        <tr key={`${h.id || 'hr'}-${idx}`} className="bg-blue-50/40">
                          <td className="px-5 py-3">
                            <input type="date" value={edicion.fecha} onChange={(e) => setEdicion({ ...edicion, fecha: e.target.value })} aria-label="Fecha" className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono text-[11px]" />
                          </td>
                          <td className="px-5 py-3">
                            <select value={edicion.clienteId} onChange={(e) => setEdicion({ ...edicion, clienteId: e.target.value })} aria-label="Cliente" className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px]">
                              <option value="">Sin cliente</option>
                              {clientes.map((c, i) => <option key={`${c.id}-${i}`} value={c.id}>{c.nombre}</option>)}
                            </select>
                            <select value={edicion.servicioId} onChange={(e) => setEdicion({ ...edicion, servicioId: e.target.value })} aria-label="Servicio" className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px]">
                              <option value="">Sin servicio</option>
                              {servicios.map((s, i) => <option key={`${s.id}-${i}`} value={s.id}>{s.nombre}</option>)}
                            </select>
                          </td>
                          <td className="px-5 py-3">
                            <input type="number" min="0" step="0.25" value={edicion.horas} onChange={(e) => setEdicion({ ...edicion, horas: Number(e.target.value) })} aria-label="Horas" className="w-20 rounded border border-slate-200 bg-white px-2 py-1 font-mono text-[11px]" />
                          </td>
                          <td className="px-5 py-3">
                            <input value={edicion.descripcion} onChange={(e) => setEdicion({ ...edicion, descripcion: e.target.value })} aria-label="Descripción" placeholder="En qué se trabajó" className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px]" />
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <button type="button" onClick={guardarEdicion} disabled={!(edicion.horas > 0)} className="rounded bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Guardar</button>
                              <button type="button" onClick={cancelarEdicion} className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                      <tr key={`${h.id || 'hr'}-${idx}`} className="hover:bg-slate-50 transition">
                        <td className="px-5 py-3 font-mono text-slate-500">{h.fecha}</td>
                        <td className="px-5 py-3 font-medium text-slate-900">
                          {h.cliente_nombre}
                          <span className="text-[10px] font-mono text-slate-500 block mt-0.5">{h.servicio_nombre}</span>
                        </td>
                        <td className="px-5 py-3 font-mono text-blue-700 font-semibold">{formatHours(h.horas)}</td>
                        <td className="px-5 py-3 text-slate-500 max-w-xs truncate">{h.descripcion}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => empezarEdicion(h)}
                              title="Editar este registro"
                              aria-label={`Editar el registro del ${h.fecha}`}
                              className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
                            >
                              Editar
                            </button>
                            <InlineDeleteConfirm
                              confirming={confirmDeleteId === h.id}
                              onRequestConfirm={() => setConfirmDeleteId(h.id)}
                              onConfirm={() => handleDeleteHora(h.id)}
                              onCancel={() => setConfirmDeleteId(null)}
                              className="justify-end max-w-[70px]"
                            />
                          </div>
                        </td>
                      </tr>
                      )
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
