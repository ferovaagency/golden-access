import { db } from './db';
import { supabase } from './supabase';

// Colaboradores del negocio con permiso fino por pestaña (ver / editar).
// Comparten los datos del dueño (owner_user_id). RLS: el dueño administra;
// cada colaborador puede leer su propia fila para conocer sus permisos.

export interface TabPermission { view: boolean; edit: boolean }
export type PermisosMap = Record<string, TabPermission>;

export interface Collaborator {
  id: string;
  email: string;
  nombre: string | null;
  permisos: PermisosMap;
  activo: boolean;
}

/** Catálogo de módulos y sus pestañas para asignar permisos. */
export const PERMISSION_MODULES: Array<{ group: string; tabs: Array<{ id: string; label: string }> }> = [
  { group: 'Inicio', tabs: [{ id: 'dashboard', label: 'Resumen / Inicio' }] },
  { group: 'Finanzas', tabs: [
    { id: 'ventas', label: 'Ingresos / Ventas' },
    { id: 'pagosEgresos', label: 'Pagos y egresos' },
    { id: 'gastos', label: 'Gastos fijos' },
    { id: 'finops', label: 'Finanzas operativas' },
    { id: 'iva', label: 'IVA' },
    { id: 'alertas', label: 'Alertas' },
    { id: 'equilibrioGlobal', label: 'Equilibrio global' },
    { id: 'equilibrioServicio', label: 'Equilibrio por servicio' },
    { id: 'servicios', label: 'Servicios' },
    { id: 'clientes', label: 'Clientes' },
    { id: 'horas', label: 'Horas' },
    { id: 'marketingRoi', label: 'Marketing ROI' },
  ] },
  { group: 'Proyectos', tabs: [{ id: 'proyectos', label: 'Proyectos y seguimiento' }] },
  { group: 'Planner', tabs: [{ id: 'planner', label: 'Planner' }] },
  { group: 'Ventas / CRM', tabs: [
    { id: 'crm-pipeline', label: 'Pipeline / CRM' },
    { id: 'crm-citas', label: 'Citas' },
    { id: 'ventas-crm', label: 'CRM del cliente' },
  ] },
  { group: 'Dirección', tabs: [
    { id: 'reports', label: 'Reportes CEO' },
    { id: 'memoria', label: 'Memoria' },
    { id: 'ajustes', label: 'Configuración' },
  ] },
];

export const ALL_PERMISSION_TABS = PERMISSION_MODULES.flatMap((m) => m.tabs.map((t) => t.id));

type Row = { id: string; email: string; nombre: string | null; permisos: PermisosMap | null; activo: boolean };

export async function listCollaborators(): Promise<Collaborator[]> {
  const { data, error } = await db<Row>('collaborators')
    .select('id, email, nombre, permisos, activo')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`[collaboratorsService] list: ${error.message}`);
  return (data ?? []).map((r) => ({ ...r, permisos: r.permisos || {} }));
}

export async function upsertCollaborator(input: { id?: string; email: string; nombre?: string | null; permisos: PermisosMap; activo?: boolean }): Promise<void> {
  const payload: Record<string, unknown> = {
    email: input.email.trim().toLowerCase(),
    nombre: input.nombre || null,
    permisos: input.permisos,
    activo: input.activo ?? true,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { error } = await db('collaborators').update(payload).eq('id', input.id);
    if (error) throw new Error(`[collaboratorsService] update: ${error.message}`);
  } else {
    const { error } = await db('collaborators').upsert(payload, { onConflict: 'owner_user_id,email' });
    if (error) throw new Error(`[collaboratorsService] insert: ${error.message}`);
  }
}

export async function deleteCollaborator(id: string): Promise<void> {
  const { error } = await db('collaborators').delete().eq('id', id);
  if (error) throw new Error(`[collaboratorsService] delete: ${error.message}`);
}

export interface CollaboratorContext { ownerUserId: string; permisos: PermisosMap }

/**
 * Contexto del usuario actual como colaborador: a qué dueño pertenece y qué
 * puede ver/editar. Devuelve null si NO es colaborador (p. ej. el dueño, que ve
 * todo con su propia cuenta). Se usa para recortar la navegación y para cargar
 * los datos del negocio del dueño.
 */
export async function getMyCollaboratorContext(): Promise<CollaboratorContext | null> {
  const { data: userData } = await supabase.auth.getUser();
  const email = userData?.user?.email;
  if (!email) return null;
  const { data, error } = await db<Row & { owner_user_id: string }>('collaborators')
    .select('owner_user_id, permisos, activo, email')
    .ilike('email', email)
    .maybeSingle();
  if (error || !data || !data.activo) return null;
  return { ownerUserId: data.owner_user_id, permisos: data.permisos || {} };
}
