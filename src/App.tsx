import React, { useState, useEffect, useCallback } from 'react';
import { Task, ConflictRecord } from './types';
import {
  getAllTasks,
  seedInitialTasksIfEmpty,
  getQueuedSyncActions,
  getConflicts,
} from './db/indexedDB';
import { syncEngine } from './sync/syncEngine';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { TaskList } from './components/TaskList';
import { TaskModal } from './components/TaskModal';
import { ConflictResolutionModal } from './components/ConflictResolutionModal';
import { SyncQueueDrawer } from './components/SyncQueueDrawer';
import { StudyPlanModal } from './components/StudyPlanModal';
import { TestRunner } from './components/TestRunner';
import {
  WifiOff,
  AlertTriangle,
  RefreshCw,
  Plus,
  BookOpen,
  Sparkles,
  ShieldCheck,
  Layers,
  Database,
  ArrowRight,
} from 'lucide-react';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'tasks' | 'planner' | 'tests'>('tasks');

  // Modals & Drawers
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isSyncDrawerOpen, setIsSyncDrawerOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [activeConflict, setActiveConflict] = useState<ConflictRecord | null>(null);

  const { isOnline, isSimulatedOffline } = useOnlineStatus();

  // Load state from IndexedDB
  const refreshData = useCallback(async () => {
    const loadedTasks = await getAllTasks();
    const queuedActions = await getQueuedSyncActions();
    const conflictRecords = await getConflicts();

    setTasks(loadedTasks);
    setPendingCount(queuedActions.length);
    setConflicts(conflictRecords);
  }, []);

  // Initialize DB and sample data
  useEffect(() => {
    async function init() {
      await seedInitialTasksIfEmpty();
      await refreshData();
    }
    init();

    // Subscribe to sync engine events
    const unsubscribe = syncEngine.subscribe(() => {
      refreshData();
    });

    return () => unsubscribe();
  }, [refreshData]);

  // Handlers
  const handleOpenNewTask = () => {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const handleOpenConflictForTask = (task: Task) => {
    const found = conflicts.find((c) => c.taskId === task.id);
    if (found) {
      setActiveConflict(found);
    } else {
      // Create fallback conflict view if record exists
      setActiveConflict({
        id: 'conflict-' + task.id,
        taskId: task.id,
        localTask: task,
        remoteTask: {
          ...task,
          title: task.title + ' [Remote Conflict Copy]',
          version: task.version + 1,
        },
        timestamp: Date.now(),
        resolved: false,
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        currentTab={activeTab}
        onSelectTab={setActiveTab}
        pendingCount={pendingCount}
        conflictCount={conflicts.length}
        onOpenSyncDrawer={() => setIsSyncDrawerOpen(true)}
      />

      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-950 shrink-0" />
              <span>
                Offline Mode Active &bull; All study tasks and plan modifications are saved
                locally in IndexedDB. {pendingCount} change(s) queued for automatic sync upon reconnection.
              </span>
            </div>
            <button
              onClick={() => setIsSyncDrawerOpen(true)}
              className="text-amber-950 underline hover:text-black font-bold hidden sm:inline"
            >
              View Sync Queue
            </button>
          </div>
        </div>
      )}

      {/* Unresolved Conflict Banner */}
      {conflicts.length > 0 && (
        <div className="bg-rose-500 text-white px-4 py-2 text-xs font-semibold shadow-xs">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-white shrink-0" />
              <span>
                {conflicts.length} concurrent edit conflict(s) detected. Your local changes are safely
                preserved! Review and resolve without data loss.
              </span>
            </div>
            <button
              onClick={() => setActiveConflict(conflicts[0])}
              className="bg-white text-rose-700 px-2.5 py-1 rounded-md text-[11px] font-bold shadow-xs hover:bg-rose-50 transition"
            >
              Resolve Now
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* TAB 1: Tasks & Dashboard */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <Dashboard
              tasks={tasks}
              onNewTask={handleOpenNewTask}
              onOpenStudyPlanner={() => setIsPlanModalOpen(true)}
              onOpenTests={() => setActiveTab('tests')}
            />

            {/* Task Management Section */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                    <span>Your Study Schedule &amp; Tasks</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Drag, reorder, check off, or edit tasks. Full IndexedDB persistence with zero data loss.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlanModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Study Plan Generator</span>
                  </button>

                  <button
                    onClick={handleOpenNewTask}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Task</span>
                  </button>
                </div>
              </div>

              <TaskList
                tasks={tasks}
                onEditTask={handleEditTask}
                onTasksChanged={refreshData}
                onOpenConflict={handleOpenConflictForTask}
              />
            </div>
          </div>
        )}

        {/* TAB 2: Study Plan Generator View */}
        {activeTab === 'planner' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    Offline Algorithmic Optimizer
                  </span>
                  <span className="text-xs text-slate-400">Zero AI tokens required</span>
                </div>
                <h2 className="text-xl font-black text-slate-900 mt-1">
                  Algorithmic Study Plan Generator
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-xl">
                  Intelligently distributes topics, calculates urgency formulas based on exam deadlines,
                  and schedules cognitive spacing sessions directly into your IndexedDB tasks.
                </p>
              </div>

              <button
                onClick={() => setIsPlanModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Launch Plan Generator</span>
              </button>
            </div>

            {/* Quick launch card into the full generator modal */}
            <div className="bg-gradient-to-br from-indigo-50/60 to-sky-50/60 p-8 rounded-3xl border border-indigo-100 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md">
                <Sparkles className="w-8 h-8 text-amber-300" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Generate a Personalized Study Plan in Seconds
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Configure your subject difficulty, upcoming exam dates, daily hours, and focus session
                duration. StudySync will balance cognitive load and add the schedule to your tasks.
              </p>
              <button
                onClick={() => setIsPlanModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold shadow-sm transition"
              >
                <span>Configure &amp; Generate Plan</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Test Runner View */}
        {activeTab === 'tests' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
              <h2 className="text-xl font-black text-slate-900">
                Hackathon Automated Verification &amp; Test Suite
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Directly validates all offline-first technical requirements: IndexedDB persistence,
                offline action queueing, safe retry backoff, mutation deduplication (idempotency),
                concurrent conflict detection, and non-destructive user preservation.
              </p>
            </div>

            <TestRunner onTestsCompleted={refreshData} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>StudySync &bull; Offline-First Student Study Planner</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>IndexedDB Storage</span>
            <span>&bull;</span>
            <span>Service Worker PWA</span>
            <span>&bull;</span>
            <span>Safe Idempotent Queue</span>
          </div>
        </div>
      </footer>

      {/* Modals and Drawers */}
      <TaskModal
        isOpen={isTaskModalOpen}
        taskToEdit={editingTask}
        tasksCount={tasks.length}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSaved={refreshData}
      />

      <StudyPlanModal
        isOpen={isPlanModalOpen}
        tasksCount={tasks.length}
        onClose={() => setIsPlanModalOpen(false)}
        onPlanImported={refreshData}
      />

      <ConflictResolutionModal
        conflict={activeConflict}
        onClose={() => setActiveConflict(null)}
        onResolved={refreshData}
      />

      <SyncQueueDrawer
        isOpen={isSyncDrawerOpen}
        onClose={() => setIsSyncDrawerOpen(false)}
        onQueueChanged={refreshData}
      />
    </div>
  );
}
