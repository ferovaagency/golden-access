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

  const [orgs, colabs] = await Promise.all([
    listMyOrganizations(),
    listMyCollaborations(),
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

  // 2. Empresas de las que manda por jerarquía (el holding sobre sus hijas).
  for (const org of orgs) {
    if (!org.dataUserId || org.dataUserId === user.id) continue;
    options.push({
      key: `org:${org.id}`,
      nombre: org.nombre,
      accountId: org.dataUserId,
      kind: 'organizacion',
      orgId: org.id,
      permisos: null,
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

  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_KEY) : null;
  const active = options.find((o) => o.key === stored) ?? options[0];

  const holdings = orgs.filter((o) => !o.dataUserId && orgs.some((h) => h.parentOrgId === o.id));
  const empresas = orgs.filter((o) => o.parentOrgId && holdings.some((h) => h.id === o.parentOrgId));

  return { options, active, holdings, empresas };
}

export function rememberActiveWorkspace(key: string): void {
  try { localStorage.setItem(ACTIVE_KEY, key); } catch { /* almacenamiento no disponible */ }
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
