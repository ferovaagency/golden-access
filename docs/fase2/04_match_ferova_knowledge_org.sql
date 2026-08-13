-- Fase 2 · 04 · Filtra el cerebro por organización. Correr en STAGING primero.
--
-- Hoy la función solo filtra por match_user (usuario). Con varias organizaciones
-- eso es el punto de fuga del cerebro: hay que acotar SIEMPRE por org. Se agrega
-- el parámetro match_org. El edge function (business-assistant-chat) debe pasar
-- la org activa del usuario (leerla de user_active_org con el JWT verificado).
--
-- Se usa service_role al llamarla, así que NO se puede depender de current_org_id()
-- (auth.uid() es null bajo service_role): por eso el org va por parámetro.

create or replace function public.match_ferova_knowledge(
  query_embedding text,
  match_user uuid default null,
  match_count integer default 6,
  min_similarity double precision default 0.0,
  match_org uuid default null
)
returns table(knowledge_id uuid, title text, content text, owner_user_id uuid, source text, similarity double precision)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select best.knowledge_id, best.title, best.content, best.owner_user_id, best.source, best.similarity
  from (
    select distinct on (k.id)
           k.id as knowledge_id, k.title, k.content, k.owner_user_id, k.source,
           1 - (e.embedding <=> query_embedding::vector(768)) as similarity
    from public.ferova_knowledge_embeddings e
    join public.ferova_knowledge k on k.id = e.knowledge_id
    where k.org_id = match_org                                   -- acota a la organización activa
      and (k.owner_user_id is null or k.owner_user_id = match_user) -- global de la org o privado del usuario
    order by k.id, e.embedding <=> query_embedding::vector(768)
  ) best
  where best.similarity >= min_similarity
  order by best.similarity desc
  limit match_count;
$function$;

-- CAMBIO DE CÓDIGO REQUERIDO (edge function business-assistant-chat):
--   1) Tras verificar el JWT, leer la org activa:
--        const { data: activeOrg } = await admin
--          .from('user_active_org').select('org_id').eq('user_id', userId).maybeSingle();
--   2) Pasarla a recallKnowledge -> match_ferova_knowledge como match_org.
--   Sin ese cambio, match_org llega null y la función no devuelve nada (falla
--   segura: mejor cerebro vacío que fuga entre organizaciones).
