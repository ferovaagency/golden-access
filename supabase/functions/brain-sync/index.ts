// Construye el "cerebro" del negocio automáticamente desde los datos reales del
// usuario (perfil del negocio + clientes), sin que tenga que escribirlo a mano.
// Genera/actualiza conocimientos duraderos y recuperables (embeddings), con una
// clave estable en `source` para no duplicar en cada sincronización.
//
// Alcance: privado del usuario (owner_user_id = userId). Hoy el sistema es
// mono-tenant por user_id, así que NO se escribe en el cerebro global (owner
// null), que aún no está aislado por organización.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { embedAndStoreChunks } from "../_shared/brain.ts";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function clean(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).filter(Boolean).join(", ");
  return String(value).trim();
}

function negocioContent(p: Record<string, unknown>): string {
  const parts = [
    p.nombre_negocio && `Negocio: ${clean(p.nombre_negocio)}.`,
    p.industria && `Industria: ${clean(p.industria)}.`,
    p.tipo_negocio && `Tipo: ${clean(p.tipo_negocio)}.`,
    p.tamano_equipo && `Equipo: ${clean(p.tamano_equipo)}.`,
    p.ciudad && `Ciudad: ${clean(p.ciudad)}.`,
  ].filter(Boolean);
  return parts.join(" ");
}

function clienteContent(c: Record<string, unknown>): string {
  const parts = [
    `Cliente ${clean(c.nombre)}${c.tipo ? ` (${clean(c.tipo)})` : ""}.`,
    c.responsable && `Responsable: ${clean(c.responsable)}.`,
    c.objetivos && `Objetivos: ${clean(c.objetivos)}.`,
    c.kpis && `KPIs: ${clean(c.kpis)}.`,
    c.entregables && `Entregables: ${clean(c.entregables)}.`,
    `Estado: ${c.activo === false ? "inactivo" : "activo"}.`,
  ].filter(Boolean);
  return parts.join(" ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ ok: false, message: "No autenticado" }, 401);

    const userClient = createClient(URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ ok: false, message: "Sesión inválida" }, 401);
    const userId = userData.user.id;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ ok: false, message: "IA no configurada (falta LOVABLE_API_KEY)." }, 503);

    const admin = createClient(URL, SERVICE);

    const [{ data: profile }, { data: clientes }] = await Promise.all([
      admin.from("business_profile").select("nombre_negocio, industria, tipo_negocio, tamano_equipo, ciudad").eq("user_id", userId).maybeSingle(),
      admin.from("finance_clientes").select("id, nombre, tipo, activo, responsable, objetivos, kpis, entregables").eq("user_id", userId),
    ]);

    const entries: Array<{ source: string; title: string; content: string }> = [];
    if (profile?.nombre_negocio) {
      const content = negocioContent(profile);
      if (content) entries.push({ source: "auto:negocio", title: `Perfil del negocio: ${clean(profile.nombre_negocio)}`, content });
    }
    for (const c of clientes ?? []) {
      const content = clienteContent(c);
      if (content) entries.push({ source: `auto:cliente:${c.id}`, title: `Cliente: ${clean(c.nombre)}`, content });
    }

    let creados = 0, actualizados = 0, sinCambios = 0;
    for (const e of entries) {
      const { data: existing } = await admin
        .from("ferova_knowledge")
        .select("id, content")
        .eq("owner_user_id", userId)
        .eq("source", e.source)
        .maybeSingle();

      if (existing) {
        if ((existing.content || "") === e.content) { sinCambios++; continue; }
        await admin.from("ferova_knowledge").update({ title: e.title, content: e.content, updated_at: new Date().toISOString() }).eq("id", existing.id);
        await embedAndStoreChunks(admin, existing.id as string, e.content, apiKey, { replace: true });
        actualizados++;
      } else {
        const { data: ins, error: insErr } = await admin
          .from("ferova_knowledge")
          .insert({ title: e.title, content: e.content, owner_user_id: userId, source: e.source, tags: ["auto"], created_by: userId })
          .select("id")
          .single();
        if (insErr || !ins) { console.error("[brain-sync] insert error", insErr); continue; }
        await embedAndStoreChunks(admin, ins.id as string, e.content, apiKey);
        creados++;
      }
    }

    return json({ ok: true, creados, actualizados, sin_cambios: sinCambios, total: entries.length });
  } catch (err) {
    console.error("[brain-sync] error", err);
    return json({ ok: false, message: (err as Error).message }, 500);
  }
});
