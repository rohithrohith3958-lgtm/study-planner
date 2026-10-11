import React, { useState, useEffect } from 'react';
import { SyncAction, SyncLogEntry } from '../types';
import { getQueuedSyncActions, clearAllSyncActions } from '../db/indexedDB';
import { syncEngine } from '../sync/syncEngine';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  X,
  RefreshCw,
  Clock,
  WifiOff,
  Wifi,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Terminal,
  Activity,
  Layers,
} from 'lucide-react';

interface SyncQueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onQueueChanged: () => void;
}

export const SyncQueueDrawer: React.FC<SyncQueueDrawerProps> = ({
  isOpen,
  onClose,
  onQueueChanged,
}) => {
  const [queue, setQueue] = useState<SyncAction[]>([]);
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const { isOnline, isSimulatedOffline } = useOnlineStatus();
  const simState = syncEngine.getSimulationState();

  const loadData = async () => {
    const q = await getQueuedSyncActions();
    setQueue(q);
    setLogs(syncEngine.getLogs());
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
    const unsub = syncEngine.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSync = async () => {
    await syncEngine.attemptSync();
    await loadData();
    onQueueChanged();
  };

  const handleClearQueue = async () => {
    await clearAllSyncActions();
    await loadData();
    onQueueChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Sync Engine & Persistent Queue
              </h2>
              <p className="text-xs text-slate-500">
                IndexedDB-backed mutation store &amp; conflict supervisor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls & Simulator Toolbar */}
        <div className="p-4 bg-slate-100/70 border-b border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  isOnline
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                {isOnline ? 'Online Ready' : 'Offline Mode'}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {queue.length} action(s) in queue
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleManualSync}
                disabled={simState.isSyncing || !isOnline}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${simState.isSyncing ? 'animate-spin' : ''}`} />
                <span>{simState.isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>
              {queue.length > 0 && (
                <button
                  onClick={handleClearQueue}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition"
                  title="Force clear queue (testing tool)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Simulation Toggles for Hackathon Judges */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80">
            <button
              onClick={() => syncEngine.setSimulatedOffline(!simState.isSimulatedOffline)}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border flex items-center justify-center gap-1 transition ${
                simState.isSimulatedOffline
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <WifiOff className="w-3 h-3" />
              {simState.isSimulatedOffline ? 'Sim Offline: ON' : 'Toggle Offline'}
            </button>

            <button
              onClick={() => syncEngine.setSimulateServerError(!simState.simulateServerError)}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border flex items-center justify-center gap-1 transition ${
                simState.simulateServerError
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <ShieldAlert className="w-3 h-3" />
              {simState.simulateServerError ? '503 Error: ON' : 'Simulate 503'}
            </button>

            <button
              onClick={() => syncEngine.setSimulateRemoteConflict(!simState.simulateRemoteConflict)}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border flex items-center justify-center gap-1 transition ${
                simState.simulateRemoteConflict
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              {simState.simulateRemoteConflict ? 'Conflict: ARMED' : 'Arm Conflict'}
            </button>
          </div>
        </div>

        {/* Main Content Area: Queue List & Logs */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-4 space-y-4">
          {/* Active Queue Section */}
          <div>
            <div className="flex items-center justify-between pb-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Persistent Offline Queue (IndexedDB)
              </span>
              <span className="text-[11px] text-slate-400">
                Guaranteed FIFO execution
              </span>
            </div>

            {queue.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-xs font-semibold text-slate-700">Sync Queue is Empty</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                  All task creations, edits, and reorders are fully in sync with the remote store.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {queue.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-mono font-bold">
                          {idx + 1}
                        </span>
                        <span
                          className={`text-xs font-bold uppercase px-2 py-0.5 rounded-md ${
                            item.action === 'create'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.action === 'update'
                              ? 'bg-blue-100 text-blue-800'
                              : item.action === 'delete'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {item.action}
                        </span>
                        <span className="text-xs font-mono text-slate-600">
                          task: {item.taskId.substring(0, 14)}...
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          item.status === 'queued'
                            ? 'bg-amber-100 text-amber-800'
                            : item.status === 'conflict'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg font-mono">
                      <div>
                        <span className="text-slate-400">Base Ver:</span> v{item.baseVersion}
                      </div>
                      <div>
                        <span className="text-slate-400">Retries:</span> {item.retryCount || 0}
                      </div>
                      <div className="col-span-2 truncate">
                        <span className="text-slate-400">Idem Key:</span> {item.clientMutationId}
                      </div>
                      {item.lastError && (
                        <div className="col-span-2 text-rose-600 font-sans text-[11px]">
                          Error: {item.lastError}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Sync Engine Activity Log */}
          <div className="pt-4">
            <div className="flex items-center justify-between pb-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                Live Sync Activity Stream
              </span>
              <button
                onClick={() => syncEngine.clearLogs()}
                className="text-[11px] text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            </div>

            <div className="h-56 rounded-xl bg-slate-900 text-slate-200 p-3 overflow-y-auto font-mono text-[11px] space-y-1.5 shadow-inner">
              {logs.length === 0 ? (
                <div className="text-slate-500 text-center py-10">No sync events recorded yet.</div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="leading-tight flex items-start gap-2">
                    <span className="text-slate-500 flex-shrink-0">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    <span
                      className={`break-words ${
                        log.type === 'success'
                          ? 'text-emerald-400 font-medium'
                          : log.type === 'error'
                          ? 'text-rose-400 font-medium'
                          : log.type === 'warning'
                          ? 'text-amber-300'
                          : 'text-slate-300'
                      }`}
                    >
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
