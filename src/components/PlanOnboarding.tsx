import React, { useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, HelpCircle, Sparkles } from 'lucide-react';
import type { BusinessProfile } from '../lib/businessProfileService';
import { upsertBusinessProfile } from '../lib/businessProfileService';
import type { ModuleFlags, PlanId } from '../lib/planService';
import type { AppData, Cliente, Config, OtroGasto, Servicio } from '../types';
import { useToast, errMsg } from './ui/toast';

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
  projects: 'Proyectos', finance: 'Finanzas', financiero: 'Finanzas', planner: 'Planner', crm: 'Ventas', crm_ventas: 'Ventas', completo: 'Todo incluido', custom: 'Personalizado',
};

const INDUSTRIAS = ['Marketing digital', 'Desarrollo de software', 'Ecommerce', 'Consultoría', 'Diseño / Creativo', 'Educación', 'Salud', 'Inmobiliaria'];
const TIPOS_NEGOCIO = ['Agencia', 'Freelance / independiente', 'Consultoría', 'SaaS', 'Ecommerce', 'Servicios profesionales'];
const EQUIPOS = ['Solo yo', '2–5 personas', '6–20 personas', 'Más de 20'];

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
      <input
        className={`${inputClass} mt-2`}
        placeholder="Otro (escribe el tuyo)"
        value={isCustom ? value : ''}
        onChange={(e) => onChange(e.target.value)}
      />
      <HelpNote>{help}</HelpNote>
    </div>
  );
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

  // Paso "primer cliente y servicio" -- opcional, se puede saltar y hacerlo
  // después desde Clientes/Servicios. addedClient/addedService evitan
  // duplicar si la persona ya los guardó y vuelve a este paso.
  const [cliNombre, setCliNombre] = useState('');
  const [cliTipo, setCliTipo] = useState<'Nacional' | 'Internacional'>('Nacional');
  const [cliObjetivo, setCliObjetivo] = useState('');
  const [addedClient, setAddedClient] = useState(false);
  const [savingClient, setSavingClient] = useState(false);

  const [srvNombre, setSrvNombre] = useState('');
  const [srvCosto, setSrvCosto] = useState('');
  const [addedService, setAddedService] = useState(false);
  const [savingService, setSavingService] = useState(false);

  // Paso "metas financieras" -- solo si el plan incluye Finanzas.
  const [salario, setSalario] = useState(String(appData.config.salario_propuesto || ''));
  const [metaVentas, setMetaVentas] = useState(String(appData.config.meta_ventas_mensual || ''));
  const [savingMetas, setSavingMetas] = useState(false);
  const [metasSaved, setMetasSaved] = useState(false);

  const [costoNombre, setCostoNombre] = useState('');
  const [costoMonto, setCostoMonto] = useState('');
  const [addedCosto, setAddedCosto] = useState(false);
  const [savingCosto, setSavingCosto] = useState(false);

  const steps = useMemo(() => {
    const list = ['Identidad del negocio', 'Tu primer cliente y servicio'];
    if (modules.finance) list.push('Metas y costos');
    list.push('Configuración restante');
    return list;
  }, [modules.finance]);

  const setupItems = useMemo(() => {
    const items: Array<{ area: string; title: string; detail: string }> = [];
    if (modules.finance) items.push(
      { area: 'Finanzas', title: 'Configura cuentas y métodos de pago', detail: 'Registra banco, efectivo, tarjetas y deudas para calcular la caja real.' },
      { area: 'Finanzas', title: 'Conecta tu Google Sheet', detail: 'El respaldo opcional conserva enlaces de comprobantes y estados financieros.' },
    );
    if (modules.planner) items.push(
      { area: 'Planner', title: 'Revisa tu horario de trabajo', detail: 'Ya lo configuraste en el paso 1 -- ajústalo cuando quieras desde Ajustes.' },
      { area: 'Planner', title: 'Conecta Google Calendar', detail: 'Autoriza Calendar para sincronizar tareas y eventos.' },
    );
    if (modules.crm) items.push(
      { area: 'Ventas', title: 'Define canales de adquisición', detail: 'Tu pipeline medirá de dónde llega cada oportunidad y quién comisiona.' },
      { area: 'Ventas', title: 'Crea la primera oportunidad', detail: 'Registra el contacto, necesidad, valor y siguiente acción.' },
    );
    return items;
  }, [modules]);

  const identityValid = form.nombre_negocio.trim() && form.industria.trim() && form.tipo_negocio.trim() && form.tamano_equipo.trim();
  const financeStepIndex = modules.finance ? 2 : -1;
  const lastStep = steps.length - 1;

  const handleAddClient = async () => {
    if (!cliNombre.trim()) return;
    setSavingClient(true);
    try {
      const newClient: Cliente = {
        id: `cli_${Date.now().toString().slice(-6)}`,
        nombre: cliNombre.trim(),
        tipo: cliTipo,
        declarante: cliTipo === 'Nacional',
        activo: true,
        fecha_creacion: new Date().toISOString().slice(0, 10),
        objetivos: cliObjetivo.trim() || undefined,
      };
      await onSaveClientes([...appData.clientes, newClient]);
      setAddedClient(true);
      toastOk(`Cliente "${newClient.nombre}" creado.`);
    } catch (err: any) {
      toastErr(`No se pudo guardar el cliente: ${errMsg(err)}`);
    } finally {
      setSavingClient(false);
    }
  };

  const handleAddService = async () => {
    if (!srvNombre.trim() || !srvCosto.trim()) return;
    setSavingService(true);
    try {
      const newService: Servicio = {
        id: `srv_${Date.now().toString().slice(-6)}`,
        nombre: srvNombre.trim(),
        costo_unitario: Number(srvCosto) || 0,
        descripcion: `Línea de servicio general para ${srvNombre.trim()}`,
      };
      await onSaveServicios([...appData.servicios, newService]);
      setAddedService(true);
      toastOk(`Servicio "${newService.nombre}" creado.`);
    } catch (err: any) {
      toastErr(`No se pudo guardar el servicio: ${errMsg(err)}`);
    } finally {
      setSavingService(false);
    }
  };

  const handleSaveMetas = async () => {
    setSavingMetas(true);
    try {
      await onSaveConfig({ salario_propuesto: Number(salario) || 0, meta_ventas_mensual: Number(metaVentas) || 0 });
      setMetasSaved(true);
      toastOk('Metas financieras guardadas.');
    } catch (err: any) {
      toastErr(`No se pudieron guardar las metas: ${errMsg(err)}`);
    } finally {
      setSavingMetas(false);
    }
  };

  const handleAddCosto = async () => {
    if (!costoNombre.trim() || !costoMonto.trim()) return;
    setSavingCosto(true);
    try {
      const newCosto: OtroGasto = {
        id: `gasto_${Date.now().toString().slice(-6)}`,
        nombre: costoNombre.trim(),
        monto: Number(costoMonto) || 0,
        moneda: 'COP',
        categoria: 'Operativo',
      };
      await onSaveOtrosGastos([...appData.otrosGastos, newCosto]);
      setAddedCosto(true);
      toastOk(`Costo "${newCosto.nombre}" registrado.`);
    } catch (err: any) {
      toastErr(`No se pudo guardar el costo: ${errMsg(err)}`);
    } finally {
      setSavingCosto(false);
    }
  };

  const finish = async () => {
    if (!identityValid) return;
    setSaving(true);
    try {
      const saved = await upsertBusinessProfile(user.id, { ...form, onboarding_completado: true });
      localStorage.removeItem(`ferova.product-tour.${user.id}`);
      onDone(saved);
    } catch (error: any) {
      toastErr(`No pudimos guardar la configuración: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
        <div className="grid lg:grid-cols-[300px_1fr]">
          <aside className="bg-slate-950 p-6 text-white sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600"><Sparkles className="h-5 w-5" /></div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Ferova One</p>
            <h1 className="mt-2 text-2xl font-bold">Tu espacio, listo para tu plan</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">Plan {planNames[plan] || plan}. Puedes saltar cualquier paso opcional y completarlo después.</p>
            <ol className="mt-8 space-y-4 text-sm">
              {steps.map((label, index) => <li key={label} className={`flex items-center gap-3 ${step >= index ? 'text-white' : 'text-slate-500'}`}>{step > index ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5" />} {label}</li>)}
            </ol>
          </aside>
          <section className="p-5 sm:p-8 lg:p-10">
            {step === 0 && <div>
              <h2 className="text-xl font-bold">Cuéntanos lo esencial</h2>
              <p className="mt-1 text-sm text-slate-500">Esto personaliza los reportes y el contexto del asistente de IA. No depende de inteligencia artificial -- son datos que tú das.</p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Nombre comercial<span className="text-red-500"> *</span></span><input className={inputClass} value={form.nombre_negocio} onChange={(e) => setForm({ ...form, nombre_negocio: e.target.value })} /></label>
                  <HelpNote>El nombre con el que te conocen tus clientes. Aparece en reportes y en la cabecera de la app.</HelpNote>
                </div>
                <ChipPicker label="Industria o sector" required value={form.industria} onChange={(v) => setForm({ ...form, industria: v })} options={INDUSTRIAS} help="A qué te dedicas. La IA lo usa para dar contexto más preciso en sugerencias y respuestas." />
                <ChipPicker label="Tipo de negocio" required value={form.tipo_negocio} onChange={(v) => setForm({ ...form, tipo_negocio: v })} options={TIPOS_NEGOCIO} help="Tu modelo de negocio -- agencia, freelance, SaaS, etc. Ajusta cómo se calculan métricas como el equilibrio por servicio." />
                <ChipPicker label="Tamaño del equipo" required value={form.tamano_equipo} onChange={(v) => setForm({ ...form, tamano_equipo: v })} options={EQUIPOS} help="Cuántas personas trabajan contigo. Solo informativo por ahora, no cambia ningún cálculo." />
                <div>
                  <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Ciudad</span><input className={inputClass} value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} /></label>
                </div>
                <div>
                  <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Teléfono de contacto</span><input className={inputClass} value={form.telefono_contacto} onChange={(e) => setForm({ ...form, telefono_contacto: e.target.value })} /></label>
                </div>
              </div>
            </div>}

            {step === 1 && <div>
              <h2 className="text-xl font-bold">Tu primer cliente y servicio</h2>
              <p className="mt-1 text-sm text-slate-500">Opcional, pero te ahorra el primer viaje a Clientes y Servicios. Puedes saltarlo y agregarlos después.</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-slate-900">Cliente</h3>
                  <HelpNote>Un cliente es cualquier persona o empresa a la que le facturas o le llevas un proyecto. "Objetivo" es la meta de ese proyecto en concreto (ej. "duplicar tráfico orgánico en 3 meses").</HelpNote>
                  {addedClient ? (
                    <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Cliente creado.</p>
                  ) : (
                    <div className="mt-3 space-y-2.5">
                      <input className={inputClass} placeholder="Nombre del cliente" value={cliNombre} onChange={(e) => setCliNombre(e.target.value)} />
                      <div className="flex gap-2">
                        {(['Nacional', 'Internacional'] as const).map((t) => (
                          <button key={t} type="button" onClick={() => setCliTipo(t)} className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold ${cliTipo === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'}`}>{t}</button>
                        ))}
                      </div>
                      <input className={inputClass} placeholder="Objetivo del proyecto (opcional)" value={cliObjetivo} onChange={(e) => setCliObjetivo(e.target.value)} />
                      <button type="button" onClick={handleAddClient} disabled={!cliNombre.trim() || savingClient} className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{savingClient ? 'Guardando…' : 'Crear cliente'}</button>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-slate-900">Servicio</h3>
                  <HelpNote>Lo que vendes como línea de producto (ej. "SEO mensual"). El costo unitario es cuánto te cuesta a ti entregarlo -- se usa para calcular tu margen real, no lo que le cobras al cliente.</HelpNote>
                  {addedService ? (
                    <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Servicio creado.</p>
                  ) : (
                    <div className="mt-3 space-y-2.5">
                      <input className={inputClass} placeholder="Nombre del servicio" value={srvNombre} onChange={(e) => setSrvNombre(e.target.value)} />
                      <input className={inputClass} type="number" min="0" placeholder="Costo unitario (COP) -- lo que te cuesta entregarlo" value={srvCosto} onChange={(e) => setSrvCosto(e.target.value)} />
                      <button type="button" onClick={handleAddService} disabled={!srvNombre.trim() || !srvCosto.trim() || savingService} className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{savingService ? 'Guardando…' : 'Crear servicio'}</button>
                    </div>
                  )}
                </div>
              </div>
            </div>}

            {step === financeStepIndex && <div>
              <h2 className="text-xl font-bold">Metas y costos</h2>
              <p className="mt-1 text-sm text-slate-500">La base de todos los cálculos financieros de Ferova One. Opcional, pero sin esto el equilibrio y las proyecciones parten de valores genéricos.</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-slate-900">Metas del negocio</h3>
                  <HelpNote>Sueldo base deseado: lo que quieres poder pagarte cada mes. Cuota de ventas: cuánto necesitas facturar al mes para cubrir ese sueldo más gastos. Ferova One usa estos dos números para calcular tu punto de equilibrio.</HelpNote>
                  {metasSaved ? (
                    <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Metas guardadas.</p>
                  ) : (
                    <div className="mt-3 space-y-2.5">
                      <input className={inputClass} type="number" min="0" placeholder="Sueldo base deseado (COP/mes)" value={salario} onChange={(e) => setSalario(e.target.value)} />
                      <input className={inputClass} type="number" min="0" placeholder="Cuota de ventas objetivo (COP/mes)" value={metaVentas} onChange={(e) => setMetaVentas(e.target.value)} />
                      <button type="button" onClick={handleSaveMetas} disabled={!salario.trim() || !metaVentas.trim() || savingMetas} className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{savingMetas ? 'Guardando…' : 'Guardar metas'}</button>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-slate-900">Tu primer costo fijo</h3>
                  <HelpNote>Gastos que pagas todos los meses sin importar cuánto vendas (arriendo, herramientas, un colaborador). Con esto Ferova One puede calcular tu equilibrio real, no uno teórico.</HelpNote>
                  {addedCosto ? (
                    <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Costo registrado.</p>
                  ) : (
                    <div className="mt-3 space-y-2.5">
                      <input className={inputClass} placeholder="Ej. Arriendo, SEMrush, Contador" value={costoNombre} onChange={(e) => setCostoNombre(e.target.value)} />
                      <input className={inputClass} type="number" min="0" placeholder="Monto mensual (COP)" value={costoMonto} onChange={(e) => setCostoMonto(e.target.value)} />
                      <button type="button" onClick={handleAddCosto} disabled={!costoNombre.trim() || !costoMonto.trim() || savingCosto} className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{savingCosto ? 'Guardando…' : 'Registrar costo'}</button>
                    </div>
                  )}
                </div>
              </div>
            </div>}

            {step === lastStep && step !== 0 && <div>
              <h2 className="text-xl font-bold">Lo que queda por configurar</h2>
              <p className="mt-1 text-sm text-slate-500">Ya cubriste lo básico. Esto lo recorrerás dentro de la plataforma, en el orden que prefieras.</p>
              {setupItems.length > 0 ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">{setupItems.map((item) => <article key={`${item.area}-${item.title}`} className="rounded-2xl border border-slate-200 p-4"><span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">{item.area}</span><h3 className="mt-3 text-sm font-bold">{item.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p></article>)}</div>
              ) : (
                <div className="mt-6 flex min-h-[200px] flex-col items-center justify-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-8 w-8" /></div>
                  <h3 className="mt-5 text-xl font-bold">Todo listo para empezar</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Al entrar verás un recorrido corto por Inicio y los módulos incluidos en tu plan. Podrás cerrarlo cuando quieras.</p>
                </div>
              )}
            </div>}

            <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
              <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-0"><ArrowLeft className="h-4 w-4" />Atrás</button>
              {step < lastStep ? (
                <div className="flex items-center gap-3">
                  {step > 0 && <span className="text-xs text-slate-400">Puedes saltar este paso y volver luego</span>}
                  <button type="button" onClick={() => setStep((value) => value + 1)} disabled={step === 0 && !identityValid} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
                    {step > 0 ? 'Continuar / saltar' : 'Continuar'}<ArrowRight className="h-4 w-4" />
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
