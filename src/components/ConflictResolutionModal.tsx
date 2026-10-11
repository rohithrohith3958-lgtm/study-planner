import React, { useState } from 'react';
import { ConflictRecord, Task } from '../types';
import { syncEngine } from '../sync/syncEngine';
import { AlertTriangle, ArrowRight, Check, X, GitMerge, Laptop, Cloud } from 'lucide-react';

interface ConflictResolutionModalProps {
  conflict: ConflictRecord | null;
  onClose: () => void;
  onResolved: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  conflict,
  onClose,
  onResolved,
}) => {
  if (!conflict) return null;

  const { localTask, remoteTask } = conflict;
  const [selectedResolution, setSelectedResolution] = useState<'local' | 'remote' | 'merged'>('merged');

  const [mergedTitle, setMergedTitle] = useState(
    localTask.title !== remoteTask.title ? `${localTask.title} (Merged)` : localTask.title
  );
  const [mergedCompleted, setMergedCompleted] = useState(localTask.completed || remoteTask.completed);
  const [mergedDesc, setMergedDesc] = useState(
    localTask.description && remoteTask.description && localTask.description !== remoteTask.description
      ? `Local Notes: ${localTask.description}\n---\nRemote Notes: ${remoteTask.description}`
      : localTask.description || remoteTask.description || ''
  );
  const [mergedPriority, setMergedPriority] = useState(localTask.priority);
  const [mergedDueDate, setMergedDueDate] = useState(localTask.dueDate);

  const handleApplyResolution = async () => {
    if (selectedResolution === 'merged') {
      const merged: Task = {
        ...localTask,
        title: mergedTitle,
        completed: mergedCompleted,
        description: mergedDesc,
        priority: mergedPriority,
        dueDate: mergedDueDate,
        version: Math.max(localTask.version, remoteTask.version) + 1,
        syncStatus: 'synced',
        updatedAt: Date.now(),
      };
      await syncEngine.resolveConflict(conflict.id, 'merged', merged);
    } else {
      await syncEngine.resolveConflict(conflict.id, selectedResolution);
    }
    onResolved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-rose-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-500 to-amber-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Concurrent Modification Detected</h3>
              <p className="text-xs text-rose-100">
                Your offline changes and another update collided. Select how to resolve this without data loss.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Side-by-side comparison */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Local Version Card */}
            <div
              onClick={() => setSelectedResolution('local')}
              className={`p-4 rounded-xl border-2 transition cursor-pointer ${
                selectedResolution === 'local'
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                  : 'border-slate-200 bg-slate-50/60 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 uppercase tracking-wider">
                  <Laptop className="w-4 h-4" />
                  Your Local Version (Offline Edit)
                </span>
                <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                  v{localTask.version}
                </span>
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Title</span>
                  <p className="font-semibold text-slate-900">{localTask.title}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Status</span>
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${
                      localTask.completed
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {localTask.completed ? 'Completed' : 'Pending'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Priority & Due Date</span>
                  <p className="text-xs text-slate-700 capitalize">
                    {localTask.priority} Priority • Due {localTask.dueDate}
                  </p>
                </div>
                {localTask.description && (
                  <div>
                    <span className="text-xs text-slate-400 block font-medium">Notes</span>
                    <p className="text-xs text-slate-600 line-clamp-3 bg-white p-2 rounded-lg border border-slate-200">
                      {localTask.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">Keep exactly this</span>
                <span className="font-semibold text-indigo-600">Select Local &rarr;</span>
              </div>
            </div>

            {/* Remote Version Card */}
            <div
              onClick={() => setSelectedResolution('remote')}
              className={`p-4 rounded-xl border-2 transition cursor-pointer ${
                selectedResolution === 'remote'
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                  : 'border-slate-200 bg-slate-50/60 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 uppercase tracking-wider">
                  <Cloud className="w-4 h-4" />
                  Remote Server Version
                </span>
                <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                  v{remoteTask.version}
                </span>
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Title</span>
                  <p className="font-semibold text-slate-900">{remoteTask.title}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Status</span>
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${
                      remoteTask.completed
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {remoteTask.completed ? 'Completed' : 'Pending'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Priority & Due Date</span>
                  <p className="text-xs text-slate-700 capitalize">
                    {remoteTask.priority} Priority • Due {remoteTask.dueDate}
                  </p>
                </div>
                {remoteTask.description && (
                  <div>
                    <span className="text-xs text-slate-400 block font-medium">Notes</span>
                    <p className="text-xs text-slate-600 line-clamp-3 bg-white p-2 rounded-lg border border-slate-200">
                      {remoteTask.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">Accept remote copy</span>
                <span className="font-semibold text-amber-700">Select Remote &rarr;</span>
              </div>
            </div>
          </div>

          {/* Merge Option Customizer */}
          <div
            onClick={() => setSelectedResolution('merged')}
            className={`p-4 rounded-xl border-2 transition cursor-pointer ${
              selectedResolution === 'merged'
                ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                <GitMerge className="w-4 h-4" />
                Merge Changes (Recommended)
              </span>
              <span className="text-xs font-medium text-emerald-700">
                Custom combined resolution
              </span>
            </div>

            {selectedResolution === 'merged' && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Merged Title
                  </label>
                  <input
                    type="text"
                    value={mergedTitle}
                    onChange={(e) => setMergedTitle(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Merged Status
                    </label>
                    <select
                      value={mergedCompleted ? 'true' : 'false'}
                      onChange={(e) => setMergedCompleted(e.target.value === 'true')}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="true">Mark Completed</option>
                      <option value="false">Mark Pending</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Merged Priority
                    </label>
                    <select
                      value={mergedPriority}
                      onChange={(e) => setMergedPriority(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Combined Notes / Description
                  </label>
                  <textarea
                    rows={3}
                    value={mergedDesc}
                    onChange={(e) => setMergedDesc(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Selected Resolution: <strong className="capitalize text-slate-800">{selectedResolution}</strong>
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyResolution}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
            >
              <Check className="w-4 h-4" />
              Apply Resolution
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
