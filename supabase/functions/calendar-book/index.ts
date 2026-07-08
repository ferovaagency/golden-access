// Book a diagnostic appointment: creates a Google Calendar event (with Meet link)
// via the Lovable connector gateway, then inserts a row into crm_citas_diagnostico.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface BookBody {
  oportunidad_id?: string | null;
  nombre_prospecto: string;
  email_prospecto?: string | null;
  telefono_prospecto?: string | null;
  fecha_hora: string; // ISO
  duracion_min?: number;
  notas?: string | null;
}

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

    // Team-member guard
    const { data: team } = await supabase.from('crm_team_members').select('email').eq('email', user.email).maybeSingle();
    if (!team) {
      return new Response(JSON.stringify({ ok: false, message: 'No autorizado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as BookBody;
    if (!body?.nombre_prospecto || !body?.fecha_hora) {
      return new Response(JSON.stringify({ ok: false, message: 'nombre_prospecto y fecha_hora son requeridos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const duracion = body.duracion_min ?? 30;
    const start = new Date(body.fecha_hora);
    if (Number.isNaN(start.getTime())) {
      return new Response(JSON.stringify({ ok: false, message: 'fecha_hora inválida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const end = new Date(start.getTime() + duracion * 60_000);

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const gcalKey = Deno.env.get('GOOGLE_CALENDAR_API_KEY');
    if (!lovableKey || !gcalKey) {
      return new Response(JSON.stringify({ ok: false, message: 'Google Calendar no configurado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const attendees: Array<{ email: string }> = [];
    if (body.email_prospecto) attendees.push({ email: body.email_prospecto });

    const event = {
      summary: `Diagnóstico Ferova · ${body.nombre_prospecto}`,
      description: [
        body.notas || 'Cita de diagnóstico agendada desde el CRM de Ferova.',
        body.telefono_prospecto ? `WhatsApp: ${body.telefono_prospecto}` : null,
      ].filter(Boolean).join('\n\n'),
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: `ferova-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    const gcalRes = await fetch(
      `${GATEWAY}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          'X-Connection-Api-Key': gcalKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      },
    );

    if (!gcalRes.ok) {
      const errText = await gcalRes.text();
      console.error(`[calendar-book] Google Calendar error [${gcalRes.status}]: ${errText}`);
      return new Response(
        JSON.stringify({ ok: false, message: 'Error creando evento en Google Calendar', status: gcalRes.status, details: errText }),
        { status: gcalRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const gEvent = await gcalRes.json();
    const meetLink = gEvent.hangoutLink
      || gEvent.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri
      || null;

    let oportunidadId = body.oportunidad_id || null;
    if (!oportunidadId) {
      const existingQuery = supabase.from('crm_oportunidades').select('*');
      const { data: existing } = body.email_prospecto
        ? await existingQuery.eq('email', body.email_prospecto).maybeSingle()
        : await existingQuery.eq('nombre_contacto', body.nombre_prospecto).maybeSingle();
      if (existing?.id) oportunidadId = existing.id;
      else {
        const { data: opp, error: oppErr } = await supabase
          .from('crm_oportunidades')
          .insert({
            nombre_contacto: body.nombre_prospecto,
            email: body.email_prospecto || null,
            telefono: body.telefono_prospecto || null,
            canal_origen: 'web',
            estado: 'nuevo',
            fuente_url: 'calendar-manual',
            notas: body.notas || 'Prospecto creado automáticamente desde una cita de diagnóstico.',
            siguiente_accion: 'Preparar diagnóstico y completar datos del prospecto.',
          })
          .select('*')
          .single();
        if (oppErr) throw oppErr;
        oportunidadId = opp.id;
      }
    }

    // Insert into crm_citas_diagnostico (RLS uses caller's JWT)
    const { data: cita, error: insErr } = await supabase
      .from('crm_citas_diagnostico')
      .insert({
        oportunidad_id: oportunidadId,
        nombre_prospecto: body.nombre_prospecto,
        email_prospecto: body.email_prospecto || null,
        telefono_prospecto: body.telefono_prospecto || null,
        fecha_hora: start.toISOString(),
        duracion_min: duracion,
        estado: 'agendada',
        es_pagada: false,
        calendar_event_id: gEvent.id,
        meet_link: meetLink,
        notas: body.notas || null,
        source: 'manual',
      })
      .select('*')
      .single();

    if (insErr) {
      console.error('[calendar-book] insert error:', insErr);
      return new Response(JSON.stringify({ ok: false, message: insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (oportunidadId && body.email_prospecto) {
      await fetch(`${Deno.env.get('SUPABASE_URL')!}/functions/v1/apollo-enrich-playbook`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oportunidad_id: oportunidadId,
          email: body.email_prospecto,
          fuente_url: 'calendar-manual',
          contexto_publicacion: body.notas || 'Cita de diagnóstico agendada manualmente desde el CRM.',
        }),
      }).catch(() => null);
    }

    return new Response(JSON.stringify({ ok: true, cita }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[calendar-book] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
