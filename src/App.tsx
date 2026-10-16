import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
} from './services/firebase';
import type {
  QueueList,
  GQueueTask,
  SmartQueueType,
  GoogleContact,
  GoogleCalendarEvent,
  DriveAttachment,
  Priority,
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
  deleteCalendarEvent,
} from './services/calendarApi';
import { fetchContacts } from './services/peopleApi';

import { AuthScreen } from './components/AuthScreen';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { TaskList } from './components/TaskList';
import { CalendarView } from './components/CalendarView';
import { TaskDetailModal } from './components/TaskDetailModal';
import { DrivePickerModal } from './components/DrivePickerModal';
import { NewQueueModal } from './components/NewQueueModal';
import { ConfirmModal } from './components/ConfirmModal';
import { InstallModal } from './components/InstallModal';
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
  const [currentView, setCurrentView] = useState<'tasks' | 'calendar'>('tasks');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

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
        setUser(res.user);
        setToken(res.accessToken);
      }
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        // User closed popup or cancelled prompt
        return;
      }
      if (err?.code === 'auth/popup-blocked') {
        setAuthError(
          'Sign-in popup was blocked by your browser. Please allow popups or open the app in a new tab.'
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

      // 3. Fetch Google Contacts for delegation (in background)
      fetchContacts(accessToken).then(setContacts).catch(console.warn);

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

  // Load tasks when active queue changes
  const handleSelectQueue = async (queueId: string) => {
    setActiveQueueId(queueId);
    setActiveSmartQueue(null);
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

    for (const t of allTasksCombined) {
      if (t.status === 'completed') {
        completedCount++;
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

  // Toggle Complete / Uncomplete
  const handleToggleComplete = async (task: GQueueTask) => {
    if (!token) return;
    const newStatus = task.status === 'completed' ? 'needsAction' : 'completed';
    const completedDate = newStatus === 'completed' ? new Date().toISOString() : undefined;

    // Optimistic UI update
    const updated: GQueueTask = {
      ...task,
      status: newStatus,
      completed: completedDate,
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
      });
    } catch (err) {
      console.error('Failed to update task completion:', err);
      // Revert if error
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    }
  };

  // Toggle Star / Flag
  const handleToggleStar = async (task: GQueueTask) => {
    if (!token) return;
    const newStarred = !task.starred;

    const updated: GQueueTask = { ...task, starred: newStarred };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    setAllTasksCache((prev) => ({
      ...prev,
      [task.listId]: (prev[task.listId] || []).map((t) => (t.id === task.id ? updated : t)),
    }));

    try {
      await updateTask(token, task.listId, task.id, { starred: newStarred });
    } catch (err) {
      console.error('Failed to update star:', err);
    }
  };

  // Save task details from modal
  const handleSaveTaskDetail = async (updatedFields: Partial<GQueueTask>) => {
    if (!token || !selectedTaskForDetail) return;
    const targetTask = selectedTaskForDetail;

    const updated: GQueueTask = {
      ...targetTask,
      ...updatedFields,
    };

    setTasks((prev) => prev.map((t) => (t.id === targetTask.id ? updated : t)));
    setAllTasksCache((prev) => ({
      ...prev,
      [targetTask.listId]: (prev[targetTask.listId] || []).map((t) =>
        t.id === targetTask.id ? updated : t
      ),
    }));

    await updateTask(token, targetTask.listId, targetTask.id, updatedFields);
    setSelectedTaskForDetail(null);
  };

  // Subtask Toggle
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

  // Add Subtask
  const handleAddSubtask = async (task: GQueueTask, subtaskTitle: string) => {
    if (!token) return;
    const newSub = {
      id: 'sub-' + Date.now(),
      title: subtaskTitle,
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
      const event = await createCalendarEvent(token, {
        summary: task.title,
        description: task.notes,
        dueDate: task.due,
        timeEstimate: task.timeEstimate,
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
      const updatedList = [...selectedTaskForDetail.driveAttachments, att];
      setSelectedTaskForDetail({
        ...selectedTaskForDetail,
        driveAttachments: updatedList,
      });
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
          // Focus quick add or open prompt
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
      />

      {/* Main Layout Area (with padding bottom on mobile for Bottom Nav) */}
      <div className="flex-1 flex overflow-hidden pb-16 md:pb-0">
        {/* Left Sidebar */}
        <Sidebar
          queues={queues}
          activeQueueId={activeQueueId}
          activeSmartQueue={activeSmartQueue}
          selectedTag={selectedTag}
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

        {/* Center / Right Content: TaskList or CalendarView */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {currentView === 'tasks' ? (
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
            />
          ) : (
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
        </main>
      </div>

      {/* Mobile Bottom Navigation (Visible on mobile screens) */}
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
      />

      {/* Task Details Drawer/Modal */}
      {selectedTaskForDetail && (
        <TaskDetailModal
          task={selectedTaskForDetail}
          isOpen={true}
          contacts={contacts}
          onClose={() => setSelectedTaskForDetail(null)}
          onSave={handleSaveTaskDetail}
          onDelete={handleDeleteTaskPrompt}
          onOpenDrivePicker={() => setIsDrivePickerOpen(true)}
          onSyncCalendar={handleSyncTaskToCalendar}
          onUnsyncCalendar={handleUnsyncTaskFromCalendar}
        />
      )}

      {/* Google Drive Picker Modal */}
      {isDrivePickerOpen && (
        <DrivePickerModal
          isOpen={isDrivePickerOpen}
          accessToken={token}
          onClose={() => setIsDrivePickerOpen(false)}
          onSelectFile={handleSelectDriveAttachment}
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

      {/* PWA Install Modal (APK / iOS / Windows) */}
      <InstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {/* Offline Status Toast Indicator */}
      <OfflineIndicator />

      {/* Destructive Action User Confirmation Modal (MANDATORY) */}
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
