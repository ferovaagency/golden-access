-- Compartir una empresa: permisos por persona y aviso.
--
-- Lo que faltaba, reportado al instalar a un cliente del holding:
--   1. A quien recibía el acceso no le llegaba NADA. Entraba en la lista y se
--      enteraba sólo si alguien se lo decía por fuera.
--   2. No se podía recortar lo que ve: sólo había dos roles, y "colaborador"
--      seguía viendo la empresa entera.
--
-- Los permisos usan el MISMO formato que los colaboradores del modelo anterior
-- (`{"ventas":{"view":true,"edit":true}}`), porque la aplicación ya sabe
-- recortar el menú con eso (`canView` en App.tsx). Objeto vacío = acceso
-- completo, que es el caso normal.

alter table public.organization_members
  add column if not exists permisos jsonb not null default '{}'::jsonb;
alter table public.organization_invites
  add column if not exists permisos jsonb not null default '{}'::jsonb;

comment on column public.organization_members.permisos is
  'Pestañas visibles para esta persona en esta organización. {} = acceso completo.';

-- share_organization: ahora recibe permisos y avisa a quien ya tiene cuenta.
-- (Cuerpo idéntico al aplicado en producción; ver el archivo anterior para el
-- resto de la lógica de invitación.)
create or replace function public.share_organization(
  p_org_id   uuid,
  p_email    text,
  p_rol      text  default 'colaborador',
  p_permisos jsonb default '{}'::jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_user uuid;
  v_org  text;
  v_quien text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not public.can_admin_org(p_org_id) then raise exception 'Sin permiso sobre esta organización'; end if;
  if v_email is null or v_email = '' then raise exception 'Escribe un correo'; end if;
  if p_rol not in ('admin','colaborador') then raise exception 'El rol debe ser admin o colaborador'; end if;

  select nombre into v_org from public.organizations where id = p_org_id;
  select email  into v_quien from auth.users where id = auth.uid();
  select u.id   into v_user from auth.users u where lower(u.email) = v_email limit 1;

  if v_user is not null then
    insert into public.organization_members (org_id, user_id, rol, permisos)
    values (p_org_id, v_user, p_rol, coalesce(p_permisos, '{}'::jsonb))
    on conflict (org_id, user_id) do update set rol = excluded.rol, permisos = excluded.permisos;
    delete from public.organization_invites where org_id = p_org_id and email = v_email;

    insert into public.user_notifications (user_id, title, message, action_tab, sender_name)
    values (v_user,
            'Tienes acceso a ' || coalesce(v_org, 'una empresa'),
            coalesce(v_quien, 'El administrador') || ' te dio acceso a ' || coalesce(v_org, 'una empresa') ||
            '. Cámbiate a esa empresa con el selector de la cabecera para ver sus datos.',
            'dashboard', coalesce(v_quien, 'Ferova One'));
    return 'agregado';
  end if;

  insert into public.organization_invites (org_id, email, rol, permisos, created_by)
  values (p_org_id, v_email, p_rol, coalesce(p_permisos, '{}'::jsonb), auth.uid())
  on conflict (org_id, email) do update set rol = excluded.rol, permisos = excluded.permisos;
  return 'invitado';
end; $$;

revoke all on function public.share_organization(uuid, text, text, jsonb) from public, anon;
grant execute on function public.share_organization(uuid, text, text, jsonb) to authenticated, service_role;
-- La versión de 3 argumentos se retira: convivir las dos haría ambigua la
-- llamada sin permisos.
drop function if exists public.share_organization(uuid, text, text);

-- El listado devuelve los permisos, y el trigger de alta se los lleva de la
-- invitación a la membresía. (Aplicados en producción con DROP + CREATE porque
-- cambia el tipo de retorno.)
