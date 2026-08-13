CREATE OR REPLACE FUNCTION public.admin_ai_usage_overview(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  with base as (
    select * from public.ai_usage_log
    where created_at >= now() - make_interval(days => greatest(coalesce(p_days,30),1))
  ),
  per_user as (
    select user_id, sum(coalesce(total_tokens,0))::numeric as tokens
    from base where user_id is not null group by user_id
  )
  select jsonb_build_object(
    'ventana_dias', greatest(coalesce(p_days,30),1),
    'totales', jsonb_build_object(
      'llamadas', (select count(*) from base),
      'usuarios_activos', (select count(*) from per_user),
      'input_tokens', (select coalesce(sum(coalesce(input_tokens,0)),0) from base),
      'output_tokens', (select coalesce(sum(coalesce(output_tokens,0)),0) from base),
      'cached_tokens', (select coalesce(sum(coalesce(cached_input_tokens,0)),0) from base),
      'total_tokens', (select coalesce(sum(coalesce(total_tokens,0)),0) from base)
    ),
    'p95_tokens_por_llamada', (select percentile_cont(0.95) within group (order by coalesce(total_tokens,0)) from base),
    'p95_tokens_por_usuario', (select percentile_cont(0.95) within group (order by tokens) from per_user),
    'mediana_tokens_por_usuario', (select percentile_cont(0.5) within group (order by tokens) from per_user),
    'por_modelo', coalesce((
      select jsonb_agg(m) from (
        select modelo,
               count(*) as llamadas,
               coalesce(sum(coalesce(input_tokens,0)),0) as input_tokens,
               coalesce(sum(coalesce(output_tokens,0)),0) as output_tokens,
               coalesce(sum(coalesce(total_tokens,0)),0) as total_tokens
        from base group by modelo order by 5 desc
      ) m), '[]'::jsonb),
    'por_funcion', coalesce((
      select jsonb_agg(f) from (
        select funcion,
               count(*) as llamadas,
               coalesce(sum(coalesce(total_tokens,0)),0) as total_tokens,
               coalesce(sum(coalesce(cached_input_tokens,0)),0) as cached_tokens
        from base group by funcion order by 3 desc
      ) f), '[]'::jsonb)
  );
$function$;

REVOKE ALL ON FUNCTION public.admin_ai_usage_overview(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_ai_usage_overview(integer) TO service_role;