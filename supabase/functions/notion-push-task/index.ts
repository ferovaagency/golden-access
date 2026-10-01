// Espejo del Planner en la base `Pendientes` de Notion.
//
// Ferova One manda: aquí se captura, se prioriza (Priority Score / Pareto) y se
// agenda. Esta función sólo PUBLICA el resultado en Notion — crea la fila si no
// existe y la actualiza si ya existe — para que la persona siga viendo todo en
// su base de tareas sin volver a escribirlo.
//
// Configuración (secretos de Lovable Cloud):
//   NOTION_API_KEY                   token de una integración interna de Notion
//                                    con acceso a la base `Pendientes`.
//   NOTION_PENDIENTES_DATA_SOURCE_ID id del data source de `Pendientes`.
//   NOTION_OWNER_ACCOUNT_ID          cuenta de Ferova One cuyo planner se espeja:
//                                    el id de usuario (UUID) o su correo de acceso.
//                                    Sin esto NO se publica nada: la base de
//                                    Notion es de una sola persona y el SaaS es
//                                    multi-cuenta.
//
// Nunca bloquea al Planner: si falta configuración responde ok + skipped.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { resolveActiveContext } from "../_shared/account.ts";

const NOTION_VERSION = "2025-09-03";
const NOTION_API = "https://api.notion.com/v1";
const MAX_TASKS = 50;

/** Nombres de las propiedades en la base `Pendientes`. Si se renombra una en
 *  Notion hay que cambiarla aquí: la API es por nombre. */
const P = {
  nombre: "Nombre",
  proyecto: "Proyecto",
  estado: "Estado",
  entrega: "Fecha de Entrega",
  sugerida: "Fecha sugerida",
  score: "Score",
  calculo: "Cálculo",
  estadoCalculo: "Estado del cálculo",
  reprogramada: "Veces reprogramada",
  idOrigen: "ID Origen",
  responsable: "Responsable",
  notas: "Notas",
} as const;

const ESTADO: Record<string, string> = {
  backlog: "Sin empezar",
  scheduled: "Sin empezar",
  postponed: "Sin empezar",
  in_progress: "En curso",
  done: "Listo",
  cancelled: "Cancelada",
};

type Task = {
  id: string; title: string; description: string | null; ai_notes: string | null; status: string;
  deadline: string | null; scheduled_for: string | null; postponed_count: number | null;
  client_ref: string | null; notion_page_id: string | null;
};
type Client = { id: string; nombre: string; notion_proyecto: string | null };

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Opción del select `Proyecto` para un cliente: la fijada en finance_clientes.notion_proyecto, o
 *  una coincidencia clara por nombre. Sin coincidencia clara: null (no se inventan opciones). */
function resolveProyecto(client: Client | null, options: string[]): string | null {
  if (!client) return null;
  if (client.notion_proyecto && options.includes(client.notion_proyecto)) return client.notion_proyecto;
  const n = normalize(client.nombre);
  if (!n) return null;
  const exact = options.find((o) => normalize(o) === n);
  if (exact) return exact;
  const contained = options.filter((o) => { const on = normalize(o); return on.includes(n) || n.includes(on); });
  return contained.length === 1 ? contained[0] : null;
}

function dateKey(value: string | null | undefined) {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

/** NOTION_OWNER_ACCOUNT_ID puede ser el UUID de la cuenta o su correo de acceso. */
async function isOwnerAccount(admin: { auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: { email?: string | null } | null } | null; error: unknown }> } } }, accountId: string, owner: string): Promise<boolean> {
  const wanted = owner.trim().toLowerCase();
  if (!wanted) return false;
  if (accountId.toLowerCase() === wanted) return true;
  if (!wanted.includes("@")) return false;
  const { data, error } = await admin.auth.admin.getUserById(accountId);
  if (error || !data?.user) return false;
  return (data.user.email || "").toLowerCase() === wanted;
}

async function notion(path: string, init: RequestInit & { key: string }) {
  const response = await fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${init.key}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

function buildProperties(task: Task, proyecto: string | null, clientName: string | null, score: number | null, isNew: boolean) {
  const text = (value: string | null) => ({ rich_text: value ? [{ text: { content: value.slice(0, 1900) } }] : [] });
  const properties: Record<string, unknown> = {
    [P.nombre]: { title: [{ text: { content: task.title.slice(0, 1900) } }] },
    [P.estado]: { status: { name: ESTADO[task.status] || "Sin empezar" } },
    [P.entrega]: { date: dateKey(task.deadline) ? { start: dateKey(task.deadline) } : null },
    [P.sugerida]: { date: dateKey(task.scheduled_for) ? { start: dateKey(task.scheduled_for) } : null },
    [P.reprogramada]: { number: Number(task.postponed_count) || 0 },
    [P.idOrigen]: text(task.id),
    [P.responsable]: { select: { name: "Mafe" } },
  };
  if (score !== null) {
    properties[P.score] = { number: score };
    properties[P.estadoCalculo] = { select: { name: "Ok" } };
    properties[P.calculo] = text(`Ferova One · Priority Score ${score.toFixed(2)} (urgencia por entrega, dinero, cliente, riesgo, facilidad, veces pospuesta)`);
  }
  if (proyecto) properties[P.proyecto] = { select: { name: proyecto } };
  // Notas es de la persona: sólo se escribe al CREAR la fila, nunca se pisa después.
  if (isNew) {
    const notas = [task.description, task.ai_notes, !proyecto && clientName ? `Cliente en Ferova One: ${clientName}` : null].filter(Boolean).join("\n\n");
    if (notas) properties[P.notas] = text(notas);
  }
  return properties;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return json({ ok: false, message: "No autenticado" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ ok: false, message: "Sesión inválida" }, 401);

    const key = Deno.env.get("NOTION_API_KEY");
    const dataSourceId = Deno.env.get("NOTION_PENDIENTES_DATA_SOURCE_ID");
    const ownerAccount = Deno.env.get("NOTION_OWNER_ACCOUNT_ID");
    if (!key || !dataSourceId || !ownerAccount) {
      return json({ ok: true, skipped: true, message: "Integración con Notion no configurada (NOTION_API_KEY, NOTION_PENDIENTES_DATA_SOURCE_ID, NOTION_OWNER_ACCOUNT_ID)." });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { accountId } = await resolveActiveContext(admin, userData.user.id);
    if (!(await isOwnerAccount(admin, accountId, ownerAccount))) {
      return json({ ok: true, skipped: true, message: "Esta cuenta no espeja su planner en Notion." });
    }

    const body = await req.json().catch(() => ({}));
    const action: "upsert" | "archive" = body?.action === "archive" ? "archive" : "upsert";
    const taskIds: string[] = Array.isArray(body?.task_ids) ? body.task_ids.filter((id: unknown) => typeof id === "string").slice(0, MAX_TASKS) : [];
    const scores: Record<string, number> = body?.scores && typeof body.scores === "object" ? body.scores : {};
    const pageIds: string[] = Array.isArray(body?.notion_page_ids) ? body.notion_page_ids.filter((id: unknown) => typeof id === "string").slice(0, MAX_TASKS) : [];

    const errors: string[] = [];
    let archived = 0;

    if (action === "archive") {
      // Al borrar en Ferova One la fila de Notion se manda a la papelera (recuperable), no se destruye.
      const { data: rows } = taskIds.length
        ? await admin.from("planner_tasks").select("notion_page_id").eq("user_id", accountId).in("id", taskIds)
        : { data: [] as { notion_page_id: string | null }[] };
      const targets = new Set<string>([...pageIds, ...((rows || []).map((r: any) => r.notion_page_id).filter(Boolean) as string[])]);
      for (const pageId of targets) {
        const result = await notion(`/pages/${pageId}`, { key, method: "PATCH", body: JSON.stringify({ in_trash: true }) });
        if (result.ok) archived += 1;
        else if (result.status !== 404) errors.push(`${pageId}: ${result.payload?.message || result.status}`);
      }
      return json({ ok: errors.length === 0, archived, errors, message: errors[0] });
    }

    if (!taskIds.length) return json({ ok: true, upserted: 0 });

    const [{ data: tasks, error: tasksError }, { data: clients }, schema] = await Promise.all([
      admin.from("planner_tasks")
        .select("id,title,description,ai_notes,status,deadline,scheduled_for,postponed_count,client_ref,notion_page_id")
        .eq("user_id", accountId).in("id", taskIds),
      admin.from("finance_clientes").select("id,nombre,notion_proyecto").eq("user_id", accountId),
      notion(`/data_sources/${dataSourceId}`, { key, method: "GET" }),
    ]);
    if (tasksError) throw tasksError;
    if (!schema.ok) return json({ ok: false, message: `Notion no devolvió la base Pendientes: ${schema.payload?.message || schema.status}` }, 502);
    const proyectoOptions: string[] = (schema.payload?.properties?.[P.proyecto]?.select?.options || []).map((o: any) => o.name);
    const clientById = new Map<string, Client>(((clients || []) as Client[]).map((c) => [c.id, c]));

    let upserted = 0;
    for (const task of (tasks || []) as Task[]) {
      const client = task.client_ref ? clientById.get(task.client_ref) || null : null;
      const proyecto = resolveProyecto(client, proyectoOptions);
      const score = Number.isFinite(Number(scores[task.id])) ? Number(scores[task.id]) : null;

      let pageId = task.notion_page_id;
      let result;
      if (pageId) {
        result = await notion(`/pages/${pageId}`, { key, method: "PATCH", body: JSON.stringify({ properties: buildProperties(task, proyecto, client?.nombre || null, score, false) }) });
        // La fila se borró en Notion: se vuelve a crear, no se pierde la tarea.
        if (!result.ok && result.status === 404) pageId = null;
      }
      if (!pageId) {
        result = await notion(`/pages`, { key, method: "POST", body: JSON.stringify({
          parent: { type: "data_source_id", data_source_id: dataSourceId },
          properties: buildProperties(task, proyecto, client?.nombre || null, score, true),
        }) });
        if (result.ok && result.payload?.id) {
          pageId = result.payload.id as string;
          await admin.from("planner_tasks").update({ notion_page_id: pageId }).eq("id", task.id).eq("user_id", accountId);
        }
      }
      if (result?.ok) upserted += 1;
      else errors.push(`${task.title}: ${result?.payload?.message || result?.status || "sin respuesta"}`);
    }

    return json({ ok: errors.length === 0, upserted, errors, message: errors[0] });
  } catch (error) {
    console.error("[notion-push-task] error", error);
    return json({ ok: false, message: error instanceof Error ? error.message : String(error) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
