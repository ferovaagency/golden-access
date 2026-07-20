// Revoca el acceso de un cliente (activo o de cortesia). No borra su cuenta
// ni sus datos -- solo cancela su suscripcion activa y, si tenia acceso de
// cortesia, borra el grant (para que resolveAccess() no se lo vuelva a dar
// solo en su proximo login). Reversible: se puede volver a dar de alta.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod';

const BodySchema = z.object({
  user_id: z.string().uuid(),
});

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

    const parsedBody = BodySchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return new Response(JSON.stringify({ ok: false, message: 'Parámetros inválidos', errors: parsedBody.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { user_id } = parsedBody.data;

    const { error: cancelErr, count: cancelledCount } = await admin
      .from('user_subscriptions')
      .update({ status: 'cancelled' }, { count: 'exact' })
      .eq('user_id', user_id)
      .eq('status', 'active');
    if (cancelErr) throw cancelErr;

    const { data: authUser, error: userErr } = await admin.auth.admin.getUserById(user_id);
    if (userErr) throw userErr;
    const email = authUser?.user?.email;

    let courtesyRevoked = false;
    if (email) {
      const { data: deletedGrant, error: grantErr } = await admin
        .from('courtesy_access_grants')
        .delete()
        .eq('email', email)
        .select('email')
        .maybeSingle();
      if (grantErr) throw grantErr;
      courtesyRevoked = !!deletedGrant;
    }

    if (!cancelledCount && !courtesyRevoked) {
      return new Response(JSON.stringify({ ok: false, message: 'Este cliente no tenía suscripción activa ni acceso de cortesía -- no había nada que revocar.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, subscriptions_cancelled: cancelledCount || 0, courtesy_revoked: courtesyRevoked }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[admin-revoke-access] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
