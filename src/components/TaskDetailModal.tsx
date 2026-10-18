import React, { useState, useMemo } from 'react';
import type {
  GQueueTask,
  Priority,
  GoogleContact,
  Subtask,
  DriveAttachment,
  KanbanStatus,
  RecurringSchedule,
} from '../types/gqueues';
import {
  Calendar,
  Star,
  Tag,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Paperclip,
  User,
  X,
  ExternalLink,
  CalendarCheck,
  AlertCircle,
  Repeat,
  Timer,
  Layers,
  History,
  Search,
  Building2,
  Users,
  UserPlus,
  Mail,
  Check,
} from 'lucide-react';
import { saveCustomTeammate } from '../services/peopleApi';

interface TaskDetailModalProps {
  task: GQueueTask | null;
  isOpen: boolean;
  contacts: GoogleContact[];
  onClose: () => void;
  onSave: (updatedTask: Partial<GQueueTask>) => Promise<void>;
  onDelete: (task: GQueueTask) => void;
  onOpenDrivePicker: () => void;
  onSyncCalendar: (task: GQueueTask) => Promise<void>;
  onUnsyncCalendar: (task: GQueueTask) => Promise<void>;
  onRefreshContacts?: () => Promise<void>;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  contacts,
  onClose,
  onSave,
  onDelete,
  onOpenDrivePicker,
  onSyncCalendar,
  onUnsyncCalendar,
  onRefreshContacts,
}) => {
  if (!isOpen || !task) return null;

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [starred, setStarred] = useState(task.starred);
  const [due, setDue] = useState(task.due ? task.due.split('T')[0] : '');
  const [tags, setTags] = useState<string[]>(task.tags || []);
  const [newTagInput, setNewTagInput] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks || []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [assignedContact, setAssignedContact] = useState(task.assignedContact);
  const [driveAttachments, setDriveAttachments] = useState<DriveAttachment[]>(
    task.driveAttachments || []
  );
  const [kanbanStatus, setKanbanStatus] = useState<KanbanStatus>(task.kanbanStatus || 'todo');
  const [recurring, setRecurring] = useState<RecurringSchedule>(task.recurring || 'none');
  const [timeEstimate, setTimeEstimate] = useState<string>(task.timeEstimate || '');

  const [isSaving, setIsSaving] = useState(false);
  const [isCalendarSyncing, setIsCalendarSyncing] = useState(false);

  // Assignee picker states
  const [isAssigneePickerOpen, setIsAssigneePickerOpen] = useState(false);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'directory' | 'contacts' | 'add'>('all');
  const [newTeammateName, setNewTeammateName] = useState('');
  const [newTeammateEmail, setNewTeammateEmail] = useState('');
  const [newTeammateRole, setNewTeammateRole] = useState('');

  React.useEffect(() => {
    setDriveAttachments(task.driveAttachments || []);
  }, [task.driveAttachments]);

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTag = newTagInput.trim().replace(/^#/, '');
    if (cleanTag && !tags.includes(cleanTag)) {
      setTags([...tags, cleanTag]);
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const newSub: Subtask = {
      id: 'sub-' + Date.now(),
      title: newSubtaskTitle.trim(),
      completed: false,
    };
    setSubtasks([...subtasks, newSub]);
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (subId: string) => {
    setSubtasks(
      subtasks.map((s) => (s.id === subId ? { ...s, completed: !s.completed } : s))
    );
  };

  const handleRemoveSubtask = (subId: string) => {
    setSubtasks(subtasks.filter((s) => s.id !== subId));
  };

  const handleRemoveAttachment = (id: string) => {
    setDriveAttachments(driveAttachments.filter((a) => a.id !== id));
  };

  // Filtered contacts / directory list
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (assigneeFilter === 'directory' && c.source !== 'directory') return false;
      if (assigneeFilter === 'contacts' && c.source !== 'contacts' && c.source !== 'other') return false;

      if (!assigneeSearchQuery.trim()) return true;
      const q = assigneeSearchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.jobTitle && c.jobTitle.toLowerCase().includes(q))
      );
    });
  }, [contacts, assigneeSearchQuery, assigneeFilter]);

  const handleSelectContact = (c: GoogleContact) => {
    setAssignedContact({
      name: c.name,
      email: c.email,
      avatarUrl: c.avatarUrl,
    });
    setIsAssigneePickerOpen(false);
    setAssigneeSearchQuery('');
  };

  const handleAddNewTeammate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeammateEmail.trim()) return;

    const saved = saveCustomTeammate({
      name: newTeammateName.trim() || newTeammateEmail.split('@')[0],
      email: newTeammateEmail.trim(),
      jobTitle: newTeammateRole.trim() || 'Organization Member',
    });

    setAssignedContact({
      name: saved.name,
      email: saved.email,
      avatarUrl: saved.avatarUrl,
    });

    setNewTeammateName('');
    setNewTeammateEmail('');
    setNewTeammateRole('');
    setIsAssigneePickerOpen(false);
    if (onRefreshContacts) onRefreshContacts();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const isDone = kanbanStatus === 'done' || task.status === 'completed';
      await onSave({
        title,
        notes,
        priority,
        starred,
        due: due ? due : (null as any),
        tags,
        subtasks,
        assignedContact,
        driveAttachments,
        kanbanStatus,
        recurring,
        timeEstimate,
        status: isDone ? 'completed' : 'needsAction',
        completedAt: isDone ? (task.completedAt || new Date().toISOString()) : undefined,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save task:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickDue = (daysFromToday: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysFromToday);
    setDue(target.toISOString().split('T')[0]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/50 backdrop-blur-xs">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStarred(!starred)}
              className={`p-1 rounded-md transition-colors ${
                starred ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-slate-400'
              }`}
              title={starred ? 'Unstar task' : 'Star task'}
            >
              <Star className={`w-5 h-5 ${starred ? 'fill-amber-400' : ''}`} />
            </button>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Task Details & Workflow
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onDelete(task)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task summary / title"
              className="w-full text-lg md:text-xl font-bold text-slate-900 border-none outline-none focus:ring-0 placeholder:text-slate-300 p-0"
            />
          </div>

          {/* Properties Grid: Workflow Stage, Priority, Due Date, Time Estimate, Recurring */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50/90 rounded-xl border border-slate-200/80">
            {/* Kanban Stage */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                Workflow Stage
              </label>
              <select
                value={kanbanStatus}
                onChange={(e) => setKanbanStatus(e.target.value as KanbanStatus)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-medium"
              >
                <option value="todo">📝 To Do / Queued</option>
                <option value="in_progress">⚡ In Progress</option>
                <option value="waiting">⏳ Waiting / Blocked</option>
                <option value="done">✅ Done / Completed</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
              >
                <option value="none">No Priority</option>
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">🔴 Urgent Priority</option>
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Due Date
              </label>
              <div className="space-y-1.5">
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                />
                <div className="flex gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleQuickDue(0)}
                    className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDue(1)}
                    className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDue(7)}
                    className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium"
                  >
                    +7 Days
                  </button>
                  {due && (
                    <button
                      type="button"
                      onClick={() => setDue('')}
                      className="px-1.5 py-0.5 rounded text-red-600 hover:bg-red-50 font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Recurring & Time Estimate */}
            <div className="space-y-2">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Repeat className="w-3.5 h-3.5 text-emerald-600" />
                  Repeat / Recurring
                </label>
                <select
                  value={recurring}
                  onChange={(e) => setRecurring(e.target.value as RecurringSchedule)}
                  className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Repeats Daily</option>
                  <option value="weekly">Repeats Weekly</option>
                  <option value="monthly">Repeats Monthly</option>
                  <option value="yearly">Repeats Yearly</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <Timer className="w-3.5 h-3.5 text-purple-600" />
                  Time Estimate
                </label>
                <input
                  type="text"
                  placeholder="e.g. 30m, 2h, 1d"
                  value={timeEstimate}
                  onChange={(e) => setTimeEstimate(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Description & Notes */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Description & Rich Notes
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add details, instructions, links, or context for this task..."
              className="w-full p-3 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all resize-y placeholder:text-slate-400 font-mono"
            />
          </div>

          {/* Subtasks Checklist */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
              Subtasks Checklist ({subtasks.filter((s) => s.completed).length}/{subtasks.length})
            </label>

            <div className="space-y-1.5 mb-3">
              {subtasks.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/70 text-xs group"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleSubtask(sub.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {sub.completed ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <span
                      className={`${
                        sub.completed ? 'line-through text-slate-400' : 'text-slate-800'
                      }`}
                    >
                      {sub.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSubtask(sub.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddSubtask} className="flex gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="Add a subtask step..."
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:bg-white"
              />
              <button
                type="submit"
                disabled={!newSubtaskTitle.trim()}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Step
              </button>
            </form>
          </div>

          {/* Tags */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              Tags & Labels
            </label>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-blue-900 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <form onSubmit={handleAddTag} className="flex gap-2 max-w-xs">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="New tag (e.g. client, urgent, review)"
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={!newTagInput.trim()}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-lg text-xs font-medium"
              >
                Add Tag
              </button>
            </form>
          </div>

          {/* Google Workspace Integrations Section */}
          <div className="border-t border-slate-200 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                Google Workspace Team & Delegation
              </h4>
              <span className="text-[11px] text-slate-500">
                {contacts.length} Contacts & Directory Users Loaded
              </span>
            </div>

            {/* Delegation: Assignee */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-purple-600" />
                  Assignee (Google Contacts & Organization Directory)
                </label>
                {!assignedContact && (
                  <button
                    type="button"
                    onClick={() => setIsAssigneePickerOpen(!isAssigneePickerOpen)}
                    className="text-xs text-purple-600 hover:text-purple-700 font-semibold inline-flex items-center gap-1"
                  >
                    {isAssigneePickerOpen ? 'Close Directory Picker' : '+ Select / Add Assignee'}
                  </button>
                )}
              </div>

              {assignedContact ? (
                <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {assignedContact.avatarUrl ? (
                        <img
                          src={assignedContact.avatarUrl}
                          alt=""
                          className="w-8 h-8 rounded-full border border-purple-300"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                          {assignedContact.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 text-xs sm:text-sm">{assignedContact.name}</p>
                          <span className="px-1.5 py-0.2 bg-purple-200 text-purple-900 rounded text-[10px] font-medium">
                            Assigned
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {assignedContact.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setIsAssigneePickerOpen(!isAssigneePickerOpen)}
                        className="px-2 py-1 text-xs text-purple-700 hover:bg-purple-100 rounded-lg font-medium transition-colors"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignedContact(undefined)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-white transition-colors"
                        title="Remove assignee"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Calendar Dispatch Explainer Notice */}
                  <div className="p-2.5 bg-white/90 rounded-lg border border-purple-200/80 text-[11px] text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5 text-purple-800 font-semibold">
                      <CalendarCheck className="w-3.5 h-3.5 text-purple-600" />
                      <span>Direct Google Calendar Dispatch</span>
                    </div>
                    <p className="text-slate-500">
                      When you sync this task to Google Calendar, Google Workspace automatically puts this task on <span className="font-semibold text-slate-800">{assignedContact.name}’s</span> personal Google Calendar and sends them a calendar invitation with all details.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Collapsible / Expandable Directory & Contacts Picker */}
              {(!assignedContact || isAssigneePickerOpen) && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  {/* Tabs */}
                  <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
                    <button
                      type="button"
                      onClick={() => setAssigneeFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                        assigneeFilter === 'all'
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      All Members ({contacts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssigneeFilter('directory')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                        assigneeFilter === 'directory'
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      🏢 Directory
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssigneeFilter('contacts')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                        assigneeFilter === 'contacts'
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      👥 Contacts
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssigneeFilter('add')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ml-auto ${
                        assigneeFilter === 'add'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      + Add Colleague
                    </button>
                  </div>

                  {assigneeFilter === 'add' ? (
                    /* Add New Teammate by Email / Org Domain Form */
                    <form onSubmit={handleAddNewTeammate} className="p-3 bg-white rounded-lg border border-emerald-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <UserPlus className="w-4 h-4 text-emerald-600" />
                          Add Organization Teammate
                        </span>
                        <span className="text-[10px] text-slate-400">Available across all queues</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          value={newTeammateName}
                          onChange={(e) => setNewTeammateName(e.target.value)}
                          placeholder="Colleague Full Name"
                          className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500"
                        />
                        <input
                          type="email"
                          required
                          value={newTeammateEmail}
                          onChange={(e) => setNewTeammateEmail(e.target.value)}
                          placeholder="Email (e.g. colleague@company.com)"
                          className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newTeammateRole}
                          onChange={(e) => setNewTeammateRole(e.target.value)}
                          placeholder="Role / Title (optional, e.g. Designer, Lead Engineer)"
                          className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500"
                        />
                        <button
                          type="submit"
                          disabled={!newTeammateEmail.trim()}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5" /> Save & Assign
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* Search & Colleague Directory List */
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          value={assigneeSearchQuery}
                          onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                          placeholder="Search colleagues in organization directory or contacts..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-purple-500 placeholder:text-slate-400"
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-slate-100">
                        {filteredContacts.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400 space-y-1">
                            <p>No colleagues match "{assigneeSearchQuery}".</p>
                            <button
                              type="button"
                              onClick={() => {
                                setNewTeammateEmail(assigneeSearchQuery.includes('@') ? assigneeSearchQuery : '');
                                setNewTeammateName(assigneeSearchQuery.includes('@') ? '' : assigneeSearchQuery);
                                setAssigneeFilter('add');
                              }}
                              className="text-purple-600 hover:underline font-semibold text-xs"
                            >
                              + Add as a new organization teammate
                            </button>
                          </div>
                        ) : (
                          filteredContacts.map((c) => {
                            const isCurrent = assignedContact?.email.toLowerCase() === c.email.toLowerCase();
                            return (
                              <button
                                key={c.id + c.email}
                                type="button"
                                onClick={() => handleSelectContact(c)}
                                className={`w-full p-2 text-left rounded-lg transition-colors flex items-center justify-between text-xs ${
                                  isCurrent
                                    ? 'bg-purple-100/70 text-purple-900 font-semibold'
                                    : 'hover:bg-slate-100 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {c.avatarUrl ? (
                                    <img
                                      src={c.avatarUrl}
                                      alt=""
                                      className="w-6 h-6 rounded-full flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                                      {c.name[0]?.toUpperCase() || 'U'}
                                    </div>
                                  )}
                                  <div className="truncate">
                                    <p className="font-medium text-slate-900 truncate flex items-center gap-1.5">
                                      {c.name}
                                      {c.source === 'directory' && (
                                        <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 text-[9px] font-semibold">
                                          Org Directory
                                        </span>
                                      )}
                                      {c.source === 'custom' && (
                                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 text-[9px] font-semibold">
                                          Teammate
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-[10px] text-slate-400 truncate">{c.email}</p>
                                  </div>
                                </div>

                                {isCurrent ? (
                                  <span className="text-[10px] font-bold text-purple-700 flex items-center gap-0.5">
                                    <Check className="w-3 h-3" /> Selected
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-purple-600 opacity-0 group-hover:opacity-100 font-medium">
                                    Assign
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Drive Attachments */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                  Google Drive Attachments ({driveAttachments.length})
                </label>
                <button
                  type="button"
                  onClick={onOpenDrivePicker}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Attach Drive File
                </button>
              </div>

              {driveAttachments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No Drive files attached to this task yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {driveAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                    >
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 min-w-0 hover:text-blue-600 truncate"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span className="font-medium truncate">{att.name}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Google Calendar Sync & Assignee Calendar Dispatch */}
            <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CalendarCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    {task.calendarEventId ? 'Synced with Google Calendar' : 'Sync to Google Calendar'}
                    {assignedContact && (
                      <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded text-[9px] font-semibold">
                        + Invites {assignedContact.name}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {task.calendarEventId
                      ? `Scheduled on your Google Calendar${
                          assignedContact ? ` and invited ${assignedContact.name} (${assignedContact.email})` : ''
                        }`
                      : `Schedules deadline on Google Calendar${
                          assignedContact
                            ? ` and automatically places it onto ${assignedContact.name}’s calendar.`
                            : '.'
                        }`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {task.calendarEventId ? (
                  <button
                    type="button"
                    disabled={isCalendarSyncing}
                    onClick={async () => {
                      setIsCalendarSyncing(true);
                      await onUnsyncCalendar(task);
                      setIsCalendarSyncing(false);
                    }}
                    className="px-3 py-1.5 text-xs text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors font-medium shadow-2xs"
                  >
                    {isCalendarSyncing ? 'Removing...' : 'Remove Sync'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isCalendarSyncing}
                    onClick={async () => {
                      setIsCalendarSyncing(true);
                      await onSyncCalendar({
                        ...task,
                        title,
                        notes,
                        due,
                        assignedContact,
                      });
                      setIsCalendarSyncing(false);
                    }}
                    className="px-3.5 py-1.5 text-xs text-amber-900 bg-amber-200/90 hover:bg-amber-300 border border-amber-300/80 rounded-lg transition-colors font-bold shadow-2xs flex items-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {isCalendarSyncing
                      ? 'Scheduling...'
                      : assignedContact
                      ? `Schedule & Invite ${assignedContact.name.split(' ')[0]}`
                      : 'Add to Calendar'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Activity History Footer */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-[11px] text-slate-400 flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Updated: {new Date(task.updated).toLocaleString()}
              {task.completedAt && ` • Finished: ${new Date(task.completedAt).toLocaleString()}`}
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            className="px-5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            {isSaving ? 'Saving to Cloud...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
