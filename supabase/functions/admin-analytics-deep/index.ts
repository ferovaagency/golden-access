// Métricas agregadas por cliente para el panel de administración: uso real
// del Planner, salud financiera, madurez del CRM propio de cada pyme y
// riesgo de abandono. Sólo agregados numéricos -- nunca notas, mensajes ni
// otro contenido libre del cliente.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

type Row = Record<string, any>;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

function groupBy(rows: Row[], key: string): Map<string, Row[]> {
  const map = new Map<string, Row[]>();
  for (const row of rows) {
    const k = row[key];
    if (!k) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(row);
  }
  return map;
}

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
    if (!user?.email) {
      return new Response(JSON.stringify({ ok: false, message: 'Sesión inválida' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: team } = await admin.from('crm_team_members').select('email, rol').eq('email', user.email).maybeSingle();
    if (!team || team.rol !== 'owner') {
      return new Response(JSON.stringify({ ok: false, message: 'No autorizado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: teamEmails } = await admin.from('crm_team_members').select('email');
    const teamEmailSet = new Set((teamEmails || []).map((t: Row) => t.email));

    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const [
      { data: authUsers, error: authErr },
      { data: profiles },
      { data: subs },
      { data: courtesy },
      { data: tasks },
      { data: ventas },
      { data: pagos },
      { data: abonos },
      { data: budgets },
      { data: accounts },
      { data: receivables },
      { data: payables },
      { data: contactos },
      { data: campaigns },
      { data: events },
    ] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from('business_profile').select('user_id, nombre_negocio, onboarding_completado'),
      admin.from('user_subscriptions').select('user_id, status, plan, created_at').eq('status', 'active').order('created_at', { ascending: false }),
      admin.from('courtesy_access_grants').select('email, plan'),
      admin.from('planner_tasks').select('user_id, status, estimated_minutes, actual_minutes, created_at'),
      admin.from('finance_ventas').select('user_id, fecha'),
      admin.from('finance_pagos_egresos').select('user_id, fecha'),
      admin.from('finance_abonos').select('user_id, fecha'),
      admin.from('finance_budget_monthly').select('user_id, periodo'),
      admin.from('finance_accounts').select('user_id, saldo_inicial, activo'),
      admin.from('finance_receivables').select('user_id, estado, vencimiento, valor'),
      admin.from('finance_payables').select('user_id, estado, vencimiento, valor, monto_pagado'),
      admin.from('biz_crm_contactos').select('user_id, estado, proxima_accion'),
      admin.from('marketing_campaigns').select('user_id'),
      admin.from('saas_user_events').select('user_id, module, created_at').order('created_at', { ascending: false }).limit(5000),
    ]);
    if (authErr) throw authErr;

    const profileByUser = new Map((profiles || []).map((p: Row) => [p.user_id, p]));
    const latestSubByUser = new Map<string, Row>();
    for (const s of subs || []) if (!latestSubByUser.has(s.user_id)) latestSubByUser.set(s.user_id, s);
    const courtesyByEmail = new Map((courtesy || []).map((c: Row) => [c.email, c]));

    const tasksByUser = groupBy(tasks || [], 'user_id');
    const ventasByUser = groupBy(ventas || [], 'user_id');
    const pagosByUser = groupBy(pagos || [], 'user_id');
    const abonosByUser = groupBy(abonos || [], 'user_id');
    const budgetsByUser = groupBy(budgets || [], 'user_id');
    const accountsByUser = groupBy(accounts || [], 'user_id');
    const receivablesByUser = groupBy(receivables || [], 'user_id');
    const payablesByUser = groupBy(payables || [], 'user_id');
    const contactosByUser = groupBy(contactos || [], 'user_id');
    const campaignsByUser = groupBy(campaigns || [], 'user_id');
    const eventsByUser = groupBy(events || [], 'user_id');

    const customers = (authUsers?.users || [])
      .filter((u: Row) => u.email && !teamEmailSet.has(u.email))
      .map((u: Row) => {
        const sub = latestSubByUser.get(u.id);
        const grant = u.email ? courtesyByEmail.get(u.email) : null;
        const profile = profileByUser.get(u.id);
        const estadoSuscripcion = sub ? 'activo' : (grant ? 'cortesia' : 'sin_pago');

        // Planner: volumen, cumplimiento y precisión de estimación.
        const myTasks = tasksByUser.get(u.id) || [];
        const completed = myTasks.filter((t: Row) => t.status === 'done');
        const withActual = completed.filter((t: Row) => t.actual_minutes != null && t.estimated_minutes);
        const avgRatio = withActual.length
          ? withActual.reduce((sum: number, t: Row) => sum + t.actual_minutes / t.estimated_minutes, 0) / withActual.length
          : null;
        const lastTaskAt = myTasks.reduce<string | null>((max: string | null, t: Row) => (!max || t.created_at > max ? t.created_at : max), null);

        // Finanzas: frecuencia de registro, caja y cartera vencida.
        const finRecords = [...(ventasByUser.get(u.id) || []), ...(pagosByUser.get(u.id) || []), ...(abonosByUser.get(u.id) || [])];
        const finLast30d = finRecords.filter((r: Row) => r.fecha >= since30).length;
        const lastFinFecha = finRecords.reduce<string | null>((max: string | null, r: Row) => (!max || r.fecha > max ? r.fecha : max), null);
        const cashBalance = (accountsByUser.get(u.id) || [])
          .filter((a: Row) => a.activo)
          .reduce((sum: number, a: Row) => sum + Number(a.saldo_inicial || 0), 0);
        const overdueReceivables = (receivablesByUser.get(u.id) || [])
          .filter((r: Row) => r.estado !== 'pagada' && r.estado !== 'cancelada' && r.vencimiento && r.vencimiento < today);
        const overduePayables = (payablesByUser.get(u.id) || [])
          .filter((p: Row) => p.estado !== 'pagada' && p.estado !== 'cancelada' && p.vencimiento && p.vencimiento < today);

        // CRM propio del cliente (biz_crm_contactos, distinto del CRM interno de Ferova).
        const myContacts = contactosByUser.get(u.id) || [];
        const contactsByStage: Record<string, number> = {};
        for (const c of myContacts) contactsByStage[c.estado] = (contactsByStage[c.estado] || 0) + 1;
        const withNextAction = myContacts.filter((c: Row) => c.proxima_accion).length;

        // Engagement general (navegación registrada).
        const myEvents = eventsByUser.get(u.id) || [];
        const moduleDiversity = new Set(myEvents.map((e: Row) => e.module)).size;
        const lastActiveAt = myEvents[0]?.created_at || null;
        const inactiveDays = daysSince(lastActiveAt);

        // Riesgo de abandono: heurística transparente por puntos, no un modelo predictivo.
        let riskPoints = 0;
        const riskReasons: string[] = [];
        if (estadoSuscripcion === 'sin_pago') { riskPoints += 2; riskReasons.push('Sin pago activo'); }
        if (inactiveDays == null) { riskPoints += 1; riskReasons.push('Sin actividad medida'); }
        else if (inactiveDays > 21) { riskPoints += 2; riskReasons.push(`${inactiveDays} días sin actividad`); }
        else if (inactiveDays > 10) { riskPoints += 1; riskReasons.push(`${inactiveDays} días sin actividad`); }
        if (!profile?.onboarding_completado) { riskPoints += 1; riskReasons.push('Onboarding incompleto'); }
        if (finLast30d === 0) { riskPoints += 1; riskReasons.push('Sin registros financieros en 30 días'); }
        const riskLevel = riskPoints >= 4 ? 'alto' : riskPoints >= 2 ? 'medio' : 'bajo';

        // Venta cruzada: módulos del producto que el cliente todavía no usa.
        const crossSell: string[] = [];
        if (myTasks.length === 0) crossSell.push('Planner');
        if (myContacts.length === 0) crossSell.push('CRM de ventas');
        if ((budgetsByUser.get(u.id) || []).length === 0) crossSell.push('Presupuesto mensual');
        if ((campaignsByUser.get(u.id) || []).length === 0) crossSell.push('Marketing ROI');

        return {
          user_id: u.id,
          email: u.email,
          nombre_negocio: profile?.nombre_negocio || null,
          plan: sub?.plan || grant?.plan || 'financiero',
          estado_suscripcion: estadoSuscripcion,
          planner: {
            totalTasks: myTasks.length,
            completedTasks: completed.length,
            completionRate: myTasks.length ? Math.round((completed.length / myTasks.length) * 100) : null,
            avgActualVsEstimatedRatio: avgRatio != null ? Math.round(avgRatio * 100) / 100 : null,
            lastTaskAt,
          },
          finance: {
            entriesLast30d: finLast30d,
            lastEntryAt: lastFinFecha,
            budgetsSet: (budgetsByUser.get(u.id) || []).length,
            cashBalance,
            overdueReceivables: { count: overdueReceivables.length, total: overdueReceivables.reduce((s: number, r: Row) => s + Number(r.valor || 0), 0) },
            overduePayables: { count: overduePayables.length, total: overduePayables.reduce((s: number, p: Row) => s + (Number(p.valor || 0) - Number(p.monto_pagado || 0)), 0) },
          },
          crm: {
            totalContacts: myContacts.length,
            byStage: contactsByStage,
            withNextAction,
          },
          engagement: { totalEvents: myEvents.length, moduleDiversity, lastActiveAt, inactiveDays },
          risk: { level: riskLevel, points: riskPoints, reasons: riskReasons },
          crossSell,
        };
      })
      .sort((a, b) => b.risk.points - a.risk.points);

    const portfolio = {
      totalCustomers: customers.length,
      altoRiesgo: customers.filter((c) => c.risk.level === 'alto').length,
      medioRiesgo: customers.filter((c) => c.risk.level === 'medio').length,
      bajoRiesgo: customers.filter((c) => c.risk.level === 'bajo').length,
      carteraVencidaTotal: customers.reduce((s, c) => s + c.finance.overdueReceivables.total, 0),
      porPagarVencidoTotal: customers.reduce((s, c) => s + c.finance.overduePayables.total, 0),
      sinPlanner: customers.filter((c) => c.planner.totalTasks === 0).length,
      sinCrm: customers.filter((c) => c.crm.totalContacts === 0).length,
      generatedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify({ ok: true, portfolio, customers }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[admin-analytics-deep] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
