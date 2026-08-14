-- DIAGNÓSTICO — qué migraciones escritas a mano NO están aplicadas en la base.
--
-- Sólo lee. No cambia nada. Pégalo en el editor SQL de Supabase y ejecútalo.
-- Cada fila dice si el objeto que crea una migración existe o falta.
--
-- Contexto: las migraciones con nombre descriptivo (escritas a mano en el repo)
-- no se aplican solas al hacer push; las que tienen nombre con UUID las genera
-- y aplica Lovable. Por eso el repo puede ir por delante de la base.

select * from (
  values
    ('20260812190000_ai_usage_stats',
     'función admin_ai_usage_overview',
     (to_regprocedure('public.admin_ai_usage_overview(integer)') is not null)),

    ('20260812191000_crm_resenas_taint',
     'crm_resenas.confirmada',
     exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='crm_resenas' and column_name='confirmada')),

    ('20260812191000_crm_resenas_taint',
     'crm_resenas.origen',
     exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='crm_resenas' and column_name='origen')),

    ('20260812192000_account_deletion_request',
     'business_profile.deletion_scheduled_for',
     exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='business_profile' and column_name='deletion_scheduled_for')),

    ('20260812192000_account_deletion_request',
     'business_profile.deletion_requested_at',
     exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='business_profile' and column_name='deletion_requested_at')),

    ('20260812220000_user_subscriptions_provider_order_full_unique',
     'índice user_subscriptions_provider_order_unique (total, no parcial)',
     exists (select 1 from pg_index i
               join pg_class c on c.oid = i.indexrelid
              where c.relname = 'user_subscriptions_provider_order_unique'
                and i.indpred is null)),

    ('20260813010000_admin_subscriptions_overview',
     'función admin_subscriptions_overview',
     (to_regprocedure('public.admin_subscriptions_overview()') is not null)),

    ('20260813120000_planner_blocks_recurrence',
     'planner_blocks.recurrence_days',
     exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='planner_blocks' and column_name='recurrence_days')),

    ('20260813140000_biz_crm_contactos_campos',
     'biz_crm_contactos.canal_origen',
     exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='biz_crm_contactos' and column_name='canal_origen')),

    ('20260814120000_organizations_base',
     'tabla organizations',
     to_regclass('public.organizations') is not null),

    ('20260814120000_organizations_base',
     'función create_organization',
     (to_regprocedure('public.create_organization(text,uuid,text,boolean,boolean)') is not null))
) as t(migracion, objeto, existe)
order by existe, migracion;
