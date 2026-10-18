import type { GoogleCalendarEvent, CalendarMeeting } from '../types/gqueues';

export interface CalendarEventAttendee {
  email: string;
  displayName?: string;
}

export interface CreateCalendarEventParams {
  summary: string;
  description?: string;
  dueDate?: string; // YYYY-MM-DD or ISO
  timeEstimate?: string;
  attendees?: CalendarEventAttendee[];
  sendUpdates?: 'all' | 'none' | 'externalOnly';
}

export interface UpdateCalendarEventParams {
  summary?: string;
  description?: string;
  dueDate?: string;
  timeEstimate?: string;
  attendees?: CalendarEventAttendee[];
  sendUpdates?: 'all' | 'none' | 'externalOnly';
}

export async function fetchCalendarEvents(
  accessToken: string,
  timeMin?: string,
  timeMax?: string
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
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

/**
 * Check if the user has meetings today in Google Workspace Calendar
 * Returns enriched meetings with Google Meet video links, status, and live countdowns
 */
export async function fetchTodayMeetings(accessToken: string): Promise<CalendarMeeting[]> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    maxResults: '50',
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to check today meetings (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  const items = data.items || [];
  const currentTimeMs = now.getTime();

  return items
    .filter((e: any) => e.status !== 'cancelled')
    .map((e: any) => {
      let isLiveNow = false;
      let startsInMinutes: number | undefined = undefined;

      const startTimeStr = e.start?.dateTime || (e.start?.date ? `${e.start.date}T00:00:00` : null);
      const endTimeStr = e.end?.dateTime || (e.end?.date ? `${e.end.date}T23:59:59` : null);

      if (startTimeStr && endTimeStr) {
        const startMs = new Date(startTimeStr).getTime();
        const endMs = new Date(endTimeStr).getTime();

        if (currentTimeMs >= startMs && currentTimeMs <= endMs) {
          isLiveNow = true;
          startsInMinutes = 0;
        } else if (startMs > currentTimeMs) {
          startsInMinutes = Math.round((startMs - currentTimeMs) / (60 * 1000));
        }
      }

      // Check for Google Meet link
      const hangoutLink =
        e.hangoutLink ||
        e.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri;

      return {
        id: e.id,
        summary: e.summary || '(Untitled Meeting)',
        description: e.description,
        start: e.start || {},
        end: e.end || {},
        htmlLink: e.htmlLink,
        hangoutLink,
        conferenceData: e.conferenceData,
        attendees: e.attendees || [],
        location: e.location,
        status: e.status,
        isLiveNow,
        startsInMinutes,
      };
    });
}

export async function createCalendarEvent(
  accessToken: string,
  params: CreateCalendarEventParams
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

  const payload: any = {
    summary: `[GQueues] ${params.summary}`,
    description: params.description
      ? `${params.description}\n\nSynced from GQueues Workspace Manager`
      : 'Synced from GQueues Workspace Manager',
    start,
    end,
    reminders: {
      useDefault: true,
    },
  };

  // If attendees (e.g. assigned colleague) are provided, add them so the event appears on their calendar!
  if (params.attendees && params.attendees.length > 0) {
    payload.attendees = params.attendees.map((a) => ({
      email: a.email,
      displayName: a.displayName || a.email,
    }));
  }

  // sendUpdates=all delivers the invitation email and adds it directly to the assignee's Google Calendar
  const sendUpdatesParam = params.sendUpdates || (params.attendees?.length ? 'all' : 'none');
  const query = `?sendUpdates=${sendUpdatesParam}`;

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${query}`, {
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

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  params: UpdateCalendarEventParams
): Promise<GoogleCalendarEvent> {
  const payload: any = {};

  if (params.summary) {
    payload.summary = `[GQueues] ${params.summary}`;
  }

  if (params.description !== undefined) {
    payload.description = `${params.description}\n\nSynced from GQueues Workspace Manager`;
  }

  if (params.dueDate) {
    const dateStr = params.dueDate;
    const isDateTime = dateStr.includes('T');
    payload.start = isDateTime ? { dateTime: dateStr } : { date: dateStr.split('T')[0] };
    if (isDateTime) {
      const startDate = new Date(dateStr);
      payload.end = { dateTime: new Date(startDate.getTime() + 60 * 60 * 1000).toISOString() };
    } else {
      payload.end = { date: dateStr.split('T')[0] };
    }
  }

  if (params.attendees) {
    payload.attendees = params.attendees.map((a) => ({
      email: a.email,
      displayName: a.displayName || a.email,
    }));
  }

  const sendUpdatesParam = params.sendUpdates || 'all';
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=${sendUpdatesParam}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to update calendar event (${res.status}): ${error}`);
  }

  const updated = await res.json();
  return {
    id: updated.id,
    summary: updated.summary,
    description: updated.description,
    start: updated.start,
    end: updated.end,
    htmlLink: updated.htmlLink,
  };
}

export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`,
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
