-- Fase 2 (corrección) — invitar por correo a alguien que YA tiene cuenta.
--
-- EL FALLO
-- `create_organization(..., p_invite_email => 'socio@…')` dejaba la empresa con
-- `data_user_id = null` y confiaba en `handle_new_user_team` para enlazarla. Pero
-- ese trigger sólo se dispara CUANDO ALGUIEN SE REGISTRA. Si la persona invitada
-- ya tenía cuenta —el caso normal cuando montas el holding con socios que ya
-- usan la plataforma— el enlace no ocurría nunca: la empresa quedaba vacía para
-- siempre, sin ningún error, y el holding no veía sus datos.
--
-- Detectado con datos reales: las dos empresas invitadas del holding apuntaban a
-- cuentas registradas un mes ANTES de la invitación.
--
-- El arreglo enlaza en el momento de crear, y deja el trigger para el otro caso
-- (invitar a alguien que todavía no se ha registrado), que sigue funcionando.

create or replace function public.create_organization(
  p_nombre               text,
  p_parent_org_id        uuid    default null,
  p_invite_email         text    default null,
  p_vincular_mi_cuenta   boolean default false,
  p_comparte_por_defecto boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_invitado uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'La organización necesita un nombre'; end if;
  if p_parent_org_id is not null and not public.can_admin_org(p_parent_org_id) then
    raise exception 'Sin permiso sobre la organización padre';
  end if;
  if p_vincular_mi_cuenta and p_invite_email is not null then
    raise exception 'Una organización se vincula a tu cuenta o invita a otra, no ambas';
  end if;

  insert into public.organizations (nombre, parent_org_id, data_user_id, invite_email, comparte_por_defecto, created_by)
  values (trim(p_nombre), p_parent_org_id,
          case when p_vincular_mi_cuenta then auth.uid() else null end,
          nullif(lower(trim(p_invite_email)), ''), p_comparte_por_defecto, auth.uid())
  returning id into v_id;

  insert into public.organization_members (org_id, user_id, rol)
  values (v_id, auth.uid(), 'owner') on conflict do nothing;

  if p_invite_email is not null then
    select u.id into v_invitado
      from auth.users u
     where lower(u.email) = lower(trim(p_invite_email))
     limit 1;

    -- Sólo si esa cuenta no es ya los datos de otra organización: una cuenta
    -- pertenece a una sola empresa (índice único sobre data_user_id).
    if v_invitado is not null
       and not exists (select 1 from public.organizations o where o.data_user_id = v_invitado) then
      update public.organizations set data_user_id = v_invitado where id = v_id;
      insert into public.organization_members (org_id, user_id, rol)
      values (v_id, v_invitado, 'owner') on conflict do nothing;
    end if;
  end if;

  return v_id;
end; $$;

revoke all on function public.create_organization(text, uuid, text, boolean, boolean) from public, anon;
grant execute on function public.create_organization(text, uuid, text, boolean, boolean) to authenticated, service_role;

-- Enlace de las invitaciones que quedaron colgadas antes de este arreglo.
-- Idempotente: no toca las que ya están enlazadas ni las de cuentas que ya son
-- los datos de otra empresa.
with pendientes as (
  select o.id as org_id, u.id as invitado
    from public.organizations o
    join auth.users u on lower(u.email) = lower(o.invite_email)
   where o.invite_email is not null
     and o.data_user_id is null
     and not exists (select 1 from public.organizations o2 where o2.data_user_id = u.id)
),
enlazadas as (
  update public.organizations o set data_user_id = p.invitado
    from pendientes p where o.id = p.org_id
  returning o.id, o.data_user_id
)
insert into public.organization_members (org_id, user_id, rol)
select id, data_user_id, 'owner' from enlazadas
on conflict do nothing;
