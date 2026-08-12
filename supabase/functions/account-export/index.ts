// Fase 6 (confianza del cliente) — Ferova One: exportación integral autoservicio.
//
// La objeción #1 contra un proveedor de una sola persona es "¿y si desaparecen?".
// No se vence con argumentos, se vence con un botón de exportar. Esta función
// devuelve TODOS los datos del usuario que la pide, en JSON abierto, sin que
// tenga que escribirnos. Es portabilidad: su información es suya.
//
// Seguridad: la identidad se deriva del JWT verificado, NUNCA del cuerpo. Se
// usa service_role solo para leer, y cada consulta está anclada a user_id (o al
// dueño correspondiente). Es de solo lectura: no muta nada.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Tablas propias del usuario. columna = la que ancla la propiedad (user_id por
// defecto; algunas usan otra). Si una tabla no existe o no aplica, se omite sin
// romper el resto del export.
const OWNED: Array<{ table: string; column?: string }> = [
  { table: 'business_profile' },
  { table: 'user_fiscal_profile' },
  { table: 'user_subscriptions' },
  { table: 'user_notifications' },
  { table: 'finance_ventas' },
  { table: 'finance_pagos_egresos' },
  { table: 'finance_otros_gastos' },
  { table: 'finance_abonos' },
  { table: 'finance_accounts' },
  { table: 'finance_payment_methods' },
  { table: 'finance_budget_monthly' },
  { table: 'finance_clientes' },
  { table: 'finance_servicios' },
  { table: 'finance_herramientas' },
  { table: 'finance_herramienta_servicios' },
  { table: 'finance_horas' },
  { table: 'finance_config' },
  { table: 'finance_debts' },
  { table: 'finance_debt_payments' },
  { table: 'finance_receivables' },
  { table: 'finance_receivable_payments' },
  { table: 'finance_payables' },
  { table: 'planner_tasks' },
  { table: 'planner_blocks' },
  { table: 'planner_goals' },
  { table: 'planner_inbox' },
  { table: 'planner_routines' },
  { table: 'planner_briefings' },
  { table: 'planner_insights' },
  { table: 'planner_behavior' },
  { table: 'biz_crm_contactos' },
  { table: 'marketing_campaigns' },
  { table: 'marketing_campaign_metrics' },
  { table: 'project_kpis' },
  { table: 'project_kpi_entries' },
  { table: 'operating_kpi_days' },
  { table: 'operating_kpi_settings' },
  { table: 'ceo_reports' },
  { table: 'decision_simulations' },
  { table: 'business_blindspots' },
  { table: 'business_health_snapshots' },
  { table: 'business_assistant_messages' },
  { table: 'onboarding_messages' },
  { table: 'audit_log' },
  { table: 'calculation_runs' },
  // El "cerebro": conocimiento del negocio. Se ancla por owner_user_id.
  { table: 'ferova_knowledge', column: 'owner_user_id' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, message: 'No autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return new Response(JSON.stringify({ ok: false, message: 'Sesión inválida' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const userId = user.id;

    const data: Record<string, unknown> = {};
    const omitidas: string[] = [];
    for (const { table, column } of OWNED) {
      try {
        const { data: rows, error } = await admin.from(table).select('*').eq(column || 'user_id', userId);
        if (error) { omitidas.push(table); continue; }
        data[table] = rows || [];
      } catch {
        omitidas.push(table);
      }
    }

    const payload = {
      export: {
        producto: 'Ferova One',
        generado_en: new Date().toISOString(),
        usuario: { id: userId, email: user.email || null },
        formato: 'json',
        nota: 'Copia completa de tus datos en Ferova One. Tablas omitidas (no aplican o vacías): ' + (omitidas.join(', ') || 'ninguna'),
      },
      data,
    };

    const filename = `ferova-export-${new Date().toISOString().slice(0, 10)}.json`;
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[account-export] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
