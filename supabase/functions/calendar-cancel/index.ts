// Cancel an appointment: deletes the Google Calendar event and marks the cita as cancelada.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY = 'https://connector-gateway.lovable.dev/google_calendar/calendar/v3';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, message: 'No autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: team } = await supabase.from('crm_team_members').select('email').eq('email', user.email).maybeSingle();
    if (!team) {
      return new Response(JSON.stringify({ ok: false, message: 'No autorizado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { cita_id } = await req.json();
    if (!cita_id) {
      return new Response(JSON.stringify({ ok: false, message: 'cita_id requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: cita, error: fetchErr } = await supabase
      .from('crm_citas_diagnostico')
      .select('*')
      .eq('id', cita_id)
      .single();
    if (fetchErr || !cita) {
      return new Response(JSON.stringify({ ok: false, message: 'Cita no encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (cita.calendar_event_id) {
      const lovableKey = Deno.env.get('LOVABLE_API_KEY');
      const gcalKey = Deno.env.get('GOOGLE_CALENDAR_API_KEY');
      const delRes = await fetch(
        `${GATEWAY}/calendars/primary/events/${cita.calendar_event_id}?sendUpdates=all`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            'X-Connection-Api-Key': gcalKey!,
          },
        },
      );
      // 404/410 = ya no existe en Calendar, seguimos igual.
      if (!delRes.ok && delRes.status !== 404 && delRes.status !== 410) {
        const errText = await delRes.text();
        console.error(`[calendar-cancel] Google Calendar delete error [${delRes.status}]: ${errText}`);
      }
    }

    const { data: updated, error: updErr } = await supabase
      .from('crm_citas_diagnostico')
      .update({ estado: 'cancelada' })
      .eq('id', cita_id)
      .select('*')
      .single();
    if (updErr) {
      return new Response(JSON.stringify({ ok: false, message: updErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, cita: updated }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[calendar-cancel] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
