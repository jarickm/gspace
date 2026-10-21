/**
 * Client service for calling server-side Gemini AI endpoints.
 * All API key credentials remain secure on the server side.
 */

export interface AISubtask {
  id: string;
  title: string;
  completed: boolean;
  timeEstimate?: string;
}

export interface TaskBreakdownResult {
  subtasks: AISubtask[];
  suggestedPriority: 'urgent' | 'high' | 'medium' | 'low';
  suggestedTimeEstimate: string;
  reasoning: string;
}

export interface TaskSuggestions {
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  timeEstimate?: string;
  tags?: string[];
  suggestedNotes?: string;
  tip?: string;
}

export interface DailyBriefingResult {
  headline: string;
  summary: string;
  topPriorities: string[];
  scheduleAnalysis?: string;
  motivationalTip?: string;
}

export interface MeetingPrepResult {
  agenda: string[];
  prepTasks: Array<{ title: string; timeEstimate?: string }>;
  discussionQuestions: string[];
  outcomeGoal: string;
}

export interface NaturalTaskResult {
  title: string;
  dueDate?: string | null;
  priority?: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  timeEstimate?: string | null;
  tags?: string[];
  notes?: string | null;
}

export interface AIChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface AIChatResponse {
  reply: string;
  suggestedAction?: {
    type: string;
    task?: {
      title: string;
      due?: string;
      priority?: string;
      timeEstimate?: string;
      notes?: string;
    };
  } | null;
}

export async function aiBreakdownTask(
  taskTitle: string,
  notes?: string,
  currentSubtasks?: string[]
): Promise<TaskBreakdownResult> {
  const res = await fetch('/api/ai/breakdown-task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskTitle, notes, currentSubtasks }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `AI breakdown failed (${res.status})`);
  }

  return res.json();
}

export async function aiSuggestTaskDetails(
  title: string,
  notes?: string,
  dueDate?: string
): Promise<TaskSuggestions> {
  const res = await fetch('/api/ai/suggest-details', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, notes, dueDate }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `AI suggestions failed (${res.status})`);
  }

  return res.json();
}

export async function aiGenerateDailyBriefing(
  tasks: any[],
  meetings: any[],
  timeZone = 'Asia/Manila'
): Promise<DailyBriefingResult> {
  const res = await fetch('/api/ai/daily-briefing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks, meetings, timeZone }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `AI Daily Briefing failed (${res.status})`);
  }

  return res.json();
}

export async function aiGenerateMeetingPrep(
  summary: string,
  description?: string,
  attendees?: any[],
  location?: string
): Promise<MeetingPrepResult> {
  const res = await fetch('/api/ai/meeting-prep', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary, description, attendees, location }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `AI Meeting Prep failed (${res.status})`);
  }

  return res.json();
}

export async function aiParseNaturalTask(
  input: string,
  todayDateStr?: string
): Promise<NaturalTaskResult> {
  const res = await fetch('/api/ai/parse-natural', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, todayDateStr }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `AI Natural Add failed (${res.status})`);
  }

  return res.json();
}

export async function aiChatAssistant(
  message: string,
  history: AIChatMessage[] = [],
  workspaceContext: Record<string, any> = {}
): Promise<AIChatResponse> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, workspaceContext }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `AI Chat Assistant failed (${res.status})`);
  }

  return res.json();
}
