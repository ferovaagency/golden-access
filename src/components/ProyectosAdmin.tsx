import { useState, useEffect } from 'react';
import { AppData, Cliente } from '../types';
import { updateProjectClient } from '../domains/projects/projectService';
import type { ProjectCadence, ProjectDeliverable, ProjectKpi, ProjectObjective } from '../domains/projects/types';
import { useProjectPortfolio } from '../hooks/useProjectPortfolio';
import { useToast, errMsg } from './ui/toast';
import {
  Target,
  TrendingUp,
  Palette,
  ClipboardList,
  UserCheck,
  Plus,
  Trash2,
  Save,
  Check,
  Percent,
  FolderOpen
} from 'lucide-react';

/** Periodicidad seleccionable para objetivos y KPIs (manual: diario alimenta semanal, etc.). */
const CADENCIAS: Array<{ value: ProjectCadence; label: string }> = [
  { value: 'diario', label: 'Diario' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'anual', label: 'Anual' },
];
const cadenciaLabel = (value?: ProjectCadence) => CADENCIAS.find((c) => c.value === value)?.label || 'Sin periodicidad';

interface ProyectosAdminProps {
  projectData: Pick<AppData, 'clientes' | 'servicios' | 'ventas' | 'horas'>;
  onSaveClientes: (updated: Cliente[]) => Promise<void>;
}

export default function ProyectosAdmin({ projectData, onSaveClientes }: ProyectosAdminProps) {
  const { error: toastErr } = useToast();
  const projects = useProjectPortfolio(projectData);
  const activeClientes = projects.map((project) => project.client);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  
  // Brand Fields
  const [marcaConcepto, setMarcaConcepto] = useState('');
  const [responsable, setResponsable] = useState('');
  const [progreso, setProgreso] = useState(0);
  
  // Lists
  const [objectives, setObjectives] = useState<ProjectObjective[]>([]);
  const [kpis, setKpis] = useState<ProjectKpi[]>([]);
  const [deliverables, setDeliverables] = useState<ProjectDeliverable[]>([]);
  
  // Form add states
  const [newObjective, setNewObjective] = useState('');
  const [newObjectiveDate, setNewObjectiveDate] = useState('');
  const [newObjectiveCadencia, setNewObjectiveCadencia] = useState<ProjectCadence>('mensual');

  const [newKpiNombre, setNewKpiNombre] = useState('');
  const [newKpiMeta, setNewKpiMeta] = useState('');
  const [newKpiActual, setNewKpiActual] = useState('');
  const [newKpiTendencia, setNewKpiTendencia] = useState<'Subiendo' | 'Estable' | 'Bajando'>('Estable');
  const [newKpiObjectiveId, setNewKpiObjectiveId] = useState('');
  const [newKpiCadencia, setNewKpiCadencia] = useState<ProjectCadence>('mensual');

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
  }, [activeClientes, selectedClientId]);

  // Load selected client project details
  useEffect(() => {
    const project = projects.find((item) => item.id === selectedClientId);
    if (project) {
      setMarcaConcepto(project.client.marca_info || '');
      setResponsable(project.client.responsable || '');
      setProgreso(project.client.progreso || 0);
      setObjectives(project.objectives);
      setKpis(project.kpis);
      setDeliverables(project.deliverables);
    } else {
      setMarcaConcepto('');
      setResponsable('');
      setProgreso(0);
      setObjectives([]);
      setKpis([]);
      setDeliverables([]);
    }
    setSuccessMsg('');
  }, [selectedClientId, projects]);

  const handleSaveProjectData = async () => {
    if (!selectedClientId) return;
    setSaving(true);
    setSuccessMsg('');
    try {
      const updated = updateProjectClient(projectData.clientes, selectedClientId, {
        marcaInfo: marcaConcepto,
        responsable,
        progreso: Number(progreso),
        objectives,
        kpis,
        deliverables,
      });
      await onSaveClientes(updated);
      setSuccessMsg('¡Seguimiento de proyecto guardado y sincronizado con Sheets!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      toastErr(`Error al guardar: ${errMsg(err)}`);
    } finally {
      setSaving(false);
    }
  };

  // List Updaters
  // 1. Objectives
  const addObjective = () => {
    if (!newObjective.trim()) return;
    const item: ProjectObjective = {
      id: `obj_${Date.now()}`,
      text: newObjective.trim(),
      completado: false,
      metaFecha: newObjectiveDate || undefined,
      progreso: 0,
      cadencia: newObjectiveCadencia,
    };
    setObjectives([...objectives, item]);
    setNewObjective('');
    setNewObjectiveDate('');
    setNewObjectiveCadencia('mensual');
  };

  const removeObjective = (id: string) => {
    setObjectives(objectives.filter(o => o.id !== id));
  };

  // Edición inline de un objetivo ya creado (texto, fecha meta y periodicidad).
  const updateObjectiveField = (id: string, patch: Partial<ProjectObjective>) => {
    setObjectives(objectives.map((o) => o.id === id ? { ...o, ...patch } : o));
  };

  const toggleObjective = (id: string) => {
    setObjectives(objectives.map(o => o.id === id ? { ...o, completado: !o.completado, progreso: !o.completado ? 100 : 0 } : o));
  };

  const updateObjectiveProgress = (id: string, value: number) => {
    const progress = Math.max(0, Math.min(100, value));
    setObjectives(objectives.map((objective) => objective.id === id ? { ...objective, progreso: progress, completado: progress === 100 } : objective));
  };

  // 2. KPIs
  const addKpi = () => {
    if (!newKpiNombre.trim()) return;
    if (objectives.length > 0 && !newKpiObjectiveId) {
      toastErr('Selecciona el objetivo al que aporta este KPI.');
      return;
    }
    const initialValue = Number(newKpiActual.replace(/[^0-9.-]/g, ''));
    const item: ProjectKpi = {
      id: `kpi_${Date.now()}`,
      nombre: newKpiNombre.trim(),
      meta: newKpiMeta.trim() || 'N/A',
      actual: newKpiActual.trim() || 'N/A',
      tendencia: newKpiTendencia,
      objetivo_id: newKpiObjectiveId || undefined,
      historial: Number.isFinite(initialValue) ? [{ fecha: new Date().toISOString().slice(0, 10), valor: initialValue }] : [],
      cadencia: newKpiCadencia,
    };
    setKpis([...kpis, item]);
    setNewKpiNombre('');
    setNewKpiMeta('');
    setNewKpiActual('');
    setNewKpiTendencia('Estable');
    setNewKpiObjectiveId('');
    setNewKpiCadencia('mensual');
  };

  const removeKpi = (id: string) => {
    setKpis(kpis.filter(k => k.id !== id));
  };

  // Edición inline de un KPI ya creado (nombre, meta, objetivo y periodicidad).
  const updateKpiField = (id: string, patch: Partial<ProjectKpi>) => {
    setKpis(kpis.map((k) => k.id === id ? { ...k, ...patch } : k));
  };

  const updateKpiActual = (id: string, actual: string) => {
    setKpis((current) => current.map((kpi) => {
      if (kpi.id !== id) return kpi;
      const numeric = Number(actual.replace(/[^0-9.-]/g, ''));
      if (!Number.isFinite(numeric)) return { ...kpi, actual };
      const history = kpi.historial || [];
      const last = history[history.length - 1];
      const nextHistory = last?.valor === numeric ? history : [...history, { fecha: new Date().toISOString().slice(0, 10), valor: numeric }].slice(-24);
      const target = Number(kpi.meta.replace(/[^0-9.-]/g, ''));
      const previous = last?.valor;
      const tendencia = previous == null || numeric === previous ? 'Estable' : numeric > previous ? 'Subiendo' : 'Bajando';
      return { ...kpi, actual, historial: nextHistory, tendencia, ...(Number.isFinite(target) ? {} : {}) };
    }));
  };

  // 3. Deliverables (Cumplimiento de Servicio)
  const addDeliverable = () => {
    if (!newDeliverableNombre.trim()) return;
    const item: ProjectDeliverable = {
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

  // Edición inline de un hito ya creado (nombre, fecha y estado).
  const updateDeliverableField = (id: string, patch: Partial<ProjectDeliverable>) => {
    setDeliverables(deliverables.map((d) => d.id === id ? { ...d, ...patch } : d));
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

  const selectedClient = activeClientes.find((client) => client.id === selectedClientId);

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
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
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
                    <label className="block text-[9px] font-mono uppercase tracking-wider text-[#a39d8e] mb-1">Periodicidad</label>
                    <select
                      value={newObjectiveCadencia}
                      onChange={(e) => setNewObjectiveCadencia(e.target.value as ProjectCadence)}
                      className="w-full bg-[#0f0e0c]/50 text-[#e8e3d8] border border-[#2a2620] p-1.5 text-xs rounded focus:outline-none focus:border-[#c9a961]"
                    >
                      {CADENCIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
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
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleObjective(obj.id)}
                            className={`mt-0.5 w-4 h-4 shrink-0 rounded flex items-center justify-center border transition ${
                              obj.completado
                                ? 'bg-emerald-400 border-emerald-500 text-black'
                                : 'border-[#8a8377] hover:border-[#c9a961]'
                            }`}
                          >
                            {obj.completado && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            {/* Editable después de creado */}
                            <input
                              type="text"
                              value={obj.text}
                              onChange={(event) => updateObjectiveField(obj.id, { text: event.target.value })}
                              aria-label="Editar objetivo"
                              className={`w-full bg-transparent border border-transparent hover:border-[#2a2620] focus:border-[#c9a961] rounded px-1 py-0.5 text-xs focus:outline-none ${obj.completado ? 'line-through text-[#8a8377]' : 'font-medium text-[#e8e3d8]'}`}
                            />
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <select
                                value={obj.cadencia || ''}
                                onChange={(event) => updateObjectiveField(obj.id, { cadencia: (event.target.value || undefined) as ProjectCadence | undefined })}
                                aria-label="Periodicidad del objetivo"
                                className="bg-[#0f0e0c]/50 text-[#c9a961] border border-[#2a2620] rounded px-1.5 py-0.5 text-[9px] font-mono focus:outline-none focus:border-[#c9a961]"
                              >
                                <option value="">Sin periodicidad</option>
                                {CADENCIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                              </select>
                              <input
                                type="date"
                                value={obj.metaFecha || ''}
                                onChange={(event) => updateObjectiveField(obj.id, { metaFecha: event.target.value || undefined })}
                                aria-label="Fecha meta del objetivo"
                                className="bg-[#0f0e0c]/50 text-[#8a8377] border border-[#2a2620] rounded px-1.5 py-0.5 text-[9px] font-mono focus:outline-none focus:border-[#c9a961]"
                              />
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <input type="range" min="0" max="100" step="5" value={obj.progreso ?? (obj.completado ? 100 : 0)} onChange={(event) => updateObjectiveProgress(obj.id, Number(event.target.value))} className="h-1.5 w-28 accent-emerald-500" aria-label={`Progreso de ${obj.text}`} />
                              <span className="text-[9px] font-mono text-emerald-400">{obj.progreso ?? (obj.completado ? 100 : 0)}%</span>
                            </div>
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
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleDeliverableState(item.id)}
                            className={`mt-0.5 shrink-0 px-2 py-0.5 rounded text-[9px] font-mono font-bold leading-normal uppercase border transition cursor-pointer ${
                              item.estado === 'Cumplido'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : item.estado === 'En Progreso'
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}
                          >
                            {item.estado}
                          </button>
                          <div className="flex-1 min-w-0">
                            {/* Editable después de creado */}
                            <input
                              type="text"
                              value={item.nombre}
                              onChange={(event) => updateDeliverableField(item.id, { nombre: event.target.value })}
                              aria-label="Editar hito"
                              className={`w-full bg-transparent border border-transparent hover:border-[#2a2620] focus:border-[#c9a961] rounded px-1 py-0.5 text-xs focus:outline-none ${item.estado === 'Cumplido' ? 'line-through text-[#8a8377]' : 'font-medium text-[#e8e3d8]'}`}
                            />
                            <input
                              type="date"
                              value={item.fecha || ''}
                              onChange={(event) => updateDeliverableField(item.id, { fecha: event.target.value || undefined })}
                              aria-label="Fecha de vencimiento del hito"
                              className="mt-1 bg-[#0f0e0c]/50 text-[#8a8377] border border-[#2a2620] rounded px-1.5 py-0.5 text-[9px] font-mono focus:outline-none focus:border-[#c9a961]"
                            />
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
                  <div className="sm:col-span-4">
                    <label className="block text-[9px] font-mono uppercase tracking-wider text-[#a39d8e] mb-1">Objetivo relacionado</label>
                    <select value={newKpiObjectiveId} onChange={(event) => setNewKpiObjectiveId(event.target.value)} className="w-full bg-[#0f0e0c] text-white border border-[#2a2620] p-2 text-xs rounded focus:outline-none" required={objectives.length > 0}>
                      <option value="">{objectives.length ? 'Selecciona un objetivo' : 'Crea primero un objetivo'}</option>
                      {objectives.map((objective) => <option key={objective.id} value={objective.id}>{objective.text}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[9px] font-mono uppercase tracking-wider text-[#a39d8e] mb-1">Periodicidad</label>
                    <select value={newKpiCadencia} onChange={(event) => setNewKpiCadencia(event.target.value as ProjectCadence)} className="w-full bg-[#0f0e0c] text-white border border-[#2a2620] p-2 text-xs rounded focus:outline-none focus:border-[#c9a961]">
                      {CADENCIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
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
                          {/* Editable después de creado */}
                          <input
                            type="text"
                            value={k.nombre}
                            onChange={(event) => updateKpiField(k.id, { nombre: event.target.value })}
                            aria-label="Editar nombre del KPI"
                            className="flex-1 min-w-0 bg-transparent border border-transparent hover:border-[#2a2620] focus:border-[#c9a961] rounded px-1 py-0.5 font-semibold text-xs text-[#e8e3d8] leading-tight focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => removeKpi(k.id)}
                            className="shrink-0 text-[#8a8377] hover:text-[#c97a61] transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="mb-2 grid grid-cols-2 gap-2">
                          <select
                            value={k.objetivo_id || ''}
                            onChange={(event) => updateKpiField(k.id, { objetivo_id: event.target.value || undefined })}
                            aria-label="Objetivo relacionado"
                            className="w-full bg-[#0f0e0c] text-blue-300 border border-[#2a2620] rounded px-1.5 py-1 text-[10px] focus:outline-none focus:border-[#c9a961]"
                          >
                            <option value="">Sin relación</option>
                            {objectives.map((objective) => <option key={objective.id} value={objective.id}>{objective.text}</option>)}
                          </select>
                          <select
                            value={k.cadencia || ''}
                            onChange={(event) => updateKpiField(k.id, { cadencia: (event.target.value || undefined) as ProjectCadence | undefined })}
                            aria-label="Periodicidad del KPI"
                            className="w-full bg-[#0f0e0c] text-[#c9a961] border border-[#2a2620] rounded px-1.5 py-1 text-[10px] font-mono focus:outline-none focus:border-[#c9a961]"
                          >
                            <option value="">Sin periodicidad</option>
                            {CADENCIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs border-t border-[#2a2620]/40 pt-2">
                          <div>
                            <span className="text-[10px] text-[#8a8377] font-mono uppercase">Actual:</span>
                            <input value={k.actual} onChange={(event) => setKpis((current) => current.map((item) => item.id === k.id ? { ...item, actual: event.target.value } : item))} onBlur={(event) => updateKpiActual(k.id, event.target.value)} className="mt-1 w-full rounded border border-[#2a2620] bg-black/20 px-2 py-1 font-bold text-[#c9a961] outline-none focus:border-[#c9a961]" aria-label={`Valor actual de ${k.nombre}`} />
                          </div>
                          <div>
                            <span className="text-[10px] text-[#8a8377] font-mono uppercase">Meta:</span>
                            <input value={k.meta} onChange={(event) => updateKpiField(k.id, { meta: event.target.value })} className="mt-1 w-full rounded border border-[#2a2620] bg-black/20 px-2 py-1 font-bold text-white outline-none focus:border-[#c9a961]" aria-label={`Meta de ${k.nombre}`} />
                          </div>
                        </div>
                        <KpiProgress kpi={k} />
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

function numericValue(value: string): number | null {
  const number = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? number : null;
}

function KpiProgress({ kpi }: { kpi: ProjectKpi }) {
  const actual = numericValue(kpi.actual);
  const target = numericValue(kpi.meta);
  const progress = actual != null && target != null && target !== 0 ? Math.max(0, Math.min(100, (actual / target) * 100)) : null;
  const history = kpi.historial || [];
  const points = history.length > 1 ? history.map((entry, index) => {
    const values = history.map((item) => item.valor);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const x = (index / Math.max(1, history.length - 1)) * 100;
    const y = max === min ? 18 : 34 - ((entry.valor - min) / (max - min)) * 30;
    return `${x},${y}`;
  }).join(' ') : '';
  return <div className="mt-3">
    {progress != null && <><div className="mb-1 flex justify-between text-[9px] font-mono text-[#8a8377]"><span>Avance hacia la meta</span><span>{progress.toFixed(0)}%</span></div><div className="h-1.5 overflow-hidden rounded bg-[#2a2620]"><div className="h-full rounded bg-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div></>}
    {points && <div className="mt-3"><svg viewBox="0 0 100 38" className="h-12 w-full" role="img" aria-label={`Tendencia histórica de ${kpi.nombre}`}><polyline fill="none" stroke="#60a5fa" strokeWidth="2" points={points} vectorEffect="non-scaling-stroke" /></svg><p className="text-[9px] text-[#8a8377]">{history.length} actualizaciones · {kpi.tendencia}</p></div>}
  </div>;
}
