import type { GQueueTask, GQueueTaskMetadata, QueueList } from '../types/gqueues';

const META_SEPARATOR = '\n\n--- [gqueues-meta] ---\n';

export function serializeNotes(cleanNotes: string, meta: GQueueTaskMetadata): string {
  const hasMeta =
    (meta.priority && meta.priority !== 'none') ||
    (meta.tags && meta.tags.length > 0) ||
    meta.starred ||
    (meta.subtasks && meta.subtasks.length > 0) ||
    meta.assignedContact ||
    (meta.driveAttachments && meta.driveAttachments.length > 0) ||
    meta.calendarEventId ||
    meta.timeEstimate;

  const trimmedNotes = (cleanNotes || '').trim();
  if (!hasMeta) {
    return trimmedNotes;
  }

  const metaJson = JSON.stringify(meta);
  return trimmedNotes ? `${trimmedNotes}${META_SEPARATOR}${metaJson}` : `${META_SEPARATOR}${metaJson}`;
}

export function deserializeNotes(rawNotes?: string): { cleanNotes: string; meta: GQueueTaskMetadata } {
  if (!rawNotes) {
    return { cleanNotes: '', meta: {} };
  }

  const separatorIndex = rawNotes.indexOf(META_SEPARATOR);
  if (separatorIndex === -1) {
    return { cleanNotes: rawNotes, meta: {} };
  }

  const cleanNotes = rawNotes.substring(0, separatorIndex).trim();
  const jsonStr = rawNotes.substring(separatorIndex + META_SEPARATOR.length).trim();

  try {
    const meta = JSON.parse(jsonStr) as GQueueTaskMetadata;
    return { cleanNotes, meta };
  } catch {
    return { cleanNotes: rawNotes, meta: {} };
  }
}

interface RawGoogleTaskList {
  id: string;
  title: string;
  updated: string;
}

interface RawGoogleTask {
  id: string;
  title?: string;
  updated: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  completed?: string;
  parent?: string;
  position?: string;
  deleted?: boolean;
  hidden?: boolean;
}

// Color palette for queues like GQueues
const QUEUE_COLORS = [
  '#2563eb', // Blue
  '#059669', // Emerald
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#dc2626', // Red
  '#0891b2', // Cyan
  '#db2777', // Pink
  '#4f46e5', // Indigo
];

function getQueueColor(title: string, index: number): string {
  return QUEUE_COLORS[index % QUEUE_COLORS.length];
}

export function parseQueueTitle(rawTitle: string): { category: string; title: string } {
  // Supports "[Work] Project Alpha" or "Work / Project Alpha"
  const bracketMatch = rawTitle.match(/^\[(.*?)\]\s*(.*)$/);
  if (bracketMatch) {
    return { category: bracketMatch[1].trim(), title: bracketMatch[2].trim() };
  }

  const slashMatch = rawTitle.match(/^(.*?)\s*\/\s*(.*)$/);
  if (slashMatch && slashMatch[1] && slashMatch[2]) {
    return { category: slashMatch[1].trim(), title: slashMatch[2].trim() };
  }

  return { category: 'My Queues', title: rawTitle };
}

export function formatQueueTitle(category: string, title: string): string {
  if (!category || category === 'My Queues' || category === 'General') {
    return title;
  }
  return `[${category}] ${title}`;
}

export async function fetchTaskLists(accessToken: string): Promise<QueueList[]> {
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=100', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to fetch task lists (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  const items: RawGoogleTaskList[] = data.items || [];

  return items.map((item, idx) => {
    const parsed = parseQueueTitle(item.title);
    return {
      id: item.id,
      title: parsed.title,
      category: parsed.category,
      updated: item.updated,
      color: getQueueColor(item.title, idx),
    };
  });
}

export async function createTaskList(
  accessToken: string,
  title: string,
  category: string
): Promise<QueueList> {
  const formattedTitle = formatQueueTitle(category, title);
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: formattedTitle }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create queue (${res.status}): ${error}`);
  }

  const item: RawGoogleTaskList = await res.json();
  const parsed = parseQueueTitle(item.title);
  return {
    id: item.id,
    title: parsed.title,
    category: parsed.category,
    updated: item.updated,
    color: getQueueColor(item.title, 0),
  };
}

export async function updateTaskList(
  accessToken: string,
  listId: string,
  title: string,
  category: string
): Promise<QueueList> {
  const formattedTitle = formatQueueTitle(category, title);
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/users/@me/lists/${listId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: formattedTitle }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to update queue (${res.status}): ${error}`);
  }

  const item: RawGoogleTaskList = await res.json();
  const parsed = parseQueueTitle(item.title);
  return {
    id: item.id,
    title: parsed.title,
    category: parsed.category,
    updated: item.updated,
    color: getQueueColor(item.title, 0),
  };
}

export async function deleteTaskList(accessToken: string, listId: string): Promise<void> {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/users/@me/lists/${listId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 204) {
    const error = await res.text();
    throw new Error(`Failed to delete queue (${res.status}): ${error}`);
  }
}

export async function fetchTasks(accessToken: string, listId: string): Promise<GQueueTask[]> {
  const url = `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=true&showHidden=true&maxResults=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch tasks for list ${listId} (${res.status}): ${error}`);
  }

  const data = await res.json();
  const items: RawGoogleTask[] = data.items || [];

  return items
    .filter((t) => !t.deleted)
    .map((item) => {
      const { cleanNotes, meta } = deserializeNotes(item.notes);
      return {
        id: item.id,
        listId,
        title: item.title || '(No title)',
        notes: cleanNotes,
        rawNotes: item.notes,
        status: item.status,
        due: item.due,
        completed: item.completed,
        updated: item.updated,
        parent: item.parent,
        position: item.position,
        priority: meta.priority || 'none',
        tags: meta.tags || [],
        starred: !!meta.starred,
        subtasks: meta.subtasks || [],
        assignedContact: meta.assignedContact,
        driveAttachments: meta.driveAttachments || [],
        calendarEventId: meta.calendarEventId,
        timeEstimate: meta.timeEstimate,
      };
    });
}

export async function createTask(
  accessToken: string,
  listId: string,
  data: Partial<GQueueTask>
): Promise<GQueueTask> {
  const meta: GQueueTaskMetadata = {
    priority: data.priority || 'none',
    tags: data.tags || [],
    starred: !!data.starred,
    subtasks: data.subtasks || [],
    assignedContact: data.assignedContact,
    driveAttachments: data.driveAttachments || [],
    calendarEventId: data.calendarEventId,
    timeEstimate: data.timeEstimate,
  };

  const payload: Record<string, unknown> = {
    title: data.title || 'New Task',
    notes: serializeNotes(data.notes || '', meta),
    status: data.status || 'needsAction',
  };

  if (data.due) {
    // Format due date in RFC 3339 format required by Google Tasks API
    payload.due = data.due.includes('T') ? data.due : `${data.due}T00:00:00.000Z`;
  }

  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create task (${res.status}): ${error}`);
  }

  const item: RawGoogleTask = await res.json();
  const { cleanNotes, meta: parsedMeta } = deserializeNotes(item.notes);

  return {
    id: item.id,
    listId,
    title: item.title || 'New Task',
    notes: cleanNotes,
    rawNotes: item.notes,
    status: item.status,
    due: item.due,
    completed: item.completed,
    updated: item.updated,
    parent: item.parent,
    position: item.position,
    priority: parsedMeta.priority || 'none',
    tags: parsedMeta.tags || [],
    starred: !!parsedMeta.starred,
    subtasks: parsedMeta.subtasks || [],
    assignedContact: parsedMeta.assignedContact,
    driveAttachments: parsedMeta.driveAttachments || [],
    calendarEventId: parsedMeta.calendarEventId,
    timeEstimate: parsedMeta.timeEstimate,
  };
}

export async function updateTask(
  accessToken: string,
  listId: string,
  taskId: string,
  data: Partial<GQueueTask>
): Promise<GQueueTask> {
  const meta: GQueueTaskMetadata = {
    priority: data.priority || 'none',
    tags: data.tags || [],
    starred: !!data.starred,
    subtasks: data.subtasks || [],
    assignedContact: data.assignedContact,
    driveAttachments: data.driveAttachments || [],
    calendarEventId: data.calendarEventId,
    timeEstimate: data.timeEstimate,
  };

  const payload: Record<string, unknown> = {
    id: taskId,
    title: data.title,
    notes: serializeNotes(data.notes || '', meta),
    status: data.status,
  };

  if (data.due) {
    payload.due = data.due.includes('T') ? data.due : `${data.due}T00:00:00.000Z`;
  } else if (data.due === null || data.due === '') {
    payload.due = null;
  }

  if (data.completed) {
    payload.completed = data.completed;
  }

  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to update task (${res.status}): ${error}`);
  }

  const item: RawGoogleTask = await res.json();
  const { cleanNotes, meta: parsedMeta } = deserializeNotes(item.notes);

  return {
    id: item.id,
    listId,
    title: item.title || '',
    notes: cleanNotes,
    rawNotes: item.notes,
    status: item.status,
    due: item.due,
    completed: item.completed,
    updated: item.updated,
    parent: item.parent,
    position: item.position,
    priority: parsedMeta.priority || 'none',
    tags: parsedMeta.tags || [],
    starred: !!parsedMeta.starred,
    subtasks: parsedMeta.subtasks || [],
    assignedContact: parsedMeta.assignedContact,
    driveAttachments: parsedMeta.driveAttachments || [],
    calendarEventId: parsedMeta.calendarEventId,
    timeEstimate: parsedMeta.timeEstimate,
  };
}

export async function deleteTask(accessToken: string, listId: string, taskId: string): Promise<void> {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 204) {
    const error = await res.text();
    throw new Error(`Failed to delete task (${res.status}): ${error}`);
  }
}

export async function clearCompletedTasks(accessToken: string, listId: string): Promise<void> {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 204) {
    const error = await res.text();
    throw new Error(`Failed to clear completed tasks (${res.status}): ${error}`);
  }
}
