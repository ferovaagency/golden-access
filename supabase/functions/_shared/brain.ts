import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Segundo cerebro de Ferova: helpers de memoria semántica.
// Embeddings vía Lovable AI Gateway (mismo modelo que el bot de WhatsApp).

export const BRAIN_EMBED_MODEL = "google/gemini-embedding-001";
const GATEWAY_EMBEDDINGS_URL = "https://ai.gateway.lovable.dev/v1/embeddings";

/** Genera el embedding (768 dims) de un texto. Devuelve null si falla o falta la key. */
export async function embedText(text: string, apiKey: string): Promise<number[] | null> {
  const clean = (text || "").trim();
  if (!apiKey || !clean) return null;
  try {
    const res = await fetch(GATEWAY_EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "manual-fetch",
      },
      body: JSON.stringify({ model: BRAIN_EMBED_MODEL, input: clean.slice(0, 8000) }),
    });
    if (!res.ok) {
      console.error("[brain] embed http error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const emb = data?.data?.[0]?.embedding;
    if (!Array.isArray(emb) || emb.length !== 768) {
      console.error("[brain] embedding con dimensiones inesperadas:", Array.isArray(emb) ? emb.length : "forma desconocida");
      return null;
    }
    return emb as number[];
  } catch (err) {
    console.error("[brain] embed exception", err);
    return null;
  }
}

export interface RecalledKnowledge {
  knowledge_id: string;
  title: string;
  content: string;
  owner_user_id: string | null;
  source: string | null;
  similarity: number;
}

/**
 * Búsqueda semántica en el cerebro. Devuelve lo GLOBAL + lo PRIVADO del usuario.
 * Se llama con el cliente admin (service_role); match_user es el id ya verificado.
 */
export async function recallKnowledge(
  admin: SupabaseClient<any, "public", "public", any, any>,
  embedding: number[] | null,
  userId: string,
  count = 6,
  minSimilarity = 0.25,
): Promise<RecalledKnowledge[]> {
  if (!embedding) return [];
  const { data, error } = await admin.rpc("match_ferova_knowledge", {
    query_embedding: JSON.stringify(embedding),
    match_user: userId,
    match_count: count,
    min_similarity: minSimilarity,
  });
  if (error) {
    console.error("[brain] recall error", error);
    return [];
  }
  return (data || []) as RecalledKnowledge[];
}

/**
 * Guarda un conocimiento + su embedding. scope: "global" (equipo) o "privado".
 * Devuelve el id o null si falla la inserción del conocimiento.
 */
export async function rememberKnowledge(
  admin: SupabaseClient<any, "public", "public", any, any>,
  args: { title: string; content: string; scope: "global" | "privado"; userId: string; source?: string; tags?: string[] },
  apiKey: string,
): Promise<string | null> {
  const owner = args.scope === "privado" ? args.userId : null;
  const { data, error } = await admin
    .from("ferova_knowledge")
    .insert({
      title: args.title,
      content: args.content,
      owner_user_id: owner,
      source: args.source ?? "asistente",
      tags: args.tags ?? [],
      created_by: args.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[brain] remember insert error", error);
    return null;
  }
  const emb = await embedText(args.content, apiKey);
  if (emb) {
    const { error: embErr } = await admin
      .from("ferova_knowledge_embeddings")
      .insert({ knowledge_id: data.id, content_chunk: args.content, embedding: emb });
    if (embErr) console.error("[brain] remember embedding error", embErr);
  }
  return data.id as string;
}
