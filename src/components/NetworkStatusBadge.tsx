import React, { useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { syncEngine } from '../sync/syncEngine';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, Settings2, CheckCircle2, ShieldAlert } from 'lucide-react';

interface NetworkStatusBadgeProps {
  pendingCount: number;
  conflictCount: number;
  onOpenSyncDrawer: () => void;
}

export const NetworkStatusBadge: React.FC<NetworkStatusBadgeProps> = ({
  pendingCount,
  conflictCount,
  onOpenSyncDrawer,
}) => {
  const { isOnline, isSimulatedOffline } = useOnlineStatus();
  const [showSimMenu, setShowSimMenu] = useState(false);
  const simState = syncEngine.getSimulationState();

  const handleManualSync = () => {
    syncEngine.attemptSync();
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Status Pill */}
      <button
        onClick={() => setShowSimMenu(!showSimMenu)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition shadow-xs ${
          !isOnline
            ? 'bg-amber-500/10 text-amber-700 border-amber-300 dark:border-amber-700 hover:bg-amber-500/20'
            : conflictCount > 0
            ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
            : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
        }`}
        title="Click to view network simulation and sync controls"
      >
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              !isOnline ? 'bg-amber-500' : conflictCount > 0 ? 'bg-rose-500' : 'bg-emerald-500'
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              !isOnline ? 'bg-amber-500' : conflictCount > 0 ? 'bg-rose-500' : 'bg-emerald-500'
            }`}
          />
        </span>

        {isOnline ? (
          <span className="flex items-center gap-1">
            <Wifi className="w-3.5 h-3.5" />
            <span>Online</span>
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline {isSimulatedOffline ? '(Simulated)' : ''}</span>
          </span>
        )}

        {pendingCount > 0 && (
          <span className="bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
            {pendingCount} queued
          </span>
        )}

        {conflictCount > 0 && (
          <span className="bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-0.5">
            <AlertTriangle className="w-2.5 h-2.5" />
            {conflictCount}
          </span>
        )}

        <Settings2 className="w-3 h-3 text-slate-400 ml-0.5" />
      </button>

      {/* Quick Sync Button */}
      <button
        onClick={handleManualSync}
        disabled={simState.isSyncing || !isOnline}
        className={`p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition disabled:opacity-40 disabled:cursor-not-allowed`}
        title="Trigger manual sync cycle"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${simState.isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
      </button>

      {/* Network Simulation Dropdown */}
      {showSimMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowSimMenu(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-white p-4 shadow-xl border border-slate-200 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Network & Sync Tools
              </span>
              <button
                onClick={() => {
                  setShowSimMenu(false);
                  onOpenSyncDrawer();
                }}
                className="text-xs text-indigo-600 font-semibold hover:underline"
              >
                Open Queue
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {/* Toggle Simulated Offline */}
              <label className="flex items-center justify-between cursor-pointer text-xs font-medium text-slate-700 p-2 rounded-xl hover:bg-slate-50 border border-slate-100">
                <span className="flex items-center gap-2">
                  <WifiOff className="w-4 h-4 text-slate-500" />
                  <span>Simulate Offline Mode</span>
                </span>
                <input
                  type="checkbox"
                  checked={simState.isSimulatedOffline}
                  onChange={(e) => syncEngine.setSimulatedOffline(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
              </label>

              {/* Toggle Server 503 Error */}
              <label className="flex items-center justify-between cursor-pointer text-xs font-medium text-slate-700 p-2 rounded-xl hover:bg-slate-50 border border-slate-100">
                <span className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span>Simulate Server Error (503)</span>
                </span>
                <input
                  type="checkbox"
                  checked={simState.simulateServerError}
                  onChange={(e) => syncEngine.setSimulateServerError(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
              </label>

              {/* Toggle Arm Remote Conflict */}
              <label className="flex items-center justify-between cursor-pointer text-xs font-medium text-slate-700 p-2 rounded-xl hover:bg-slate-50 border border-slate-100">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span>Arm Next Concurrency Conflict</span>
                </span>
                <input
                  type="checkbox"
                  checked={simState.simulateRemoteConflict}
                  onChange={(e) => syncEngine.setSimulateRemoteConflict(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
              </label>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Queue Status: {pendingCount} item(s)</span>
              <button
                onClick={() => {
                  handleManualSync();
                  setShowSimMenu(false);
                }}
                disabled={!isOnline || simState.isSyncing}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-40"
              >
                Sync Now
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
