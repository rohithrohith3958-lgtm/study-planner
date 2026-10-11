import React from 'react';
import { NetworkStatusBadge } from './NetworkStatusBadge';
import { PWAInstallButton } from './PWAInstallButton';
import {
  BookOpen,
  Sparkles,
  Layers,
  ShieldCheck,
  RotateCw,
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'tasks' | 'planner' | 'tests';
  onSelectTab: (tab: 'tasks' | 'planner' | 'tests') => void;
  pendingCount: number;
  conflictCount: number;
  onOpenSyncDrawer: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  pendingCount,
  conflictCount,
  onOpenSyncDrawer,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => onSelectTab('tasks')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-sm shadow-indigo-200 group-hover:scale-105 transition">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-slate-900 group-hover:text-indigo-600 transition">
                  StudySync
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Offline-First
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium hidden md:block">
                IndexedDB &bull; Service Worker PWA &bull; Conflict Engine
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => onSelectTab('tasks')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                currentTab === 'tasks'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Planner & Tasks</span>
            </button>

            <button
              onClick={() => onSelectTab('planner')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                currentTab === 'planner'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Study Plan Generator</span>
            </button>

            <button
              onClick={() => onSelectTab('tests')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                currentTab === 'tests'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Test Runner</span>
            </button>
          </nav>
        </div>

        {/* Right Action Tools: Sync Status, Queue Drawer, PWA Install */}
        <div className="flex items-center gap-2.5">
          {/* Persistent Queue Quick Access */}
          <button
            onClick={onOpenSyncDrawer}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
            title="Open Persistent Sync Queue & Diagnostic Activity"
          >
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Sync Queue</span>
            {pendingCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </button>

          {/* Network & Simulation Indicator */}
          <NetworkStatusBadge
            pendingCount={pendingCount}
            conflictCount={conflictCount}
            onOpenSyncDrawer={onOpenSyncDrawer}
          />

          {/* PWA Install Button */}
          <PWAInstallButton />
        </div>
      </div>

      {/* Mobile Tab Strip */}
      <div className="flex md:hidden border-t border-slate-200 px-2 py-1.5 bg-slate-50 justify-around text-xs">
        <button
          onClick={() => onSelectTab('tasks')}
          className={`flex-1 py-1.5 text-center font-bold rounded-lg ${
            currentTab === 'tasks' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
          }`}
        >
          Planner
        </button>
        <button
          onClick={() => onSelectTab('planner')}
          className={`flex-1 py-1.5 text-center font-bold rounded-lg ${
            currentTab === 'planner' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
          }`}
        >
          Generator
        </button>
        <button
          onClick={() => onSelectTab('tests')}
          className={`flex-1 py-1.5 text-center font-bold rounded-lg ${
            currentTab === 'tests' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
          }`}
        >
          Tests
        </button>
      </div>
    </header>
  );
};
