import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
const BOOKING_LINK = "https://calendar.app.google/NuikMY4L6FcUDMUP6";

function phoneFromText(text: string): string | null {
  const match = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
  return match ? match[0].replace(/[^\d+]/g, "") : null;
}

function nameFromEvent(event: any, email?: string | null): string {
  const summary = String(event.summary || "").replace(/diagn[oó]stico|ferova|reuni[oó]n|cita/gi, "").replace(/[·|-]/g, " ").trim();
  if (summary && summary.length > 2) return summary.slice(0, 120);
  return event.attendees?.find((a: any) => a.displayName)?.displayName || email?.split("@")[0] || "Prospecto desde reserva";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, message: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user?.email) return new Response(JSON.stringify({ ok: false, message: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: member } = await userClient.from("crm_team_members").select("email").eq("email", user.email).maybeSingle();
    if (!member) return new Response(JSON.stringify({ ok: false, message: "No autorizado" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const gcalKey = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
    if (!lovableKey || !gcalKey) return new Response(JSON.stringify({ ok: false, message: "Google Calendar no está configurado" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(Number(body.days || 30), 1), 90);
    const timeMin = new Date(Date.now() - days * 86_400_000).toISOString();
    const url = `${GATEWAY}/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=100&timeMin=${encodeURIComponent(timeMin)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gcalKey } });
    if (!res.ok) {
      const details = await res.text();
      return new Response(JSON.stringify({ ok: false, message: "No pude leer Calendar", status: res.status, details }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const json = await res.json();
    const events = (json.items || []).filter((event: any) => {
      const haystack = `${event.summary || ""}\n${event.description || ""}\n${event.htmlLink || ""}`.toLowerCase();
      return event.status !== "cancelled" && !event.recurringEventId && (haystack.includes("calendar.app.google") || haystack.includes("diagn") || (event.attendees || []).length);
    });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const created: any[] = [];
    let skipped = 0;

    for (const event of events) {
      const { data: existing } = await admin.from("crm_citas_diagnostico").select("id").eq("calendar_event_id", event.id).maybeSingle();
      if (existing) { skipped++; continue; }
      const attendee = (event.attendees || []).find((a: any) => a.email && a.email !== user.email) || (event.attendees || [])[0];
      const email = attendee?.email || null;
      const description = String(event.description || "");
      const phone = phoneFromText(description);
      const nombre = nameFromEvent(event, email);
      const start = event.start?.dateTime || event.start?.date;
      const end = event.end?.dateTime || event.end?.date;
      if (!start) { skipped++; continue; }
      const duration = end ? Math.max(15, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)) : 30;

      let { data: oportunidad } = await admin.from("crm_oportunidades").select("*").or(email ? `email.eq.${email}` : `nombre_contacto.eq.${nombre}`).maybeSingle();
      if (!oportunidad) {
        const { data } = await admin.from("crm_oportunidades").insert({
          nombre_contacto: nombre,
          email,
          telefono: phone,
          canal_origen: "web",
          estado: "nuevo",
          fuente_url: BOOKING_LINK,
          notas: `Reserva detectada en Google Calendar.\n${description}`.slice(0, 3000),
          siguiente_accion: "Revisar diagnóstico agendado, enriquecer datos y preparar conversación.",
        }).select("*").single();
        oportunidad = data;
      }

      const meetLink = event.hangoutLink || event.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri || null;
      const { data: cita, error: citaErr } = await admin.from("crm_citas_diagnostico").insert({
        oportunidad_id: oportunidad?.id || null,
        nombre_prospecto: nombre,
        email_prospecto: email,
        telefono_prospecto: phone,
        fecha_hora: new Date(start).toISOString(),
        duracion_min: duration,
        estado: "agendada",
        es_pagada: false,
        calendar_event_id: event.id,
        meet_link: meetLink,
        notas: `Importada desde link de reserva. ${event.htmlLink || ""}`,
        source: "booking_link",
      }).select("*").single();
      if (citaErr) { skipped++; continue; }
      created.push(cita);

      if (oportunidad?.id && email) {
        fetch(`${SUPABASE_URL}/functions/v1/apollo-enrich-playbook`, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ oportunidad_id: oportunidad.id, email, fuente_url: BOOKING_LINK, contexto_publicacion: description }),
        }).catch(() => null);
      }
    }

    return new Response(JSON.stringify({ ok: true, scanned: events.length, inserted: created.length, skipped, citas: created }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[calendar-sync-bookings] error", err);
    return new Response(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});