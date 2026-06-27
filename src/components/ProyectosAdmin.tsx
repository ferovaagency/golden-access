import React, { useState, useEffect } from 'react';
import { Cliente, Config } from '../types';
import { 
  Target, 
  TrendingUp, 
  Palette, 
  ClipboardList, 
  UserCheck, 
  Plus, 
  CheckCircle, 
  Trash2, 
  ChevronRight, 
  Sparkles, 
  AlertCircle,
  Save,
  Check,
  Percent,
  FolderOpen
} from 'lucide-react';

interface ProyectosAdminProps {
  clientes: Cliente[];
  config: Config;
  onSaveClientes: (updated: Cliente[]) => Promise<void>;
}

interface ObjectiveItem {
  id: string;
  text: string;
  completado: boolean;
  metaFecha?: string;
}

interface KPIItem {
  id: string;
  nombre: string;
  meta: string;
  actual: string;
  tendencia: 'Subiendo' | 'Estable' | 'Bajando';
}

interface DeliverableItem {
  id: string;
  nombre: string;
  estado: 'Pendiente' | 'En Progreso' | 'Cumplido';
  fecha?: string;
}

export default function ProyectosAdmin({ clientes, config, onSaveClientes }: ProyectosAdminProps) {
  const activeClientes = clientes.filter(c => c.activo);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  
  // Brand Fields
  const [marcaConcepto, setMarcaConcepto] = useState('');
  const [responsable, setResponsable] = useState('');
  const [progreso, setProgreso] = useState(0);
  
  // Lists
  const [objectives, setObjectives] = useState<ObjectiveItem[]>([]);
  const [kpis, setKpis] = useState<KPIItem[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>([]);
  
  // Form add states
  const [newObjective, setNewObjective] = useState('');
  const [newObjectiveDate, setNewObjectiveDate] = useState('');
  
  const [newKpiNombre, setNewKpiNombre] = useState('');
  const [newKpiMeta, setNewKpiMeta] = useState('');
  const [newKpiActual, setNewKpiActual] = useState('');
  const [newKpiTendencia, setNewKpiTendencia] = useState<'Subiendo' | 'Estable' | 'Bajando'>('Estable');

  const [newDeliverableNombre, setNewDeliverableNombre] = useState('');
  const [newDeliverableEstado, setNewDeliverableEstado] = useState<'Pendiente' | 'En Progreso' | 'Cumplido'>('Pendiente');
  const [newDeliverableFecha, setNewDeliverableFecha] = useState('');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Auto-select first client
  useEffect(() => {
    if (activeClientes.length > 0 && !selectedClientId) {
      setSelectedClientId(activeClientes[0].id);
    }
  }, [clientes]);

  // Load selected client project details
  useEffect(() => {
    const client = clientes.find(c => c.id === selectedClientId);
    if (client) {
      setMarcaConcepto(client.marca_info || '');
      setResponsable(client.responsable || '');
      setProgreso(client.progreso || 0);
      
      // Parse objectives JSON safely
      try {
        if (client.objetivos) {
          setObjectives(JSON.parse(client.objetivos));
        } else {
          setObjectives([]);
        }
      } catch (e) {
        // Fallback to text lines if not valid JSON
        setObjectives([]);
      }

      // Parse KPIs JSON safely
      try {
        if (client.kpis) {
          setKpis(JSON.parse(client.kpis));
        } else {
          setKpis([]);
        }
      } catch (e) {
        setKpis([]);
      }

      // Parse Deliverables JSON safely
      try {
        if (client.entregables) {
          setDeliverables(JSON.parse(client.entregables));
        } else {
          setDeliverables([]);
        }
      } catch (e) {
        setDeliverables([]);
      }
    } else {
      setMarcaConcepto('');
      setResponsable('');
      setProgreso(0);
      setObjectives([]);
      setKpis([]);
      setDeliverables([]);
    }
    setSuccessMsg('');
  }, [selectedClientId, clientes]);

  const handleSaveProjectData = async () => {
    if (!selectedClientId) return;
    setSaving(true);
    setSuccessMsg('');
    try {
      const updated = clientes.map(c => {
        if (c.id === selectedClientId) {
          return {
            ...c,
            marca_info: marcaConcepto,
            responsable: responsable,
            progreso: Number(progreso),
            objetivos: JSON.stringify(objectives),
            kpis: JSON.stringify(kpis),
            entregables: JSON.stringify(deliverables)
          };
        }
        return c;
      });
      await onSaveClientes(updated);
      setSuccessMsg('¡Seguimiento de proyecto guardado y sincronizado con Sheets!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(`Error al guardar: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  // List Updaters
  // 1. Objectives
  const addObjective = () => {
    if (!newObjective.trim()) return;
    const item: ObjectiveItem = {
      id: `obj_${Date.now()}`,
      text: newObjective.trim(),
      completado: false,
      metaFecha: newObjectiveDate || undefined
    };
    setObjectives([...objectives, item]);
    setNewObjective('');
    setNewObjectiveDate('');
  };

  const removeObjective = (id: string) => {
    setObjectives(objectives.filter(o => o.id !== id));
  };

  const toggleObjective = (id: string) => {
    setObjectives(objectives.map(o => o.id === id ? { ...o, completado: !o.completado } : o));
  };

  // 2. KPIs
  const addKpi = () => {
    if (!newKpiNombre.trim()) return;
    const item: KPIItem = {
      id: `kpi_${Date.now()}`,
      nombre: newKpiNombre.trim(),
      meta: newKpiMeta.trim() || 'N/A',
      actual: newKpiActual.trim() || 'N/A',
      tendencia: newKpiTendencia
    };
    setKpis([...kpis, item]);
    setNewKpiNombre('');
    setNewKpiMeta('');
    setNewKpiActual('');
    setNewKpiTendencia('Estable');
  };

  const removeKpi = (id: string) => {
    setKpis(kpis.filter(k => k.id !== id));
  };

  // 3. Deliverables (Cumplimiento de Servicio)
  const addDeliverable = () => {
    if (!newDeliverableNombre.trim()) return;
    const item: DeliverableItem = {
      id: `del_${Date.now()}`,
      nombre: newDeliverableNombre.trim(),
      estado: newDeliverableEstado,
      fecha: newDeliverableFecha || undefined
    };
    setDeliverables([...deliverables, item]);
    setNewDeliverableNombre('');
    setNewDeliverableFecha('');
    setNewDeliverableEstado('Pendiente');
  };

  const removeDeliverable = (id: string) => {
    setDeliverables(deliverables.filter(d => d.id !== id));
  };

  const toggleDeliverableState = (id: string) => {
    setDeliverables(deliverables.map(d => {
      if (d.id === id) {
        const nextState = d.estado === 'Pendiente' ? 'En Progreso' : (d.estado === 'En Progreso' ? 'Cumplido' : 'Pendiente');
        return { ...d, estado: nextState };
      }
      return d;
    }));
  };

  const selectedClient = clientes.find(c => c.id === selectedClientId);

  return (
    <div className="space-y-8 animate-fade-in text-[#e8e3d8]">
      
      {/* Tab Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2a2620] pb-5">
        <div>
          <h2 className="text-xl font-display font-medium text-[#c9a961]">Seguimiento de Proyectos, Objetivos y KPIs</h2>
          <p className="text-xs text-[#a39d8e] font-mono mt-1">
            Garantiza el cumplimiento de entrega, objetivos estratégicos, indicadores de rendimiento y branding de tus clientes.
          </p>
        </div>
        
        {/* Sync with Sheets Button */}
        {selectedClientId && (
          <button 
            type="button"
            onClick={handleSaveProjectData}
            disabled={saving}
            className="bg-[#c9a961] hover:bg-[#b09252] disabled:bg-[#2a2620] text-black font-semibold font-mono tracking-wide px-4 py-2 text-xs rounded-lg flex items-center gap-2 transition cursor-pointer"
          >
            {saving ? (
              <span className="flex items-center gap-1.5">Cargando...</span>
            ) : (
              <span className="flex items-center gap-1.5"><Save className="w-4.5 h-4.5" /> Guardar y Sincronizar</span>
            )}
          </button>
        )}
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 p-4 rounded-lg flex items-center gap-2 font-mono">
          <Check className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Select active client view */}
      <div className="bg-[#161412] border border-[#2a2620] p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#c9a961]/10 flex items-center justify-center text-[#c9a961]">
            <FolderOpen className="w-4 h-4" />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#a39d8e] mb-0.5 font-bold">Cliente Seleccionado:</label>
            <span className="text-xs text-[#e8e3d8] font-sans font-semibold">Selecciona un cliente activo para revisar su estrategia</span>
          </div>
        </div>

        <div>
          {activeClientes.length === 0 ? (
            <div className="text-xs font-mono text-[#c97a61] p-1">No hay clientes activos registrados.</div>
          ) : (
            <select 
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="bg-[#0f0e0c] text-white border border-[#2a2620] p-2 rounded text-xs focus:outline-none focus:border-[#c9a961] font-medium"
            >
              <option value="" disabled>Seleccionar cliente...</option>
              {activeClientes.map(c => (
                <option key={c.id} value={c.id} className="bg-[#0f0e0c]">{c.nombre} ({c.id})</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {selectedClientId && selectedClient && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: BRAND INFO & PROGRESS TRACKER */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* 1. BRAND METADATA COMPONENT */}
            <div className="bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden">
              <div className="bg-white/[0.02] border-b border-[#2a2620] px-4 py-3.5 flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#c9a961]" />
                <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold">Atributos de Marca & Proyecto</h3>
              </div>
              
              <div className="p-4 space-y-4 text-xs">
                {/* Client brief */}
                <div>
                  <label className="block text-[#a39d8e] font-semibold mb-1 uppercase tracking-wider font-mono text-[9px]">Concepto Visual & Enlaces de Interés</label>
                  <textarea 
                    rows={4}
                    placeholder="Ej. Colores primarios: #1A1A1A, #E4B55F. Tipografía: Syne. Drive de activos de marca: https://drive.google.com/..."
                    value={marcaConcepto}
                    onChange={(e) => setMarcaConcepto(e.target.value)}
                    className="w-full bg-[#0f0e0c]/50 text-[#e8e3d8] border border-[#2a2620] p-2.5 rounded focus:outline-none focus:border-[#c9a961] font-sans text-xs"
                  />
                  <span className="text-[10px] text-[#8a8377] leading-tight block mt-1">Design system, drives, lineamientos de diseño, contraseñas seguras o notas de identidad.</span>
                </div>

                {/* Team Lead / Responsable */}
                <div>
                  <label className="block text-[#a39d8e] font-semibold mb-1 uppercase tracking-wider font-mono text-[9px]">Responsable (Account Manager / Lead)</label>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Ej. Carolina G. (SEO Strategist)"
                      value={responsable}
                      onChange={(e) => setResponsable(e.target.value)}
                      className="w-full bg-[#0f0e0c]/50 text-[#e8e3d8] border border-[#2a2620] pl-8.5 pr-3 py-2 rounded focus:outline-none focus:border-[#c9a961] font-sans text-xs"
                    />
                    <UserCheck className="absolute left-2.5 top-2.5 w-4 h-4 text-[#8a8377]" />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. OVERALL SERVICES COMPLIANCE PROGRESS */}
            <div className="bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden">
              <div className="bg-white/[0.02] border-b border-[#2a2620] px-4 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-[#c9a961]" />
                  <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold">Progreso Contractual</h3>
                </div>
                <span className="text-xs font-mono font-bold text-white bg-[#c9a961]/10 border border-[#c9a961]/30 px-2 py-0.5 rounded">
                  {progreso}%
                </span>
              </div>
              
              <div className="p-4 space-y-4 text-xs">
                <span className="text-[10px] text-[#a39d8e] leading-snug block">
                  Arrastra para indicar el grado de avance en el periodo de prestación del servicio con el cliente:
                </span>
                
                <div className="space-y-2">
                  <input 
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={progreso}
                    onChange={(e) => setProgreso(Number(e.target.value))}
                    className="w-full accent-[#c9a961] cursor-pointer h-2 bg-[#0f0e0c]/80 rounded"
                  />
                  
                  <div className="flex justify-between font-mono text-[9px] text-[#8a8377]">
                    <span>0% (Kick-off)</span>
                    <span>50% (Entrega parcial)</span>
                    <span>100% (Satisfecho)</span>
                  </div>
                </div>

                <div className="p-3 bg-[#0f0e0c]/30 border border-[#2a2620]/60 rounded text-[11px] leading-relaxed text-[#a39d8e]">
                  {progreso === 100 ? (
                    <span className="text-emerald-400 font-semibold block">✓ Entregables Completados al 100%: Servicio prestado con total cumplimiento.</span>
                  ) : progreso >= 70 ? (
                    <span>Fase final de entregas y control de calidad. Sincroniza al terminar para consolidar el reporte.</span>
                  ) : (
                    <span>Registra más abonos e hitos semanales para actualizar el progreso global del cliente.</span>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: GOALS, SERVICE CHECKLIST (DELIVERABLES) & KPIS */}
          <div className="lg:col-span-8 space-y-6">

            {/* 1. STRATEGIC OBJECTIVES */}
            <div className="bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden">
              <div className="bg-white/[0.02] border-b border-[#2a2620] px-4 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#c9a961]" />
                  <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold">Objetivos del Cliente (Marca & SEO)</h3>
                </div>
                <span className="text-[10px] font-mono text-[#8a8377]">
                  {objectives.filter(o => o.completado).length}/{objectives.length} Logrados
                </span>
              </div>

              <div className="p-4 space-y-4">
                
                {/* Add Objective form */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-[9px] font-mono uppercase tracking-wider text-[#a39d8e] mb-1">Nuevo Objetivo Estratégico</label>
                    <input 
                      type="text"
                      placeholder="Ej. Reposicionar palabras clave transaccionales"
                      value={newObjective}
                      onChange={(e) => setNewObjective(e.target.value)}
                      className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2 text-xs rounded focus:outline-none focus:border-[#c9a961]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono uppercase tracking-wider text-[#a39d8e] mb-1">Fecha Meta</label>
                    <input 
                      type="date"
                      value={newObjectiveDate}
                      onChange={(e) => setNewObjectiveDate(e.target.value)}
                      className="w-full bg-[#0f0e0c]/50 text-[#a39d8e] border border-[#2a2620] p-1.5 text-xs rounded focus:outline-none"
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={addObjective}
                    className="bg-[#c9a961]/10 hover:bg-[#c9a961]/20 border border-[#c9a961]/35 text-[#c9a961] px-4 py-2 rounded text-xs transition font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Agregar
                  </button>
                </div>

                {/* Objectives list */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {objectives.length === 0 ? (
                    <div className="text-center py-6 text-xs text-[#8a8377] font-mono italic">
                      No hay objetivos estratégicos agregados aún para este cliente.
                    </div>
                  ) : (
                    objectives.map((obj) => (
                      <div 
                        key={obj.id}
                        className={`p-3 rounded border transition flex items-center justify-between gap-3 text-xs ${
                          obj.completado 
                            ? 'bg-emerald-500/5 border-emerald-500/20 text-[#a39d8e]' 
                            : 'bg-[#0f0e0c]/35 border-[#2a2620] text-[#e8e3d8]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <button 
                            type="button" 
                            onClick={() => toggleObjective(obj.id)}
                            className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                              obj.completado 
                                ? 'bg-emerald-400 border-emerald-500 text-black' 
                                : 'border-[#8a8377] hover:border-[#c9a961]'
                            }`}
                          >
                            {obj.completado && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                          <div>
                            <span className={obj.completado ? 'line-through text-[#8a8377]' : 'font-medium'}>
                              {obj.text}
                            </span>
                            {obj.metaFecha && (
                              <span className="block text-[9px] font-mono text-[#8a8377] mt-0.5">Meta: {obj.metaFecha}</span>
                            )}
                          </div>
                        </div>

                        <button 
                          type="button"
                          onClick={() => removeObjective(obj.id)}
                          className="text-[#8a8377] hover:text-[#c97a61] p-1 transition rounded-md hover:bg-[#c97a61]/5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

              </div>
            </div>

            {/* 2. SERVICES COMPLIANCE / DELIVERABLES CHECKLIST */}
            <div className="bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden">
              <div className="bg-white/[0.02] border-b border-[#2a2620] px-4 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[#c9a961]" />
                  <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold">Prestación del Servicio (Entregables y Hitos Contractuales)</h3>
                </div>
                <span className="text-[10px] font-mono text-[#8a8377]">
                  {deliverables.filter(d => d.estado === 'Cumplido').length}/{deliverables.length} Completados
                </span>
              </div>

              <div className="p-4 space-y-4">
                
                {/* Add Deliverable Form */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5">
                    <label className="block text-[9px] font-mono uppercase tracking-wider text-[#a39d8e] mb-1">Suscripción de Entregable / Hito</label>
                    <input 
                      type="text"
                      placeholder="Ej. Auditoría técnica SEO inicial"
                      value={newDeliverableNombre}
                      onChange={(e) => setNewDeliverableNombre(e.target.value)}
                      className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2 text-xs rounded focus:outline-none focus:border-[#c9a961]"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[9px] font-mono uppercase tracking-wider text-[#a39d8e] mb-1">Estado</label>
                    <select 
                      value={newDeliverableEstado}
                      onChange={(e) => setNewDeliverableEstado(e.target.value as any)}
                      className="w-full bg-[#0f0e0c] text-white border border-[#2a2620] p-2 text-xs rounded focus:outline-none"
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="En Progreso">En Progreso</option>
                      <option value="Cumplido">Cumplido</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[9px] font-mono uppercase tracking-wider text-[#a39d8e] mb-1">Fecha</label>
                    <input 
                      type="date"
                      value={newDeliverableFecha}
                      onChange={(e) => setNewDeliverableFecha(e.target.value)}
                      className="w-full bg-[#0f0e0c]/50 text-[#a39d8e] border border-[#2a2620] p-1.5 text-xs rounded focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button 
                      type="button"
                      onClick={addDeliverable}
                      className="w-full bg-[#c9a961]/10 hover:bg-[#c9a961]/20 border border-[#c9a961]/35 text-[#c9a961] py-2 rounded text-xs transition font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Crear
                    </button>
                  </div>
                </div>

                {/* Deliverables List */}
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {deliverables.length === 0 ? (
                    <div className="text-center py-6 text-xs text-[#8a8377] font-mono italic">
                      No hay hitos de prestación del servicio agregados aún para este cliente.
                    </div>
                  ) : (
                    deliverables.map((item) => (
                      <div 
                        key={item.id}
                        className="p-3 rounded border bg-[#0f0e0c]/25 border-[#2a2620] text-xs flex items-center justify-between gap-3 text-[#e8e3d8]"
                      >
                        <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            onClick={() => toggleDeliverableState(item.id)}
                            className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold leading-normal uppercase border transition cursor-pointer ${
                              item.estado === 'Cumplido' 
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                : item.estado === 'En Progreso'
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}
                          >
                            {item.estado}
                          </button>
                          <div>
                            <span className={item.estado === 'Cumplido' ? 'line-through text-[#8a8377]' : 'font-medium'}>
                              {item.nombre}
                            </span>
                            {item.fecha && (
                              <span className="block text-[9px] font-mono text-[#8a8377] mt-0.5">Vencimiento: {item.fecha}</span>
                            )}
                          </div>
                        </div>

                        <button 
                          type="button"
                          onClick={() => removeDeliverable(item.id)}
                          className="text-[#8a8377] hover:text-[#c97a61] p-1 transition rounded-md hover:bg-[#c97a61]/5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

              </div>
            </div>

            {/* 3. PERFORMANCE KPIS TRACKER */}
            <div className="bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden">
              <div className="bg-white/[0.02] border-b border-[#2a2620] px-4 py-3.5 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#c9a961]" />
                <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold">Indicadores Clave de Rendimiento (KPIs)</h3>
              </div>

              <div className="p-4 space-y-4">
                
                {/* Add KPI form */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-4">
                    <label className="block text-[9px] font-mono uppercase tracking-wider text-[#a39d8e] mb-1">Nombre del KPI</label>
                    <input 
                      type="text"
                      placeholder="Ej. Tráfico orgánico mensual"
                      value={newKpiNombre}
                      onChange={(e) => setNewKpiNombre(e.target.value)}
                      className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2 text-xs rounded focus:outline-none focus:border-[#c9a961]"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[9px] font-mono uppercase tracking-wider text-[#a39d8e] mb-1">Meta</label>
                    <input 
                      type="text"
                      placeholder="Ej. 15,000 visitas"
                      value={newKpiMeta}
                      onChange={(e) => setNewKpiMeta(e.target.value)}
                      className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2 text-xs rounded focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[9px] font-mono uppercase tracking-wider text-[#a39d8e] mb-1">Valor Actual</label>
                    <input 
                      type="text"
                      placeholder="Ej. 11,200 visitas"
                      value={newKpiActual}
                      onChange={(e) => setNewKpiActual(e.target.value)}
                      className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2 text-xs rounded focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button 
                      type="button"
                      onClick={addKpi}
                      className="w-full bg-[#c9a961]/10 hover:bg-[#c9a961]/20 border border-[#c9a961]/35 text-[#c9a961] py-2 rounded text-xs transition font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </button>
                  </div>
                </div>

                {/* KPIs grid/list */}
                {kpis.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[#8a8377] font-mono italic border border-[#2a2620]/45 rounded">
                    No hay KPIs corporativos trackeados para este cliente.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {kpis.map((k) => (
                      <div key={k.id} className="bg-[#0f0e0c]/40 border border-[#2a2620] p-3 rounded-lg flex flex-col justify-between">
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <span className="font-semibold text-xs text-[#e8e3d8] leading-tight block">{k.nombre}</span>
                          <button 
                            type="button"
                            onClick={() => removeKpi(k.id)}
                            className="text-[#8a8377] hover:text-[#c97a61] transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs border-t border-[#2a2620]/40 pt-2">
                          <div>
                            <span className="text-[10px] text-[#8a8377] font-mono uppercase">Actual:</span>
                            <span className="block font-bold text-[#c9a961]">{k.actual}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#8a8377] font-mono uppercase">Meta:</span>
                            <span className="block font-bold text-white">{k.meta}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
