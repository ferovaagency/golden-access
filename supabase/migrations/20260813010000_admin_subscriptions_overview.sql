-- Fase 7 (precio) — Ferova One: resumen de suscripciones/MRR para el admin.
-- Métrica reina de un SaaS autofinanciado. Solo agregados; el service_role la
-- llama desde una edge function admin. No expone datos de clientes individuales.

create or replace function public.admin_subscriptions_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'generado_en', now(),
    'activos', (select count(*) from public.user_subscriptions where status = 'active'),
    'activos_pagos', (select count(*) from public.user_subscriptions
                      where status = 'active' and provider not in ('manual','courtesy')),
    'nuevos_mes', (select count(*) from public.user_subscriptions
                   where status = 'active' and provider not in ('manual','courtesy')
                     and created_at >= date_trunc('month', now())),
    'por_estado', coalesce((
      select jsonb_agg(e) from (
        select status, count(*) as n
        from public.user_subscriptions group by status order by n desc
      ) e), '[]'::jsonb),
    'por_proveedor', coalesce((
      select jsonb_agg(p) from (
        select provider, count(*) as n
        from public.user_subscriptions where status = 'active'
        group by provider order by n desc
      ) p), '[]'::jsonb)
  );
$$;

revoke all on function public.admin_subscriptions_overview() from anon, authenticated;
