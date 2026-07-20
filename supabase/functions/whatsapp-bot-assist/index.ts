// Ayuda a redactar el prompt del bot de WhatsApp y las entradas de
// conocimiento: la persona escribe una idea suelta y la IA la convierte en
// un prompt/entrada bien estructurada, lista para guardar (nunca se guarda
// sola -- siempre vuelve al textarea para revisión).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { generateText } from "npm:ai";
import { createLovableAiGatewayProvider } from "../_shared/ai-gateway.ts";

const PROMPT_SYSTEM = `Eres un experto en diseñar prompts para bots de ventas de WhatsApp.
Recibes una idea suelta (o un prompt existente a mejorar) de la dueña de una agencia y devuelves
un system prompt completo y listo para usar. Debe incluir: quién es el bot y a nombre de qué
negocio habla, tono de voz, qué información puede dar, cuándo debe escalar a un humano, y que
nunca debe inventar precios o promesas que no se le hayan dado como conocimiento. Responde SOLO
con el prompt final en español, sin explicaciones ni comillas envolventes.`;

const KNOWLEDGE_SYSTEM = `Eres un asistente que convierte notas sueltas de una dueña de negocio en
una entrada de "conocimiento" clara y completa para un bot de WhatsApp que atiende clientes.
Reescribe la nota como un párrafo corto, directo y sin ambigüedad, que el bot pueda citar tal
cual al responder. No inventes datos (precios, horarios, políticas) que no estén en la nota
original -- si falta un dato clave, señálalo entre corchetes, ej. [confirmar precio]. Responde
SOLO con el texto final en español, sin explicaciones ni comillas envolventes.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth) return json({ ok: false, message: "No autenticado" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: uerr } = await userClient.auth.getUser();
    if (uerr || !userData.user?.email) return json({ ok: false, message: "Sesión inválida" }, 401);
    const { data: team } = await userClient.from("crm_team_members").select("email").eq("email", userData.user.email).maybeSingle();
    if (!team) return json({ ok: false, message: "No autorizado" }, 403);

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "knowledge" ? "knowledge" : "prompt";
    const draft = typeof body?.draft === "string" ? body.draft.trim() : "";
    if (!draft) return json({ ok: false, message: "Escribe una idea antes de mejorarla con IA." }, 400);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ ok: false, message: "La IA todavía no está configurada en este despliegue." }, 500);
    const gateway = createLovableAiGatewayProvider(key);

    const { text } = await generateText({
      model: gateway("google/gemini-3.5-flash"),
      system: mode === "prompt" ? PROMPT_SYSTEM : KNOWLEDGE_SYSTEM,
      prompt: draft,
    });

    return json({ ok: true, result: text.trim() });
  } catch (err) {
    console.error("[whatsapp-bot-assist] error", err);
    return json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
