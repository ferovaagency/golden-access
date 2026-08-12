-- Fase 4 (costo por usuario) — Ferova One: analítica sobre ai_usage_log.
--
-- El registro de tokens ya existe (20260812180842); esto lo hace LEGIBLE. La
-- decisión de precio necesita el percentil 95 del consumo por usuario, no el
-- promedio (en IA la cola larga es la que descuadra el mes). Aquí va la lógica
-- de agregación; el costo en dinero se deriva fuera con las tarifas vigentes de
-- cada modelo (no se hardcodean tarifas aquí).
--
-- Solo el service_role la ejecuta (una edge function admin la llama). El
-- navegador no toca ai_usage_log ni esta función.

create or replace function public.admin_ai_usage_overview(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select *
    from public.ai_usage_log
    where created_at >= now() - make_interval(days => greatest(p_days, 1))
  ),
  por_usuario as (
    select
      user_id,
      count(*)                              as llamadas,
      coalesce(sum(input_tokens), 0)        as input_tokens,
      coalesce(sum(output_tokens), 0)       as output_tokens,
      coalesce(sum(cached_input_tokens), 0) as cached_tokens,
      coalesce(sum(total_tokens), 0)        as total_tokens
    from base
    group by user_id
  )
  select jsonb_build_object(
    'ventana_dias', greatest(p_days, 1),
    'generado_en', now(),
    'totales', jsonb_build_object(
      'llamadas',       (select count(*) from base),
      'usuarios_activos', (select count(*) from por_usuario),
      'input_tokens',   (select coalesce(sum(input_tokens), 0) from base),
      'output_tokens',  (select coalesce(sum(output_tokens), 0) from base),
      'cached_tokens',  (select coalesce(sum(cached_input_tokens), 0) from base),
      'total_tokens',   (select coalesce(sum(total_tokens), 0) from base)
    ),
    -- p95 de tokens por llamada individual (la conversación cara puntual).
    'p95_tokens_por_llamada',
      (select percentile_cont(0.95) within group (order by total_tokens)
       from base where total_tokens is not null),
    -- p95 de tokens acumulados por usuario en la ventana (el usuario caro).
    'p95_tokens_por_usuario',
      (select percentile_cont(0.95) within group (order by total_tokens)
       from por_usuario),
    'mediana_tokens_por_usuario',
      (select percentile_cont(0.50) within group (order by total_tokens)
       from por_usuario),
    -- Top 10 usuarios por consumo: donde vive el riesgo de costo.
    'top_usuarios', coalesce((
      select jsonb_agg(u)
      from (
        select user_id, llamadas, input_tokens, output_tokens, cached_tokens, total_tokens
        from por_usuario
        order by total_tokens desc
        limit 10
      ) u
    ), '[]'::jsonb),
    -- Desglose por función: qué endpoint consume más.
    'por_funcion', coalesce((
      select jsonb_agg(f)
      from (
        select
          funcion,
          count(*)                       as llamadas,
          coalesce(sum(total_tokens), 0) as total_tokens,
          coalesce(sum(cached_input_tokens), 0) as cached_tokens
        from base
        group by funcion
        order by total_tokens desc
      ) f
    ), '[]'::jsonb),
    -- Desglose por modelo: para validar el enrutado barato/caro.
    'por_modelo', coalesce((
      select jsonb_agg(m)
      from (
        select
          modelo,
          count(*)                       as llamadas,
          coalesce(sum(input_tokens), 0) as input_tokens,
          coalesce(sum(output_tokens), 0) as output_tokens,
          coalesce(sum(total_tokens), 0) as total_tokens
        from base
        group by modelo
        order by total_tokens desc
      ) m
    ), '[]'::jsonb)
  );
$$;

-- Nadie desde el navegador ejecuta esto; solo el service_role (edge admin).
revoke all on function public.admin_ai_usage_overview(integer) from anon, authenticated;
