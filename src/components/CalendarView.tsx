import React, { useState } from 'react';
import type { GQueueTask, GoogleCalendarEvent, GoogleContact } from '../types/gqueues';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  ExternalLink,
  Plus,
  Clock,
  Video,
  Edit2,
  Users,
  MapPin,
  Sparkles,
  Layers,
} from 'lucide-react';
import { CalendarEventModal } from './CalendarEventModal';

interface CalendarViewProps {
  tasks: GQueueTask[];
  calendarEvents: GoogleCalendarEvent[];
  contacts?: GoogleContact[];
  onSelectTask: (task: GQueueTask) => void;
  onToggleComplete: (task: GQueueTask) => void;
  onAddTask: (dateStr: string) => void;
  onCreateEvent?: (eventData: {
    summary: string;
    description?: string;
    dueDate?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    attendees?: Array<{ email: string; displayName?: string }>;
    addGoogleMeet?: boolean;
  }) => Promise<void>;
  onUpdateEvent?: (
    eventId: string,
    eventData: {
      summary?: string;
      description?: string;
      dueDate?: string;
      startTime?: string;
      endTime?: string;
      location?: string;
      attendees?: Array<{ email: string; displayName?: string }>;
    }
  ) => Promise<void>;
  onDeleteEvent?: (eventId: string) => Promise<void>;
  onConvertEventToTask?: (event: GoogleCalendarEvent) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  calendarEvents,
  contacts = [],
  onSelectTask,
  onToggleComplete,
  onAddTask,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onConvertEventToTask,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal states for clicking / editing
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<GoogleCalendarEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [targetDateForCreate, setTargetDateForCreate] = useState<string>('');

  // Quick Action menu when clicking on empty cell
  const [cellActionMenu, setCellActionMenu] = useState<{
    dateStr: string;
    x: number;
    y: number;
  } | null>(null);

  // Get days for current month view
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startDay = firstDayOfMonth.getDay(); // 0 is Sunday
  const daysInMonth = lastDayOfMonth.getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToday = () => {
    setCurrentDate(new Date());
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Map tasks by date YYYY-MM-DD
  const tasksByDate = React.useMemo(() => {
    const map: Record<string, GQueueTask[]> = {};
    for (const t of tasks) {
      if (t.due) {
        const d = t.due.split('T')[0];
        if (!map[d]) map[d] = [];
        map[d].push(t);
      }
    }
    return map;
  }, [tasks]);

  // Map calendar events by date YYYY-MM-DD
  const eventsByDate = React.useMemo(() => {
    const map: Record<string, GoogleCalendarEvent[]> = {};
    for (const e of calendarEvents) {
      const d = e.start.date || (e.start.dateTime ? e.start.dateTime.split('T')[0] : null);
      if (d) {
        if (!map[d]) map[d] = [];
        map[d].push(e);
      }
    }
    return map;
  }, [calendarEvents]);

  // Build calendar matrix (42 cells: 6 rows of 7 days)
  const calendarCells = [];
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const dateObj = new Date(year, month - 1, dayNum);
    calendarCells.push({
      dateObj,
      dateString: dateObj.toISOString().split('T')[0],
      dayNum,
      isCurrentMonth: false,
    });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const dateObj = new Date(year, month, i);
    calendarCells.push({
      dateObj,
      dateString: dateObj.toISOString().split('T')[0],
      dayNum: i,
      isCurrentMonth: true,
    });
  }

  const remaining = 42 - calendarCells.length;
  for (let i = 1; i <= remaining; i++) {
    const dateObj = new Date(year, month + 1, i);
    calendarCells.push({
      dateObj,
      dateString: dateObj.toISOString().split('T')[0],
      dayNum: i,
      isCurrentMonth: false,
    });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const handleOpenEditEvent = (evt: GoogleCalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEventForEdit(evt);
    setIsEventModalOpen(true);
  };

  const handleOpenCreateEventModal = (dateStr: string) => {
    setSelectedEventForEdit(null);
    setTargetDateForCreate(dateStr);
    setIsEventModalOpen(true);
    setCellActionMenu(null);
  };

  const handleSaveEvent = async (eventData: any) => {
    if (eventData.id && onUpdateEvent) {
      await onUpdateEvent(eventData.id, eventData);
    } else if (onCreateEvent) {
      await onCreateEvent(eventData);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden relative"
      onClick={() => setCellActionMenu(null)}
    >
      {/* Calendar Header Controls */}
      <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">{monthName}</h2>
            <p className="text-xs text-slate-500">
              Click any event or meeting to view & edit • Click any day to add
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="hidden md:flex items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span> GQueues Task
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Google Calendar / Meet
            </span>
          </div>

          {/* Quick Schedule Button */}
          <button
            onClick={() => handleOpenCreateEventModal(todayStr)}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Schedule Meeting</span>
          </button>

          {/* Month Navigation */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-white rounded-md text-slate-600 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToday}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white rounded-md transition-colors"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-white rounded-md text-slate-600 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 bg-white border-b border-slate-200 text-center py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <span className="text-rose-500">Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span className="text-blue-500">Sat</span>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-px bg-slate-200 overflow-y-auto">
        {calendarCells.map((cell) => {
          const isToday = cell.dateString === todayStr;
          const dayTasks = tasksByDate[cell.dateString] || [];
          const dayEvents = eventsByDate[cell.dateString] || [];

          return (
            <div
              key={cell.dateString}
              onClick={(e) => {
                // If user clicks on empty space of cell, show popover with Task or Meeting creation
                const rect = e.currentTarget.getBoundingClientRect();
                setCellActionMenu({
                  dateStr: cell.dateString,
                  x: Math.min(e.clientX, window.innerWidth - 220),
                  y: Math.min(e.clientY, window.innerHeight - 150),
                });
              }}
              className={`min-h-[105px] p-1.5 sm:p-2 bg-white flex flex-col justify-between group transition-colors cursor-pointer hover:bg-blue-50/20 ${
                !cell.isCurrentMonth ? 'bg-slate-50/70 text-slate-400' : 'text-slate-800'
              } ${isToday ? 'bg-blue-50/50 ring-1 ring-inset ring-blue-400' : ''}`}
            >
              {/* Day Number and Action Buttons */}
              <div className="flex items-center justify-between pointer-events-auto">
                <span
                  className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
                    isToday
                      ? 'bg-blue-600 text-white shadow-xs'
                      : cell.isCurrentMonth
                      ? 'text-slate-700'
                      : 'text-slate-400'
                  }`}
                >
                  {cell.dayNum}
                </span>

                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddTask(cell.dateString);
                    }}
                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Add task on this date"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCreateEventModal(cell.dateString);
                    }}
                    className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                    title="Schedule meeting on this date"
                  >
                    <Video className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Items Container */}
              <div className="flex-1 overflow-y-auto space-y-1 my-1 max-h-24 pr-0.5">
                {/* Google Calendar Events - Clickable and Editable */}
                {dayEvents.map((evt) => {
                  const hasMeet = !!evt.hangoutLink;
                  const timeDisplay = evt.start.dateTime
                    ? new Date(evt.start.dateTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'All Day';

                  return (
                    <div
                      key={evt.id}
                      onClick={(e) => handleOpenEditEvent(evt, e)}
                      className="p-1 sm:p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100/90 border border-amber-200/90 text-[11px] text-amber-900 flex items-center justify-between gap-1 shadow-2xs group/item transition-all cursor-pointer"
                      title={`Click to edit: ${evt.summary} (${timeDisplay})`}
                    >
                      <div className="flex items-center gap-1 truncate min-w-0">
                        {hasMeet ? (
                          <Video className="w-3 h-3 text-blue-600 flex-shrink-0" />
                        ) : (
                          <Clock className="w-3 h-3 text-amber-600 flex-shrink-0" />
                        )}
                        <span className="truncate font-semibold">{evt.summary}</span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-[9px] text-amber-700 font-medium hidden sm:inline">
                          {timeDisplay}
                        </span>
                        <Edit2 className="w-2.5 h-2.5 text-amber-600 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  );
                })}

                {/* GQueues Tasks - Clickable and Editable */}
                {dayTasks.map((t) => {
                  const isDone = t.status === 'completed';
                  return (
                    <div
                      key={t.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTask(t);
                      }}
                      className={`p-1 sm:p-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all ${
                        isDone
                          ? 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                          : 'bg-blue-50 border-blue-200 hover:border-blue-300 text-blue-900 hover:bg-blue-100 font-medium'
                      }`}
                      title={`Click to edit task: ${t.title}`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleComplete(t);
                        }}
                        className="text-slate-400 hover:text-emerald-600 flex-shrink-0"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Circle className="w-3 h-3 text-slate-400" />
                        )}
                      </button>
                      <span className="truncate flex-1">{t.title}</span>
                      {t.priority && t.priority !== 'none' && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            t.priority === 'urgent'
                              ? 'bg-red-500'
                              : t.priority === 'high'
                              ? 'bg-amber-500'
                              : t.priority === 'medium'
                              ? 'bg-blue-500'
                              : 'bg-slate-400'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Popover Action Menu for empty day clicking */}
      {cellActionMenu && (
        <div
          style={{ top: cellActionMenu.y, left: cellActionMenu.x }}
          className="fixed z-40 bg-white border border-slate-200 rounded-xl shadow-xl p-2 w-52 flex flex-col gap-1 animate-in fade-in zoom-in-95"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 border-b border-slate-100">
            {new Date(cellActionMenu.dateStr).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              weekday: 'short',
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              onAddTask(cellActionMenu.dateStr);
              setCellActionMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-800 hover:bg-blue-50 hover:text-blue-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4 text-blue-600" />
            Add GQueues Task
          </button>
          <button
            type="button"
            onClick={() => handleOpenCreateEventModal(cellActionMenu.dateStr)}
            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-800 hover:bg-amber-50 hover:text-amber-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Video className="w-4 h-4 text-amber-600" />
            Schedule Google Meeting
          </button>
        </div>
      )}

      {/* Calendar Event / Meeting Editor & Scheduler Modal */}
      <CalendarEventModal
        isOpen={isEventModalOpen}
        event={selectedEventForEdit}
        initialDate={targetDateForCreate}
        contacts={contacts}
        onClose={() => {
          setIsEventModalOpen(false);
          setSelectedEventForEdit(null);
        }}
        onSave={handleSaveEvent}
        onDelete={onDeleteEvent}
        onConvertToTask={onConvertEventToTask}
      />
    </div>
  );
};
