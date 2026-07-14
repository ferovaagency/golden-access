// Guarda (o borra, si viene vacio) el telefono de WhatsApp propio de un miembro
// del equipo para recibir alertas automaticas de leads Hot (ver linkedin-analyze
// + _shared/notify-team.ts). Cada quien solo puede tocar su propia fila -- se
// resuelve por el email del JWT, nunca por un id que venga en el body.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod';

const BodySchema = z.object({
  telefono: z.string().trim().max(20).regex(/^\d*$/, 'Solo dígitos, sin "+" ni espacios (ej. 573001234567)'),
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

    const parsedBody = BodySchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return new Response(JSON.stringify({ ok: false, message: 'Parámetros inválidos', errors: parsedBody.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: updated, error } = await admin
      .from('crm_team_members')
      .update({ telefono_notificaciones: parsedBody.data.telefono || null })
      .eq('email', user.email)
      .select('email, telefono_notificaciones')
      .maybeSingle();
    if (error) {
      return new Response(JSON.stringify({ ok: false, message: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!updated) {
      return new Response(JSON.stringify({ ok: false, message: 'No autorizado (no eres parte del equipo).' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, team_member: updated }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[crm-set-notification-phone] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
