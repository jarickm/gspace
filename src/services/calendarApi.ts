import type { GoogleCalendarEvent } from '../types/gqueues';

export async function fetchCalendarEvents(
  accessToken: string,
  timeMin?: string,
  timeMax?: string
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });

  if (timeMin) params.set('timeMin', timeMin);
  if (timeMax) params.set('timeMax', timeMax);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch calendar events (${res.status}): ${error}`);
  }

  const data = await res.json();
  const items = data.items || [];

  return items.map((e: any) => ({
    id: e.id,
    summary: e.summary || '(Untitled Event)',
    description: e.description,
    start: e.start || {},
    end: e.end || {},
    htmlLink: e.htmlLink,
  }));
}

export async function createCalendarEvent(
  accessToken: string,
  params: {
    summary: string;
    description?: string;
    dueDate?: string; // YYYY-MM-DD or ISO
    timeEstimate?: string;
  }
): Promise<GoogleCalendarEvent> {
  const dateStr = params.dueDate || new Date().toISOString().split('T')[0];
  const isDateTime = dateStr.includes('T');

  const start = isDateTime
    ? { dateTime: dateStr }
    : { date: dateStr.split('T')[0] };

  // Calculate default end time: 1 hour later if datetime, or same day if date
  let end: { dateTime?: string; date?: string };
  if (isDateTime) {
    const startDate = new Date(dateStr);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    end = { dateTime: endDate.toISOString() };
  } else {
    end = { date: dateStr.split('T')[0] };
  }

  const payload = {
    summary: `[GQueues] ${params.summary}`,
    description: params.description ? `${params.description}\n\nSynced from GQueues Workspace Manager` : 'Synced from GQueues Workspace Manager',
    start,
    end,
    reminders: {
      useDefault: true,
    },
  };

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create calendar event (${res.status}): ${error}`);
  }

  const created = await res.json();
  return {
    id: created.id,
    summary: created.summary,
    description: created.description,
    start: created.start,
    end: created.end,
    htmlLink: created.htmlLink,
  };
}

export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok && res.status !== 204 && res.status !== 404 && res.status !== 410) {
    const error = await res.text();
    throw new Error(`Failed to delete calendar event (${res.status}): ${error}`);
  }
}
