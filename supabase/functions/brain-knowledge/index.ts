import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { embedAndStoreChunks } from "../_shared/brain.ts";
import { resolveActiveContext } from "../_shared/account.ts";

// CRUD de la memoria del negocio (cerebro) para la pantalla de Memoria.
//
// QUIÉN VE QUÉ
// Antes esta función devolvía 403 a quien no estuviera en `crm_team_members`, y
// su listado incluía las notas con `owner_user_id IS NULL` — que son el cerebro
// interno de FEROVA. Es decir: la Memoria era inaccesible para los clientes, y
// abrirla sin más les habría mostrado el conocimiento interno de la agencia.
//
// Ahora cada negocio tiene su propio cerebro:
//   · del negocio  → `owner_user_id = cuenta activa`; lo ve todo el que tenga
//                    acceso a esa cuenta (socios, colaboradores).
//   · privado      → `owner_user_id = la persona`; sólo ella.
//   · Ferova       → las notas heredadas sin dueño NI organización. Sólo las ve
//                    el equipo interno (crm_team_members), como siempre.
//
// La cuenta activa se resuelve en la base (`active_context_for_user`), no desde
// la petición: esta función usa service_role y se salta la RLS, así que estas
// comprobaciones SON el control de acceso.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function reembed(admin: any, knowledgeId: string, content: string) {
  // Trocea el contenido (varios embeddings por nota) y reemplaza los previos.
  await embedAndStoreChunks(admin, knowledgeId, content, LOVABLE_API_KEY, { replace: true });
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
    // La pertenencia al equipo interno ya NO decide si se entra: sólo si se ve
    // (y se administra) el cerebro heredado de Ferova.
    const { data: member } = await admin.from("crm_team_members").select("email, rol").eq("email", email).maybeSingle();
    const isTeam = !!member;
    const isAdmin = isTeam && ["owner", "admin"].includes((member as { rol?: string }).rol || "");

    const { accountId, orgId } = await resolveActiveContext(admin, userId);

    const payload = await req.json().catch(() => ({}));
    const action = payload?.action as string;

    // Permiso sobre una fila:
    //   sin dueño  => cerebro de Ferova, sólo un admin del equipo;
    //   de la cuenta => cualquiera con acceso a esa cuenta;
    //   privada    => su dueño y nadie más.
    const canManage = (ownerUserId: string | null) =>
      ownerUserId === null ? isAdmin : ownerUserId === userId || ownerUserId === accountId;

    if (action === "list") {
      // Lo del negocio y lo propio. Las notas de Ferova (sin dueño) sólo entran
      // si quien pregunta es del equipo interno.
      const filtros = [`owner_user_id.eq.${accountId}`, `owner_user_id.eq.${userId}`];
      if (isTeam) filtros.push("owner_user_id.is.null");
      const { data, error } = await admin
        .from("ferova_knowledge")
        .select("id, title, content, source, tags, owner_user_id, org_id, created_at, updated_at")
        .or(filtros.join(","))
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) return json({ ok: false, message: error.message }, 500);
      const items = (data || []).map((k: any) => ({
        ...k,
        // `global` es la etiqueta que la pantalla ya entiende como "lo que ve
        // todo el equipo de este negocio".
        alcance: k.owner_user_id === userId && k.owner_user_id !== accountId ? "privado" : "global",
      }));
      return json({ ok: true, items, is_admin: isAdmin });
    }

    if (action === "create") {
      const title = (payload.title || "").toString().trim();
      const content = (payload.content || "").toString().trim();
      const scope = payload.scope === "privado" ? "privado" : "global";
      const tags = Array.isArray(payload.tags) ? payload.tags.slice(0, 20) : [];
      if (!title || !content) return json({ ok: false, message: "Faltan titulo o contenido." }, 400);

      // "global" ahora significa "de este negocio": se guarda a nombre de la
      // cuenta activa, no sin dueño. Sin dueño es el cerebro de Ferova, y una
      // nota de un cliente no puede acabar ahí por descuido.
      const owner = scope === "privado" ? userId : accountId;
      const { data, error } = await admin
        .from("ferova_knowledge")
        .insert({ title, content, owner_user_id: owner, org_id: orgId, source: "manual", tags, created_by: userId })
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
