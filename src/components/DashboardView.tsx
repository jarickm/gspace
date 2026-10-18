import React, { useState, useMemo } from 'react';
import type { GQueueTask, QueueList } from '../types/gqueues';
import { formatSecondsToHuman } from '../services/tasksApi';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  Layers,
  Calendar,
  AlertTriangle,
  Timer,
  PieChart as PieIcon,
  BarChart3,
  CalendarDays,
  Sparkles,
  ArrowUpRight,
  Filter,
} from 'lucide-react';

interface DashboardViewProps {
  tasks: GQueueTask[];
  allTasks: GQueueTask[];
  queues: QueueList[];
  onSelectTask: (task: GQueueTask) => void;
  onSelectQueue: (queueId: string) => void;
  onOpenCompletedView: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  tasks,
  allTasks,
  queues,
  onSelectTask,
  onSelectQueue,
  onOpenCompletedView,
}) => {
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [queueFilter, setQueueFilter] = useState<string>('all');

  // Filter tasks based on selections
  const filteredTasks = useMemo(() => {
    let list = queueFilter === 'all' ? allTasks : allTasks.filter((t) => t.listId === queueFilter);

    if (timeFilter === 'all') return list;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfWeek = startOfToday + 7 * 24 * 60 * 60 * 1000;
    const endOfMonth = startOfToday + 30 * 24 * 60 * 60 * 1000;

    return list.filter((t) => {
      if (!t.due) return timeFilter === 'all';
      const dueTime = new Date(t.due).getTime();

      if (timeFilter === 'today') {
        const d = new Date(t.due);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      }
      if (timeFilter === 'week') {
        return dueTime >= startOfToday && dueTime <= endOfWeek;
      }
      if (timeFilter === 'month') {
        return dueTime >= startOfToday && dueTime <= endOfMonth;
      }
      return true;
    });
  }, [allTasks, queueFilter, timeFilter]);

  // High-level KPI metrics
  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter((t) => t.status === 'completed');
  const activeTasks = filteredTasks.filter((t) => t.status !== 'completed');

  const todayStr = new Date().toISOString().split('T')[0];
  const overdueTasks = activeTasks.filter((t) => {
    if (!t.due) return false;
    const d = t.due.split('T')[0];
    return d < todayStr;
  });

  const dueTodayTasks = activeTasks.filter((t) => {
    if (!t.due) return false;
    return t.due.split('T')[0] === todayStr;
  });

  const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  const totalTimeSpentSeconds = filteredTasks.reduce(
    (acc, t) => acc + (t.totalTimeSpentSeconds || 0),
    0
  );

  // 1. Completion Status Breakdown (Donut Chart)
  const statusChartData = useMemo(() => {
    const todoCount = activeTasks.filter((t) => t.kanbanStatus === 'todo' && !overdueTasks.includes(t)).length;
    const inProgressCount = activeTasks.filter((t) => t.kanbanStatus === 'in_progress').length;
    const waitingCount = activeTasks.filter((t) => t.kanbanStatus === 'waiting').length;

    return [
      { name: 'Completed', value: completedTasks.length, color: '#10b981' },
      { name: 'In Progress', value: inProgressCount, color: '#3b82f6' },
      { name: 'Overdue', value: overdueTasks.length, color: '#ef4444' },
      { name: 'To Do', value: Math.max(0, todoCount), color: '#8b5cf6' },
      { name: 'Waiting', value: waitingCount, color: '#f59e0b' },
    ].filter((item) => item.value > 0);
  }, [completedTasks, activeTasks, overdueTasks]);

  // 2. Workload Distribution across Categories / Queues (Bar Chart)
  const workloadByQueueData = useMemo(() => {
    return queues.map((q) => {
      const qTasks = allTasks.filter((t) => t.listId === q.id);
      const completed = qTasks.filter((t) => t.status === 'completed').length;
      const pending = qTasks.filter((t) => t.status !== 'completed').length;
      const timeHours = (
        qTasks.reduce((acc, t) => acc + (t.totalTimeSpentSeconds || 0), 0) / 3600
      ).toFixed(1);

      return {
        name: q.title.length > 14 ? `${q.title.slice(0, 12)}…` : q.title,
        fullName: q.title,
        category: q.category,
        Active: pending,
        Completed: completed,
        total: qTasks.length,
        hoursSpent: Number(timeHours),
      };
    }).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [queues, allTasks]);

  // 3. Overdue & Due Horizon Trends (Area Chart)
  const dueHorizonTrendData = useMemo(() => {
    const now = new Date();
    const days: { label: string; overdue: number; due: number; completed: number }[] = [];

    // Analyze past 3 days and next 4 days (7 day window)
    for (let i = -3; i <= 4; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = i === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });

      const dueOnThisDay = activeTasks.filter((t) => t.due && t.due.split('T')[0] === dateStr).length;
      const isPast = dateStr < todayStr;
      const overdueOnThisDay = isPast
        ? activeTasks.filter((t) => t.due && t.due.split('T')[0] === dateStr).length
        : 0;
      const completedOnThisDay = allTasks.filter(
        (t) => t.status === 'completed' && t.completedAt && t.completedAt.split('T')[0] === dateStr
      ).length;

      days.push({
        label: dayLabel,
        overdue: overdueOnThisDay,
        due: dueOnThisDay,
        completed: completedOnThisDay,
      });
    }

    return days;
  }, [activeTasks, allTasks, todayStr]);

  // 4. Priority Breakdown
  const priorityChartData = useMemo(() => {
    const urgent = activeTasks.filter((t) => t.priority === 'urgent').length;
    const high = activeTasks.filter((t) => t.priority === 'high').length;
    const medium = activeTasks.filter((t) => t.priority === 'medium').length;
    const low = activeTasks.filter((t) => t.priority === 'low').length;
    const none = activeTasks.filter((t) => !t.priority || t.priority === 'none').length;

    return [
      { name: 'Urgent', count: urgent, color: '#dc2626' },
      { name: 'High', count: high, color: '#f97316' },
      { name: 'Medium', count: medium, color: '#eab308' },
      { name: 'Low', count: low, color: '#3b82f6' },
      { name: 'None', count: none, color: '#94a3b8' },
    ];
  }, [activeTasks]);

  // Top time tracked tasks
  const topTimeLoggedTasks = useMemo(() => {
    return [...allTasks]
      .filter((t) => (t.totalTimeSpentSeconds || 0) > 0)
      .sort((a, b) => (b.totalTimeSpentSeconds || 0) - (a.totalTimeSpentSeconds || 0))
      .slice(0, 5);
  }, [allTasks]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Dashboard Top Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Productivity & Analytics Dashboard
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time visual metrics for completion rates, queue workload, overdue trends, and time logs.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Queue Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={queueFilter}
              onChange={(e) => setQueueFilter(e.target.value)}
              className="bg-transparent border-none outline-none font-medium text-slate-700 cursor-pointer"
            >
              <option value="all">All Queues ({allTasks.length} tasks)</option>
              {queues.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
          </div>

          {/* Time Horizon Filter */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                timeFilter === 'all' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeFilter('today')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                timeFilter === 'today' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeFilter('week')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                timeFilter === 'week' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Week
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Card 1: Total Tasks */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Tasks</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{totalTasks}</span>
            <span className="text-xs text-slate-500">across queues</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>{activeTasks.length} pending execution</span>
          </div>
        </div>

        {/* Card 2: Completion Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Completion Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600">{completionRate}%</span>
            <span className="text-xs text-slate-500">({completedTasks.length} done)</span>
          </div>
          <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* Card 3: Overdue Tasks */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Overdue</span>
            <AlertTriangle className={`w-4 h-4 ${overdueTasks.length > 0 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-extrabold ${overdueTasks.length > 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {overdueTasks.length}
            </span>
            <span className="text-xs text-slate-500">need action</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {overdueTasks.length > 0 ? (
              <span className="text-red-600 font-medium">⚠️ Action required immediately</span>
            ) : (
              <span className="text-emerald-600 font-medium">✨ All deadlines on track</span>
            )}
          </div>
        </div>

        {/* Card 4: Due Today */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Due Today</span>
            <CalendarDays className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-600">{dueTodayTasks.length}</span>
            <span className="text-xs text-slate-500">scheduled</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            <span>Focused on today’s agenda</span>
          </div>
        </div>

        {/* Card 5: Total Time Logged */}
        <div className="col-span-2 lg:col-span-1 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Time Tracked</span>
            <Timer className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-purple-700">
              {formatSecondsToHuman(totalTimeSpentSeconds)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-purple-600 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Productivity stopwatch</span>
          </div>
        </div>
      </div>

      {/* Main Charts Grid: 2-Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Task Completion & Status Breakdown (Donut Chart) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Task Status & Completion Breakdown</h2>
            </div>
            <span className="text-xs text-slate-400">{filteredTasks.length} Total</span>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {statusChartData.length === 0 ? (
              <div className="text-center text-xs text-slate-400">
                <p>No tasks found for current filter.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any, name: any) => [`${val} tasks`, name]}
                    contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Overall completion rate: <strong className="text-emerald-700">{completionRate}%</strong></span>
            <button
              onClick={onOpenCompletedView}
              className="text-blue-600 hover:underline font-semibold flex items-center gap-1"
            >
              Archive & history <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Chart 2: Workload Distribution Across Queues (Stacked Bar Chart) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">Workload Distribution Across Queues</h2>
            </div>
            <span className="text-xs text-slate-400">{queues.length} Queues</span>
          </div>

          <div className="h-64 w-full">
            {workloadByQueueData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                <p>No queue data available.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadByQueueData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded-lg text-xs space-y-1 shadow-lg">
                            <p className="font-bold">{data.fullName}</p>
                            <p className="text-blue-300">Active Tasks: {data.Active}</p>
                            <p className="text-emerald-300">Completed: {data.Completed}</p>
                            <p className="text-purple-300">Time Tracked: {data.hoursSpent} hrs</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }} />
                  <Bar dataKey="Active" fill="#3b82f6" stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Completed" fill="#10b981" stackId="a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Largest queue: <strong className="text-slate-800">{workloadByQueueData[0]?.fullName || 'N/A'}</strong></span>
            <span>Balanced workload across team</span>
          </div>
        </div>

        {/* Chart 3: Overdue & Schedule Trends (Area Chart) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">Deadlines & Completion Trends (7-Day Horizon)</h2>
            </div>
            <span className="text-xs text-slate-400">Past & Upcoming</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dueHorizonTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }} />
                <Area
                  type="monotone"
                  dataKey="due"
                  name="Tasks Due"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorDue)"
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Completed"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorCompleted)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Due today: <strong className="text-amber-600">{dueTodayTasks.length} tasks</strong></span>
            <span>Overdue total: <strong className="text-red-600">{overdueTasks.length}</strong></span>
          </div>
        </div>

        {/* Chart 4: Priority & Productivity Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-purple-600" />
              <h2 className="text-sm font-bold text-slate-900">Task Priorities & Time Investment</h2>
            </div>
            <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-semibold">
              {formatSecondsToHuman(totalTimeSpentSeconds)} Logged
            </span>
          </div>

          <div className="space-y-4">
            {/* Priority Bars */}
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Priority Distribution (Active Tasks)</p>
              <div className="space-y-1.5">
                {priorityChartData.map((item) => {
                  const pct = activeTasks.length > 0 ? Math.round((item.count / activeTasks.length) * 100) : 0;
                  return (
                    <div key={item.name} className="flex items-center gap-3 text-xs">
                      <span className="w-16 font-medium text-slate-700">{item.name}</span>
                      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, backgroundColor: item.color }}
                        />
                      </div>
                      <span className="w-12 text-right font-bold text-slate-600">
                        {item.count} <span className="text-[10px] text-slate-400 font-normal">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Tasks with Time Logged */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center justify-between">
                <span>Top Time-Logged Tasks</span>
                <span className="text-[10px] text-slate-400">Stopwatch records</span>
              </p>
              {topTimeLoggedTasks.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No tasks have logged time yet. Use the Start/Stop timer in task details!</p>
              ) : (
                <div className="space-y-1.5">
                  {topTimeLoggedTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => onSelectTask(t)}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-purple-50/60 border border-slate-200/60 transition-colors cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Clock className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                        <span className="font-semibold text-slate-800 truncate">{t.title}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[11px] flex-shrink-0">
                        {formatSecondsToHuman(t.totalTimeSpentSeconds || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
