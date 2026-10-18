export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export type KanbanStatus = 'todo' | 'in_progress' | 'waiting' | 'done';

export type RecurringSchedule = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export type ViewMode = 'tasks' | 'kanban' | 'calendar' | 'completed';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  due?: string;
}

export interface DriveAttachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
}

export interface AssignedContact {
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface GQueueTaskMetadata {
  priority?: Priority;
  tags?: string[];
  starred?: boolean;
  subtasks?: Subtask[];
  assignedContact?: AssignedContact;
  driveAttachments?: DriveAttachment[];
  calendarEventId?: string;
  timeEstimate?: string;
  kanbanStatus?: KanbanStatus;
  recurring?: RecurringSchedule;
  reminder?: string;
  completedAt?: string;
  createdAt?: string;
}

export interface GQueueTask {
  id: string;
  listId: string;
  title: string;
  notes: string; // Clean user notes without metadata block
  rawNotes?: string;
  status: 'needsAction' | 'completed';
  due?: string; // ISO string or YYYY-MM-DD
  completed?: string;
  updated: string;
  parent?: string;
  position?: string;
  
  // GQueues advanced metadata
  priority: Priority;
  tags: string[];
  starred: boolean;
  subtasks: Subtask[];
  assignedContact?: AssignedContact;
  driveAttachments: DriveAttachment[];
  calendarEventId?: string;
  timeEstimate?: string;
  kanbanStatus: KanbanStatus;
  recurring: RecurringSchedule;
  reminder?: string;
  completedAt?: string;
  createdAt?: string;
}

export interface QueueList {
  id: string;
  title: string;
  updated?: string;
  category: string;
  color: string;
  taskCount?: number;
  completedCount?: number;
}

export type SmartQueueType = 'today' | 'overdue' | 'upcoming' | 'starred' | 'all' | 'completed';

export interface GoogleContact {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  jobTitle?: string;
  department?: string;
  source?: 'contacts' | 'directory' | 'other' | 'custom';
  isOrgMember?: boolean;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  iconLink?: string;
  modifiedTime?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
}
