import { useEffect, useState } from 'react';
import { Loader2, Plus, Shield, Users, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast, errMsg } from './ui/toast';
import type { FeatureEstado } from '../lib/features';

// Administración → Funciones: qué funciones nuevas ve quién. Interno (equipo),
// Beta (equipo + correos), Publicado (todos, con plan mínimo opcional). Cada
// cambio de estado queda en la bitácora con motivo y autor.

interface Flag { key: string; nombre: string; descripcion: string | null; estado: FeatureEstado; plan_minimo: 'basico' | 'intermedio' | 'full' | null; updated_at: string; updated_by: string | null }
interface FlagUser { flag_key: string; email: string; added_at: string }
interface Change { id: number; flag_key: string; de: string | null; a: string; motivo: string | null; por: string | null; created_at: string }

const ESTADOS: Array<{ id: FeatureEstado; label: string; hint: string; tone: string }> = [
  { id: 'interno', label: 'Interno', hint: 'Solo el equipo Ferova', tone: 'border-slate-300 bg-slate-100 text-slate-700' },
  { id: 'beta', label: 'Beta', hint: 'Equipo + correos elegidos', tone: 'border-amber-300 bg-amber-50 text-amber-800' },
  { id: 'publicado', label: 'Publicado', hint: 'Todos los usuarios (según plan)', tone: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
];

function fecha(iso: string) { return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }

export default function AdminFeatures() {
  const { success: toastOk, error: toastErr } = useToast();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [users, setUsers] = useState<FlagUser[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState({ key: '', nombre: '', descripcion: '' });
  const [emailPorFlag, setEmailPorFlag] = useState<Record<string, string>>({});

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('admin-set-feature', { body });
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error(data?.message || 'No fue posible aplicar el cambio.');
    setFlags(data.flags); setUsers(data.users); setChanges(data.changes);
  };

  useEffect(() => {
    call({ action: 'list' }).catch((e) => toastErr(errMsg(e))).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setEstado = async (flag: Flag, estado: FeatureEstado) => {
    if (estado === flag.estado) return;
    let motivo: string | null = null;
    if (estado === 'publicado') {
      motivo = window.prompt(`Vas a publicar "${flag.nombre}" para todos los usuarios. Escribe el motivo (queda en la bitácora):`, '');
      if (motivo === null) return;
    }
    setBusy(flag.key);
    try { await call({ action: 'set', key: flag.key, estado, motivo: motivo || undefined }); toastOk(`${flag.nombre}: ${estado}.`); }
    catch (e) { toastErr(errMsg(e)); }
    finally { setBusy(null); }
  };

  const setPlan = async (flag: Flag, plan_minimo: Flag['plan_minimo']) => {
    setBusy(flag.key);
    try { await call({ action: 'set', key: flag.key, plan_minimo }); }
    catch (e) { toastErr(errMsg(e)); }
    finally { setBusy(null); }
  };

  const crear = async () => {
    if (!nuevo.key.trim() || !nuevo.nombre.trim()) return;
    setBusy('__new');
    try { await call({ action: 'create', key: nuevo.key.trim(), nombre: nuevo.nombre.trim(), descripcion: nuevo.descripcion.trim() || undefined }); setNuevo({ key: '', nombre: '', descripcion: '' }); toastOk('Función creada en estado Interno.'); }
    catch (e) { toastErr(errMsg(e)); }
    finally { setBusy(null); }
  };

  const addUser = async (key: string) => {
    const email = (emailPorFlag[key] || '').trim();
    if (!email) return;
    setBusy(key);
    try { await call({ action: 'add_user', key, email }); setEmailPorFlag((m) => ({ ...m, [key]: '' })); }
    catch (e) { toastErr(errMsg(e)); }
    finally { setBusy(null); }
  };

  const removeUser = async (key: string, email: string) => {
    setBusy(key);
    try { await call({ action: 'remove_user', key, email }); }
    catch (e) { toastErr(errMsg(e)); }
    finally { setBusy(null); }
  };

  if (loading) return <div className="p-10 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-slate-900"><Shield className="h-5 w-5 text-blue-600" /> Funciones</h2>
        <p className="mt-1 text-sm text-slate-500">Lo nuevo nace <strong>Interno</strong> (solo tú lo ves), pasa a <strong>Beta</strong> con los correos que elijas y se <strong>publica</strong> cuando decidas. Aplica al instante, sin deploy.</p>
      </div>

      <div className="grid gap-4">
        {flags.map((f) => {
          const beta = users.filter((u) => u.flag_key === f.key);
          const estado = ESTADOS.find((e) => e.id === f.estado)!;
          return (
            <section key={f.key} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{f.nombre}</h3>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{f.key}</code>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${estado.tone}`}>{estado.label}</span>
                  </div>
                  {f.descripcion && <p className="mt-1 text-sm text-slate-500">{f.descripcion}</p>}
                  <p className="mt-1 text-[11px] text-slate-400">Último cambio: {fecha(f.updated_at)}{f.updated_by ? ` · ${f.updated_by}` : ''}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
                    {ESTADOS.map((e) => (
                      <button key={e.id} type="button" disabled={busy === f.key} title={e.hint} onClick={() => setEstado(f, e.id)} className={`rounded-lg px-3 py-1.5 ${f.estado === e.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'} disabled:opacity-60`}>{e.label}</button>
                    ))}
                  </div>
                  <label className="text-[11px] text-slate-500">Plan mínimo al publicar
                    <select value={f.plan_minimo ?? ''} disabled={busy === f.key} onChange={(e) => setPlan(f, (e.target.value || null) as Flag['plan_minimo'])} className="ml-2 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-800">
                      <option value="">Todos los planes</option>
                      <option value="basico">Básico o superior</option>
                      <option value="intermedio">Intermedio o superior</option>
                      <option value="full">Solo Full</option>
                    </select>
                  </label>
                </div>
              </div>

              {f.estado === 'beta' && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800"><Users className="h-3.5 w-3.5" /> Correos en beta ({beta.length})</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {beta.map((u) => (
                      <span key={u.email} className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[11px] text-amber-900">{u.email}<button type="button" onClick={() => removeUser(f.key, u.email)} aria-label={`Quitar ${u.email}`} className="text-amber-600 hover:text-red-600"><X className="h-3 w-3" /></button></span>
                    ))}
                    {beta.length === 0 && <span className="text-[11px] text-amber-700">Nadie todavía: solo el equipo la ve.</span>}
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); void addUser(f.key); }} className="mt-2 flex gap-2">
                    <input type="email" value={emailPorFlag[f.key] || ''} onChange={(e) => setEmailPorFlag((m) => ({ ...m, [f.key]: e.target.value }))} placeholder="correo@ejemplo.com" className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs" />
                    <button type="submit" disabled={busy === f.key} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60">Agregar</button>
                  </form>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <section className="rounded-2xl border border-dashed border-slate-300 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Plus className="h-4 w-4" /> Registrar una función nueva</h3>
        <p className="mt-1 text-xs text-slate-500">La llave es la que usa el código (`useFeature('llave')`). Nace en Interno.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_1fr_auto]">
          <input value={nuevo.key} onChange={(e) => setNuevo({ ...nuevo, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} placeholder="llave_interna" className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" />
          <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre visible" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} placeholder="Qué hace (opcional)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <button type="button" onClick={crear} disabled={busy === '__new' || !nuevo.key || !nuevo.nombre} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">Crear</button>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-800">Bitácora de cambios</h3>
        {changes.length === 0 ? <p className="mt-1 text-xs text-slate-400">Sin cambios todavía.</p> : (
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-xs">
            {changes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="text-slate-400">{fecha(c.created_at)}</span>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">{c.flag_key}</code>
                <span className="text-slate-700">{c.de ?? '—'} → <strong>{c.a}</strong></span>
                {c.motivo && <span className="text-slate-500">· {c.motivo}</span>}
                {c.por && <span className="ml-auto text-slate-400">{c.por}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
