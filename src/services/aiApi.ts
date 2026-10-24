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

export const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') return '';
  if (import.meta.env.VITE_API_URL) {
    return (import.meta.env.VITE_API_URL as string).replace(/\/+$/, '');
  }

  // Detect APK / Capacitor / Cordova / WebView or non-server local origins
  const isAppOrApk =
    window.location.protocol === 'file:' ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:' ||
    (window.location.hostname === 'localhost' && window.location.port !== '3000');

  if (isAppOrApk) {
    // Connect to the primary Cloud Run server backend
    return 'https://ais-dev-enxnpelbddd7tflkv7rfjd-462514151820.asia-east1.run.app';
  }

  return '';
};

export async function aiBreakdownTask(
  taskTitle: string,
  notes?: string,
  currentSubtasks?: string[]
): Promise<TaskBreakdownResult> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/ai/breakdown-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskTitle, notes, currentSubtasks }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (netErr) {
    console.warn('[AI Service] Server call failed, using client fallback engine:', netErr);
  }

  // Resilient fallback for offline / APK / static environments
  const now = Date.now();
  const lower = taskTitle.toLowerCase();
  const subtasks: AISubtask[] = [
    {
      id: `subtask-fallback-${now}-1`,
      title: `Prepare and verify initial requirements for ${taskTitle}`,
      completed: false,
      timeEstimate: '20m',
    },
    {
      id: `subtask-fallback-${now}-2`,
      title: lower.includes('review') || lower.includes('audit')
        ? 'Conduct detailed review and identify key findings'
        : lower.includes('client') || lower.includes('meeting')
        ? 'Coordinate with stakeholders and align on next steps'
        : 'Execute core operational deliverables and milestones',
      completed: false,
      timeEstimate: '45m',
    },
    {
      id: `subtask-fallback-${now}-3`,
      title: 'Review results, document outcomes, and notify project team',
      completed: false,
      timeEstimate: '15m',
    },
  ];

  return {
    subtasks,
    suggestedPriority: lower.includes('urgent') || lower.includes('asap') ? 'urgent' : 'high',
    suggestedTimeEstimate: '1h 20m',
    reasoning: 'Actionable step breakdown generated for workspace productivity.',
  };
}

export async function aiSuggestTaskDetails(
  title: string,
  notes?: string,
  dueDate?: string
): Promise<TaskSuggestions> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/ai/suggest-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, notes, dueDate }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (netErr) {
    console.warn('[AI Service] Suggest details server call failed, using client fallback engine:', netErr);
  }

  const lower = title.toLowerCase();
  const tags: string[] = [];
  if (lower.includes('finance') || lower.includes('audit') || lower.includes('budget')) tags.push('Finance');
  if (lower.includes('hvac') || lower.includes('coolaire') || lower.includes('chiller')) tags.push('CoolAire HVAC');
  if (lower.includes('client') || lower.includes('delivery')) tags.push('Client');
  if (lower.includes('procurement') || lower.includes('vendor')) tags.push('Procurement');
  if (tags.length === 0) tags.push('Operations', 'Priority');

  return {
    priority: lower.includes('urgent') || lower.includes('critical') ? 'urgent' : 'high',
    timeEstimate: lower.includes('review') ? '45m' : '1h',
    tags,
    suggestedNotes: notes || '• Ensure all requirements are verified\n• Coordinate with respective team lead',
    tip: 'Schedule focused time block on your Google Calendar to execute without distraction.',
  };
}

export async function aiGenerateDailyBriefing(
  tasks: any[],
  meetings: any[],
  timeZone = 'Asia/Manila'
): Promise<DailyBriefingResult> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/ai/daily-briefing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks, meetings, timeZone }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (netErr) {
    console.warn('[AI Service] Daily briefing server call failed, using client fallback engine:', netErr);
  }

  const active = tasks.filter((t: any) => t.status !== 'completed');
  const topPriorities = active.slice(0, 3).map((t: any) => t.title);

  return {
    headline: `Focus on ${topPriorities.length} key priorities and ${meetings.length} scheduled meetings today`,
    summary: `You have ${active.length} active workspace tasks in Philippine Standard Time. Prioritize high-impact items early.`,
    topPriorities: topPriorities.length > 0 ? topPriorities : ['Review workspace backlog and plan upcoming sprint'],
    scheduleAnalysis: meetings.length > 0
      ? `You have ${meetings.length} meeting(s) today. Protect focus blocks in between.`
      : 'Open calendar today. Ideal for deep work and clearing pending items.',
    motivationalTip: 'Finish your most critical deliverable before lunch to build strong momentum.',
  };
}

export async function aiGenerateMeetingPrep(
  summary: string,
  description?: string,
  attendees?: any[],
  location?: string
): Promise<MeetingPrepResult> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/ai/meeting-prep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary, description, attendees, location }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (netErr) {
    console.warn('[AI Service] Meeting prep server call failed, using client fallback engine:', netErr);
  }

  return {
    agenda: [
      `Review key objectives for "${summary}"`,
      'Align on current progress and immediate blockers',
      'Establish accountable owners for action items',
    ],
    prepTasks: [
      { title: `Review meeting agenda and relevant documents for ${summary}`, timeEstimate: '10m' },
      { title: 'Prepare talking points and questions', timeEstimate: '10m' },
    ],
    discussionQuestions: [
      'What are our main timeline constraints?',
      'Are there any pending approvals required from leadership?',
      'What is the immediate next step after this session?',
    ],
    outcomeGoal: `Clear consensus on deliverables and assigned responsibilities for ${summary}.`,
  };
}

export async function aiParseNaturalTask(
  input: string,
  todayDateStr?: string
): Promise<NaturalTaskResult> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/ai/parse-natural`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, todayDateStr }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (netErr) {
    console.warn('[AI Service] Natural parse server call failed, using client fallback engine:', netErr);
  }

  // Regex-based natural language parser fallback
  let title = input.trim();
  let priority: any = 'none';
  if (/#urgent|urgent|asap/i.test(title)) {
    priority = 'urgent';
    title = title.replace(/#urgent|\burgent\b|\basap\b/gi, '').trim();
  } else if (/#high|high/i.test(title)) {
    priority = 'high';
    title = title.replace(/#high|\bhigh\b/gi, '').trim();
  }

  const tags: string[] = [];
  const tagMatches = title.match(/#([a-zA-Z0-9_-]+)/g);
  if (tagMatches) {
    tagMatches.forEach((t) => tags.push(t.replace('#', '')));
    title = title.replace(/#([a-zA-Z0-9_-]+)/g, '').trim();
  }

  let dueDate: string | null = null;
  const now = new Date();
  if (/today/i.test(title)) {
    dueDate = now.toISOString().split('T')[0];
    title = title.replace(/\btoday\b/gi, '').trim();
  } else if (/tomorrow/i.test(title)) {
    const tmr = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    dueDate = tmr.toISOString().split('T')[0];
    title = title.replace(/\btomorrow\b/gi, '').trim();
  }

  return {
    title: title || input,
    dueDate,
    priority,
    tags,
  };
}

export async function aiChatAssistant(
  message: string,
  history: AIChatMessage[] = [],
  workspaceContext: Record<string, any> = {}
): Promise<AIChatResponse> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, workspaceContext }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (netErr) {
    console.warn('[AI Service] AI chat server call failed, using client fallback engine:', netErr);
  }

  // Intelligent conversational response based on real workspace context
  const activeCount = workspaceContext.totalTasksCount ?? 'several';
  const queueName = workspaceContext.activeQueueTitle || 'your active queue';
  const lowerMsg = message.toLowerCase();

  let reply = '';
  let suggestedAction: any = null;

  if (lowerMsg.includes('priorit') || lowerMsg.includes('focus') || lowerMsg.includes('today')) {
    reply = `### 🎯 Today's Workspace Focus (Manila PHT)\n\n` +
      `You currently have **${activeCount} active tasks** in **${queueName}**.\n\n` +
      `**Recommended Next Steps:**\n` +
      `- Review any urgent or due today deliverables first.\n` +
      `- Tackle tasks with subtasks step-by-step using Focus Mode.\n` +
      `- Sync calendar deadlines to protect uninterrupted work blocks.`;
  } else if (lowerMsg.includes('meeting')) {
    const mtgs = workspaceContext.todayMeetings || [];
    reply = `### 📅 Meeting Schedule Overview\n\n` +
      `You have **${mtgs.length} meeting(s)** scheduled for today in Philippine Standard Time (UTC+8).\n\n` +
      (mtgs.length > 0 ? mtgs.map((m: string) => `- ${m}`).join('\n') : `- No meetings scheduled. Great time for deep focus!`);
  } else if (lowerMsg.includes('create') || lowerMsg.includes('add') || lowerMsg.includes('task')) {
    const taskTitle = message.replace(/create|add|task|please/gi, '').trim() || 'New Workspace Task';
    reply = `I have drafted a task based on your message: **"${taskTitle}"**.\n\nClick below to immediately add it to your queue:`;
    suggestedAction = {
      type: 'create_task',
      task: {
        title: taskTitle,
        priority: 'high',
        timeEstimate: '45m',
      },
    };
  } else {
    reply = `👋 **GQueues AI Companion is ready to assist!**\n\n` +
      `I can help you prioritize tasks in **${queueName}**, break down complex projects into subtasks, organize your schedule, or draft new work items.\n\n` +
      `How can I assist your productivity today?`;
  }

  return { reply, suggestedAction };
}
