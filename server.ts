import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Google GenAI SDK (Server-Side Only per security rules)
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';

const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper to call Gemini with resilient fallback between gemini-3.8-flash and gemini-3.1-flash-lite
async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
  const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: systemInstruction
          ? {
              systemInstruction,
              temperature: 0.2,
            }
          : {
              temperature: 0.2,
            },
      });

      if (response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini API] Model ${model} encountered error:`, err?.message || err);
      // If 503 or 429, continue to next model in list
      if (err?.status === 503 || err?.status === 429 || err?.message?.includes('demand')) {
        continue;
      }
      // If other error, still try fallback before giving up
    }
  }

  throw lastError || new Error('All Gemini models failed to respond');
}

// -------------------------------------------------------------
// AI API Endpoints for GQueues Workspace Manager
// -------------------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!apiKey,
    timestamp: new Date().toISOString(),
  });
});

// 1. Task Breakdown into Subtasks
app.post('/api/ai/breakdown-task', async (req, res) => {
  try {
    const { taskTitle, notes, currentSubtasks } = req.body;
    if (!taskTitle) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const prompt = `You are an expert project manager and productivity coach for GQueues Workspace.
Break down this task into 3 to 6 logical, actionable, sequential subtasks.
Each subtask must be clear, concise, and start with an action verb.

Task Title: "${taskTitle}"
Existing Notes: "${notes || 'None'}"
Existing Subtasks: ${JSON.stringify(currentSubtasks || [])}

Respond ONLY with valid JSON in this exact structure:
{
  "subtasks": [
    { "title": "Specific action step", "timeEstimate": "15m" }
  ],
  "suggestedPriority": "urgent" | "high" | "medium" | "low",
  "suggestedTimeEstimate": "1h 30m",
  "reasoning": "Brief 1-sentence explanation"
}`;

    const text = await callGemini(
      prompt,
      'You are a JSON-only response engine. Return only pure JSON without markdown code fences or backticks.'
    );

    // Clean JSON if code fences are present
    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    // Format subtasks with unique IDs
    const formattedSubtasks = (parsed.subtasks || []).map((s: any, idx: number) => ({
      id: `subtask-ai-${Date.now()}-${idx}`,
      title: s.title || String(s),
      completed: false,
      timeEstimate: s.timeEstimate || undefined,
    }));

    res.json({
      subtasks: formattedSubtasks,
      suggestedPriority: parsed.suggestedPriority || 'medium',
      suggestedTimeEstimate: parsed.suggestedTimeEstimate || '30m',
      reasoning: parsed.reasoning || 'Automated task breakdown based on best practices',
    });
  } catch (error: any) {
    console.error('Error in /api/ai/breakdown-task:', error);
    res.status(500).json({
      error: error?.message || 'Failed to generate task breakdown',
    });
  }
});

// 2. Task Details Enhancer (Suggest Priority, Time, Tags, Notes)
app.post('/api/ai/suggest-details', async (req, res) => {
  try {
    const { title, notes, dueDate } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const prompt = `Analyze this task for a professional Google Workspace user:
Title: "${title}"
Notes: "${notes || ''}"
Due Date: "${dueDate || 'Unscheduled'}"

Recommend:
1. Priority: "urgent" (critical/deadlines), "high", "medium", or "low"
2. Realistic Time Estimate: e.g. "30m", "1h", "2h 30m"
3. Recommended Tags: 2-4 clean short tags (e.g. ["Procurement", "Review", "FollowUp"])
4. Clean Refined Description / Notes: helpful checklist or structured notes if appropriate
5. One quick productivity tip for completing it efficiently.

Return ONLY raw JSON with keys: "priority", "timeEstimate", "tags", "suggestedNotes", "tip".`;

    const text = await callGemini(
      prompt,
      'You are a JSON-only response engine. Return only pure JSON without markdown code fences.'
    );

    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/suggest-details:', error);
    res.status(500).json({
      error: error?.message || 'Failed to suggest task details',
    });
  }
});

// 3. AI Executive Daily Briefing
app.post('/api/ai/daily-briefing', async (req, res) => {
  try {
    const { tasks = [], meetings = [], timeZone = 'Asia/Manila' } = req.body;

    const prompt = `Generate a motivating, high-impact Daily Executive Briefing for a user operating in ${timeZone} (Philippine Standard Time, UTC+8).

Today's Scheduled Meetings (${meetings.length}):
${JSON.stringify(meetings.slice(0, 8))}

Pending / Due Tasks (${tasks.length}):
${JSON.stringify(tasks.slice(0, 15).map((t: any) => ({
  title: t.title,
  priority: t.priority,
  due: t.due,
  timeEstimate: t.timeEstimate,
  status: t.status,
  isBlocked: !!(t.dependsOn && t.dependsOn.length > 0),
})))}

Generate an executive briefing with:
1. headline: Catchy 1-line summary (e.g. "Focus on 2 key client meetings and 3 high-priority tasks")
2. summary: 2-3 sentence executive overview of the day
3. topPriorities: Array of the top 3-4 specific things to accomplish first
4. scheduleAnalysis: Any meeting overlaps, tight transitions, or protected focus blocks
5. motivationalTip: A sharp, professional productivity tip

Return ONLY valid JSON with keys: "headline", "summary", "topPriorities", "scheduleAnalysis", "motivationalTip".`;

    const text = await callGemini(
      prompt,
      'You are a JSON-only response engine. Return only pure JSON without markdown code fences.'
    );

    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/daily-briefing:', error);
    res.status(500).json({
      error: error?.message || 'Failed to generate daily briefing',
    });
  }
});

// 4. Meeting Preparation & Action Items
app.post('/api/ai/meeting-prep', async (req, res) => {
  try {
    const { summary, description, attendees, location } = req.body;
    if (!summary) {
      return res.status(400).json({ error: 'Meeting summary is required' });
    }

    const prompt = `You are an executive assistant preparing a briefing for this Google Workspace meeting:
Title: "${summary}"
Description: "${description || 'None'}"
Location / Link: "${location || 'Google Meet'}"
Attendees: ${JSON.stringify(attendees || [])}

Generate:
1. agenda: 3-5 structured agenda bullet points
2. prepTasks: 2-4 preparation tasks that should be done BEFORE the meeting (with time estimates like "10m", "20m")
3. discussionQuestions: 3 thought-provoking questions to ask during the meeting
4. outcomeGoal: 1 clear sentence describing what a successful meeting outcome looks like.

Return ONLY raw JSON with keys: "agenda", "prepTasks", "discussionQuestions", "outcomeGoal".`;

    const text = await callGemini(
      prompt,
      'You are a JSON-only response engine. Return only pure JSON without markdown code fences.'
    );

    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/meeting-prep:', error);
    res.status(500).json({
      error: error?.message || 'Failed to generate meeting preparation',
    });
  }
});

// 5. Natural Language Smart Add Parser
app.post('/api/ai/parse-natural', async (req, res) => {
  try {
    const { input, todayDateStr = new Date().toISOString().split('T')[0] } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const prompt = `Today is ${todayDateStr}.
Parse the following natural language task into structured GQueues fields:
Input: "${input}"

Examples:
- "Submit payroll audit by Friday 4pm urgent #finance" -> title: "Submit payroll audit", dueDate: "[Friday YYYY-MM-DD]", priority: "urgent", tags: ["finance"], timeEstimate: "1h"
- "Review CoolAire HVAC specs next Tuesday" -> title: "Review CoolAire HVAC specs", dueDate: "[Tuesday YYYY-MM-DD]", priority: "medium", tags: []

Return ONLY raw JSON with keys:
"title", "dueDate" (YYYY-MM-DD or null), "priority" ("urgent"|"high"|"medium"|"low"|"none"), "timeEstimate" (string or null), "tags" (string array), "notes" (string or null).`;

    const text = await callGemini(
      prompt,
      'You are a JSON-only response engine. Return only pure JSON without markdown code fences.'
    );

    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/parse-natural:', error);
    res.status(500).json({
      error: error?.message || 'Failed to parse natural language task',
    });
  }
});

// 6. GQueues AI Companion Chat Assistant
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history = [], workspaceContext = {} } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const systemPrompt = `You are GQueues AI Companion, an intelligent executive assistant integrated directly into GQueues Workspace Manager.
You have real-time visibility into the user's tasks, queues, and Google Calendar meetings (operating in Philippine Standard Time / Manila UTC+8).
Be concise, proactive, actionable, and professional.

Current Workspace Context:
- Active Queue: ${workspaceContext.activeQueueTitle || 'All Queues'}
- Total Active Tasks: ${workspaceContext.totalTasksCount ?? 'Unknown'}
- Urgent Tasks: ${JSON.stringify(workspaceContext.urgentTasks || [])}
- Due Today / Tomorrow: ${JSON.stringify(workspaceContext.dueSoonTasks || [])}
- Blocked Tasks: ${JSON.stringify(workspaceContext.blockedTasks || [])}
- Today's Meetings: ${JSON.stringify(workspaceContext.todayMeetings || [])}

If the user asks to create or schedule a task, format a suggestedAction in your JSON response so the app can offer a 1-click button to create it!

Respond with JSON in this format:
{
  "reply": "Your markdown formatted conversational response with bullet points and clear recommendations",
  "suggestedAction": null | {
    "type": "create_task",
    "task": {
      "title": "Task title",
      "due": "YYYY-MM-DD",
      "priority": "high",
      "timeEstimate": "45m",
      "notes": "Optional notes"
    }
  }
}`;

    const prompt = `Conversation history:
${history.map((h: any) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n')}

User's new message: "${message}"

Generate a helpful response and return ONLY valid JSON with keys "reply" and "suggestedAction".`;

    const text = await callGemini(prompt, systemPrompt);
    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/chat:', error);
    res.status(500).json({
      error: error?.message || 'Failed to process AI chat message',
    });
  }
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 GQueues Full-Stack Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
