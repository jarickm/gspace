import React from 'react';
import type { SmartQueueType } from '../types/gqueues';
import {
  ListTodo,
  CalendarDays,
  Calendar,
  Download,
  Plus,
  Clock
} from 'lucide-react';

interface MobileBottomNavProps {
  currentView: 'tasks' | 'calendar';
  activeSmartQueue: SmartQueueType | null;
  onSelectView: (view: 'tasks' | 'calendar') => void;
  onOpenQueuesDrawer: () => void;
  onSelectToday: () => void;
  onQuickAddTask: () => void;
  onOpenInstallModal: () => void;
  todayCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  activeSmartQueue,
  onSelectView,
  onOpenQueuesDrawer,
  onSelectToday,
  onQuickAddTask,
  onOpenInstallModal,
  todayCount,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200/90 z-30 px-3 flex items-center justify-around shadow-lg">
      {/* 1. All Queues / Drawer */}
      <button
        onClick={onOpenQueuesDrawer}
        className="flex flex-col items-center justify-center gap-1 text-slate-600 hover:text-blue-600 active:scale-95 transition-all w-14"
      >
        <ListTodo className="w-5 h-5" />
        <span className="text-[10px] font-semibold">Queues</span>
      </button>

      {/* 2. Today */}
      <button
        onClick={() => {
          onSelectView('tasks');
          onSelectToday();
        }}
        className={`flex flex-col items-center justify-center gap-1 relative w-14 transition-all ${
          currentView === 'tasks' && activeSmartQueue === 'today'
            ? 'text-blue-600 font-bold'
            : 'text-slate-600 hover:text-blue-600'
        }`}
      >
        <CalendarDays className="w-5 h-5" />
        <span className="text-[10px] font-semibold">Today</span>
        {todayCount > 0 && (
          <span className="absolute top-0 right-3 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
            {todayCount}
          </span>
        )}
      </button>

      {/* 3. Central FAB: + Add Task */}
      <button
        onClick={onQuickAddTask}
        className="w-12 h-12 -mt-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 hover:bg-blue-700 active:scale-90 transition-all cursor-pointer"
        aria-label="Add task"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* 4. Calendar View */}
      <button
        onClick={() => onSelectView('calendar')}
        className={`flex flex-col items-center justify-center gap-1 w-14 transition-all ${
          currentView === 'calendar'
            ? 'text-blue-600 font-bold'
            : 'text-slate-600 hover:text-blue-600'
        }`}
      >
        <Calendar className="w-5 h-5" />
        <span className="text-[10px] font-semibold">Calendar</span>
      </button>

      {/* 5. Install App button */}
      <button
        onClick={onOpenInstallModal}
        className="flex flex-col items-center justify-center gap-1 text-slate-600 hover:text-emerald-600 active:scale-95 transition-all w-14"
      >
        <Download className="w-5 h-5 text-emerald-600" />
        <span className="text-[10px] font-semibold text-emerald-700">Install</span>
      </button>
    </nav>
  );
};
