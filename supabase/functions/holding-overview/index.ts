// Vista consolidada del holding: una fila por empresa, más el total.
//
// Por qué una edge function y no una consulta desde el navegador: las tablas de
// negocio siguen aisladas por `user_id = auth.uid()`, así que el holding NO
// puede leer los datos de sus empresas desde el cliente. Aquí se usa
// service_role (que salta RLS) y la autorización se hace explícita: sólo se
// devuelven las cuentas de organizaciones donde quien pregunta es owner/admin.
// Eso evita tocar las ~55 políticas de las tablas de negocio, que es la Fase 7
// y exige staging. Ver docs/DISENO_ORGANIZACIONES.md.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface EmpresaResumen {
  org_id: string;
  nombre: string;
  ventas: number;
  egresos: number;
  margen: number;
  clientes_activos: number;
  tareas_abiertas: number;
  meta_ventas: number | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return json({ ok: false, message: "No autenticado" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData, error: uerr } = await userClient.auth.getUser(token);
    if (uerr || !userData.user) return json({ ok: false, message: "Sesión inválida" }, 401);
    const userId = userData.user.id;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Organizaciones donde manda. Un 'colaborador' no consolida nada.
    const { data: memberships, error: merr } = await admin
      .from("organization_members")
      .select("org_id, rol")
      .eq("user_id", userId)
      .in("rol", ["owner", "admin"]);
    if (merr) return json({ ok: false, message: merr.message }, 500);
    if (!memberships?.length) return json({ ok: true, empresas: [], total: null });

    // 2. Sus descendientes: las empresas que cuelgan del holding.
    const orgIds = new Set<string>();
    for (const m of memberships) {
      const { data: tree, error: terr } = await admin.rpc("org_descendants", { root: m.org_id });
      if (terr) return json({ ok: false, message: terr.message }, 500);
      for (const row of (tree || []) as { id: string }[]) orgIds.add(row.id);
    }

    // 3. Sólo las que tienen cuenta vinculada tienen datos que consolidar.
    const { data: orgs, error: oerr } = await admin
      .from("organizations")
      .select("id, nombre, data_user_id")
      .in("id", [...orgIds])
      .not("data_user_id", "is", null)
      .order("nombre");
    if (oerr) return json({ ok: false, message: oerr.message }, 500);
    if (!orgs?.length) return json({ ok: true, empresas: [], total: null });

    // 4. Un resumen por empresa. `business_overview` ya agrega por cuenta; se
    //    dejan fuera sus columnas de CRM (oportunidades, pipeline, reseñas)
    //    porque salen de tablas globales del equipo y darían el mismo número
    //    para todas.
    const empresas: EmpresaResumen[] = [];
    for (const org of orgs as { id: string; nombre: string; data_user_id: string }[]) {
      const [{ data: overview }, { count: tareas }] = await Promise.all([
        admin
          .from("business_overview")
          .select("ventas_totales, egresos_pagados, gastos_operativos, margen_directo_total, clientes_activos, meta_ventas_mensual")
          .eq("user_id", org.data_user_id)
          .maybeSingle(),
        admin
          .from("planner_tasks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", org.data_user_id)
          .not("status", "in", "(done,cancelled)"),
      ]);

      const ventas = num(overview?.ventas_totales);
      const egresos = num(overview?.egresos_pagados) + num(overview?.gastos_operativos);
      empresas.push({
        org_id: org.id,
        nombre: org.nombre,
        ventas,
        egresos,
        margen: num(overview?.margen_directo_total) || (ventas - egresos),
        clientes_activos: num(overview?.clientes_activos),
        tareas_abiertas: tareas ?? 0,
        meta_ventas: overview?.meta_ventas_mensual ?? null,
      });
    }

    const total = empresas.reduce(
      (acc, e) => ({
        ventas: acc.ventas + e.ventas,
        egresos: acc.egresos + e.egresos,
        margen: acc.margen + e.margen,
        clientes_activos: acc.clientes_activos + e.clientes_activos,
        tareas_abiertas: acc.tareas_abiertas + e.tareas_abiertas,
      }),
      { ventas: 0, egresos: 0, margen: 0, clientes_activos: 0, tareas_abiertas: 0 },
    );

    return json({ ok: true, empresas, total });
  } catch (err) {
    console.error("[holding-overview] error", err);
    return json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
