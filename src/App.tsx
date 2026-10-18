import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  auth,
} from './services/firebase';
import type {
  QueueList,
  GQueueTask,
  SmartQueueType,
  GoogleContact,
  GoogleCalendarEvent,
  DriveAttachment,
  Priority,
  ViewMode,
  KanbanStatus,
} from './types/gqueues';
import {
  fetchTaskLists,
  createTaskList,
  updateTaskList,
  deleteTaskList,
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  clearCompletedTasks,
} from './services/tasksApi';
import {
  fetchCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from './services/calendarApi';
import { fetchContacts } from './services/peopleApi';

import { AuthScreen } from './components/AuthScreen';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { TaskList } from './components/TaskList';
import { KanbanBoard } from './components/KanbanBoard';
import { CalendarView } from './components/CalendarView';
import { CompletedView } from './components/CompletedView';
import { TaskDetailModal } from './components/TaskDetailModal';
import { DrivePickerModal } from './components/DrivePickerModal';
import { NewQueueModal } from './components/NewQueueModal';
import { ConfirmModal } from './components/ConfirmModal';
import { InstallModal } from './components/InstallModal';
import { ExportModal } from './components/ExportModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';

export default function App() {
  // Authentication states
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // App data states
  const [queues, setQueues] = useState<QueueList[]>([]);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);
  const [activeSmartQueue, setActiveSmartQueue] = useState<SmartQueueType | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tasks, setTasks] = useState<GQueueTask[]>([]);
  const [allTasksCache, setAllTasksCache] = useState<Record<string, GQueueTask[]>>({});
  const [contacts, setContacts] = useState<GoogleContact[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>([]);

  // UI state
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentView, setCurrentView] = useState<ViewMode>('tasks');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // Modals state
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<GQueueTask | null>(null);
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [queueModalTarget, setQueueModalTarget] = useState<QueueList | null>(null);
  const [queueModalDefaultCat, setQueueModalDefaultCat] = useState<string>('My Queues');

  // Confirmation Modal state for Workspace Destructive operations
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Initialize auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setIsAuthChecking(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setIsAuthChecking(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Handle Google Workspace Sign-In
  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user as User);
        setToken(res.accessToken);
      }
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        return;
      }
      if (err?.code === 'auth/popup-blocked') {
        setAuthError(
          'Sign-in popup was blocked by your browser. Please allow popups or open the app in a new window.'
        );
        return;
      }
      setAuthError(err?.message || 'Failed to sign in with Google Workspace');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setQueues([]);
    setTasks([]);
    setAllTasksCache({});
    setContacts([]);
    setCalendarEvents([]);
  };

  // Load Queues, Contacts, and Calendar events from Google APIs
  const loadInitialWorkspaceData = useCallback(async (accessToken: string) => {
    setIsSyncing(true);
    try {
      // 1. Fetch Task Lists (Queues)
      let fetchedQueues = await fetchTaskLists(accessToken);
      if (fetchedQueues.length === 0) {
        // Create an initial queue if user has no Google Tasks lists yet
        const defaultQ = await createTaskList(accessToken, 'Work Projects', 'Work');
        fetchedQueues = [defaultQ];
      }

      setQueues(fetchedQueues);
      const initialQueue = fetchedQueues[0];
      setActiveQueueId(initialQueue.id);

      // 2. Fetch Tasks for the active queue
      const initialTasks = await fetchTasks(accessToken, initialQueue.id);
      setTasks(initialTasks);
      setAllTasksCache((prev) => ({ ...prev, [initialQueue.id]: initialTasks }));

      // 3. Fetch Google Contacts & Workspace Organization Directory (in background)
      const userEmail = auth.currentUser?.email || user?.email || '';
      const domain = userEmail.includes('@') ? userEmail.split('@')[1] : 'coolaireconsolidated.com';
      fetchContacts(accessToken, domain).then(setContacts).catch(console.warn);

      // 4. Fetch Google Calendar events (in background)
      const now = new Date();
      const pastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const nextMonth = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();
      fetchCalendarEvents(accessToken, pastMonth, nextMonth)
        .then(setCalendarEvents)
        .catch(console.warn);

      // 5. Preload tasks from other queues for Smart Queues calculation
      for (const q of fetchedQueues) {
        if (q.id !== initialQueue.id) {
          fetchTasks(accessToken, q.id)
            .then((tasks) => {
              setAllTasksCache((prev) => ({ ...prev, [q.id]: tasks }));
            })
            .catch(console.warn);
        }
      }
    } catch (err: any) {
      console.error('Failed to load Google Workspace data:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Trigger loading when token is set
  useEffect(() => {
    if (token) {
      loadInitialWorkspaceData(token);
    }
  }, [token, loadInitialWorkspaceData]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      if (e.key === '?') {
        setIsShortcutsModalOpen((prev) => !prev);
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        const el = document.querySelector('input[placeholder*="Add a task"]') as HTMLInputElement;
        if (el) el.focus();
      } else if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        handleOpenNewQueueModal();
      } else if (e.key === '/') {
        e.preventDefault();
        const searchEl = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (searchEl) searchEl.focus();
      } else if (e.key === '1') {
        setCurrentView('tasks');
      } else if (e.key === '2') {
        setCurrentView('kanban');
      } else if (e.key === '3') {
        setCurrentView('calendar');
      } else if (e.key === '4') {
        setCurrentView('completed');
      } else if (e.key === 't' || e.key === 'T') {
        handleSelectSmartQueue('today');
      } else if (e.key === 'r' || e.key === 'R') {
        handleRefresh();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load tasks when active queue changes
  const handleSelectQueue = async (queueId: string) => {
    setActiveQueueId(queueId);
    setActiveSmartQueue(null);
    if (currentView === 'completed') {
      setCurrentView('tasks');
    }
    if (!token) return;

    // Use cache if available first, then refresh
    if (allTasksCache[queueId]) {
      setTasks(allTasksCache[queueId]);
    } else {
      setIsSyncing(true);
    }

    try {
      const freshTasks = await fetchTasks(token, queueId);
      setTasks(freshTasks);
      setAllTasksCache((prev) => ({ ...prev, [queueId]: freshTasks }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Smart Queue selection
  const handleSelectSmartQueue = (smart: SmartQueueType) => {
    if (smart === 'completed') {
      setCurrentView('completed');
      setActiveSmartQueue(null);
      return;
    }
    if (currentView === 'completed') {
      setCurrentView('tasks');
    }
    setActiveSmartQueue(smart);
    setActiveQueueId(null);
  };

  // Compile all tasks across all queues
  const allTasksCombined = useMemo(() => {
    const list: GQueueTask[] = [];
    const seen = new Set<string>();
    for (const qId of Object.keys(allTasksCache)) {
      for (const t of allTasksCache[qId]) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          list.push(t);
        }
      }
    }
    return list;
  }, [allTasksCache]);

  // Calculate Smart Queue counts
  const smartCounts = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    let todayCount = 0;
    let overdueCount = 0;
    let upcomingCount = 0;
    let starredCount = 0;
    let allActiveCount = 0;
    let completedCount = 0;
    let todayCompleted = 0;

    for (const t of allTasksCombined) {
      if (t.status === 'completed') {
        completedCount++;
        const finishedDate = (t.completed || t.completedAt || t.updated || '').split('T')[0];
        if (finishedDate === today) {
          todayCompleted++;
        }
        continue;
      }

      allActiveCount++;

      if (t.starred || t.priority === 'urgent' || t.priority === 'high') {
        starredCount++;
      }

      if (t.due) {
        const dueDate = t.due.split('T')[0];
        if (dueDate === today) {
          todayCount++;
        } else if (dueDate < today) {
          overdueCount++;
        } else if (dueDate <= sevenDaysLater) {
          upcomingCount++;
        }
      }
    }

    return {
      today: todayCount,
      overdue: overdueCount,
      upcoming: upcomingCount,
      starred: starredCount,
      all: allActiveCount,
      completed: completedCount,
      todayCompleted,
    };
  }, [allTasksCombined]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const t of allTasksCombined) {
      for (const tag of t.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet);
  }, [allTasksCombined]);

  // Determine current active tasks to render
  const tasksToRender = useMemo(() => {
    if (activeSmartQueue) {
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      switch (activeSmartQueue) {
        case 'today':
          return allTasksCombined.filter(
            (t) => t.status !== 'completed' && t.due && t.due.split('T')[0] === today
          );
        case 'overdue':
          return allTasksCombined.filter(
            (t) => t.status !== 'completed' && t.due && t.due.split('T')[0] < today
          );
        case 'upcoming':
          return allTasksCombined.filter(
            (t) =>
              t.status !== 'completed' &&
              t.due &&
              t.due.split('T')[0] >= today &&
              t.due.split('T')[0] <= sevenDaysLater
          );
        case 'starred':
          return allTasksCombined.filter(
            (t) => t.status !== 'completed' && (t.starred || t.priority === 'urgent')
          );
        case 'all':
          return allTasksCombined.filter((t) => t.status !== 'completed');
        case 'completed':
          return allTasksCombined.filter((t) => t.status === 'completed');
      }
    }
    return tasks;
  }, [activeSmartQueue, allTasksCombined, tasks]);

  // Active queue object
  const currentQueue = useMemo(() => {
    return queues.find((q) => q.id === activeQueueId) || null;
  }, [queues, activeQueueId]);

  // Refresh handler
  const handleRefresh = async () => {
    if (!token) return;
    await loadInitialWorkspaceData(token);
  };

  // --- Task CRUD operations ---

  // Quick Add Task
  const handleQuickAddTask = async (
    title: string,
    due?: string,
    priority: Priority = 'none'
  ) => {
    const targetQueueId = activeQueueId || queues[0]?.id;
    if (!token || !targetQueueId) return;

    try {
      const created = await createTask(token, targetQueueId, {
        title,
        due,
        priority,
      });

      // Update state
      setTasks((prev) => [created, ...prev]);
      setAllTasksCache((prev) => ({
        ...prev,
        [targetQueueId]: [created, ...(prev[targetQueueId] || [])],
      }));
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  // Quick Add Kanban Task in specific column
  const handleQuickAddKanbanTask = async (title: string, status: KanbanStatus) => {
    const targetQueueId = activeQueueId || queues[0]?.id;
    if (!token || !targetQueueId) return;

    try {
      const isDone = status === 'done';
      const created = await createTask(token, targetQueueId, {
        title,
        status: isDone ? 'completed' : 'needsAction',
        kanbanStatus: status,
      });

      setTasks((prev) => [created, ...prev]);
      setAllTasksCache((prev) => ({
        ...prev,
        [targetQueueId]: [created, ...(prev[targetQueueId] || [])],
      }));
    } catch (err) {
      console.error('Failed to add kanban task:', err);
    }
  };

  // Toggle Complete / Uncomplete
  const handleToggleComplete = async (task: GQueueTask) => {
    if (!token) return;
    const newStatus = task.status === 'completed' ? 'needsAction' : 'completed';
    const completedDate = newStatus === 'completed' ? new Date().toISOString() : undefined;
    const newKanbanStatus: KanbanStatus = newStatus === 'completed' ? 'done' : 'todo';

    // Optimistic UI update
    const updated: GQueueTask = {
      ...task,
      status: newStatus,
      completed: completedDate,
      kanbanStatus: newKanbanStatus,
    };

    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    setAllTasksCache((prev) => ({
      ...prev,
      [task.listId]: (prev[task.listId] || []).map((t) => (t.id === task.id ? updated : t)),
    }));

    try {
      await updateTask(token, task.listId, task.id, {
        status: newStatus,
        completed: completedDate,
        kanbanStatus: newKanbanStatus,
      });
    } catch (err) {
      console.error('Failed to update task status in Google Tasks:', err);
      // Revert optimistic update on failure
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    }
  };

  // Toggle Star / Flag
  const handleToggleStar = async (task: GQueueTask) => {
    if (!token) return;
    const updated: GQueueTask = { ...task, starred: !task.starred };

    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    setAllTasksCache((prev) => ({
      ...prev,
      [task.listId]: (prev[task.listId] || []).map((t) => (t.id === task.id ? updated : t)),
    }));

    try {
      await updateTask(token, task.listId, task.id, { starred: updated.starred });
    } catch (err) {
      console.error('Failed to star task:', err);
    }
  };

  // Update Task Priority inline
  const handleUpdateTaskPriority = async (task: GQueueTask, priority: Priority) => {
    if (!token) return;
    const updated: GQueueTask = { ...task, priority };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    setAllTasksCache((prev) => ({
      ...prev,
      [task.listId]: (prev[task.listId] || []).map((t) => (t.id === task.id ? updated : t)),
    }));

    try {
      await updateTask(token, task.listId, task.id, { priority });
    } catch (err) {
      console.error('Failed to update priority:', err);
    }
  };

  // Update Task Kanban Status
  const handleUpdateTaskKanbanStatus = async (task: GQueueTask, newStatus: KanbanStatus) => {
    if (!token) return;
    const isNowDone = newStatus === 'done';
    const newGoogleStatus = isNowDone ? 'completed' : 'needsAction';
    const completedDate = isNowDone ? (task.completed || new Date().toISOString()) : undefined;

    const updated: GQueueTask = {
      ...task,
      kanbanStatus: newStatus,
      status: newGoogleStatus,
      completed: completedDate,
    };

    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    setAllTasksCache((prev) => ({
      ...prev,
      [task.listId]: (prev[task.listId] || []).map((t) => (t.id === task.id ? updated : t)),
    }));

    try {
      await updateTask(token, task.listId, task.id, {
        status: newGoogleStatus,
        kanbanStatus: newStatus,
        completed: completedDate,
      });
    } catch (err) {
      console.error('Failed to update kanban status:', err);
    }
  };

  // Save Task Details from Modal
  const handleSaveTaskDetail = async (updatedFields: Partial<GQueueTask>) => {
    if (!token || !selectedTaskForDetail) return;

    const updatedTask: GQueueTask = {
      ...selectedTaskForDetail,
      ...updatedFields,
    };

    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    setAllTasksCache((prev) => ({
      ...prev,
      [updatedTask.listId]: (prev[updatedTask.listId] || []).map((t) =>
        t.id === updatedTask.id ? updatedTask : t
      ),
    }));
    setSelectedTaskForDetail(updatedTask);

    try {
      await updateTask(token, updatedTask.listId, updatedTask.id, {
        title: updatedTask.title,
        notes: updatedTask.notes,
        due: updatedTask.due,
        priority: updatedTask.priority,
        tags: updatedTask.tags,
        starred: updatedTask.starred,
        subtasks: updatedTask.subtasks,
        assignedContact: updatedTask.assignedContact,
        driveAttachments: updatedTask.driveAttachments,
        timeEstimate: updatedTask.timeEstimate,
        recurring: updatedTask.recurring,
      });

      // If task has a synced calendar event, update event details and assignee invitation
      if (updatedTask.calendarEventId) {
        const attendees = updatedTask.assignedContact?.email
          ? [{ email: updatedTask.assignedContact.email, displayName: updatedTask.assignedContact.name }]
          : undefined;

        updateCalendarEvent(token, updatedTask.calendarEventId, {
          summary: updatedTask.title,
          description: updatedTask.notes,
          dueDate: updatedTask.due,
          timeEstimate: updatedTask.timeEstimate,
          attendees,
          sendUpdates: 'all',
        }).catch((err) => console.warn('Failed to update synced Google Calendar event:', err));
      }
    } catch (err) {
      console.error('Failed to update task details:', err);
    }
  };

  // Subtask checkbox toggle
  const handleToggleSubtask = async (task: GQueueTask, subtaskId: string) => {
    if (!token) return;
    const updatedSubtasks = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );

    const updated: GQueueTask = { ...task, subtasks: updatedSubtasks };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    setAllTasksCache((prev) => ({
      ...prev,
      [task.listId]: (prev[task.listId] || []).map((t) => (t.id === task.id ? updated : t)),
    }));

    try {
      await updateTask(token, task.listId, task.id, { subtasks: updatedSubtasks });
    } catch (err) {
      console.error(err);
    }
  };

  // Add new subtask inline
  const handleAddSubtask = async (task: GQueueTask, subtaskTitle: string) => {
    if (!token || !subtaskTitle.trim()) return;

    const newSub = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: subtaskTitle.trim(),
      completed: false,
    };
    const updatedSubtasks = [...task.subtasks, newSub];

    const updated: GQueueTask = { ...task, subtasks: updatedSubtasks };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    setAllTasksCache((prev) => ({
      ...prev,
      [task.listId]: (prev[task.listId] || []).map((t) => (t.id === task.id ? updated : t)),
    }));

    try {
      await updateTask(token, task.listId, task.id, { subtasks: updatedSubtasks });
    } catch (err) {
      console.error(err);
    }
  };

  // Batch Complete
  const handleBatchComplete = async (selectedList: GQueueTask[]) => {
    if (!token || selectedList.length === 0) return;
    const completedDate = new Date().toISOString();
    const selectedIds = new Set(selectedList.map((t) => t.id));

    setTasks((prev) =>
      prev.map((t) =>
        selectedIds.has(t.id) ? { ...t, status: 'completed', completed: completedDate } : t
      )
    );
    setAllTasksCache((prev) => {
      const copy = { ...prev };
      for (const qId of Object.keys(copy)) {
        copy[qId] = copy[qId].map((t) =>
          selectedIds.has(t.id) ? { ...t, status: 'completed', completed: completedDate } : t
        );
      }
      return copy;
    });

    for (const t of selectedList) {
      updateTask(token, t.listId, t.id, { status: 'completed', completed: completedDate }).catch(
        console.error
      );
    }
  };

  // Batch Delete
  const handleBatchDelete = (selectedList: GQueueTask[]) => {
    if (selectedList.length === 0) return;
    setConfirmModalConfig({
      isOpen: true,
      title: `Delete ${selectedList.length} Tasks from Google Workspace`,
      message: `Are you sure you want to permanently delete ${selectedList.length} tasks from your Google Workspace? This cannot be undone.`,
      confirmLabel: 'Delete All',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        if (!token) return;

        const idsToDelete = new Set(selectedList.map((t) => t.id));
        setTasks((prev) => prev.filter((t) => !idsToDelete.has(t.id)));
        setAllTasksCache((prev) => {
          const copy = { ...prev };
          for (const qId of Object.keys(copy)) {
            copy[qId] = copy[qId].filter((t) => !idsToDelete.has(t.id));
          }
          return copy;
        });

        for (const t of selectedList) {
          deleteTask(token, t.listId, t.id).catch(console.error);
        }
      },
    });
  };

  // Task Delete (Mandatory Confirmation Modal)
  const handleDeleteTaskPrompt = (task: GQueueTask) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Delete Task from Google Tasks',
      message: `Are you sure you want to delete "${task.title}"? This will permanently delete the task from your Google Workspace account and cannot be undone.`,
      confirmLabel: 'Delete Task',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        if (!token) return;

        // If calendar event synced, clean it up
        if (task.calendarEventId) {
          deleteCalendarEvent(token, task.calendarEventId).catch(console.warn);
        }

        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        setAllTasksCache((prev) => ({
          ...prev,
          [task.listId]: (prev[task.listId] || []).filter((t) => t.id !== task.id),
        }));

        if (selectedTaskForDetail?.id === task.id) {
          setSelectedTaskForDetail(null);
        }

        try {
          await deleteTask(token, task.listId, task.id);
        } catch (err) {
          console.error('Failed to delete task:', err);
        }
      },
    });
  };

  // Clear Completed Tasks Prompt
  const handleClearCompletedPrompt = () => {
    if (!currentQueue) return;
    setConfirmModalConfig({
      isOpen: true,
      title: 'Clear Completed Tasks',
      message: `Clear all finished tasks in "${currentQueue.title}"? This removes completed items from this list in Google Tasks.`,
      confirmLabel: 'Clear Completed',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        if (!token) return;

        setTasks((prev) => prev.filter((t) => t.status !== 'completed'));
        setAllTasksCache((prev) => ({
          ...prev,
          [currentQueue.id]: (prev[currentQueue.id] || []).filter(
            (t) => t.status !== 'completed'
          ),
        }));

        try {
          await clearCompletedTasks(token, currentQueue.id);
        } catch (err) {
          console.error('Failed to clear completed tasks:', err);
        }
      },
    });
  };

  // --- Queue CRUD operations ---

  const handleOpenNewQueueModal = (cat?: string) => {
    setQueueModalTarget(null);
    setQueueModalDefaultCat(cat || 'My Queues');
    setIsQueueModalOpen(true);
  };

  const handleEditQueueModal = (queue: QueueList) => {
    setQueueModalTarget(queue);
    setQueueModalDefaultCat(queue.category || 'My Queues');
    setIsQueueModalOpen(true);
  };

  const handleSaveQueue = async (title: string, category: string, color: string) => {
    if (!token) return;

    if (queueModalTarget) {
      // Update existing queue
      const updated = await updateTaskList(token, queueModalTarget.id, title, category);
      updated.color = color;

      setQueues((prev) => prev.map((q) => (q.id === queueModalTarget.id ? updated : q)));
    } else {
      // Create new queue in Google Tasks
      const created = await createTaskList(token, title, category);
      created.color = color;

      setQueues((prev) => [...prev, created]);
      setActiveQueueId(created.id);
      setActiveSmartQueue(null);
      setTasks([]);
      setAllTasksCache((prev) => ({ ...prev, [created.id]: [] }));
    }
  };

  // Delete Queue Prompt (Mandatory Confirmation)
  const handleDeleteQueuePrompt = (queue: QueueList) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Delete Queue from Google Tasks',
      message: `Are you sure you want to delete the queue "${queue.title}" and all its tasks? This permanently removes the list from Google Tasks and cannot be undone.`,
      confirmLabel: 'Delete Queue',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        if (!token) return;

        setQueues((prev) => prev.filter((q) => q.id !== queue.id));
        if (activeQueueId === queue.id) {
          const nextQ = queues.find((q) => q.id !== queue.id);
          if (nextQ) {
            handleSelectQueue(nextQ.id);
          } else {
            setActiveQueueId(null);
            setTasks([]);
          }
        }

        try {
          await deleteTaskList(token, queue.id);
        } catch (err) {
          console.error('Failed to delete queue:', err);
        }
      },
    });
  };

  // --- Google Calendar Sync Operations ---

  const handleSyncTaskToCalendar = async (task: GQueueTask) => {
    if (!token) return;
    try {
      const attendees = task.assignedContact?.email
        ? [{ email: task.assignedContact.email, displayName: task.assignedContact.name }]
        : undefined;

      const event = await createCalendarEvent(token, {
        summary: task.title,
        description: task.notes,
        dueDate: task.due,
        timeEstimate: task.timeEstimate,
        attendees,
        sendUpdates: 'all',
      });

      const updated: GQueueTask = { ...task, calendarEventId: event.id };
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      setAllTasksCache((prev) => ({
        ...prev,
        [task.listId]: (prev[task.listId] || []).map((t) => (t.id === task.id ? updated : t)),
      }));

      // Update in Google Tasks
      await updateTask(token, task.listId, task.id, { calendarEventId: event.id });
      setCalendarEvents((prev) => [...prev, event]);
    } catch (err) {
      console.error('Failed to sync event to Google Calendar:', err);
    }
  };

  const handleUnsyncTaskFromCalendar = async (task: GQueueTask) => {
    if (!token || !task.calendarEventId) return;
    try {
      await deleteCalendarEvent(token, task.calendarEventId);
      const updated: GQueueTask = { ...task, calendarEventId: undefined };
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      setAllTasksCache((prev) => ({
        ...prev,
        [task.listId]: (prev[task.listId] || []).map((t) => (t.id === task.id ? updated : t)),
      }));

      await updateTask(token, task.listId, task.id, { calendarEventId: undefined });
      setCalendarEvents((prev) => prev.filter((e) => e.id !== task.calendarEventId));
    } catch (err) {
      console.error('Failed to remove event from Google Calendar:', err);
    }
  };

  // Google Drive attachment selected
  const handleSelectDriveAttachment = (att: DriveAttachment) => {
    if (selectedTaskForDetail) {
      if (selectedTaskForDetail.driveAttachments.some((a) => a.id === att.id || a.url === att.url)) {
        return;
      }
      const updatedList = [...selectedTaskForDetail.driveAttachments, att];
      const updatedTask: GQueueTask = {
        ...selectedTaskForDetail,
        driveAttachments: updatedList,
      };
      setSelectedTaskForDetail(updatedTask);
      setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
      setAllTasksCache((prev) => ({
        ...prev,
        [updatedTask.listId]: (prev[updatedTask.listId] || []).map((t) =>
          t.id === updatedTask.id ? updatedTask : t
        ),
      }));

      if (token) {
        updateTask(token, updatedTask.listId, updatedTask.id, {
          driveAttachments: updatedList,
        }).catch((err) => console.error('Failed to save Drive attachment to task:', err));
      }
    }
  };

  // Existing categories
  const existingCategories = useMemo(() => {
    return Array.from(new Set(queues.map((q) => q.category || 'My Queues')));
  }, [queues]);

  // If loading authentication state
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Connecting to Google Workspace...</p>
        </div>
      </div>
    );
  }

  // If not signed in with Google
  if (!user || !token) {
    return (
      <>
        <AuthScreen
          onSignIn={handleSignIn}
          isLoading={isLoggingIn}
          error={authError}
          onOpenInstallModal={() => setIsInstallModalOpen(true)}
        />
        <InstallModal
          isOpen={isInstallModalOpen}
          onClose={() => setIsInstallModalOpen(false)}
        />
        <OfflineIndicator />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800 font-sans">
      {/* App Header */}
      <Header
        user={user}
        onSignOut={handleSignOut}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onQuickAddTask={() => {
          const el = document.querySelector('input[placeholder*="Add a task"]') as HTMLInputElement;
          if (el) el.focus();
        }}
        onNewQueue={() => handleOpenNewQueueModal()}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        isSyncing={isSyncing}
        onRefresh={handleRefresh}
        currentView={currentView}
        onViewChange={setCurrentView}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        isMobileSidebarOpen={isMobileSidebarOpen}
        completedCount={smartCounts.completed}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden pb-16 md:pb-0">
        {/* Left Sidebar */}
        <Sidebar
          queues={queues}
          activeQueueId={activeQueueId}
          activeSmartQueue={activeSmartQueue}
          selectedTag={selectedTag}
          currentView={currentView}
          onViewChange={setCurrentView}
          onSelectQueue={handleSelectQueue}
          onSelectSmartQueue={handleSelectSmartQueue}
          onSelectTag={setSelectedTag}
          onNewQueue={handleOpenNewQueueModal}
          onEditQueue={handleEditQueueModal}
          onDeleteQueue={handleDeleteQueuePrompt}
          onOpenInstallModal={() => setIsInstallModalOpen(true)}
          allTags={allTags}
          counts={smartCounts}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Center / Right Content: 4 Main Views */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {currentView === 'tasks' && (
            <TaskList
              currentQueue={currentQueue}
              smartQueueType={activeSmartQueue}
              tasks={tasksToRender}
              allQueues={queues}
              searchQuery={searchQuery}
              selectedTag={selectedTag}
              onToggleComplete={handleToggleComplete}
              onToggleStar={handleToggleStar}
              onQuickAddTask={handleQuickAddTask}
              onSelectTask={setSelectedTaskForDetail}
              onDeleteTask={handleDeleteTaskPrompt}
              onClearCompleted={handleClearCompletedPrompt}
              onEditQueue={handleEditQueueModal}
              onToggleSubtask={handleToggleSubtask}
              onAddSubtask={handleAddSubtask}
              onUpdatePriority={handleUpdateTaskPriority}
              onBatchComplete={handleBatchComplete}
              onBatchDelete={handleBatchDelete}
              onOpenCompletedView={() => setCurrentView('completed')}
              onOpenKanbanView={() => setCurrentView('kanban')}
            />
          )}

          {currentView === 'kanban' && (
            <KanbanBoard
              tasks={activeQueueId ? tasks : allTasksCombined}
              queues={queues}
              currentQueue={currentQueue}
              onSelectTask={setSelectedTaskForDetail}
              onUpdateTaskStatus={handleUpdateTaskKanbanStatus}
              onQuickAddTask={handleQuickAddKanbanTask}
              onToggleComplete={handleToggleComplete}
            />
          )}

          {currentView === 'calendar' && (
            <CalendarView
              tasks={allTasksCombined}
              calendarEvents={calendarEvents}
              onSelectTask={setSelectedTaskForDetail}
              onToggleComplete={handleToggleComplete}
              onAddTask={(dateStr) => {
                handleQuickAddTask('New Task', dateStr);
              }}
            />
          )}

          {currentView === 'completed' && (
            <CompletedView
              tasks={allTasksCombined}
              queues={queues}
              onUncompleteTask={handleToggleComplete}
              onDeleteTask={handleDeleteTaskPrompt}
              onSelectTask={setSelectedTaskForDetail}
              onClearAllCompleted={() => {
                setConfirmModalConfig({
                  isOpen: true,
                  title: 'Clear All Completed Tasks',
                  message:
                    'Permanently clear all completed tasks across all Google Workspace queues? This will remove finished items from Google Tasks.',
                  confirmLabel: 'Clear All Completed',
                  isDestructive: true,
                  onConfirm: async () => {
                    setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
                    if (!token) return;

                    setTasks((prev) => prev.filter((t) => t.status !== 'completed'));
                    setAllTasksCache((prev) => {
                      const copy = { ...prev };
                      for (const qId of Object.keys(copy)) {
                        copy[qId] = copy[qId].filter((t) => t.status !== 'completed');
                      }
                      return copy;
                    });

                    for (const q of queues) {
                      clearCompletedTasks(token, q.id).catch(console.error);
                    }
                  },
                });
              }}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        currentView={currentView}
        activeSmartQueue={activeSmartQueue}
        onSelectView={setCurrentView}
        onOpenQueuesDrawer={() => setIsMobileSidebarOpen(true)}
        onSelectToday={() => handleSelectSmartQueue('today')}
        onQuickAddTask={() => {
          const el = document.querySelector('input[placeholder*="Add a task"]') as HTMLInputElement;
          if (el) {
            el.focus();
            el.scrollIntoView({ behavior: 'smooth' });
          }
        }}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        todayCount={smartCounts.today}
        completedCount={smartCounts.completed}
      />

      {/* Task Details Drawer/Modal */}
      {selectedTaskForDetail && (
        <TaskDetailModal
          task={selectedTaskForDetail}
          isOpen={true}
          contacts={contacts}
          accessToken={token}
          userDomain={user?.email?.includes('@') ? user.email.split('@')[1] : 'coolaireconsolidated.com'}
          onClose={() => setSelectedTaskForDetail(null)}
          onSave={handleSaveTaskDetail}
          onDelete={handleDeleteTaskPrompt}
          onOpenDrivePicker={() => setIsDrivePickerOpen(true)}
          onSyncCalendar={handleSyncTaskToCalendar}
          onUnsyncCalendar={handleUnsyncTaskFromCalendar}
          onRefreshContacts={async () => {
            if (token) {
              const domain = user?.email?.includes('@') ? user.email.split('@')[1] : 'coolaireconsolidated.com';
              const fresh = await fetchContacts(token, domain);
              setContacts(fresh);
            }
          }}
        />
      )}

      {/* Google Drive Picker Modal */}
      {isDrivePickerOpen && (
        <DrivePickerModal
          isOpen={isDrivePickerOpen}
          accessToken={token}
          onClose={() => setIsDrivePickerOpen(false)}
          onSelectFile={handleSelectDriveAttachment}
          onReauth={handleSignIn}
        />
      )}

      {/* New / Edit Queue Modal */}
      {isQueueModalOpen && (
        <NewQueueModal
          isOpen={isQueueModalOpen}
          initialQueue={queueModalTarget}
          defaultCategory={queueModalDefaultCat}
          existingCategories={existingCategories}
          onClose={() => {
            setIsQueueModalOpen(false);
            setQueueModalTarget(null);
          }}
          onSave={handleSaveQueue}
        />
      )}

      {/* Export Tasks Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        tasks={allTasksCombined}
        queues={queues}
        currentQueue={currentQueue}
      />

      {/* Keyboard Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* PWA Install Modal (APK / iOS / Windows) */}
      <InstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {/* Offline Status Toast Indicator */}
      <OfflineIndicator />

      {/* Destructive Action User Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModalConfig.isOpen}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        confirmLabel={confirmModalConfig.confirmLabel}
        isDestructive={confirmModalConfig.isDestructive}
        onConfirm={confirmModalConfig.onConfirm}
        onCancel={() => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
