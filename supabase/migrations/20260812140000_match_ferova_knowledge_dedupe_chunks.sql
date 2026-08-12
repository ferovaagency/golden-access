-- Fase 4 (cerebro/costo) — Ferova One: recall del cerebro con fragmentos.
--
-- Ahora cada nota puede tener VARIOS embeddings (uno por fragmento), en vez de
-- uno solo. Si el RPC devolviera una fila por fragmento, una misma nota con dos
-- fragmentos cercanos ocuparía dos de los match_count cupos y desplazaría a
-- otras notas relevantes. Este cambio deduplica por nota: toma el MEJOR
-- fragmento de cada nota, y luego ordena y limita. Sigue devolviendo el
-- contenido completo de la nota (k.content) para el contexto del asistente.
--
-- Compatible hacia atrás: las notas con un solo embedding funcionan igual.
create or replace function public.match_ferova_knowledge(
  query_embedding text,
  match_user uuid default null,
  match_count int default 6,
  min_similarity float default 0.0
)
returns table (knowledge_id uuid, title text, content text, owner_user_id uuid, source text, similarity float)
language sql stable security definer set search_path = public as $$
  select best.knowledge_id, best.title, best.content, best.owner_user_id, best.source, best.similarity
  from (
    select distinct on (k.id)
           k.id as knowledge_id, k.title, k.content, k.owner_user_id, k.source,
           1 - (e.embedding <=> query_embedding::vector(768)) as similarity
    from public.ferova_knowledge_embeddings e
    join public.ferova_knowledge k on k.id = e.knowledge_id
    where (k.owner_user_id is null or k.owner_user_id = match_user)
    order by k.id, e.embedding <=> query_embedding::vector(768)
  ) best
  where best.similarity >= min_similarity
  order by best.similarity desc
  limit match_count;
$$;

revoke all on function public.match_ferova_knowledge(text, uuid, int, float) from public, authenticated;
grant execute on function public.match_ferova_knowledge(text, uuid, int, float) to service_role;
