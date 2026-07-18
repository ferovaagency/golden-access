// Cambia el plan (modulos activos) de un cliente. Actualiza la ultima fila
// activa de user_subscriptions, o el grant de cortesia si es un cliente de
// cortesia sin fila de suscripcion.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod';

const BodySchema = z.object({
  user_id: z.string().uuid(),
  plan: z.enum(['projects', 'finance', 'planner', 'crm', 'completo', 'custom', 'financiero', 'crm_ventas']),
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
    const { user_id, plan } = parsedBody.data;

    const { data: activeSub } = await admin
      .from('user_subscriptions')
      .select('id')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeSub) {
      const { error } = await admin.from('user_subscriptions').update({ plan }).eq('id', activeSub.id);
      if (error) throw error;
    } else {
      // Sin suscripcion activa: si es un cliente de cortesia, se actualiza su
      // grant; si no tiene ninguna de las dos, no hay nada que cambiar de
      // plan todavia (no deberia poder entrar a la app de todos modos).
      const { data: authUser, error: userErr } = await admin.auth.admin.getUserById(user_id);
      if (userErr) throw userErr;
      const email = authUser?.user?.email;
      if (!email) {
        return new Response(JSON.stringify({ ok: false, message: 'No se encontró el usuario.' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: grant } = await admin.from('courtesy_access_grants').select('email').eq('email', email).maybeSingle();
      if (!grant) {
        return new Response(JSON.stringify({ ok: false, message: 'Este cliente no tiene una suscripción activa ni acceso de cortesía -- no tiene plan que cambiar.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { error } = await admin.from('courtesy_access_grants').update({ plan }).eq('email', email);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[admin-set-plan] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
