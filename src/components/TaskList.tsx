import React, { useState } from 'react';
import type {
  GQueueTask,
  QueueList,
  SmartQueueType,
  Priority,
  Subtask,
} from '../types/gqueues';
import {
  CheckCircle2,
  Circle,
  Star,
  Calendar,
  Clock,
  Tag,
  Paperclip,
  CheckSquare,
  Plus,
  Trash2,
  Edit3,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  FolderKanban,
  Sparkles,
  ExternalLink,
  UserCheck
} from 'lucide-react';

interface TaskListProps {
  currentQueue: QueueList | null;
  smartQueueType: SmartQueueType | null;
  tasks: GQueueTask[];
  allQueues: QueueList[];
  searchQuery: string;
  selectedTag: string | null;
  onToggleComplete: (task: GQueueTask) => Promise<void>;
  onToggleStar: (task: GQueueTask) => Promise<void>;
  onQuickAddTask: (title: string, due?: string, priority?: Priority) => Promise<void>;
  onSelectTask: (task: GQueueTask) => void;
  onDeleteTask: (task: GQueueTask) => void;
  onClearCompleted?: () => void;
  onEditQueue?: (queue: QueueList) => void;
  onToggleSubtask: (task: GQueueTask, subtaskId: string) => Promise<void>;
  onAddSubtask: (task: GQueueTask, subtaskTitle: string) => Promise<void>;
}

export const TaskList: React.FC<TaskListProps> = ({
  currentQueue,
  smartQueueType,
  tasks,
  allQueues,
  searchQuery,
  selectedTag,
  onToggleComplete,
  onToggleStar,
  onQuickAddTask,
  onSelectTask,
  onDeleteTask,
  onClearCompleted,
  onEditQueue,
  onToggleSubtask,
  onAddSubtask,
}) => {
  // Quick Add input state
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDue, setQuickDue] = useState('');
  const [quickPriority, setQuickPriority] = useState<Priority>('none');
  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);

  // Sorting and filtering
  const [sortBy, setSortBy] = useState<'due' | 'priority' | 'title' | 'updated'>('due');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showCompletedSection, setShowCompletedSection] = useState(false);

  // Inline expanded subtasks state
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});
  const [inlineSubtaskInput, setInlineSubtaskInput] = useState<Record<string, string>>({});

  const toggleSubtasksExpand = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSubtasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || isSubmittingQuick) return;

    setIsSubmittingQuick(true);
    try {
      await onQuickAddTask(quickTitle.trim(), quickDue || undefined, quickPriority);
      setQuickTitle('');
      setQuickDue('');
      setQuickPriority('none');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingQuick(false);
    }
  };

  const handleInlineAddSubtask = async (task: GQueueTask, e: React.FormEvent) => {
    e.preventDefault();
    const val = (inlineSubtaskInput[task.id] || '').trim();
    if (!val) return;
    await onAddSubtask(task, val);
    setInlineSubtaskInput((prev) => ({ ...prev, [task.id]: '' }));
  };

  // Priority ranking for sorting
  const priorityRank: Record<Priority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
    none: 0,
  };

  // Filter tasks based on search, tags, active/completed
  const filteredTasks = React.useMemo(() => {
    return tasks.filter((t) => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchNotes = t.notes.toLowerCase().includes(q);
        const matchTags = t.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!matchTitle && !matchNotes && !matchTags) return false;
      }

      // Tag filter
      if (selectedTag) {
        if (!t.tags.includes(selectedTag)) return false;
      }

      return true;
    });
  }, [tasks, searchQuery, selectedTag]);

  // Separate active and completed tasks
  const activeTasks = React.useMemo(() => {
    return filteredTasks.filter((t) => t.status !== 'completed');
  }, [filteredTasks]);

  const completedTasks = React.useMemo(() => {
    return filteredTasks.filter((t) => t.status === 'completed');
  }, [filteredTasks]);

  // Sort tasks
  const sortedActiveTasks = React.useMemo(() => {
    return [...activeTasks].sort((a, b) => {
      if (sortBy === 'due') {
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return sortOrder === 'asc'
          ? a.due.localeCompare(b.due)
          : b.due.localeCompare(a.due);
      }
      if (sortBy === 'priority') {
        const diff = priorityRank[b.priority] - priorityRank[a.priority];
        return sortOrder === 'asc' ? diff : -diff;
      }
      if (sortBy === 'title') {
        return sortOrder === 'asc'
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title);
      }
      // Updated date
      return sortOrder === 'asc'
        ? (a.updated || '').localeCompare(b.updated || '')
        : (b.updated || '').localeCompare(a.updated || '');
    });
  }, [activeTasks, sortBy, sortOrder]);

  // Helper for due date display
  const getDueStatus = (dueStr?: string) => {
    if (!dueStr) return null;
    const today = new Date().toISOString().split('T')[0];
    const target = dueStr.split('T')[0];

    if (target < today) {
      return { label: `Overdue (${target})`, isOverdue: true, isToday: false };
    }
    if (target === today) {
      return { label: 'Due Today', isOverdue: false, isToday: true };
    }
    return { label: `Due ${target}`, isOverdue: false, isToday: false };
  };

  const getPriorityBadge = (p: Priority) => {
    switch (p) {
      case 'urgent':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">URGENT</span>;
      case 'high':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">HIGH</span>;
      case 'medium':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">MED</span>;
      case 'low':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-normal bg-slate-100 text-slate-600">LOW</span>;
      default:
        return null;
    }
  };

  // Find parent queue title for smart queues
  const getQueueTitleForTask = (listId: string) => {
    const q = allQueues.find((item) => item.id === listId);
    return q ? q.title : 'Queue';
  };

  // View header titles
  const getHeaderInfo = () => {
    if (smartQueueType) {
      switch (smartQueueType) {
        case 'today':
          return { title: 'Today', subtitle: 'Tasks scheduled for today', icon: <Sparkles className="w-5 h-5 text-blue-600" /> };
        case 'overdue':
          return { title: 'Overdue', subtitle: 'Tasks that missed their scheduled deadline', icon: <Clock className="w-5 h-5 text-red-500" /> };
        case 'upcoming':
          return { title: 'Upcoming (7 Days)', subtitle: 'Tasks scheduled within the next week', icon: <Calendar className="w-5 h-5 text-emerald-600" /> };
        case 'starred':
          return { title: 'Starred & Urgent', subtitle: 'Flagged or high priority tasks across all queues', icon: <Star className="w-5 h-5 text-amber-500 fill-amber-400" /> };
        case 'all':
          return { title: 'All Tasks', subtitle: 'Consolidated view of all active tasks across all queues', icon: <FolderKanban className="w-5 h-5 text-slate-600" /> };
        case 'completed':
          return { title: 'Completed Archive', subtitle: 'History of finished tasks from Google Tasks', icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" /> };
      }
    }
    return {
      title: currentQueue?.title || 'My Queue',
      subtitle: currentQueue?.category ? `Category: ${currentQueue.category}` : 'Google Tasks List',
      icon: (
        <span
          className="w-4 h-4 rounded-full inline-block shadow-xs"
          style={{ backgroundColor: currentQueue?.color || '#2563eb' }}
        />
      ),
    };
  };

  const header = getHeaderInfo();

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/70 overflow-hidden">
      {/* Top Queue Banner */}
      <div className="px-6 py-4 bg-white border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-100 flex items-center justify-center">
            {header.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">{header.title}</h2>
              {selectedTag && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                  #{selectedTag}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">{header.subtitle}</p>
          </div>
        </div>

        {/* Sort and Actions Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 p-1 rounded-lg border border-slate-200/60">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent font-medium outline-none cursor-pointer pr-1"
            >
              <option value="due">Sort by Due Date</option>
              <option value="priority">Sort by Priority</option>
              <option value="title">Sort by Title</option>
              <option value="updated">Sort by Updated</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-1 text-slate-500 hover:text-slate-900 font-bold"
              title="Toggle sort direction"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          {currentQueue && onEditQueue && (
            <button
              onClick={() => onEditQueue(currentQueue)}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors"
              title="Edit Queue Properties"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}

          {completedTasks.length > 0 && onClearCompleted && (
            <button
              onClick={onClearCompleted}
              className="text-xs text-slate-500 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50 font-medium"
            >
              Clear Completed
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        {/* Quick Add Bar (only shown if a specific queue is active or in standard view) */}
        <form
          onSubmit={handleQuickAddSubmit}
          className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/90 shadow-xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all flex flex-wrap items-center gap-2"
        >
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Plus className="w-5 h-5 text-slate-400 ml-1 flex-shrink-0" />
            <input
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Add a task (e.g. 'Draft proposal for client review'). Press Enter to save..."
              className="w-full text-xs sm:text-sm bg-transparent outline-none placeholder:text-slate-400 font-medium text-slate-800"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Due Date */}
            <input
              type="date"
              value={quickDue}
              onChange={(e) => setQuickDue(e.target.value)}
              title="Set Due Date"
              className="px-2 py-1 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg outline-none text-slate-600 cursor-pointer"
            />

            {/* Quick Priority */}
            <select
              value={quickPriority}
              onChange={(e) => setQuickPriority(e.target.value as Priority)}
              className="px-2 py-1 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg outline-none text-slate-600 cursor-pointer"
            >
              <option value="none">Priority</option>
              <option value="urgent">🔴 Urgent</option>
              <option value="high">🟠 High</option>
              <option value="medium">🔵 Medium</option>
              <option value="low">⚪ Low</option>
            </select>

            <button
              type="submit"
              disabled={!quickTitle.trim() || isSubmittingQuick}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95"
            >
              {isSubmittingQuick ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>

        {/* Active Tasks List */}
        <div className="space-y-2">
          {sortedActiveTasks.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-8">
              <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">All caught up!</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No active tasks in this queue. Type in the bar above to add a new task directly to Google Tasks.
              </p>
            </div>
          ) : (
            sortedActiveTasks.map((task) => {
              const dueInfo = getDueStatus(task.due);
              const subtasksDone = task.subtasks.filter((s) => s.completed).length;
              const hasSubtasks = task.subtasks.length > 0;
              const isSubExpanded = !!expandedSubtasks[task.id];

              return (
                <div
                  key={task.id}
                  className="bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all group overflow-hidden"
                >
                  <div
                    onClick={() => onSelectTask(task)}
                    className="p-3.5 flex items-start justify-between gap-3 cursor-pointer"
                  >
                    {/* Left: Complete Checkbox + Star */}
                    <div className="flex items-center gap-2 pt-0.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onToggleComplete(task)}
                        className="text-slate-400 hover:text-blue-600 transition-colors p-0.5 rounded-full"
                        title="Mark task completed"
                      >
                        <Circle className="w-5 h-5 text-slate-300 hover:text-blue-500" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleStar(task)}
                        className={`p-0.5 transition-colors ${
                          task.starred
                            ? 'text-amber-500 hover:text-amber-600'
                            : 'text-slate-300 hover:text-slate-400 opacity-40 group-hover:opacity-100'
                        }`}
                        title={task.starred ? 'Starred' : 'Star'}
                      >
                        <Star className={`w-4 h-4 ${task.starred ? 'fill-amber-400' : ''}`} />
                      </button>
                    </div>

                    {/* Middle: Content, Metadata & Badges */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">
                          {task.title}
                        </span>
                        {getPriorityBadge(task.priority)}

                        {smartQueueType && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium border border-slate-200/60">
                            {getQueueTitleForTask(task.listId)}
                          </span>
                        )}
                      </div>

                      {task.notes && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {task.notes}
                        </p>
                      )}

                      {/* Metadata Chips: Due Date, Subtasks, Tags, Assignee, Drive, Calendar */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                        {/* Due Date Chip */}
                        {dueInfo && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium text-[11px] ${
                              dueInfo.isOverdue
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : dueInfo.isToday
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            {dueInfo.label}
                          </span>
                        )}

                        {/* Subtasks Count Badge */}
                        {hasSubtasks && (
                          <button
                            type="button"
                            onClick={(e) => toggleSubtasksExpand(task.id, e)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            <CheckSquare className="w-3 h-3 text-blue-600" />
                            <span>
                              {subtasksDone}/{task.subtasks.length} subtasks
                            </span>
                            {isSubExpanded ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </button>
                        )}

                        {/* Tags */}
                        {task.tags.map((tg) => (
                          <span
                            key={tg}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] bg-blue-50 text-blue-700 border border-blue-100 font-medium"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            #{tg}
                          </span>
                        ))}

                        {/* Assignee */}
                        {task.assignedContact && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-purple-50 text-purple-700 border border-purple-100 font-medium">
                            <UserCheck className="w-3 h-3" />
                            {task.assignedContact.name}
                          </span>
                        )}

                        {/* Drive Attachments */}
                        {task.driveAttachments.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">
                            <Paperclip className="w-3 h-3" />
                            {task.driveAttachments.length} Drive {task.driveAttachments.length === 1 ? 'doc' : 'docs'}
                          </span>
                        )}

                        {/* Calendar Sync */}
                        {task.calendarEventId && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-amber-50 text-amber-700 border border-amber-200 font-medium"
                            title="Synced to Google Calendar"
                          >
                            <CalendarCheck className="w-3 h-3 text-amber-600" />
                            Calendar Synced
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Hover Actions */}
                    <div
                      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onSelectTask(task)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit details"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteTask(task)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Expanded Subtasks Section */}
                  {isSubExpanded && (
                    <div className="bg-slate-50/90 border-t border-slate-100 p-3 space-y-2">
                      <div className="space-y-1.5 pl-4 sm:pl-7">
                        {task.subtasks.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center gap-2 text-xs text-slate-700"
                          >
                            <button
                              type="button"
                              onClick={() => onToggleSubtask(task, sub.id)}
                              className="text-slate-400 hover:text-emerald-600"
                            >
                              {sub.completed ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Circle className="w-3.5 h-3.5 text-slate-300" />
                              )}
                            </button>
                            <span
                              className={
                                sub.completed ? 'line-through text-slate-400' : 'text-slate-800'
                              }
                            >
                              {sub.title}
                            </span>
                          </div>
                        ))}

                        {/* Inline subtask quick add */}
                        <form
                          onSubmit={(e) => handleInlineAddSubtask(task, e)}
                          className="flex items-center gap-2 pt-1"
                        >
                          <input
                            type="text"
                            placeholder="Add subtask step..."
                            value={inlineSubtaskInput[task.id] || ''}
                            onChange={(e) =>
                              setInlineSubtaskInput((prev) => ({
                                ...prev,
                                [task.id]: e.target.value,
                              }))
                            }
                            className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md outline-none focus:border-blue-500 w-60"
                          />
                          <button
                            type="submit"
                            className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-medium"
                          >
                            Add
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Completed Tasks Accordion */}
        {completedTasks.length > 0 && (
          <div className="pt-4 border-t border-slate-200">
            <button
              onClick={() => setShowCompletedSection(!showCompletedSection)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-2"
            >
              {showCompletedSection ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span>Completed Tasks ({completedTasks.length})</span>
            </button>

            {showCompletedSection && (
              <div className="space-y-1.5 opacity-80">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 bg-white/70 rounded-xl border border-slate-200/60 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <button
                        onClick={() => onToggleComplete(task)}
                        className="text-emerald-600 hover:text-slate-400"
                        title="Uncomplete task"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </button>
                      <span className="line-through text-slate-400 truncate">
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onDeleteTask(task)}
                        className="p-1 text-slate-300 hover:text-red-500"
                        title="Delete completed task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
