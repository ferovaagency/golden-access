import { useEffect, useState } from 'react';
import { Building2, Loader2, Network, Plus, Share2 } from 'lucide-react';
import {
  listMyOrganizations, createOrganization, setOrganizationSharing,
  type Organization,
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
            El fundador de cada empresa entra con su propio correo y sólo ve lo suyo. No lo agregues al
            equipo interno de Ferova: eso le daría acceso al CRM comercial y a la memoria compartida.
          </p>
        </>
      )}
    </section>
  );
}
