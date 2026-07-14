// Da acceso de cortesia (sin pago) a un email. Accion sensible -- requiere no
// solo ser miembro del equipo, sino tener rol 'owner' en crm_team_members
// (primer uso real de esa columna en el codigo). Deliberadamente separado de
// crm_team_members: agregar a alguien ahi le daria acceso al CRM interno de
// prospeccion de Ferova, que no es lo que se busca aqui.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod';

const BodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  plan: z.enum(['financiero', 'crm_ventas', 'completo']).default('completo'),
  notas: z.string().trim().max(500).optional(),
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
    if (!team) {
      return new Response(JSON.stringify({ ok: false, message: 'No autorizado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (team.rol !== 'owner') {
      return new Response(JSON.stringify({ ok: false, message: 'Solo el owner del equipo puede dar acceso de cortesía.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsedBody = BodySchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return new Response(JSON.stringify({ ok: false, message: 'Parámetros inválidos', errors: parsedBody.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { email, plan, notas } = parsedBody.data;

    const { data: grant, error } = await admin
      .from('courtesy_access_grants')
      .upsert({ email, plan, notas: notas || null, granted_by: user.email })
      .select('*')
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, grant }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[admin-grant-courtesy-access] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
