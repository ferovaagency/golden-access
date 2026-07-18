// Lista todos los clientes (pymes que pagan) para el portal de administración
// de Mafe: perfil de negocio, plan y estado de suscripción. Excluye al equipo
// interno de Ferova (crm_team_members) -- esos no son clientes.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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
    const teamEmailSet = new Set((teamEmails || []).map((t: any) => t.email));

    const [{ data: authUsers, error: authErr }, { data: profiles }, { data: subs }, { data: courtesy }] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from('business_profile').select('user_id, nombre_negocio, onboarding_completado'),
      admin.from('user_subscriptions').select('user_id, status, plan, created_at').eq('status', 'active').order('created_at', { ascending: false }),
      admin.from('courtesy_access_grants').select('email, plan, notas'),
    ]);
    if (authErr) throw authErr;

    const profileByUser = new Map((profiles || []).map((p: any) => [p.user_id, p]));
    const latestSubByUser = new Map<string, any>();
    for (const s of subs || []) {
      if (!latestSubByUser.has(s.user_id)) latestSubByUser.set(s.user_id, s);
    }
    const courtesyByEmail = new Map((courtesy || []).map((c: any) => [c.email, c]));

    const customers = (authUsers?.users || [])
      .filter((u: any) => u.email && !teamEmailSet.has(u.email))
      .map((u: any) => {
        const sub = latestSubByUser.get(u.id);
        const grant = u.email ? courtesyByEmail.get(u.email) : null;
        const profile = profileByUser.get(u.id);
        const esCortesia = !sub && !!grant;
        return {
          user_id: u.id,
          email: u.email,
          created_at: u.created_at,
          nombre_negocio: profile?.nombre_negocio || null,
          onboarding_completado: !!profile?.onboarding_completado,
          plan: sub?.plan || grant?.plan || 'financiero',
          estado_suscripcion: sub ? 'activo' : (grant ? 'cortesia' : 'sin_pago'),
          es_cortesia: esCortesia,
          notas_cortesia: grant?.notas || null,
        };
      })
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return new Response(JSON.stringify({ ok: true, customers }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[admin-list-customers] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
