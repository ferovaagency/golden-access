import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, HelpCircle, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { BusinessProfile } from '../lib/businessProfileService';
import { upsertBusinessProfile } from '../lib/businessProfileService';
import type { ModuleFlags, PlanId } from '../lib/planService';
import { upsertBudgetLine } from '../lib/budgetService';
import type { AppData, Cliente, Config, OtroGasto, Servicio } from '../types';
import { useToast, errMsg } from './ui/toast';

// Onboarding en 5 pasos, en el orden que reduce carga: identidad → oferta →
// clientes (opcional) → costos fijos → metas y presupuesto inicial.
//   1. Empresa: identidad y contexto para la IA.
//   2. Servicios: la oferta (varios, "agregar otro").
//   3. Clientes: pregunta explícita; quien empieza de cero pasa sin fricción.
//   4. Costos fijos: con el costo de los servicios ya se calcula el equilibrio.
//   5. Metas + presupuesto: sueldo deseado y cuota de ventas; con el
//      interruptor activo se siembra el presupuesto del mes en curso
//      (finance_budget_monthly) con los costos del paso 4 y el sueldo.
// Lo que se agrega se guarda al momento (no se pierde si se cierra la pestaña).

interface Props {
  user: User;
  plan: PlanId;
  modules: ModuleFlags;
  profile: BusinessProfile | null;
  appData: AppData;
  onSaveClientes: (updated: Cliente[]) => Promise<void>;
  onSaveServicios: (updated: Servicio[]) => Promise<void>;
  onSaveConfig: (updated: Partial<Config>) => Promise<void>;
  onSaveOtrosGastos: (updated: OtroGasto[]) => Promise<void>;
  onDone: (profile: BusinessProfile) => void;
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const planNames: Record<string, string> = {
  free: 'Gratis', basico: 'Básico', intermedio: 'Intermedio', full: 'Full',
  projects: 'Proyectos', finance: 'Finanzas', financiero: 'Finanzas', planner: 'Planner', crm: 'Ventas', crm_ventas: 'Ventas', completo: 'Todo incluido', custom: 'Personalizado',
};

const INDUSTRIAS = ['Marketing digital', 'Desarrollo de software', 'Ecommerce', 'Consultoría', 'Diseño / Creativo', 'Educación', 'Salud', 'Inmobiliaria'];
const TIPOS_NEGOCIO = ['Freelance / independiente', 'Agencia', 'Consultoría', 'SaaS', 'Ecommerce', 'Servicios profesionales'];
const EQUIPOS = ['Solo yo', '2–5 personas', '6–20 personas', 'Más de 20'];
const COSTOS_SUGERIDOS = ['Herramientas / software', 'Arriendo', 'Contador', 'Internet y celular', 'Suscripciones', 'Colaborador'];

const STEPS = ['Tu empresa', 'Tus servicios', 'Clientes', 'Costos fijos', 'Metas y presupuesto'] as const;

const fmt = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 0 });
const periodoActual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

/** Pequeña ayuda expandible: "¿qué es esto y para qué sirve?", sin saturar el formulario. */
function HelpNote({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800">
        <HelpCircle className="h-3 w-3" /> {open ? 'Ocultar explicación' : '¿Qué es esto?'}
      </button>
      {open && <p className="mt-1 rounded-lg bg-blue-50 px-3 py-2 text-[11px] leading-5 text-blue-800">{children}</p>}
    </div>
  );
}

/** Opciones rápidas para elegir con un clic, más un campo libre por si ninguna encaja. */
function ChipPicker({ label, help, options, value, onChange, required }: { label: string; help: React.ReactNode; options: string[]; value: string; onChange: (v: string) => void; required?: boolean }) {
  const isCustom = value !== '' && !options.includes(value);
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}{required && <span className="text-red-500"> *</span>}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button key={opt} type="button" onClick={() => onChange(opt)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${value === opt ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
            {opt}
          </button>
        ))}
      </div>
      <input className={`${inputClass} mt-2`} placeholder="Otro (escribe el tuyo)" value={isCustom ? value : ''} onChange={(e) => onChange(e.target.value)} />
      <HelpNote>{help}</HelpNote>
    </div>
  );
}

function Added({ children }: { children: React.ReactNode }) {
  return <li className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> {children}</span></li>;
}

export default function PlanOnboarding({ user, plan, modules, profile, appData, onSaveClientes, onSaveServicios, onSaveConfig, onSaveOtrosGastos, onDone }: Props) {
  const { success: toastOk, error: toastErr } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre_negocio: profile?.nombre_negocio || '',
    industria: profile?.industria || '',
    tipo_negocio: profile?.tipo_negocio || '',
    tamano_equipo: profile?.tamano_equipo || '',
    ciudad: profile?.ciudad || '',
    telefono_contacto: profile?.telefono_contacto || '',
  });

  // Paso 2 · servicios (varios)
  const [servicios, setServicios] = useState<Servicio[]>(appData.servicios);
  const [srv, setSrv] = useState({ nombre: '', precio: '', costo: '', horas: '' });
  const [savingSrv, setSavingSrv] = useState(false);

  // Paso 3 · clientes (opcional)
  const [tieneClientes, setTieneClientes] = useState<boolean | null>(appData.clientes.length ? true : null);
  const [clientes, setClientes] = useState<Cliente[]>(appData.clientes);
  const [cli, setCli] = useState<{ nombre: string; tipo: 'Nacional' | 'Internacional'; objetivo: string }>({ nombre: '', tipo: 'Nacional', objetivo: '' });
  const [savingCli, setSavingCli] = useState(false);

  // Paso 4 · costos fijos (varios)
  const [costos, setCostos] = useState<OtroGasto[]>(appData.otrosGastos);
  const [costo, setCosto] = useState({ nombre: '', monto: '' });
  const [savingCosto, setSavingCosto] = useState(false);

  // Paso 5 · metas + presupuesto
  const [salario, setSalario] = useState(String(appData.config.salario_propuesto || ''));
  const [metaVentas, setMetaVentas] = useState(String(appData.config.meta_ventas_mensual || ''));
  const [crearPresupuesto, setCrearPresupuesto] = useState(true);

  const identityValid = !!(form.nombre_negocio.trim() && form.industria.trim() && form.tipo_negocio.trim() && form.tamano_equipo.trim());
  const lastStep = STEPS.length - 1;
  const totalCostos = costos.reduce((sum, c) => sum + (c.moneda === 'COP' ? c.monto : 0), 0);

  const addServicio = async () => {
    if (!srv.nombre.trim()) return;
    setSavingSrv(true);
    try {
      const nuevo: Servicio = {
        id: `srv_${Date.now().toString().slice(-6)}`,
        nombre: srv.nombre.trim(),
        tipo: 'servicio',
        costo_unitario: Number(srv.costo) || 0,
        costo_entrega_estimado: Number(srv.costo) || null,
        precio_habitual: Number(srv.precio) || null,
        precio_habitual_moneda: 'COP',
        descripcion: srv.horas ? `Entrega estimada: ${srv.horas} h` : undefined,
      };
      const lista = [...servicios, nuevo];
      await onSaveServicios(lista);
      setServicios(lista);
      setSrv({ nombre: '', precio: '', costo: '', horas: '' });
      toastOk(`Servicio "${nuevo.nombre}" creado.`);
    } catch (err: any) {
      toastErr(`No se pudo guardar el servicio: ${errMsg(err)}`);
    } finally {
      setSavingSrv(false);
    }
  };

  const addCliente = async () => {
    if (!cli.nombre.trim()) return;
    setSavingCli(true);
    try {
      const nuevo: Cliente = {
        id: `cli_${Date.now().toString().slice(-6)}`,
        nombre: cli.nombre.trim(),
        tipo: cli.tipo,
        declarante: cli.tipo === 'Nacional',
        activo: true,
        fecha_creacion: new Date().toISOString().slice(0, 10),
        objetivos: cli.objetivo.trim() || undefined,
      };
      const lista = [...clientes, nuevo];
      await onSaveClientes(lista);
      setClientes(lista);
      setCli({ nombre: '', tipo: 'Nacional', objetivo: '' });
      toastOk(`Cliente "${nuevo.nombre}" creado.`);
    } catch (err: any) {
      // El tope de clientes del plan (planGate) también cae aquí con su mensaje.
      toastErr(`No se pudo guardar el cliente: ${errMsg(err)}`);
    } finally {
      setSavingCli(false);
    }
  };

  const addCosto = async () => {
    if (!costo.nombre.trim() || !costo.monto.trim()) return;
    setSavingCosto(true);
    try {
      const nuevo: OtroGasto = { id: `gasto_${Date.now().toString().slice(-6)}`, nombre: costo.nombre.trim(), monto: Number(costo.monto) || 0, moneda: 'COP', categoria: 'Operativo' };
      const lista = [...costos, nuevo];
      await onSaveOtrosGastos(lista);
      setCostos(lista);
      setCosto({ nombre: '', monto: '' });
    } catch (err: any) {
      toastErr(`No se pudo guardar el costo: ${errMsg(err)}`);
    } finally {
      setSavingCosto(false);
    }
  };

  const removeCosto = async (id: string) => {
    const lista = costos.filter((c) => c.id !== id);
    try { await onSaveOtrosGastos(lista); setCostos(lista); }
    catch (err: any) { toastErr(errMsg(err)); }
  };

  /** Presupuesto del mes en curso: una línea por costo fijo + sueldo propio. */
  const sembrarPresupuesto = async () => {
    const periodo = periodoActual();
    const lineas = new Map<string, number>();
    for (const c of costos) if (c.moneda === 'COP') lineas.set(c.nombre, (lineas.get(c.nombre) || 0) + c.monto);
    const sueldo = Number(salario) || 0;
    if (sueldo > 0) lineas.set('Sueldo propio', sueldo);
    let n = 0;
    for (const [categoria, monto] of lineas) {
      await upsertBudgetLine(user.id, { periodo, categoria, monto_presupuestado: Math.round(monto), moneda: 'COP', origen: 'auto', notas: 'Creado en el onboarding' });
      n += 1;
    }
    return n;
  };

  const finish = async () => {
    if (!identityValid) return;
    setSaving(true);
    try {
      if (modules.finance && (salario.trim() || metaVentas.trim())) {
        await onSaveConfig({ salario_propuesto: Number(salario) || 0, meta_ventas_mensual: Number(metaVentas) || 0 });
      }
      let lineas = 0;
      if (modules.finance && crearPresupuesto) {
        try { lineas = await sembrarPresupuesto(); }
        catch (err: any) { toastErr(`El presupuesto no se pudo crear: ${errMsg(err)}. Puedes hacerlo luego en Finanzas operativas.`); }
      }
      const saved = await upsertBusinessProfile(user.id, { ...form, onboarding_completado: true });
      localStorage.removeItem(`ferova.product-tour.${user.id}`);
      if (lineas) toastOk(`Presupuesto de ${periodoActual()} creado con ${lineas} línea(s).`);
      onDone(saved);
    } catch (error: any) {
      toastErr(`No pudimos guardar la configuración: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  const canContinue = step === 0 ? identityValid : step === 2 ? tieneClientes !== null : true;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
        <div className="grid lg:grid-cols-[300px_1fr]">
          <aside className="bg-slate-950 p-6 text-white sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600"><Sparkles className="h-5 w-5" /></div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Ferova One</p>
            <h1 className="mt-2 text-2xl font-bold">Cinco pasos y tus números quedan vivos</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">Plan {planNames[plan] || plan}. Lo que agregues se guarda al momento; los pasos 2 a 4 puedes completarlos después.</p>
            <ol className="mt-8 space-y-4 text-sm">
              {STEPS.map((label, index) => <li key={label} className={`flex items-center gap-3 ${step >= index ? 'text-white' : 'text-slate-500'}`}>{step > index ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5" />} <span><span className="mr-1 text-slate-500">{index + 1}.</span>{label}</span></li>)}
            </ol>
          </aside>
          <section className="p-5 sm:p-8 lg:p-10">
            {step === 0 && <div>
              <h2 className="text-xl font-bold">Tu empresa</h2>
              <p className="mt-1 text-sm text-slate-500">Le da identidad a la app desde el primer minuto y le da contexto al asistente. Son datos tuyos, no adivinados.</p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Nombre comercial<span className="text-red-500"> *</span></span><input className={inputClass} value={form.nombre_negocio} onChange={(e) => setForm({ ...form, nombre_negocio: e.target.value })} /></label>
                  <HelpNote>El nombre con el que te conocen tus clientes. Aparece en reportes y en la cabecera de la app.</HelpNote>
                </div>
                <ChipPicker label="Industria o sector" required value={form.industria} onChange={(v) => setForm({ ...form, industria: v })} options={INDUSTRIAS} help="A qué te dedicas. La IA lo usa para dar contexto más preciso en sugerencias y respuestas." />
                <ChipPicker label="Modelo de negocio" required value={form.tipo_negocio} onChange={(v) => setForm({ ...form, tipo_negocio: v })} options={TIPOS_NEGOCIO} help="Freelance, agencia, consultoría… Ajusta cómo se calculan métricas como el equilibrio por servicio." />
                <ChipPicker label="Tamaño del equipo" required value={form.tamano_equipo} onChange={(v) => setForm({ ...form, tamano_equipo: v })} options={EQUIPOS} help="Cuántas personas trabajan contigo. Solo informativo por ahora." />
                <div><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Ciudad</span><input className={inputClass} value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} /></label></div>
                <div><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Teléfono de contacto</span><input className={inputClass} value={form.telefono_contacto} onChange={(e) => setForm({ ...form, telefono_contacto: e.target.value })} /></label></div>
              </div>
            </div>}

            {step === 1 && <div>
              <h2 className="text-xl font-bold">Tus servicios</h2>
              <p className="mt-1 text-sm text-slate-500">Lo que vendes. Empieza por tu servicio estrella; puedes agregar los demás ahora o después.</p>
              <HelpNote>El precio es lo que cobras hoy por una unidad (un mes, un proyecto). El costo es lo que te cuesta entregarla (tu tiempo, insumos, herramientas). Con los dos, Ferova One calcula el margen real por servicio.</HelpNote>
              {servicios.length > 0 && <ul className="mt-4 space-y-1.5">{servicios.map((s) => <Added key={s.id}>{s.nombre}{s.precio_habitual ? ` · precio ${fmt(s.precio_habitual)}` : ''}{s.costo_unitario ? ` · costo ${fmt(s.costo_unitario)}` : ''}</Added>)}</ul>}
              <div className="mt-4 grid gap-2.5 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2">
                <input className={`${inputClass} sm:col-span-2`} placeholder="Nombre del servicio (ej. SEO mensual, Desarrollo web)" value={srv.nombre} onChange={(e) => setSrv({ ...srv, nombre: e.target.value })} />
                <input className={inputClass} type="number" min="0" placeholder="Precio sugerido (COP)" value={srv.precio} onChange={(e) => setSrv({ ...srv, precio: e.target.value })} />
                <input className={inputClass} type="number" min="0" placeholder="Costo de entregarlo (COP)" value={srv.costo} onChange={(e) => setSrv({ ...srv, costo: e.target.value })} />
                <input className={inputClass} type="number" min="0" placeholder="Horas estimadas por entrega (opcional)" value={srv.horas} onChange={(e) => setSrv({ ...srv, horas: e.target.value })} />
                <button type="button" onClick={addServicio} disabled={!srv.nombre.trim() || savingSrv} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> {savingSrv ? 'Guardando…' : servicios.length ? 'Agregar otro servicio' : 'Agregar servicio'}</button>
              </div>
            </div>}

            {step === 2 && <div>
              <h2 className="text-xl font-bold">¿Ya tienes clientes activos?</h2>
              <p className="mt-1 text-sm text-slate-500">Si los cargas ahora, tus horas y ventas quedan asociadas desde el primer día. Si empiezas de cero, sigue sin trabas.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => setTieneClientes(true)} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${tieneClientes === true ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>Sí, los cargo ahora</button>
                <button type="button" onClick={() => { setTieneClientes(false); setStep(3); }} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${tieneClientes === false ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>Aún no tengo clientes / lo haré después</button>
              </div>
              {tieneClientes && <>
                {clientes.length > 0 && <ul className="mt-4 space-y-1.5">{clientes.map((c) => <Added key={c.id}>{c.nombre} · {c.tipo}</Added>)}</ul>}
                <div className="mt-4 grid gap-2.5 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2">
                  <input className={`${inputClass} sm:col-span-2`} placeholder="Nombre del cliente" value={cli.nombre} onChange={(e) => setCli({ ...cli, nombre: e.target.value })} />
                  <div className="flex gap-2">
                    {(['Nacional', 'Internacional'] as const).map((t) => <button key={t} type="button" onClick={() => setCli({ ...cli, tipo: t })} className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold ${cli.tipo === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'}`}>{t}</button>)}
                  </div>
                  <input className={inputClass} placeholder="Objetivo principal (opcional)" value={cli.objetivo} onChange={(e) => setCli({ ...cli, objetivo: e.target.value })} />
                  <button type="button" onClick={addCliente} disabled={!cli.nombre.trim() || savingCli} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 sm:col-span-2"><Plus className="h-3.5 w-3.5" /> {savingCli ? 'Guardando…' : clientes.length ? 'Agregar otro cliente' : 'Agregar cliente'}</button>
                </div>
                <HelpNote>Nacional / Internacional decide si por defecto se marca como declarante de IVA. "Objetivo" es la meta del proyecto con ese cliente (ej. "duplicar tráfico orgánico en 3 meses").</HelpNote>
              </>}
            </div>}

            {step === 3 && <div>
              <h2 className="text-xl font-bold">Costos fijos</h2>
              <p className="mt-1 text-sm text-slate-500">Lo que pagas cada mes sin importar cuánto vendas. Con esto y el costo de tus servicios ya sale tu punto de equilibrio real.</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {COSTOS_SUGERIDOS.map((n) => <button key={n} type="button" onClick={() => setCosto({ ...costo, nombre: n })} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">{n}</button>)}
              </div>
              {costos.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {costos.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> {c.nombre} · {c.moneda} {fmt(c.monto)} / mes</span>
                      <button type="button" onClick={() => removeCosto(c.id)} className="text-emerald-700 hover:text-red-600" aria-label="Quitar"><Trash2 className="h-3.5 w-3.5" /></button>
                    </li>
                  ))}
                  <li className="px-3 pt-1 text-xs font-semibold text-slate-700">Total fijo: COP {fmt(totalCostos)} / mes</li>
                </ul>
              )}
              <div className="mt-4 grid gap-2.5 rounded-2xl border border-slate-200 p-4 sm:grid-cols-[1fr_180px_auto]">
                <input className={inputClass} placeholder="Ej. Arriendo, SEMrush, Contador" value={costo.nombre} onChange={(e) => setCosto({ ...costo, nombre: e.target.value })} />
                <input className={inputClass} type="number" min="0" placeholder="Monto mensual (COP)" value={costo.monto} onChange={(e) => setCosto({ ...costo, monto: e.target.value })} />
                <button type="button" onClick={addCosto} disabled={!costo.nombre.trim() || !costo.monto.trim() || savingCosto} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> {savingCosto ? '…' : 'Agregar'}</button>
              </div>
            </div>}

            {step === 4 && <div>
              <h2 className="text-xl font-bold">Metas y presupuesto inicial</h2>
              <p className="mt-1 text-sm text-slate-500">Dos números y Ferova One calcula tu punto de equilibrio y te deja el presupuesto del mes ya vivo.</p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Sueldo base deseado (COP / mes)</span><input className={inputClass} type="number" min="0" value={salario} onChange={(e) => setSalario(e.target.value)} placeholder="Lo que quieres poder pagarte" /></label>
                  <HelpNote>Lo que quieres poder pagarte cada mes. Entra al equilibrio como un costo más: si no te pagas, el negocio no está en equilibrio.</HelpNote>
                </div>
                <div>
                  <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Meta de ventas (COP / mes)</span><input className={inputClass} type="number" min="0" value={metaVentas} onChange={(e) => setMetaVentas(e.target.value)} placeholder="Cuánto necesitas o proyectas facturar" /></label>
                  <HelpNote>Cuánto necesitas facturar al mes para cubrir costos fijos y sueldo. Si no lo sabes, pon lo que facturas hoy: el equilibrio te dirá si alcanza.</HelpNote>
                </div>
              </div>
              {modules.finance && (
                <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <input type="checkbox" checked={crearPresupuesto} onChange={(e) => setCrearPresupuesto(e.target.checked)} className="mt-1 h-4 w-4 accent-amber-500" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">¿Quieres que Ferova cree tu presupuesto mensual inicial?</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-600">
                      Con los {costos.length} costo(s) fijo(s) del paso anterior{Number(salario) > 0 ? ' y tu sueldo' : ''}, se crea el presupuesto de {periodoActual()} en Finanzas operativas: {costos.length + (Number(salario) > 0 ? 1 : 0)} línea(s), COP {fmt(totalCostos + (Number(salario) || 0))} en total. Lo editas cuando quieras.
                    </span>
                  </span>
                </label>
              )}
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Resumen</p>
                <ul className="mt-2 space-y-1 text-xs">
                  <li>· {form.nombre_negocio || 'Tu empresa'} · {form.tipo_negocio || 'modelo sin definir'}</li>
                  <li>· {servicios.length} servicio(s) · {clientes.length} cliente(s) · {costos.length} costo(s) fijo(s) por COP {fmt(totalCostos)} / mes</li>
                  <li>· Al entrar, el Copiloto te muestra el tablero en un recorrido de 5 estaciones. Puedes saltarlo.</li>
                </ul>
              </div>
            </div>}

            <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
              <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-0"><ArrowLeft className="h-4 w-4" />Atrás</button>
              {step < lastStep ? (
                <div className="flex items-center gap-3">
                  {step > 0 && step !== 2 && <span className="text-xs text-slate-400">Puedes completarlo después</span>}
                  <button type="button" onClick={() => setStep((value) => value + 1)} disabled={!canContinue} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
                    Continuar<ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={finish} disabled={saving || !identityValid} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Entrar a Ferova One'}</button>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
