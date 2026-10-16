import React, { useState } from 'react';
import type { GQueueTask, GoogleCalendarEvent } from '../types/gqueues';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  ExternalLink,
  Plus,
  Clock
} from 'lucide-react';

interface CalendarViewProps {
  tasks: GQueueTask[];
  calendarEvents: GoogleCalendarEvent[];
  onSelectTask: (task: GQueueTask) => void;
  onToggleComplete: (task: GQueueTask) => void;
  onAddTask: (dateStr: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  calendarEvents,
  onSelectTask,
  onToggleComplete,
  onAddTask,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

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
  // Days from prev month
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

  // Days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    const dateObj = new Date(year, month, i);
    calendarCells.push({
      dateObj,
      dateString: dateObj.toISOString().split('T')[0],
      dayNum: i,
      isCurrentMonth: true,
    });
  }

  // Fill remaining cells with next month
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

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Calendar Header Controls */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{monthName}</h2>
            <p className="text-xs text-slate-500">Live Google Calendar Events + Task Due Dates</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="hidden lg:flex items-center gap-3 text-xs mr-4 text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> GQueues Task
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Google Calendar Event
            </span>
          </div>

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
        <span>Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
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
              className={`min-h-[100px] p-1.5 sm:p-2 bg-white flex flex-col justify-between group transition-colors ${
                !cell.isCurrentMonth ? 'bg-slate-50/60 text-slate-400' : 'text-slate-800'
              } ${isToday ? 'bg-blue-50/40' : ''}`}
            >
              {/* Day Number and Add Button */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-blue-600 text-white font-bold'
                      : cell.isCurrentMonth
                      ? 'text-slate-700'
                      : 'text-slate-400'
                  }`}
                >
                  {cell.dayNum}
                </span>

                <button
                  type="button"
                  onClick={() => onAddTask(cell.dateString)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 rounded transition-opacity"
                  title="Add task on this date"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Items Container */}
              <div className="flex-1 overflow-y-auto space-y-1 my-1 max-h-24">
                {/* Calendar Events */}
                {dayEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-1 rounded bg-amber-50 border border-amber-200/80 text-[10px] text-amber-900 truncate flex items-center gap-1 shadow-2xs"
                    title={`Google Calendar Event: ${evt.summary}`}
                  >
                    <Clock className="w-2.5 h-2.5 text-amber-600 flex-shrink-0" />
                    <span className="truncate font-medium">{evt.summary}</span>
                  </div>
                ))}

                {/* GQueues Tasks */}
                {dayTasks.map((t) => {
                  const isDone = t.status === 'completed';
                  return (
                    <div
                      key={t.id}
                      onClick={() => onSelectTask(t)}
                      className={`p-1 rounded border text-[10px] truncate flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors ${
                        isDone
                          ? 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                          : 'bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100 font-medium'
                      }`}
                      title={t.title}
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
                      <span className="truncate">{t.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
