import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { logAiUsage } from "./ai-usage.ts";

// Segundo cerebro de Ferova: helpers de memoria semántica.
// Embeddings vía Lovable AI Gateway (mismo modelo que el bot de WhatsApp).

export const BRAIN_EMBED_MODEL = "google/gemini-embedding-001";
const GATEWAY_EMBEDDINGS_URL = "https://ai.gateway.lovable.dev/v1/embeddings";

/** Genera el embedding (768 dims) de un texto. Devuelve null si falla o falta la key.
 *
 *  `atribucion` es opcional a propósito: los embeddings salen baratos pero no
 *  son gratis, y quien tenga a mano el usuario y un cliente admin puede dejar
 *  registro del costo sin obligar a todos los llamadores a hacerlo. */
export async function embedText(
  text: string,
  apiKey: string,
  atribucion?: { admin: SupabaseClient<any, "public", "public", any, any>; userId: string | null; funcion: string },
): Promise<number[] | null> {
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
    if (atribucion) {
      logAiUsage(atribucion.admin, { userId: atribucion.userId, funcion: atribucion.funcion, modelo: BRAIN_EMBED_MODEL, usage: data?.usage })
        .catch((e) => console.error("[ai-usage] embedText", e));
    }
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

/**
 * Trocea contenido largo en fragmentos de ~unos cientos de tokens con
 * solapamiento, cortando en límites naturales (párrafo/oración) cuando se puede.
 * Contenido corto => un solo fragmento. Mejora la precisión del recall Y evita
 * que lo que pase de 8000 caracteres se pierda en silencio (embedText corta ahí).
 */
export function chunkText(text: string, maxChars = 1400, overlap = 200): string[] {
  const clean = (text || "").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + maxChars, clean.length);
    if (end < clean.length) {
      // Corta en un límite natural hacia atrás (párrafo, oración o salto).
      const window = clean.slice(start, end);
      const brk = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf(". "), window.lastIndexOf("\n"));
      if (brk > maxChars * 0.5) end = start + brk + 1;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

/**
 * Genera y guarda los embeddings de un conocimiento, TROCEANDO el contenido
 * (un embedding por fragmento). Con replace=true borra los embeddings previos
 * antes de reindexar (para updates). Antes se guardaba un único embedding por
 * nota y se perdía todo lo que pasara de 8000 caracteres.
 */
export async function embedAndStoreChunks(
  admin: SupabaseClient<any, "public", "public", any, any>,
  knowledgeId: string,
  content: string,
  apiKey: string,
  opts: { replace?: boolean; userId?: string | null } = {},
): Promise<void> {
  if (opts.replace) {
    await admin.from("ferova_knowledge_embeddings").delete().eq("knowledge_id", knowledgeId);
  }
  const chunks = chunkText(content);
  const rows: Array<{ knowledge_id: string; content_chunk: string; embedding: number[] }> = [];
  for (const chunk of chunks) {
    const emb = await embedText(chunk, apiKey, { admin, userId: opts.userId ?? null, funcion: "brain:indexar" });
    if (emb) rows.push({ knowledge_id: knowledgeId, content_chunk: chunk, embedding: emb });
  }
  if (rows.length) {
    const { error } = await admin.from("ferova_knowledge_embeddings").insert(rows);
    if (error) console.error("[brain] embed chunks insert error", error);
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
 *
 * Con `orgId` (la organización activa) el alcance pasa a ser el del holding: lo
 * de esa empresa, lo que sus empresas hijas marcaron para compartir hacia
 * arriba y lo que un ancestro publicó hacia abajo. Sin `orgId` se comporta
 * exactamente como antes.
 */
export async function recallKnowledge(
  admin: SupabaseClient<any, "public", "public", any, any>,
  embedding: number[] | null,
  userId: string,
  count = 6,
  minSimilarity = 0.25,
  orgId: string | null = null,
): Promise<RecalledKnowledge[]> {
  if (!embedding) return [];
  const { data, error } = await admin.rpc("match_ferova_knowledge", {
    query_embedding: JSON.stringify(embedding),
    match_user: userId,
    match_count: count,
    min_similarity: minSimilarity,
    match_org: orgId,
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
  args: {
    title: string;
    content: string;
    scope: "global" | "privado";
    userId: string;
    source?: string;
    tags?: string[];
    /** Organización activa al escribir. La nota se queda en ella salvo que la
     *  empresa tenga encendido `comparte_por_defecto`. */
    orgId?: string | null;
  },
  apiKey: string,
): Promise<string | null> {
  const owner = args.scope === "privado" ? args.userId : null;
  const orgId = args.orgId ?? null;

  // Si la empresa comparte por defecto, lo que se escriba en ella sube al
  // holding sin que nadie tenga que acordarse de marcarlo.
  let compartirArriba = false;
  if (orgId) {
    const { data: org } = await admin
      .from("organizations")
      .select("comparte_por_defecto")
      .eq("id", orgId)
      .maybeSingle();
    compartirArriba = !!org?.comparte_por_defecto;
  }

  const { data, error } = await admin
    .from("ferova_knowledge")
    .insert({
      title: args.title,
      content: args.content,
      owner_user_id: owner,
      org_id: orgId,
      compartir_arriba: compartirArriba,
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
  await embedAndStoreChunks(admin, data.id as string, args.content, apiKey, { userId: args.userId });
  return data.id as string;
}
