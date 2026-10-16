import React, { useState } from 'react';
import type { QueueList, SmartQueueType } from '../types/gqueues';
import {
  CalendarDays,
  Clock,
  Star,
  Layers,
  CheckCircle,
  Plus,
  Folder,
  FolderOpen,
  MoreVertical,
  Edit2,
  Trash2,
  Hash,
  ChevronRight,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Calendar,
  Download
} from 'lucide-react';

interface SidebarProps {
  queues: QueueList[];
  activeQueueId: string | null;
  activeSmartQueue: SmartQueueType | null;
  selectedTag: string | null;
  onSelectQueue: (queueId: string) => void;
  onSelectSmartQueue: (smart: SmartQueueType) => void;
  onSelectTag: (tag: string | null) => void;
  onNewQueue: (category?: string) => void;
  onEditQueue: (queue: QueueList) => void;
  onDeleteQueue: (queue: QueueList) => void;
  onOpenInstallModal?: () => void;
  allTags: string[];
  counts: {
    today: number;
    overdue: number;
    upcoming: number;
    starred: number;
    all: number;
    completed: number;
  };
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  queues,
  activeQueueId,
  activeSmartQueue,
  selectedTag,
  onSelectQueue,
  onSelectSmartQueue,
  onSelectTag,
  onNewQueue,
  onEditQueue,
  onDeleteQueue,
  onOpenInstallModal,
  allTags,
  counts,
  isMobileOpen,
  onCloseMobile,
}) => {
  // Category collapse states
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [activeMenuQueueId, setActiveMenuQueueId] = useState<string | null>(null);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Group queues by category
  const categories = React.useMemo(() => {
    const map: Record<string, QueueList[]> = {};
    for (const q of queues) {
      const cat = q.category || 'My Queues';
      if (!map[cat]) map[cat] = [];
      map[cat].push(q);
    }
    return map;
  }, [queues]);

  const smartQueueItems: Array<{
    type: SmartQueueType;
    label: string;
    icon: React.ReactNode;
    count: number;
    countColor?: string;
  }> = [
    {
      type: 'today',
      label: 'Today',
      icon: <CalendarDays className="w-4 h-4 text-blue-600" />,
      count: counts.today,
      countColor: 'bg-blue-100 text-blue-700',
    },
    {
      type: 'overdue',
      label: 'Overdue',
      icon: <Clock className="w-4 h-4 text-red-500" />,
      count: counts.overdue,
      countColor: counts.overdue > 0 ? 'bg-red-100 text-red-700 font-bold' : undefined,
    },
    {
      type: 'upcoming',
      label: 'Upcoming (7 Days)',
      icon: <Calendar className="w-4 h-4 text-emerald-600" />,
      count: counts.upcoming,
      countColor: 'bg-slate-100 text-slate-600',
    },
    {
      type: 'starred',
      label: 'Starred & Urgent',
      icon: <Star className="w-4 h-4 text-amber-500" />,
      count: counts.starred,
      countColor: counts.starred > 0 ? 'bg-amber-100 text-amber-700' : undefined,
    },
    {
      type: 'all',
      label: 'All Active Tasks',
      icon: <Layers className="w-4 h-4 text-slate-600" />,
      count: counts.all,
      countColor: 'bg-slate-100 text-slate-600',
    },
    {
      type: 'completed',
      label: 'Completed Tasks',
      icon: <CheckCircle className="w-4 h-4 text-slate-400" />,
      count: counts.completed,
      countColor: 'bg-slate-100 text-slate-500',
    },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 bg-slate-50/95 border-r border-slate-200/80 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Section: Smart Queues */}
          <div>
            <div className="px-3 mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-blue-500" />
                Smart Queues
              </span>
            </div>
            <nav className="space-y-0.5">
              {smartQueueItems.map((item) => {
                const isActive = activeSmartQueue === item.type;
                return (
                  <button
                    key={item.type}
                    onClick={() => {
                      onSelectSmartQueue(item.type);
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-100/80 text-blue-900 font-semibold shadow-xs'
                        : 'text-slate-700 hover:bg-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.count > 0 && (
                      <span
                        className={`text-[11px] px-1.5 py-0.2 rounded-full font-medium ${
                          item.countColor || 'bg-slate-200/80 text-slate-700'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Section: Categories and Queues */}
          <div>
            <div className="px-3 mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Folder className="w-3 h-3 text-slate-400" />
                Queues & Projects
              </span>
              <button
                onClick={() => onNewQueue()}
                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-200/60 rounded-md transition-colors"
                title="Create new queue"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {Object.keys(categories).length === 0 ? (
              <div className="px-3 py-4 text-center rounded-lg border border-dashed border-slate-300">
                <p className="text-xs text-slate-500">No queues found in Google Tasks.</p>
                <button
                  onClick={() => onNewQueue()}
                  className="mt-2 text-xs text-blue-600 hover:underline font-medium inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Create your first queue
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(categories).map(([categoryName, queueList]) => {
                  const isCollapsed = !!collapsedCategories[categoryName];

                  return (
                    <div key={categoryName} className="space-y-1">
                      {/* Category Header */}
                      <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 group">
                        <button
                          onClick={() => toggleCategory(categoryName)}
                          className="flex items-center gap-1.5 truncate flex-1 text-left"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span className="truncate">{categoryName}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({queueList.length})
                          </span>
                        </button>
                        <button
                          onClick={() => onNewQueue(categoryName)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 transition-opacity"
                          title={`Add queue under ${categoryName}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Queues List */}
                      {!isCollapsed && (
                        <div className="space-y-0.5 pl-3">
                          {queueList.map((queue) => {
                            const isQueueActive = activeQueueId === queue.id && activeSmartQueue === null;
                            const isMenuOpen = activeMenuQueueId === queue.id;

                            return (
                              <div
                                key={queue.id}
                                className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                                  isQueueActive
                                    ? 'bg-blue-100/90 text-blue-900 font-semibold shadow-xs'
                                    : 'text-slate-700 hover:bg-slate-200/60'
                                }`}
                              >
                                <button
                                  onClick={() => {
                                    onSelectQueue(queue.id);
                                    onCloseMobile();
                                  }}
                                  className="flex items-center gap-2 truncate flex-1 text-left"
                                >
                                  <span
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: queue.color || '#2563eb' }}
                                  />
                                  <span className="truncate">{queue.title}</span>
                                </button>

                                <div className="flex items-center gap-1">
                                  {typeof queue.taskCount === 'number' && queue.taskCount > 0 && (
                                    <span className="text-[11px] text-slate-400 font-normal px-1">
                                      {queue.taskCount}
                                    </span>
                                  )}

                                  <div className="relative">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuQueueId(isMenuOpen ? null : queue.id);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-700 rounded transition-opacity"
                                      title="Queue options"
                                    >
                                      <MoreVertical className="w-3.5 h-3.5" />
                                    </button>

                                    {isMenuOpen && (
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95"
                                      >
                                        <button
                                          onClick={() => {
                                            setActiveMenuQueueId(null);
                                            onEditQueue(queue);
                                          }}
                                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                        >
                                          <Edit2 className="w-3 h-3 text-slate-400" />
                                          <span>Edit Queue</span>
                                        </button>
                                        <button
                                          onClick={() => {
                                            setActiveMenuQueueId(null);
                                            onDeleteQueue(queue);
                                          }}
                                          className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"
                                        >
                                          <Trash2 className="w-3 h-3 text-red-400" />
                                          <span>Delete Queue</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Tags */}
          {allTags.length > 0 && (
            <div>
              <div className="px-3 mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-3 h-3 text-slate-400" />
                  Tags
                </span>
                {selectedTag && (
                  <button
                    onClick={() => onSelectTag(null)}
                    className="text-[10px] text-blue-600 hover:underline font-medium"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1 px-2">
                {allTags.map((tag) => {
                  const isSelected = selectedTag === tag;
                  return (
                    <button
                      key={tag}
                      onClick={() => onSelectTag(isSelected ? null : tag)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-200/70 text-slate-700 hover:bg-slate-300/70'
                      }`}
                    >
                      <span>#{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Install App Banner Card */}
          {onOpenInstallModal && (
            <div className="mx-2 p-3 bg-gradient-to-br from-blue-50 to-emerald-50 rounded-xl border border-blue-200/80 shadow-2xs">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Download className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs font-bold text-slate-900">Install GQueues App</p>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed mb-2.5">
                Install as a standalone app on Android (APK), iPhone (iOS), or Windows PC.
              </p>
              <button
                onClick={onOpenInstallModal}
                className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install Now</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer: Workspace Status */}
        <div className="p-3 border-t border-slate-200/80 bg-white/70">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span className="truncate">Google Cloud Synced</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Tasks • Calendar • Drive • People</p>
        </div>
      </aside>
    </>
  );
};
