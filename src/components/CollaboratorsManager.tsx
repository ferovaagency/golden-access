import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, ShieldCheck, ChevronDown, ChevronRight } from 'lucide-react';
import {
  listCollaborators, upsertCollaborator, deleteCollaborator,
  PERMISSION_MODULES, type Collaborator, type PermisosMap,
} from '../lib/collaboratorsService';
import { useToast, errMsg } from './ui/toast';

function countAllowed(permisos: PermisosMap): { ver: number; editar: number } {
  let ver = 0, editar = 0;
  for (const p of Object.values(permisos || {})) { if (p?.view) ver++; if (p?.edit) editar++; }
  return { ver, editar };
}

export default function CollaboratorsManager() {
  const { success: toastOk, error: toastErr } = useToast();
  const [items, setItems] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newNombre, setNewNombre] = useState('');

  const reload = () => { setLoading(true); listCollaborators().then(setItems).catch((e) => toastErr(`No se pudieron cargar los colaboradores: ${errMsg(e)}`)).finally(() => setLoading(false)); };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const addCollaborator = async () => {
    if (!newEmail.trim()) { toastErr('Escribe el email del colaborador.'); return; }
    setSaving(true);
    try {
      await upsertCollaborator({ email: newEmail, nombre: newNombre || null, permisos: {} });
      setNewEmail(''); setNewNombre('');
      toastOk('Colaborador agregado. Ahora asígnale permisos.');
      reload();
    } catch (e: any) { toastErr(`No se pudo agregar: ${errMsg(e)}`); } finally { setSaving(false); }
  };

  const setPerm = async (c: Collaborator, tabId: string, kind: 'view' | 'edit', value: boolean) => {
    const current = c.permisos[tabId] || { view: false, edit: false };
    const next = { ...current };
    if (kind === 'view') { next.view = value; if (!value) next.edit = false; }
    else { next.edit = value; if (value) next.view = true; }
    const permisos = { ...c.permisos, [tabId]: next };
    // Optimista + persistir.
    setItems((prev) => prev.map((x) => x.id === c.id ? { ...x, permisos } : x));
    try { await upsertCollaborator({ id: c.id, email: c.email, nombre: c.nombre, permisos, activo: c.activo }); }
    catch (e: any) { toastErr(`No se pudo guardar el permiso: ${errMsg(e)}`); reload(); }
  };

  const removeCollaborator = async (c: Collaborator) => {
    if (!confirm(`¿Quitar el acceso de ${c.email}?`)) return;
    try { await deleteCollaborator(c.id); setItems((prev) => prev.filter((x) => x.id !== c.id)); toastOk('Colaborador eliminado.'); }
    catch (e: any) { toastErr(`No se pudo eliminar: ${errMsg(e)}`); }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-700"><ShieldCheck className="h-4 w-4" /></span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Colaboradores y permisos</h3>
          <p className="text-[11px] text-slate-500">Agrega personas de tu equipo y define qué pestañas puede <b>ver</b> y <b>editar</b> cada una. Comparten los datos del negocio.</p>
        </div>
      </div>

      {/* Alta */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1fr_auto]">
        <input className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Email del colaborador" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <input className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Nombre (opcional)" value={newNombre} onChange={(e) => setNewNombre(e.target.value)} />
        <button onClick={addCollaborator} disabled={saving} className="inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Agregar</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /></div>
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">Aún no hay colaboradores. Agrega el primero arriba con su email.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => {
            const open = expandedId === c.id;
            const { ver, editar } = countAllowed(c.permisos);
            return (
              <li key={c.id} className="rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 p-3">
                  <button onClick={() => setExpandedId(open ? null : c.id)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{c.nombre || c.email}</p>
                    <p className="truncate text-[11px] text-slate-500">{c.email} · ve {ver} · edita {editar}</p>
                  </div>
                  <button onClick={() => removeCollaborator(c)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600" title="Quitar acceso"><Trash2 className="h-4 w-4" /></button>
                </div>
                {open && (
                  <div className="border-t border-slate-100 p-3">
                    {PERMISSION_MODULES.map((mod) => (
                      <div key={mod.group} className="mb-3 last:mb-0">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{mod.group}</p>
                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                          {mod.tabs.map((t) => {
                            const p = c.permisos[t.id] || { view: false, edit: false };
                            return (
                              <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5">
                                <span className="truncate text-xs text-slate-700">{t.label}</span>
                                <div className="flex shrink-0 items-center gap-3 text-[11px]">
                                  <label className="inline-flex items-center gap-1 text-slate-600"><input type="checkbox" checked={p.view} onChange={(e) => setPerm(c, t.id, 'view', e.target.checked)} className="h-3.5 w-3.5 accent-blue-600" /> Ver</label>
                                  <label className="inline-flex items-center gap-1 text-slate-600"><input type="checkbox" checked={p.edit} onChange={(e) => setPerm(c, t.id, 'edit', e.target.checked)} className="h-3.5 w-3.5 accent-blue-600" /> Editar</label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <p className="mt-1 text-[10px] text-slate-400">"Editar" activa "Ver" automáticamente. Los cambios se guardan solos.</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
