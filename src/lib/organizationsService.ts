import { db } from './db';
import { supabase } from './supabase';
import type { PermisosMap } from './collaboratorsService';

// Organizaciones: holding (padre) + empresas (hijas). Ver
// docs/DISENO_ORGANIZACIONES.md.
//
// Este módulo resuelve UNA pregunta: sobre los datos de qué cuenta está
// trabajando la persona ahora mismo. El resto de la aplicación ya está
// parametrizado por esa cuenta (`accountId` en App.tsx), así que cambiar de
// empresa es cambiar esta respuesta.

export interface Organization {
  id: string;
  nombre: string;
  parentOrgId: string | null;
  /** Cuenta cuyos datos son los de esta organización. null = contenedora
   *  (el holding) o empresa cuyo fundador aún no se ha registrado. */
  dataUserId: string | null;
  inviteEmail: string | null;
  compartePorDefecto: boolean;
}

type OrgRow = {
  id: string;
  nombre: string;
  parent_org_id: string | null;
  data_user_id: string | null;
  invite_email: string | null;
  comparte_por_defecto: boolean;
};

const toOrg = (r: OrgRow): Organization => ({
  id: r.id,
  nombre: r.nombre,
  parentOrgId: r.parent_org_id,
  dataUserId: r.data_user_id,
  inviteEmail: r.invite_email,
  compartePorDefecto: !!r.comparte_por_defecto,
});

/** Organizaciones visibles para quien consulta. La RLS ya recorta: el holding
 *  ve las suyas y sus descendientes; un fundador ve sólo la propia. */
export async function listMyOrganizations(): Promise<Organization[]> {
  const { data, error } = await db<OrgRow>('organizations')
    .select('id, nombre, parent_org_id, data_user_id, invite_email, comparte_por_defecto')
    .order('created_at', { ascending: true });
  // Antes de aplicar la migración la tabla no existe: no es un error de uso,
  // la aplicación sigue funcionando en modo de una sola cuenta.
  if (error) return [];
  return (data ?? []).map(toOrg);
}

export async function createOrganization(input: {
  nombre: string;
  parentOrgId?: string | null;
  inviteEmail?: string | null;
  vincularMiCuenta?: boolean;
  compartePorDefecto?: boolean;
}): Promise<string> {
  // Cast único: los tipos generados de Supabase todavía no conocen esta función
  // (se regeneran tras aplicar la migración). Igual criterio que db().
  //
  // Se invoca como método sobre el cliente a propósito: extraer `supabase.rpc`
  // a una variable pierde el `this` y revienta dentro de supabase-js con
  // "Cannot read properties of undefined (reading 'rest')".
  const client = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: string | null; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc('create_organization', {
    p_nombre: input.nombre,
    p_parent_org_id: input.parentOrgId ?? null,
    p_invite_email: input.inviteEmail ?? null,
    p_vincular_mi_cuenta: input.vincularMiCuenta ?? false,
    p_comparte_por_defecto: input.compartePorDefecto ?? false,
  });
  if (error) throw new Error(`[organizationsService] create: ${error.message}`);
  if (!data) throw new Error('[organizationsService] create: la organización no devolvió id');
  return data;
}

// --- Personas con acceso a una organización ---------------------------------

export interface OrganizationMember {
  userId: string | null;
  email: string;
  rol: 'owner' | 'admin' | 'colaborador';
  /** `invitado` = todavía no tiene cuenta; entra sola al registrarse. */
  estado: 'activo' | 'invitado';
  /** Pestañas que puede ver. Vacío = acceso completo. */
  permisos: PermisosMap;
}

/** Cliente tipado laxo para las RPC: los tipos generados no conocen estas
 *  funciones hasta que Lovable los regenera. Se invoca como método sobre el
 *  cliente a propósito (extraer `supabase.rpc` pierde el `this`). */
function rpc<T>(fn: string, args: Record<string, unknown>) {
  const client = supabase as unknown as {
    rpc: (name: string, params: Record<string, unknown>) => PromiseLike<{ data: T | null; error: { message: string } | null }>;
  };
  return client.rpc(fn, args);
}

export async function listOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
  const { data, error } = await rpc<Array<{ user_id: string | null; email: string; rol: string; estado: string; permisos: PermisosMap | null }>>(
    'list_organization_members', { p_org_id: orgId },
  );
  if (error) throw new Error(`[organizationsService] miembros: ${error.message}`);
  return (data ?? []).map((r) => ({
    userId: r.user_id,
    email: r.email,
    rol: r.rol as OrganizationMember['rol'],
    estado: r.estado as OrganizationMember['estado'],
    permisos: r.permisos || {},
  }));
}

/** Da acceso a una persona. Si ya tiene cuenta entra de inmediato (y recibe un
 *  aviso en la campana); si no, queda invitada y entra sola cuando se registre
 *  con ese correo. `permisos` vacío = acceso completo a la empresa. */
export async function shareOrganization(
  orgId: string,
  email: string,
  rol: 'admin' | 'colaborador',
  permisos: PermisosMap = {},
): Promise<'agregado' | 'invitado'> {
  const { data, error } = await rpc<string>('share_organization', { p_org_id: orgId, p_email: email, p_rol: rol, p_permisos: permisos });
  if (error) throw new Error(error.message);
  return (data as 'agregado' | 'invitado') ?? 'invitado';
}

export async function revokeOrganizationMember(orgId: string, userId: string): Promise<void> {
  const { error } = await rpc<null>('revoke_organization_member', { p_org_id: orgId, p_user_id: userId });
  if (error) throw new Error(error.message);
}

export async function cancelOrganizationInvite(orgId: string, email: string): Promise<void> {
  const { error } = await db('organization_invites').delete().eq('org_id', orgId).eq('email', email.toLowerCase());
  if (error) throw new Error(`[organizationsService] invitación: ${error.message}`);
}

export async function setOrganizationSharing(orgId: string, comparte: boolean): Promise<void> {
  const { error } = await db('organizations')
    .update({ comparte_por_defecto: comparte })
    .eq('id', orgId);
  if (error) throw new Error(`[organizationsService] sharing: ${error.message}`);
}

// --- Espacio de trabajo activo ---------------------------------------------

export type WorkspaceKind = 'propia' | 'organizacion' | 'colaboracion';

export interface WorkspaceOption {
  /** Identificador estable para el selector. */
  key: string;
  nombre: string;
  /** Cuenta sobre cuyos datos se opera. Es el `accountId` de la aplicación. */
  accountId: string;
  kind: WorkspaceKind;
  orgId: string | null;
  /** null = acceso completo (dueño). Con valor = permisos por pestaña. */
  permisos: PermisosMap | null;
}

export interface WorkspaceContext {
  options: WorkspaceOption[];
  active: WorkspaceOption;
  /** Organizaciones contenedoras que la persona administra (el holding).
   *  No tienen datos propios: alimentan la vista consolidada. */
  holdings: Organization[];
  /** Empresas hijas de esos holdings, con o sin fundador registrado. */
  empresas: Organization[];
}

const ACTIVE_KEY = 'ferova.workspace.active';

/**
 * Resuelve todas las cuentas sobre las que puede trabajar esta persona y cuál
 * está activa. Sustituye a `getMyCollaboratorContext`, que asumía como máximo
 * una (`maybeSingle`) y por eso impedía llevar varios negocios con un login.
 */
export async function resolveWorkspaceContext(): Promise<WorkspaceContext | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return null;

  const [orgs, colabs, enServidor] = await Promise.all([
    listMyOrganizations(),
    listMyCollaborations(),
    readActiveWorkspace(),
  ]);

  const options: WorkspaceOption[] = [];
  const propia = orgs.find((o) => o.dataUserId === user.id);

  // 1. La cuenta propia, siempre primero. Si ya tiene organización, se muestra
  //    con su nombre real.
  options.push({
    key: 'propia',
    nombre: propia?.nombre || 'Mi negocio',
    accountId: user.id,
    kind: 'propia',
    orgId: propia?.id ?? null,
    permisos: null,
  });

  // 2. Empresas a las que se llega por la organización (el holding sobre sus
  //    hijas, o una empresa que alguien te compartió).
  //
  //    `permisos` sale de la membresía en ESA organización: quien te invita
  //    puede recortarle las pestañas a la persona. Vacío = acceso completo, que
  //    es también el caso del acceso heredado desde un ancestro (ahí no hay
  //    fila de membresía en la hija y no se recorta nada).
  const misMembresias = await listMyMemberships();
  for (const org of orgs) {
    if (!org.dataUserId || org.dataUserId === user.id) continue;
    const permisos = misMembresias.get(org.id);
    options.push({
      key: `org:${org.id}`,
      nombre: org.nombre,
      accountId: org.dataUserId,
      kind: 'organizacion',
      orgId: org.id,
      permisos: permisos && Object.keys(permisos).length ? permisos : null,
    });
  }

  // 3. Negocios donde es colaborador con permisos recortados.
  for (const c of colabs) {
    if (options.some((o) => o.accountId === c.ownerUserId)) continue;
    options.push({
      key: `colab:${c.ownerUserId}`,
      nombre: c.nombre || 'Negocio invitado',
      accountId: c.ownerUserId,
      kind: 'colaboracion',
      orgId: null,
      permisos: c.permisos,
    });
  }

  // Reconciliación entre el navegador y el servidor. Hacen falta las dos
  // fuentes y pueden discrepar: `localStorage` es de ESTE dispositivo y
  // `user_active_org` es lo que ve el asistente. Sin este paso, al recargar la
  // página la interfaz mostraba la empresa guardada aquí mientras el asistente
  // seguía respondiendo sobre la cuenta propia — la peor forma de fallar,
  // porque nada parece roto.
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_KEY) : null;
  const active =
    options.find((o) => o.key === stored)
    // Sin preferencia en este dispositivo, manda la del servidor: así entrar
    // desde otro navegador continúa en la misma empresa.
    ?? (enServidor.accountId ? options.find((o) => o.accountId === enServidor.accountId) : undefined)
    ?? options[0];

  if (stored !== active.key) {
    try { localStorage.setItem(ACTIVE_KEY, active.key); } catch { /* almacenamiento no disponible */ }
  }
  // Sólo se escribe si difiere: recargar la página no debe generar escrituras.
  const cuentaEnServidor = enServidor.accountId ?? user.id;
  if (cuentaEnServidor !== active.accountId) {
    void persistActiveWorkspace(active.orgId ?? null, active.accountId);
  }

  const holdings = orgs.filter((o) => !o.dataUserId && orgs.some((h) => h.parentOrgId === o.id));
  const empresas = orgs.filter((o) => o.parentOrgId && holdings.some((h) => h.id === o.parentOrgId));

  return { options, active, holdings, empresas };
}

/**
 * Recuerda la empresa activa en dos sitios, y los dos hacen falta:
 *
 * - `localStorage`: para que al recargar la página siga en la misma empresa sin
 *   esperar a la red.
 * - `user_active_org`: para que el SERVIDOR lo sepa. Las edge functions (el
 *   asistente, los informes, el cerebro) no pueden creerle a la petición sobre
 *   qué cuenta consultar —sería dejar que el cliente declare a qué datos
 *   accede—, así que lo leen de esta tabla vía `active_context_for_user`.
 */
export function rememberActiveWorkspace(key: string, orgId: string | null, accountId: string): void {
  try { localStorage.setItem(ACTIVE_KEY, key); } catch { /* almacenamiento no disponible */ }
  void persistActiveWorkspace(orgId, accountId);
}

/** El espacio de trabajo activo según el SERVIDOR: lo que decide qué filas
 *  devuelve la RLS y sobre qué responde el asistente. */
/** Mis membresías por organización, con sus permisos. La RLS de
 *  organization_members ya deja leer las filas propias. */
async function listMyMemberships(): Promise<Map<string, PermisosMap>> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return new Map();
  const { data, error } = await db<{ org_id: string; permisos: PermisosMap | null }>('organization_members')
    .select('org_id, permisos')
    .eq('user_id', uid);
  if (error) return new Map();
  return new Map((data ?? []).map((r) => [r.org_id, r.permisos || {}]));
}

async function readActiveWorkspace(): Promise<{ orgId: string | null; accountId: string | null }> {
  const { data, error } = await db<{ org_id: string | null; account_user_id: string | null }>('user_active_org')
    .select('org_id, account_user_id')
    .maybeSingle();
  // La RLS ya acota la fila a quien consulta; un error aquí (tabla ausente en
  // un despliegue viejo) no debe impedir que la aplicación arranque.
  if (error) return { orgId: null, accountId: null };
  return { orgId: data?.org_id ?? null, accountId: data?.account_user_id ?? null };
}

async function persistActiveWorkspace(orgId: string | null, accountId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return;
  // Trabajando en la cuenta propia se borra la fila: sin fila, el servidor
  // resuelve la cuenta propia, que es su valor por defecto.
  const { error } = accountId && accountId !== uid
    ? await db('user_active_org').upsert(
        { user_id: uid, org_id: orgId, account_user_id: accountId, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
    : await db('user_active_org').delete().eq('user_id', uid);
  // Que falle no debe romper el selector, pero sí hay que verlo: mientras no se
  // guarde, la interfaz muestra una empresa y el asistente responde por otra.
  if (error) console.error('[organizationsService] user_active_org', error.message);
}

interface Collaboration { ownerUserId: string; nombre: string | null; permisos: PermisosMap }

/** Todos los negocios donde la persona es colaboradora activa (puede ser más de
 *  uno; el código anterior asumía como máximo uno). */
async function listMyCollaborations(): Promise<Collaboration[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return [];
  // El filtro por user_id es imprescindible: el dueño de un negocio también lee
  // las filas de SUS colaboradores, y sin él se colaría como colaborador de sí
  // mismo.
  const { data, error } = await db<{ owner_user_id: string; nombre: string | null; permisos: PermisosMap | null; activo: boolean }>('collaborators')
    .select('owner_user_id, nombre, permisos, activo, user_id')
    .eq('user_id', uid);
  if (error) return [];
  return (data ?? [])
    .filter((r) => r.activo)
    .map((r) => ({ ownerUserId: r.owner_user_id, nombre: r.nombre, permisos: r.permisos || {} }));
}
