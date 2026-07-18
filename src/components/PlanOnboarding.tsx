import React, { useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Sparkles } from 'lucide-react';
import type { BusinessProfile } from '../lib/businessProfileService';
import { upsertBusinessProfile } from '../lib/businessProfileService';
import type { ModuleFlags, PlanId } from '../lib/planService';

interface Props {
  user: User;
  plan: PlanId;
  modules: ModuleFlags;
  profile: BusinessProfile | null;
  onDone: (profile: BusinessProfile) => void;
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const planNames: Record<string, string> = {
  projects: 'Proyectos', finance: 'Finanzas', financiero: 'Finanzas', planner: 'Planner', crm: 'Ventas', crm_ventas: 'Ventas', completo: 'Todo incluido', custom: 'Personalizado',
};

export default function PlanOnboarding({ user, plan, modules, profile, onDone }: Props) {
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

  const setupItems = useMemo(() => {
    const items = [
      { area: 'Base', title: 'Crea tu primer proyecto', detail: 'Los clientes, tareas, horas y resultados se relacionan desde un proyecto.' },
    ];
    if (modules.finance) items.push(
      { area: 'Finanzas', title: 'Configura cuentas y métodos de pago', detail: 'Registra banco, efectivo, tarjetas y deudas para calcular la caja real.' },
      { area: 'Finanzas', title: 'Conecta tu Google Sheet', detail: 'El respaldo opcional conserva enlaces de comprobantes y estados financieros.' },
    );
    if (modules.planner) items.push(
      { area: 'Planner', title: 'Define tu horario y primera tarea', detail: 'Podrás crear recurrencias, fechas de entrega y bloques protegidos.' },
      { area: 'Planner', title: 'Conecta Google Calendar', detail: 'Autoriza Calendar para sincronizar tareas y eventos.' },
    );
    if (modules.crm) items.push(
      { area: 'Ventas', title: 'Define servicios y canales de adquisición', detail: 'Tu pipeline medirá de dónde llega cada oportunidad y quién comisiona.' },
      { area: 'Ventas', title: 'Crea la primera oportunidad', detail: 'Registra el contacto, necesidad, valor y siguiente acción.' },
    );
    return items;
  }, [modules]);

  const valid = form.nombre_negocio.trim() && form.industria.trim() && form.tipo_negocio.trim() && form.tamano_equipo.trim();

  const finish = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const saved = await upsertBusinessProfile(user.id, { ...form, onboarding_completado: true });
      localStorage.removeItem(`ferova.product-tour.${user.id}`);
      onDone(saved);
    } catch (error: any) {
      alert(`No pudimos guardar la configuración: ${error?.message || error}`);
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
            <p className="mt-3 text-sm leading-6 text-slate-300">Plan {planNames[plan] || plan}. Sólo verás los pasos y módulos que tienes activos.</p>
            <ol className="mt-8 space-y-4 text-sm">
              {['Identidad del negocio', 'Configuración recomendada', 'Recorrido por la plataforma'].map((label, index) => <li key={label} className={`flex items-center gap-3 ${step >= index ? 'text-white' : 'text-slate-500'}`}>{step > index ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5" />} {label}</li>)}
            </ol>
          </aside>
          <section className="p-5 sm:p-8 lg:p-10">
            {step === 0 && <div>
              <h2 className="text-xl font-bold">Cuéntanos lo esencial</h2>
              <p className="mt-1 text-sm text-slate-500">Esto personaliza los reportes y el contexto del asistente. No depende de inteligencia artificial.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Nombre comercial" required value={form.nombre_negocio} onChange={(value) => setForm({ ...form, nombre_negocio: value })} />
                <Field label="Industria o sector" required value={form.industria} onChange={(value) => setForm({ ...form, industria: value })} />
                <Field label="Tipo de negocio" required value={form.tipo_negocio} onChange={(value) => setForm({ ...form, tipo_negocio: value })} placeholder="Ej. agencia, consultoría, ecommerce" />
                <Field label="Tamaño del equipo" required value={form.tamano_equipo} onChange={(value) => setForm({ ...form, tamano_equipo: value })} placeholder="Ej. 1, 2–5, 6–20" />
                <Field label="Ciudad" value={form.ciudad} onChange={(value) => setForm({ ...form, ciudad: value })} />
                <Field label="Teléfono de contacto" value={form.telefono_contacto} onChange={(value) => setForm({ ...form, telefono_contacto: value })} />
              </div>
            </div>}
            {step === 1 && <div>
              <h2 className="text-xl font-bold">Tu lista de configuración</h2>
              <p className="mt-1 text-sm text-slate-500">La recorreremos dentro de la plataforma. Puedes completar cada punto en el orden que prefieras.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">{setupItems.map((item) => <article key={`${item.area}-${item.title}`} className="rounded-2xl border border-slate-200 p-4"><span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">{item.area}</span><h3 className="mt-3 text-sm font-bold">{item.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p></article>)}</div>
            </div>}
            {step === 2 && <div className="flex min-h-[380px] flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-8 w-8" /></div>
              <h2 className="mt-5 text-2xl font-bold">Todo listo para empezar</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Al entrar verás un recorrido corto por Inicio, Proyectos y los módulos incluidos en tu plan. Podrás cerrarlo cuando quieras.</p>
            </div>}
            <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
              <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-0"><ArrowLeft className="h-4 w-4" />Atrás</button>
              {step < 2 ? <button type="button" onClick={() => setStep((value) => value + 1)} disabled={step === 0 && !valid} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">Continuar<ArrowRight className="h-4 w-4" /></button> : <button type="button" onClick={finish} disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Entrar a Ferova One'}</button>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}{required && <span className="text-red-500"> *</span>}</span><input className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} /></label>;
}
