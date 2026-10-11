import React from 'react';
import { Task } from '../types';
import {
  CheckCircle2,
  Clock,
  Calendar,
  TrendingUp,
  Plus,
  Sparkles,
  BookOpen,
  ShieldCheck,
  Flame,
} from 'lucide-react';

interface DashboardProps {
  tasks: Task[];
  onNewTask: () => void;
  onOpenStudyPlanner: () => void;
  onOpenTests: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  tasks,
  onNewTask,
  onOpenStudyPlanner,
  onOpenTests,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const todayTasks = tasks.filter((t) => t.dueDate === todayStr);
  const completedTasks = tasks.filter((t) => t.completed);
  const pendingTasks = tasks.filter((t) => !t.completed);

  const totalTasks = tasks.length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  const todayCompleted = todayTasks.filter((t) => t.completed).length;
  const todayProgress = todayTasks.length > 0 ? Math.round((todayCompleted / todayTasks.length) * 100) : 0;

  const totalMinutesRemaining = pendingTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);
  const hoursRemaining = (totalMinutesRemaining / 60).toFixed(1);

  // Group by subject
  const subjectsMap: Record<string, { total: number; completed: number }> = {};
  tasks.forEach((t) => {
    if (!subjectsMap[t.subject]) {
      subjectsMap[t.subject] = { total: 0, completed: 0 };
    }
    subjectsMap[t.subject].total++;
    if (t.completed) {
      subjectsMap[t.subject].completed++;
    }
  });

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 p-6 rounded-3xl text-white shadow-md relative overflow-hidden">
        {/* Subtle decorative background circles */}
        <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-indigo-500/10 pointer-events-none" />
        <div className="absolute right-32 -bottom-12 w-48 h-48 rounded-full bg-sky-500/10 pointer-events-none" />

        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              Offline-First Planner
            </span>
            <span className="text-xs text-slate-300 font-medium">
              IndexedDB Persistent Local Storage
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Today's Study Command Center
          </h2>
          <p className="text-sm text-indigo-200 max-w-xl">
            {pendingTasks.length > 0
              ? `You have ${todayTasks.length} tasks scheduled for today (${hoursRemaining}h of focused study remaining).`
              : 'All study tasks are completed! Great job maintaining momentum.'}
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          <button
            onClick={onNewTask}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-indigo-950 text-xs font-bold shadow-sm transition"
          >
            <Plus className="w-4 h-4 text-indigo-600" />
            <span>+ Add Task</span>
          </button>

          <button
            onClick={onOpenStudyPlanner}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-700/80 hover:bg-indigo-600 active:scale-95 border border-indigo-400/40 text-white text-xs font-bold shadow-sm transition"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Generate Plan</span>
          </button>

          <button
            onClick={onOpenTests}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-950/70 hover:bg-indigo-900 active:scale-95 border border-indigo-500/30 text-indigo-200 text-xs font-bold transition"
            title="Open Hackathon Automated Test Runner"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Run Tests</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Tasks */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Today's Tasks
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {todayTasks.length}
            </span>
            <span className="text-xs text-slate-500">
              ({todayCompleted} done &bull; {todayProgress}%)
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${todayProgress}%` }}
            />
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Pending Tasks
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {pendingTasks.length}
            </span>
            <span className="text-xs text-amber-700 font-medium">
              in queue
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-500 truncate">
            {hoursRemaining} hrs estimated focus
          </p>
        </div>

        {/* Completed Tasks */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Completed Tasks
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {completedTasks.length}
            </span>
            <span className="text-xs text-emerald-700 font-medium">
              of {totalTasks}
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Overall Progress */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Overall Progress
            </span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {progressPercent}%
            </span>
            <span className="text-xs text-purple-700 font-medium">
              completion
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <span>4-day study streak active</span>
          </div>
        </div>
      </div>

      {/* Subject Distribution Bar */}
      {Object.keys(subjectsMap).length > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              Subjects &amp; Progress
            </span>
            <span className="text-xs text-slate-400">
              {Object.keys(subjectsMap).length} subjects active
            </span>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {Object.entries(subjectsMap).map(([subject, stats]) => {
              const subPct = Math.round((stats.completed / stats.total) * 100);
              return (
                <div
                  key={subject}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex items-center gap-2 hover:bg-slate-100/70 transition"
                >
                  <span className="font-bold text-slate-800">{subject}</span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {stats.completed}/{stats.total}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      subPct === 100
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    {subPct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
