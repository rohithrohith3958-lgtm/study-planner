import React, { useState } from 'react';
import { TestResult } from '../types';
import { runAllTests } from '../utils/testSuite';
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Terminal,
  ShieldCheck,
  Check,
  AlertCircle,
} from 'lucide-react';

interface TestRunnerProps {
  onTestsCompleted?: () => void;
}

export const TestRunner: React.FC<TestRunnerProps> = ({ onTestsCompleted }) => {
  const [tests, setTests] = useState<TestResult[]>([
    {
      id: 'test-persistence',
      name: 'IndexedDB Data Persistence',
      description: 'Verifies tasks are written to and retrieved from IndexedDB with full schema fidelity.',
      status: 'idle',
      logs: [],
    },
    {
      id: 'test-offline-queue',
      name: 'Offline Editing & Persistent Sync Queue',
      description: 'Verifies offline mutations are queued in FIFO order and never deleted prior to sync acknowledgement.',
      status: 'idle',
      logs: [],
    },
    {
      id: 'test-idempotency',
      name: 'Idempotency & Safe Deduplication',
      description: 'Ensures duplicate mutations with identical clientMutationId are safely deduplicated.',
      status: 'idle',
      logs: [],
    },
    {
      id: 'test-conflict-detection',
      name: 'Conflict Detection & Non-Destructive Preservation',
      description: 'Simulates concurrent remote edits, verifies conflict detection triggers and local data is preserved.',
      status: 'idle',
      logs: [],
    },
    {
      id: 'test-conflict-resolution',
      name: 'Conflict Resolution Engine',
      description: 'Tests resolving conflicts via Keep Local and Merge, verifying version convergence.',
      status: 'idle',
      logs: [],
    },
    {
      id: 'test-reconnection-drain',
      name: 'Network Reconnection & Queue Draining',
      description: 'Verifies that restoring online connectivity automatically drains the queue and synchronizes records.',
      status: 'idle',
      logs: [],
    },
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const handleRunAll = async () => {
    setIsRunning(true);
    try {
      await runAllTests((updated) => {
        setTests([...updated]);
      });
      if (onTestsCompleted) {
        onTestsCompleted();
      }
    } finally {
      setIsRunning(false);
    }
  };

  const passedCount = tests.filter((t) => t.status === 'passed').length;
  const failedCount = tests.filter((t) => t.status === 'failed').length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Test Suite Header */}
      <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">
                Hackathon Test Suite Runner
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-semibold">
                IndexedDB &bull; Offline &bull; Sync Queue &bull; Conflicts
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Live automated assertions validating offline-first requirements 3, 6, 8, 9, 10, &amp; 13.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold">
            {passedCount > 0 && (
              <span className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                <Check className="w-3.5 h-3.5" />
                {passedCount} Passed
              </span>
            )}
            {failedCount > 0 && (
              <span className="flex items-center gap-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5" />
                {failedCount} Failed
              </span>
            )}
          </div>

          <button
            onClick={handleRunAll}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
          >
            {isRunning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            <span>{isRunning ? 'Running Assertions...' : 'Run All Tests'}</span>
          </button>
        </div>
      </div>

      {/* Tests List */}
      <div className="divide-y divide-slate-100">
        {tests.map((test) => {
          const isExpanded = expandedLogId === test.id;
          return (
            <div key={test.id} className="p-4 hover:bg-slate-50/60 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {test.status === 'passed' && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                    {test.status === 'failed' && (
                      <XCircle className="w-5 h-5 text-rose-600" />
                    )}
                    {test.status === 'running' && (
                      <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                    )}
                    {test.status === 'idle' && (
                      <Clock className="w-5 h-5 text-slate-300" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{test.name}</h4>
                      {test.durationMs !== undefined && (
                        <span className="text-[11px] font-mono text-slate-400">
                          {test.durationMs}ms
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{test.description}</p>
                    {test.message && (
                      <p className="text-xs text-rose-600 font-semibold mt-1">
                        Failure: {test.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${
                      test.status === 'passed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : test.status === 'failed'
                        ? 'bg-rose-100 text-rose-800'
                        : test.status === 'running'
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {test.status}
                  </span>

                  {test.logs.length > 0 && (
                    <button
                      onClick={() => setExpandedLogId(isExpanded ? null : test.id)}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                      title="View test execution logs"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Collapsible Log Stream */}
              {isExpanded && test.logs.length > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs space-y-1 overflow-x-auto shadow-inner animate-in fade-in duration-150">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] pb-1 border-b border-slate-800">
                    <Terminal className="w-3 h-3" />
                    <span>Assertion Log Stream</span>
                  </div>
                  {test.logs.map((log, lIdx) => (
                    <div
                      key={lIdx}
                      className={
                        log.includes('[PASS]')
                          ? 'text-emerald-400'
                          : log.includes('[FAIL]')
                          ? 'text-rose-400 font-bold'
                          : 'text-slate-300'
                      }
                    >
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
