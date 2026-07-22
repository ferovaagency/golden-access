import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY = 'https://connector-gateway.lovable.dev/google_calendar/calendar/v3';
const MAX_OCCURRENCES = 180;

type Body = {
  id: string;
  title: string;
  category: string;
  priority: string;
  financial_impact?: number;
  client_impact?: number;
  risk_score?: number;
  execution_ease?: number;
  dependency_task_ids?: string[];
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

function zoneParts(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(value).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
}

function startAt(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetAt = (instant: Date) => {
    const parts = zoneParts(instant, timeZone);
    return (Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) - instant.getTime()) / 60_000;
  };
  let instant = new Date(wallClockAsUtc - offsetAt(new Date(wallClockAsUtc)) * 60_000);
  instant = new Date(wallClockAsUtc - offsetAt(instant) * 60_000);
  return instant;
}

function scoreInput(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.min(5, Math.round(number))) : 3;
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
    const { data: businessProfile } = await admin.from('business_profile').select('zona_horaria').eq('user_id', user.id).maybeSingle();
    const timeZone = businessProfile?.zona_horaria || 'America/Bogota';
    const { data: current, error: currentError } = await admin.from('planner_tasks').select('id, google_calendar_event_id').eq('id', body.id).eq('user_id', user.id).maybeSingle();
    if (currentError) throw currentError;
    if (!current) return new Response(JSON.stringify({ ok: false, message: 'No se encontró la tarea' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const days = validDays(body.recurrence_days);
    const taskPatch = {
      title: body.title.trim(), category: body.category, priority: body.priority,
      financial_impact: scoreInput(body.financial_impact), client_impact: scoreInput(body.client_impact),
      risk_score: scoreInput(body.risk_score), execution_ease: scoreInput(body.execution_ease),
      dependency_task_ids: Array.from(new Set((Array.isArray(body.dependency_task_ids) ? body.dependency_task_ids : []).filter((id): id is string => typeof id === 'string' && id !== body.id))),
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
        const start = startAt(date, body.schedule_time!, timeZone);
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
        const start = startAt(body.scheduled_for, body.schedule_time, timeZone);
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
