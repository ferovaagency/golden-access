import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Loader2, Save } from 'lucide-react';
import { BusinessProfile, upsertBusinessProfile } from '../lib/businessProfileService';

interface Props {
  userId: string;
  profile: BusinessProfile | null;
  onUpdated: (profile: BusinessProfile) => void;
}

const DIAS = [
  { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' }, { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' }, { value: 5, label: 'Vie' }, { value: 6, label: 'Sáb' }, { value: 0, label: 'Dom' },
];

const ZONAS_HORARIAS = [
  ['America/Bogota', 'Colombia · Bogotá (UTC−5)'],
  ['America/Mexico_City', 'México · Ciudad de México'],
  ['America/Lima', 'Perú · Lima (UTC−5)'],
  ['America/Guayaquil', 'Ecuador · Quito / Guayaquil (UTC−5)'],
  ['America/Caracas', 'Venezuela · Caracas (UTC−4)'],
  ['America/Santiago', 'Chile · Santiago'],
  ['America/Argentina/Buenos_Aires', 'Argentina · Buenos Aires (UTC−3)'],
  ['America/Sao_Paulo', 'Brasil · São Paulo (UTC−3)'],
  ['Europe/Madrid', 'España · Madrid'],
  ['America/New_York', 'EE. UU. · Nueva York'],
  ['America/Los_Angeles', 'EE. UU. · Los Ángeles'],
] as const;

const emptyForm = {
  nombre_negocio: '', industria: '', tipo_negocio: '', tamano_equipo: '', ciudad: '', telefono_contacto: '',
  dias_laborales: [1, 2, 3, 4, 5] as number[], horario_inicio: '08:00', horario_fin: '18:00', zona_horaria: 'America/Bogota',
};

export default function BusinessProfileSettings({ userId, profile, onUpdated }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      nombre_negocio: profile?.nombre_negocio || '', industria: profile?.industria || '',
      tipo_negocio: profile?.tipo_negocio || '', tamano_equipo: profile?.tamano_equipo || '',
      ciudad: profile?.ciudad || '', telefono_contacto: profile?.telefono_contacto || '',
      dias_laborales: profile?.dias_laborales?.length ? profile.dias_laborales : [1, 2, 3, 4, 5],
      horario_inicio: profile?.horario_inicio || '08:00', horario_fin: profile?.horario_fin || '18:00',
      zona_horaria: profile?.zona_horaria || 'America/Bogota',
    });
  }, [profile]);

  const update = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setNotice(null);
  };

  const toggleDia = (dia: number) => {
    setForm((current) => ({
      ...current,
      dias_laborales: current.dias_laborales.includes(dia)
        ? current.dias_laborales.filter((d) => d !== dia)
        : [...current.dias_laborales, dia].sort(),
    }));
    setNotice(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.nombre_negocio.trim()) { setNotice('Ingresa el nombre comercial del negocio.'); return; }
    setSaving(true); setNotice(null);
    try {
      const saved = await upsertBusinessProfile(userId, { ...form, nombre_negocio: form.nombre_negocio.trim() });
      onUpdated(saved);
      setNotice('Perfil comercial actualizado. El nombre ya aparece en la cabecera.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message.replace('[businessProfileService] upsertBusinessProfile: ', '') : 'No se pudo guardar el perfil comercial.');
    } finally { setSaving(false); }
  };

  const fieldClass = 'mt-1.5 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white';
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Building2 className="h-5 w-5" /></div>
        <div><h3 className="text-sm font-semibold text-slate-900">Identidad del negocio</h3><p className="mt-0.5 text-xs text-slate-500">Personaliza el nombre comercial y el contexto que utiliza Ferova One.</p></div>
      </div>
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-medium text-slate-600">Nombre comercial<input value={form.nombre_negocio} onChange={(e) => update('nombre_negocio', e.target.value)} required maxLength={120} placeholder="Ej. SEO para Ecommerce" className={fieldClass} /></label>
        <label className="text-xs font-medium text-slate-600">Industria o sector<input value={form.industria} onChange={(e) => update('industria', e.target.value)} maxLength={120} placeholder="Ej. Marketing digital" className={fieldClass} /></label>
        <label className="text-xs font-medium text-slate-600">Tipo de negocio<input value={form.tipo_negocio} onChange={(e) => update('tipo_negocio', e.target.value)} maxLength={120} placeholder="Ej. Agencia B2B" className={fieldClass} /></label>
        <label className="text-xs font-medium text-slate-600">Tamaño del equipo<input value={form.tamano_equipo} onChange={(e) => update('tamano_equipo', e.target.value)} maxLength={80} placeholder="Ej. 1–5 personas" className={fieldClass} /></label>
        <label className="text-xs font-medium text-slate-600">Ciudad<input value={form.ciudad} onChange={(e) => update('ciudad', e.target.value)} maxLength={100} placeholder="Ej. Bogotá" className={fieldClass} /></label>
        <label className="text-xs font-medium text-slate-600">Teléfono de contacto<input type="tel" value={form.telefono_contacto} onChange={(e) => update('telefono_contacto', e.target.value)} maxLength={40} placeholder="Ej. +57 300 000 0000" className={fieldClass} /></label>
        <div className="sm:col-span-2 lg:col-span-3">
          <p className="text-xs font-medium text-slate-600">Días laborales</p>
          <p className="mt-0.5 text-[11px] text-slate-400">El Planner y el asistente usan esto para agendar y reprogramar dentro de tu horario real.</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {DIAS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDia(d.value)}
                className={`min-h-9 rounded-lg border px-3 text-xs font-semibold transition ${
                  form.dias_laborales.includes(d.value)
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <label className="text-xs font-medium text-slate-600">Horario de inicio<input type="time" value={form.horario_inicio} onChange={(e) => update('horario_inicio', e.target.value)} className={fieldClass} /></label>
        <label className="text-xs font-medium text-slate-600">Horario de fin<input type="time" value={form.horario_fin} onChange={(e) => update('horario_fin', e.target.value)} className={fieldClass} /></label>
        <label className="text-xs font-medium text-slate-600 sm:col-span-2 lg:col-span-1">Zona horaria<select value={form.zona_horaria} onChange={(e) => update('zona_horaria', e.target.value)} className={fieldClass}>{!ZONAS_HORARIAS.some(([value]) => value === form.zona_horaria) && <option value={form.zona_horaria}>{form.zona_horaria}</option>}{ZONAS_HORARIAS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><div className="mt-1.5 flex items-center justify-between gap-2"><span className="text-[10px] text-slate-400">El Planner programa y muestra las horas en esta zona.</span><button type="button" onClick={() => update('zona_horaria', Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota')} className="shrink-0 text-[10px] font-semibold text-blue-700 hover:text-blue-900">Usar mi zona automática</button></div></label>
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between lg:col-span-3">
          <div aria-live="polite" className="min-h-5 text-xs text-slate-600">{notice && <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{notice}</span>}</div>
          <button disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar identidad</button>
        </div>
      </form>
    </section>
  );
}
