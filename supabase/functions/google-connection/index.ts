import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Estado de la conexión con Google Workspace.
//
// EL PROBLEMA QUE RESUELVE
// La única señal de que alguien había conectado Google era `provider_token`,
// que Supabase entrega UNA vez al volver del OAuth y vive en memoria del
// navegador. En cuanto se recargaba la página desaparecía, así que Integraciones
// mostraba "sin conectar" para siempre y parecía que la conexión no funcionaba.
// La tabla `google_workspace_connections` existía para esto y no la escribía
// nadie: el asistente la leía y siempre encontraba vacío.
//
// QUÉ SE GUARDA Y QUÉ NO
// Sólo el HECHO de la conexión: que ocurrió, con qué correo y con qué permisos.
// El token NO se guarda — esa fue una decisión deliberada de la Fase 1 (no hay
// tokens de terceros en reposo) y sigue en pie. Cuando haga falta operar contra
// Google y no haya token vivo, la aplicación pide reconectar: un clic, sin
// misterio, en vez de decir que nunca se conectó.
//
// Va por edge function porque `google_workspace_connections` no tiene permisos
// para `authenticated`: sólo service_role escribe ahí.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    if (userErr || !userData?.user) return json({ ok: false, message: "Sesión inválida." }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload = await req.json().catch(() => ({}));
    const action = payload?.action as string;

    if (action === "status") {
      const { data } = await admin
        .from("google_workspace_connections")
        .select("connected, connected_email, scopes, last_error, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      return json({ ok: true, connection: data ?? null });
    }

    if (action === "connected") {
      // La conexión es de la PERSONA, no de la empresa activa: cada quien
      // conecta su propia cuenta de Google.
      const email = typeof payload.email === "string" ? payload.email.slice(0, 320) : userData.user.email;
      const scopes = Array.isArray(payload.scopes) ? payload.scopes.slice(0, 40) : [];
      const { error } = await admin.from("google_workspace_connections").upsert({
        user_id: userId,
        connected: true,
        connected_email: email,
        scopes,
        last_error: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) return json({ ok: false, message: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "disconnect") {
      const { error } = await admin.from("google_workspace_connections").upsert({
        user_id: userId,
        connected: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) return json({ ok: false, message: error.message }, 500);
      return json({ ok: true });
    }

    return json({ ok: false, message: "Acción no reconocida." }, 400);
  } catch (err) {
    console.error("[google-connection] error", err);
    return json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
  }
});
