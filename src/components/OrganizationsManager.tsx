import { useEffect, useState } from 'react';
import { Building2, Loader2, Network, Plus, Share2, UserPlus, X } from 'lucide-react';
import {
  listMyOrganizations, createOrganization, setOrganizationSharing,
  listOrganizationMembers, shareOrganization, revokeOrganizationMember, cancelOrganizationInvite,
  type Organization, type OrganizationMember,
} from '../lib/organizationsService';
import { useToast, errMsg } from './ui/toast';

// Alta y gobierno del árbol de organizaciones: un holding contenedor y sus
// empresas. Cada empresa es una cuenta aislada; el holding las ve todas.
// Ver docs/DISENO_ORGANIZACIONES.md.

export default function OrganizationsManager() {
  const { success: toastOk, error: toastErr } = useToast();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Alta inicial del holding.
  const [holdingNombre, setHoldingNombre] = useState('');
  const [propiaNombre, setPropiaNombre] = useState('');
  // Alta de una empresa dentro del holding.
  const [empresaNombre, setEmpresaNombre] = useState('');
  const [empresaEmail, setEmpresaEmail] = useState('');

  const reload = () => {
    setLoading(true);
    listMyOrganizations()
      .then(setOrgs)
      .catch((e) => toastErr(`No se pudieron cargar las organizaciones: ${errMsg(e)}`))
      .finally(() => setLoading(false));
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const holding = orgs.find((o) => !o.parentOrgId && orgs.some((h) => h.parentOrgId === o.id))
    ?? orgs.find((o) => !o.parentOrgId && !o.dataUserId);
  const empresas = holding ? orgs.filter((o) => o.parentOrgId === holding.id) : [];

  const crearHolding = async () => {
    if (!holdingNombre.trim() || !propiaNombre.trim()) {
      toastErr('Escribe el nombre del holding y el de tu empresa.');
      return;
    }
    setSaving(true);
    try {
      // El holding es contenedor: no tiene datos propios. Tu empresa sí, y
      // queda vinculada a tu cuenta actual.
      const holdingId = await createOrganization({ nombre: holdingNombre, compartePorDefecto: true });
      await createOrganization({
        nombre: propiaNombre,
        parentOrgId: holdingId,
        vincularMiCuenta: true,
        compartePorDefecto: true,
      });
      setHoldingNombre(''); setPropiaNombre('');
      toastOk('Holding creado. Ya puedes añadir las demás empresas.');
      reload();
    } catch (e: any) { toastErr(`No se pudo crear: ${errMsg(e)}`); } finally { setSaving(false); }
  };

  const agregarEmpresa = async () => {
    if (!holding) return;
    if (!empresaNombre.trim()) { toastErr('Escribe el nombre de la empresa.'); return; }
    if (!empresaEmail.trim()) { toastErr('Escribe el correo del fundador: es lo que enlaza su cuenta.'); return; }
    setSaving(true);
    try {
      await createOrganization({
        nombre: empresaNombre,
        parentOrgId: holding.id,
        inviteEmail: empresaEmail,
      });
      setEmpresaNombre(''); setEmpresaEmail('');
      toastOk('Empresa añadida. Se enlazará cuando su fundador se registre con ese correo.');
      reload();
    } catch (e: any) { toastErr(`No se pudo añadir: ${errMsg(e)}`); } finally { setSaving(false); }
  };

  // --- Personas con acceso a una empresa ---
  const [gestionando, setGestionando] = useState<Organization | null>(null);
  const [miembros, setMiembros] = useState<OrganizationMember[] | null>(null);
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoRol, setNuevoRol] = useState<'admin' | 'colaborador'>('colaborador');

  const abrirPersonas = async (org: Organization) => {
    setGestionando(org); setMiembros(null); setNuevoEmail('');
    try { setMiembros(await listOrganizationMembers(org.id)); }
    catch (e: any) { toastErr(`No se pudo cargar quién tiene acceso: ${errMsg(e)}`); }
  };

  const compartir = async () => {
    if (!gestionando || !nuevoEmail.trim()) { toastErr('Escribe el correo de la persona.'); return; }
    setSaving(true);
    try {
      const resultado = await shareOrganization(gestionando.id, nuevoEmail, nuevoRol);
      toastOk(resultado === 'agregado'
        ? 'Listo: ya puede entrar a esta empresa desde su selector.'
        : 'Invitación guardada: entrará sola cuando se registre con ese correo.');
      setNuevoEmail('');
      setMiembros(await listOrganizationMembers(gestionando.id));
    } catch (e: any) { toastErr(`No se pudo compartir: ${errMsg(e)}`); } finally { setSaving(false); }
  };

  const quitarAcceso = async (m: OrganizationMember) => {
    if (!gestionando) return;
    try {
      if (m.userId) await revokeOrganizationMember(gestionando.id, m.userId);
      else await cancelOrganizationInvite(gestionando.id, m.email);
      setMiembros(await listOrganizationMembers(gestionando.id));
    } catch (e: any) { toastErr(`No se pudo quitar: ${errMsg(e)}`); }
  };

  const toggleCompartir = async (org: Organization) => {
    const next = !org.compartePorDefecto;
    setOrgs((prev) => prev.map((o) => o.id === org.id ? { ...o, compartePorDefecto: next } : o));
    try { await setOrganizationSharing(org.id, next); }
    catch (e: any) { toastErr(`No se pudo cambiar: ${errMsg(e)}`); reload(); }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-700"><Network className="h-4 w-4" /></span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Holding y empresas</h3>
          <p className="text-xs text-slate-500">
            Cada empresa es una cuenta aparte y sus datos no se cruzan. Desde el holding las ves todas.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
        </div>
      ) : !holding ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-4">
          <p className="mb-3 text-xs text-slate-600">
            Todavía no hay holding. Se crean dos cosas: el holding, que no tiene datos propios y sirve
            para ver el conjunto, y tu empresa, que queda vinculada a esta cuenta con todo lo que ya tienes.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={holdingNombre}
              onChange={(e) => setHoldingNombre(e.target.value)}
              placeholder="Nombre del holding"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              value={propiaNombre}
              onChange={(e) => setPropiaNombre(e.target.value)}
              placeholder="Tu empresa (p. ej. Ferova)"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
            />
          </div>
          <button
            onClick={crearHolding}
            disabled={saving}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Crear el holding
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
              <Network className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs font-semibold text-slate-900">{holding.nombre}</span>
              <span className="text-[10px] text-slate-400">holding</span>
            </div>
            {empresas.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-500">Aún no hay empresas dentro del holding.</p>
            ) : empresas.map((o) => (
              <div key={o.id} className="flex items-center gap-3 border-b border-slate-100 px-3 py-2.5 last:border-b-0">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-900">{o.nombre}</span>
                  <span className="block text-[10px] text-slate-400">
                    {o.dataUserId
                      ? 'Cuenta activa'
                      : o.inviteEmail
                        ? `Invitación enviada a ${o.inviteEmail} — se enlaza al registrarse`
                        : 'Sin cuenta vinculada'}
                  </span>
                </span>
                <button
                  onClick={() => abrirPersonas(o)}
                  title="Dar acceso a esta empresa a otras personas"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  <UserPlus className="h-3 w-3" /> Personas
                </button>
                <button
                  onClick={() => toggleCompartir(o)}
                  title="Si está activo, lo que se escriba en esta empresa alimenta el cerebro del holding por defecto"
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-medium transition ${
                    o.compartePorDefecto
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <Share2 className="h-3 w-3" />
                  {o.compartePorDefecto ? 'Comparte con el holding' : 'No comparte'}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              value={empresaNombre}
              onChange={(e) => setEmpresaNombre(e.target.value)}
              placeholder="Nombre de la empresa"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              value={empresaEmail}
              onChange={(e) => setEmpresaEmail(e.target.value)}
              placeholder="Correo de su fundador"
              type="email"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
            />
          </div>
          <button
            onClick={agregarEmpresa}
            disabled={saving}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Añadir empresa
          </button>

          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            El fundador de cada empresa entra con su propio correo y sólo ve lo suyo. Con "Personas" le
            das acceso a alguien más. No lo agregues al equipo interno de Ferova: eso le daría acceso al
            CRM comercial y a la memoria compartida.
          </p>

          {gestionando && (
            <div
              className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-3"
              role="dialog" aria-modal="true" aria-label={`Personas con acceso a ${gestionando.nombre}`}
              onClick={(e) => { if (e.target === e.currentTarget) setGestionando(null); }}
            >
              <div className="my-8 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Quién puede entrar a {gestionando.nombre}</p>
                    <p className="text-[11px] text-slate-500">
                      Estas personas verán esta empresa en su selector, con sus datos. No verán las demás
                      empresas del holding.
                    </p>
                  </div>
                  <button type="button" onClick={() => setGestionando(null)} aria-label="Cerrar" className="text-slate-500 hover:text-slate-900"><X className="h-4 w-4" /></button>
                </div>

                {miembros === null ? (
                  <div className="flex items-center gap-2 py-4 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…</div>
                ) : (
                  <ul className="mb-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {miembros.length === 0 && <li className="px-3 py-3 text-xs text-slate-500">Todavía nadie más.</li>}
                    {miembros.map((m) => (
                      <li key={`${m.email}-${m.estado}`} className="flex items-center gap-2 px-3 py-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs text-slate-800">{m.email}</span>
                          <span className="block text-[10px] text-slate-400">
                            {m.rol === 'owner' ? 'Dueño' : m.rol === 'admin' ? 'Administra la empresa' : 'Ve y trabaja en la empresa'}
                            {m.estado === 'invitado' && ' · pendiente de registrarse'}
                          </span>
                        </span>
                        {m.rol !== 'owner' && (
                          <button
                            onClick={() => quitarAcceso(m)}
                            className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            Quitar
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input
                    value={nuevoEmail}
                    onChange={(e) => setNuevoEmail(e.target.value)}
                    placeholder="Correo de la persona"
                    type="email"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                  <select
                    value={nuevoRol}
                    onChange={(e) => setNuevoRol(e.target.value as 'admin' | 'colaborador')}
                    aria-label="Rol"
                    className="rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-700"
                  >
                    <option value="colaborador">Trabaja en la empresa</option>
                    <option value="admin">La administra</option>
                  </select>
                  <button
                    onClick={compartir}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Dar acceso
                  </button>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                  Si la persona todavía no tiene cuenta, queda invitada y entra sola al registrarse con ese
                  correo. "La administra" además le deja dar acceso a otros.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
