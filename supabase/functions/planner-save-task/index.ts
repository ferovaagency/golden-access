import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY = 'https://connector-gateway.lovable.dev/google_calendar/calendar/v3';
const MAX_OCCURRENCES = 180;

type Body = {
  id: string;
  title: string;
  category: string;
  priority: string;
  client_ref?: string | null;
  deadline?: string | null;
  estimated_minutes: number;
  actual_minutes?: number | null;
  scheduled_for?: string | null;
  schedule_time?: string | null;
  protected?: boolean;
  recurrence_days?: number[];
  recurrence_until?: string | null;
  sync_to_google_calendar?: boolean;
};

const validDays = (days: unknown): number[] => Array.from(new Set(
  (Array.isArray(days) ? days : []).map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
)).sort((a, b) => a - b);

function startAt(date: string, time: string) {
  // Ferova's current product calendar is Colombia-first. Sending an explicit
  // offset prevents an Edge runtime in another region from shifting the task.
  return new Date(`${date}T${time}:00-05:00`);
}

function occurrenceDates(start: string, days: number[], until?: string | null): string[] {
  const first = new Date(`${start}T00:00:00Z`);
  const final = until ? new Date(`${until}T00:00:00Z`) : new Date(first.getTime() + 90 * 86_400_000);
  const result: string[] = [];
  for (let current = first; current <= final && result.length < MAX_OCCURRENCES; current = new Date(current.getTime() + 86_400_000)) {
    const weekday = current.getUTCDay();
    if (days.length === 0 ? current.getTime() === first.getTime() : days.includes(weekday)) result.push(current.toISOString().slice(0, 10));
  }
  return result;
}

function rrule(days: number[], until?: string | null): string[] | undefined {
  if (days.length === 0) return undefined;
  const names = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const parts = [`RRULE:FREQ=WEEKLY;BYDAY=${days.map((day) => names[day]).join(',')}`];
  if (until) parts[0] += `;UNTIL=${until.replaceAll('-', '')}T235959Z`;
  return parts;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ ok: false, message: 'Método no permitido' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ ok: false, message: 'Sesión inválida' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json() as Body;
    if (!body.id || !body.title?.trim() || !Number.isFinite(body.estimated_minutes) || body.estimated_minutes < 5) {
      return new Response(JSON.stringify({ ok: false, message: 'Datos de tarea inválidos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (body.recurrence_until && body.scheduled_for && body.recurrence_until < body.scheduled_for) {
      return new Response(JSON.stringify({ ok: false, message: 'La fecha final no puede ser anterior al inicio' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: current, error: currentError } = await admin.from('planner_tasks').select('id, google_calendar_event_id').eq('id', body.id).eq('user_id', user.id).maybeSingle();
    if (currentError) throw currentError;
    if (!current) return new Response(JSON.stringify({ ok: false, message: 'No se encontró la tarea' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const days = validDays(body.recurrence_days);
    const taskPatch = {
      title: body.title.trim(), category: body.category, priority: body.priority,
      client_ref: body.client_ref || null, deadline: body.deadline || null,
      estimated_minutes: Math.round(body.estimated_minutes), actual_minutes: body.actual_minutes ?? null,
      scheduled_for: body.scheduled_for || null, recurrence_days: days,
      recurrence_until: days.length ? (body.recurrence_until || null) : null,
      sync_to_google_calendar: Boolean(body.sync_to_google_calendar), updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await admin.from('planner_tasks').update(taskPatch).eq('id', body.id).eq('user_id', user.id);
    if (updateError) throw updateError;

    // Materialize the coming instances so the planner can reserve them even
    // when the user opens a future day. They are rebuilt atomically per task.
    const { error: deleteBlocksError } = await admin.from('planner_blocks').delete().eq('user_id', user.id).contains('task_ids', [body.id]);
    if (deleteBlocksError) throw deleteBlocksError;
    if (body.scheduled_for && body.schedule_time) {
      const dates = occurrenceDates(body.scheduled_for, days, body.recurrence_until);
      const blocks = dates.map((date) => {
        const start = startAt(date, body.schedule_time!);
        return {
          user_id: user.id, title: body.title.trim(), category: body.category,
          starts_at: start.toISOString(), ends_at: new Date(start.getTime() + taskPatch.estimated_minutes * 60_000).toISOString(),
          // Recurrent commitments reserve their time by default; the daily
          // planner may only move a one-off task when the user leaves it open.
          task_ids: [body.id], protected: Boolean(body.protected) || days.length > 0, source: days.length ? 'recurrence' : 'task',
          notes: days.length ? `Recurrente: ${days.join(',')}` : null,
        };
      });
      if (blocks.length) {
        const { error: insertBlocksError } = await admin.from('planner_blocks').insert(blocks);
        if (insertBlocksError) throw insertBlocksError;
      }
    }

    let calendar = { synced: false, message: body.sync_to_google_calendar ? 'Google Calendar no está configurado en este proyecto.' : 'Sin sincronización solicitada.' };
    if (body.sync_to_google_calendar && body.scheduled_for && body.schedule_time) {
      const lovableKey = Deno.env.get('LOVABLE_API_KEY');
      const googleKey = Deno.env.get('GOOGLE_CALENDAR_API_KEY');
      if (lovableKey && googleKey) {
        const start = startAt(body.scheduled_for, body.schedule_time);
        const event = {
          summary: body.title.trim(),
          description: `Creado desde Ferova OS.${body.client_ref ? ` Cliente: ${body.client_ref}.` : ''}`,
          start: { dateTime: start.toISOString() },
          end: { dateTime: new Date(start.getTime() + taskPatch.estimated_minutes * 60_000).toISOString() },
          recurrence: rrule(days, body.recurrence_until),
        };
        const url = current.google_calendar_event_id
          ? `${GATEWAY}/calendars/primary/events/${encodeURIComponent(current.google_calendar_event_id)}`
          : `${GATEWAY}/calendars/primary/events`;
        const response = await fetch(url, { method: current.google_calendar_event_id ? 'PUT' : 'POST', headers: { Authorization: `Bearer ${lovableKey}`, 'X-Connection-Api-Key': googleKey, 'Content-Type': 'application/json' }, body: JSON.stringify(event) });
        if (response.ok) {
          const external = await response.json();
          await admin.from('planner_tasks').update({ google_calendar_event_id: external.id }).eq('id', body.id).eq('user_id', user.id);
          calendar = { synced: true, message: days.length ? 'Serie recurrente sincronizada con Google Calendar.' : 'Evento sincronizado con Google Calendar.' };
        } else {
          console.error('[planner-save-task] Google Calendar', response.status, await response.text());
          calendar = { synced: false, message: 'La tarea se guardó, pero Google Calendar rechazó la sincronización.' };
        }
      }
    }
    return new Response(JSON.stringify({ ok: true, calendar }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[planner-save-task]', error);
    return new Response(JSON.stringify({ ok: false, message: error instanceof Error ? error.message : String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
