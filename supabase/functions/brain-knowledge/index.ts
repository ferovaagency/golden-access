import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { embedText } from "../_shared/brain.ts";

// CRUD de la memoria del negocio (cerebro) para la pantalla de Memoria.
// Reglas: el cerebro GLOBAL (owner_user_id null) solo lo administra un admin
// (owner/admin). Cada quien administra su cerebro PRIVADO.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function reembed(admin: any, knowledgeId: string, content: string) {
  await admin.from("ferova_knowledge_embeddings").delete().eq("knowledge_id", knowledgeId);
  const emb = await embedText(content, LOVABLE_API_KEY);
  if (emb) {
    const { error } = await admin.from("ferova_knowledge_embeddings").insert({ knowledge_id: knowledgeId, content_chunk: content, embedding: emb });
    if (error) console.error("[brain-knowledge] embed insert error", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, message: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return json({ ok: false, message: "No autenticado." }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user?.email) return json({ ok: false, message: "Sesion invalida." }, 401);

    const userId = userData.user.id;
    const email = userData.user.email;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: member } = await admin.from("crm_team_members").select("email, rol").eq("email", email).maybeSingle();
    if (!member) return json({ ok: false, message: "No autorizado." }, 403);
    const isAdmin = ["owner", "admin"].includes((member as { rol?: string }).rol || "");

    const payload = await req.json().catch(() => ({}));
    const action = payload?.action as string;

    // Permiso sobre una fila: global => admin; privada => su dueño.
    const canManage = (ownerUserId: string | null) =>
      ownerUserId === null ? isAdmin : ownerUserId === userId;

    if (action === "list") {
      const { data, error } = await admin
        .from("ferova_knowledge")
        .select("id, title, content, source, tags, owner_user_id, created_at, updated_at")
        .or(`owner_user_id.is.null,owner_user_id.eq.${userId}`)
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) return json({ ok: false, message: error.message }, 500);
      const items = (data || []).map((k: any) => ({ ...k, alcance: k.owner_user_id ? "privado" : "global" }));
      return json({ ok: true, items, is_admin: isAdmin });
    }

    if (action === "create") {
      const title = (payload.title || "").toString().trim();
      const content = (payload.content || "").toString().trim();
      const scope = payload.scope === "privado" ? "privado" : "global";
      const tags = Array.isArray(payload.tags) ? payload.tags.slice(0, 20) : [];
      if (!title || !content) return json({ ok: false, message: "Faltan titulo o contenido." }, 400);
      if (scope === "global" && !isAdmin) return json({ ok: false, message: "Solo un admin puede escribir en el cerebro global." }, 403);

      const owner = scope === "privado" ? userId : null;
      const { data, error } = await admin
        .from("ferova_knowledge")
        .insert({ title, content, owner_user_id: owner, source: "manual", tags, created_by: userId })
        .select("id")
        .single();
      if (error || !data) return json({ ok: false, message: error?.message || "No se pudo crear." }, 500);
      await reembed(admin, data.id, content);
      return json({ ok: true, id: data.id });
    }

    if (action === "update") {
      const id = (payload.id || "").toString();
      if (!id) return json({ ok: false, message: "Falta id." }, 400);
      const { data: row } = await admin.from("ferova_knowledge").select("owner_user_id, content").eq("id", id).maybeSingle();
      if (!row) return json({ ok: false, message: "No existe." }, 404);
      if (!canManage(row.owner_user_id)) return json({ ok: false, message: "Sin permiso." }, 403);

      const patch: Record<string, unknown> = {};
      if (typeof payload.title === "string") patch.title = payload.title.trim();
      if (typeof payload.content === "string") patch.content = payload.content.trim();
      if (Array.isArray(payload.tags)) patch.tags = payload.tags.slice(0, 20);
      if (Object.keys(patch).length === 0) return json({ ok: false, message: "Nada que actualizar." }, 400);

      const { error } = await admin.from("ferova_knowledge").update(patch).eq("id", id);
      if (error) return json({ ok: false, message: error.message }, 500);
      if (typeof patch.content === "string" && patch.content !== row.content) await reembed(admin, id, patch.content as string);
      return json({ ok: true });
    }

    if (action === "delete") {
      const id = (payload.id || "").toString();
      if (!id) return json({ ok: false, message: "Falta id." }, 400);
      const { data: row } = await admin.from("ferova_knowledge").select("owner_user_id").eq("id", id).maybeSingle();
      if (!row) return json({ ok: true }); // ya no existe
      if (!canManage(row.owner_user_id)) return json({ ok: false, message: "Sin permiso." }, 403);
      const { error } = await admin.from("ferova_knowledge").delete().eq("id", id);
      if (error) return json({ ok: false, message: error.message }, 500);
      return json({ ok: true });
    }

    return json({ ok: false, message: "Accion no reconocida." }, 400);
  } catch (err) {
    console.error("[brain-knowledge] error", err);
    return json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
  }
});
