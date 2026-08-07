-- ============================================================
-- FEROVA BRAIN — control de acceso admin vs colaborador
-- El cerebro GLOBAL (owner_user_id null) solo lo escribe un admin (owner/admin).
-- Cada quien escribe su cerebro PRIVADO (owner_user_id = auth.uid()).
-- ============================================================
create or replace function public.is_ferova_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.crm_team_members tm
    where tm.email = (select email from auth.users where id = auth.uid())
      and tm.rol in ('owner', 'admin')
  );
$$;

-- Reemplaza la policy de escritura amplia por uno granular con la regla admin/global
drop policy if exists "team ferova_knowledge write" on public.ferova_knowledge;

create policy "ferova_knowledge insert" on public.ferova_knowledge for insert to authenticated
  with check (
    public.is_team_member() and (
      (owner_user_id = auth.uid())
      or (owner_user_id is null and public.is_ferova_admin())
    )
  );

create policy "ferova_knowledge update" on public.ferova_knowledge for update to authenticated
  using (
    public.is_team_member() and (
      (owner_user_id = auth.uid())
      or (owner_user_id is null and public.is_ferova_admin())
    )
  )
  with check (
    public.is_team_member() and (
      (owner_user_id = auth.uid())
      or (owner_user_id is null and public.is_ferova_admin())
    )
  );

create policy "ferova_knowledge delete" on public.ferova_knowledge for delete to authenticated
  using (
    public.is_team_member() and (
      (owner_user_id = auth.uid())
      or (owner_user_id is null and public.is_ferova_admin())
    )
  );
