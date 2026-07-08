/**
 * Agendamiento de citas de diagnóstico vía Google Calendar.
 *
 * Reutiliza el mismo patrón que sheetsService.ts: llamadas directas a la API
 * de Google con el access token OAuth del miembro del equipo (obtenido con
 * el mismo googleSignIn/linkGoogleIdentity ya usado para Sheets/Drive, ahora
 * también con el scope calendar.events). No requiere ninguna credencial nueva.
 */

export interface DiagnosticEventInput {
  summary: string;
  description: string;
  startISO: string;
  endISO: string;
  attendeeEmail?: string;
}

export interface DiagnosticEventResult {
  eventId: string;
  meetLink: string | null;
  htmlLink: string;
}

export async function createDiagnosticEvent(
  accessToken: string,
  input: DiagnosticEventInput
): Promise<DiagnosticEventResult> {
  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.startISO },
    end: { dateTime: input.endISO },
    conferenceData: {
      createRequest: {
        requestId: `ferova-diag-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };
  if (input.attendeeEmail) {
    body.attendees = [{ email: input.attendeeEmail }];
  }

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    throw new Error(`Error creando el evento en Google Calendar: ${errText}`);
  }

  const data = await res.json();
  const meetLink =
    data.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri || data.hangoutLink || null;

  return { eventId: data.id, meetLink, htmlLink: data.htmlLink };
}

export async function deleteDiagnosticEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    throw new Error(`Error cancelando el evento: ${await res.text()}`);
  }
}

export interface DayEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
}

export async function listEventsForDay(accessToken: string, dayISODate: string): Promise<DayEvent[]> {
  const timeMin = `${dayISODate}T00:00:00Z`;
  const timeMax = `${dayISODate}T23:59:59Z`;
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
    timeMin
  )}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    throw new Error(`Error consultando el calendario: ${await res.text()}`);
  }
  const data = await res.json();
  return (data.items || []).map((e: any) => ({
    id: e.id,
    summary: e.summary || '(sin título)',
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
  }));
}
