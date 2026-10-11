import React, { useState } from 'react';
import { Task, TaskPriority } from '../types';
import { saveTask, deleteTask, enqueueSyncAction } from '../db/indexedDB';
import { syncEngine } from '../sync/syncEngine';
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  MoreVertical,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Search,
  Filter,
  Layers,
  Tag,
  Check,
} from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onTasksChanged: () => void;
  onOpenConflict: (task: Task) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onEditTask,
  onTasksChanged,
  onOpenConflict,
}) => {
  const [filter, setFilter] = useState<'all' | 'today' | 'pending' | 'completed'>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // Unique subjects
  const subjects = Array.from(new Set(tasks.map((t) => t.subject))).filter(Boolean);

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    // Tab filter
    if (filter === 'today' && task.dueDate !== todayStr) return false;
    if (filter === 'pending' && task.completed) return false;
    if (filter === 'completed' && !task.completed) return false;

    // Subject filter
    if (selectedSubject !== 'all' && task.subject !== selectedSubject) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchSubj = task.subject.toLowerCase().includes(q);
      const matchDesc = task.description?.toLowerCase().includes(q);
      const matchTags = task.tags?.some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchSubj && !matchDesc && !matchTags) return false;
    }

    return true;
  });

  // Toggle completion
  const handleToggleComplete = async (task: Task) => {
    const updated: Task = {
      ...task,
      completed: !task.completed,
      updatedAt: Date.now(),
      syncStatus: 'pending',
    };
    await saveTask(updated);

    await enqueueSyncAction({
      id: 'action-toggle-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      clientMutationId: `mut-toggle-${task.id}-${Date.now()}`,
      taskId: task.id,
      action: 'update',
      payload: { completed: updated.completed },
      timestamp: Date.now(),
      baseVersion: task.version,
      retryCount: 0,
      status: 'queued',
    });

    syncEngine.addLog(
      `Task "${task.title}" marked as ${updated.completed ? 'completed' : 'pending'}.`,
      'info'
    );
    syncEngine.attemptSync();
    onTasksChanged();
  };

  // Reordering: Move up / Move down
  const handleMove = async (task: Task, direction: 'up' | 'down') => {
    const currentIndex = tasks.findIndex((t) => t.id === task.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= tasks.length) return;

    const targetTask = tasks[targetIndex];

    // Swap order values
    const currentOrder = task.order;
    const targetOrder = targetTask.order;

    task.order = targetOrder;
    targetTask.order = currentOrder;
    task.syncStatus = 'pending';
    targetTask.syncStatus = 'pending';

    await saveTask(task);
    await saveTask(targetTask);

    await enqueueSyncAction({
      id: 'action-reorder-' + task.id + '-' + Date.now(),
      clientMutationId: `mut-reorder-${task.id}-${Date.now()}`,
      taskId: task.id,
      action: 'reorder',
      payload: { order: task.order },
      timestamp: Date.now(),
      baseVersion: task.version,
      retryCount: 0,
      status: 'queued',
    });

    syncEngine.addLog(`Reordered task "${task.title}".`, 'info');
    syncEngine.attemptSync();
    onTasksChanged();
  };

  // Delete task
  const confirmDelete = async () => {
    if (!taskToDelete) return;
    const t = taskToDelete;
    await deleteTask(t.id);

    await enqueueSyncAction({
      id: 'action-del-' + t.id + '-' + Date.now(),
      clientMutationId: `mut-del-${t.id}-${Date.now()}`,
      taskId: t.id,
      action: 'delete',
      payload: null,
      timestamp: Date.now(),
      baseVersion: t.version,
      retryCount: 0,
      status: 'queued',
    });

    syncEngine.addLog(`Deleted task "${t.title}".`, 'info');
    syncEngine.attemptSync();
    setTaskToDelete(null);
    onTasksChanged();
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'low':
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({tasks.length})
            </button>
            <button
              onClick={() => setFilter('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filter === 'today'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today ({tasks.filter((t) => t.dueDate === todayStr).length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filter === 'pending'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending ({tasks.filter((t) => !t.completed).length})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filter === 'completed'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Completed ({tasks.filter((t) => t.completed).length})
            </button>
          </div>

          {/* Subject Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-700"
            >
              <option value="all">All Subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search study tasks by topic, keyword, subject, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs font-medium pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No study tasks found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'Try adjusting your search terms or filter settings.'
              : 'Add your first task or generate a study plan to start your session.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task, index) => {
            const isToday = task.dueDate === todayStr;
            const isPast = task.dueDate < todayStr && !task.completed;

            return (
              <div
                key={task.id}
                className={`group p-4 rounded-2xl bg-white border transition shadow-2xs hover:shadow-xs ${
                  task.completed
                    ? 'border-slate-200 bg-slate-50/50 opacity-80'
                    : task.syncStatus === 'conflict'
                    ? 'border-rose-300 bg-rose-50/30'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Complete checkbox */}
                  <button
                    onClick={() => handleToggleComplete(task)}
                    className="mt-0.5 text-slate-400 hover:text-indigo-600 transition shrink-0"
                    title={task.completed ? 'Mark incomplete' : 'Mark completed'}
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                    ) : (
                      <Circle className="w-5 h-5 hover:text-indigo-500" />
                    )}
                  </button>

                  {/* Task details */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4
                        className={`text-sm font-bold truncate ${
                          task.completed
                            ? 'line-through text-slate-400'
                            : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </h4>

                      {/* Subject chip */}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {task.subject}
                      </span>

                      {/* Priority pill */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${getPriorityBadge(
                          task.priority
                        )}`}
                      >
                        {task.priority}
                      </span>

                      {/* Sync Status Badge */}
                      {task.syncStatus === 'synced' && (
                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> Synced
                        </span>
                      )}

                      {task.syncStatus === 'pending' && (
                        <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          <Clock className="w-3 h-3" /> Queued Offline
                        </span>
                      )}

                      {task.syncStatus === 'conflict' && (
                        <button
                          onClick={() => onOpenConflict(task)}
                          className="text-[10px] font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1 border border-rose-300 transition"
                        >
                          <AlertTriangle className="w-3 h-3" /> Resolve Conflict
                        </button>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    {/* Metadata Footer */}
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {task.estimatedMinutes} mins
                      </span>

                      <span
                        className={`flex items-center gap-1 ${
                          isPast
                            ? 'text-rose-600 font-bold'
                            : isToday
                            ? 'text-indigo-600 font-bold'
                            : ''
                        }`}
                      >
                        <Calendar className="w-3 h-3" />
                        {isToday ? 'Today' : isPast ? `Overdue (${task.dueDate})` : task.dueDate}
                      </span>

                      {task.tags && task.tags.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {task.tags.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions & Reordering */}
                  <div className="flex items-center gap-1 shrink-0 opacity-90 group-hover:opacity-100 transition">
                    {/* Reorder Up */}
                    <button
                      onClick={() => handleMove(task, 'up')}
                      disabled={index === 0}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded"
                      title="Move task up in schedule"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>

                    {/* Reorder Down */}
                    <button
                      onClick={() => handleMove(task, 'down')}
                      disabled={index === filteredTasks.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded"
                      title="Move task down in schedule"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => onEditTask(task)}
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                      title="Edit task"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => setTaskToDelete(task)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* In-App Delete Confirmation Modal (Avoids window.alert) */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900">Delete Study Task?</h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-800">"{taskToDelete.title}"</strong>?
              This will remove it from IndexedDB and queue a deletion sync action.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setTaskToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-lg shadow-xs transition"
              >
                Delete Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
