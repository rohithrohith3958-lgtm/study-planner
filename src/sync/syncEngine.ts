import {
  SyncAction,
  Task,
  ConflictRecord,
  SyncLogEntry
} from '../types';
import {
  getQueuedSyncActions,
  removeSyncAction,
  updateSyncAction,
  saveTask,
  getTaskById,
  getAllTasks,
  getRemoteTask,
  saveRemoteTask,
  deleteRemoteTask,
  saveConflictRecord,
  getConflicts,
  deleteConflictRecord,
} from '../db/indexedDB';

type SyncListener = () => void;

class SyncEngine {
  private isSimulatedOffline: boolean = false;
  private simulateServerError: boolean = false;
  private simulateRemoteConflict: boolean = false;
  private activeSyncPromise: Promise<{ success: boolean; syncedCount: number; errors: number }> | null = null;
  private rerunRequested: boolean = false;
  private listeners: Set<SyncListener> = new Set();
  private logs: SyncLogEntry[] = [];
  private processedMutationIds: Set<string> = new Set();
  private autoSyncTimer: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.addLog('Browser went online. Initiating auto-synchronization...', 'info');
        this.notify();
        this.attemptSync();
      });

      window.addEventListener('offline', () => {
        this.addLog('Browser went offline. Changes will be saved locally and queued.', 'warning');
        this.notify();
      });
    }

    // Gentle background sync check every 45s, only active if pending items exist
    if (typeof window !== 'undefined') {
      this.autoSyncTimer = window.setInterval(() => {
        if (this.isOnline() && !this.activeSyncPromise) {
          getQueuedSyncActions().then(actions => {
            if (actions.length > 0) {
              this.attemptSync();
            }
          });
        }
      }, 45000);
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  public getLogs(): SyncLogEntry[] {
    return [...this.logs].slice(-50);
  }

  public clearLogs() {
    this.logs = [];
    this.notify();
  }

  public addLog(message: string, type: SyncLogEntry['type'] = 'info', details?: string) {
    const entry: SyncLogEntry = {
      id: 'log-' + Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      message,
      type,
      details,
    };
    this.logs.push(entry);
    this.notify();
  }

  public isOnline(): boolean {
    if (this.isSimulatedOffline) return false;
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  }

  public getSimulationState() {
    return {
      isSimulatedOffline: this.isSimulatedOffline,
      simulateServerError: this.simulateServerError,
      simulateRemoteConflict: this.simulateRemoteConflict,
      isSyncing: this.activeSyncPromise !== null,
      isOnline: this.isOnline(),
    };
  }

  public setSimulatedOffline(val: boolean): Promise<{ success: boolean; syncedCount: number; errors: number }> {
    const wasOffline = this.isSimulatedOffline;
    this.isSimulatedOffline = val;
    this.addLog(
      val ? 'Offline Simulation enabled. Network calls paused.' : 'Offline Simulation disabled. Network restored.',
      val ? 'warning' : 'success'
    );
    this.notify();
    if (!val && wasOffline) {
      // Automatically trigger and return synchronization when connectivity returns
      return this.attemptSync();
    }
    return Promise.resolve({ success: true, syncedCount: 0, errors: 0 });
  }

  public setSimulateServerError(val: boolean) {
    this.simulateServerError = val;
    this.addLog(
      val ? 'Server Error Simulation enabled (HTTP 503 test).' : 'Server Error Simulation disabled.',
      val ? 'warning' : 'info'
    );
    this.notify();
  }

  public setSimulateRemoteConflict(val: boolean) {
    this.simulateRemoteConflict = val;
    this.addLog(
      val ? 'Remote Conflict Simulation armed: next task update will trigger concurrency conflict!' : 'Conflict simulation cleared.',
      val ? 'warning' : 'info'
    );
    this.notify();
  }

  /**
   * Main synchronization execution loop with in-flight promise coalescing
   */
  public async attemptSync(): Promise<{ success: boolean; syncedCount: number; errors: number }> {
    if (!this.isOnline()) {
      this.addLog('Cannot sync: device is offline or in simulated offline mode.', 'warning');
      return { success: false, syncedCount: 0, errors: 0 };
    }

    // If a sync is already running, wait for it to complete
    while (this.activeSyncPromise) {
      this.rerunRequested = true;
      this.addLog('Sync already in progress. Waiting for active synchronization...', 'info');
      await this.activeSyncPromise;
    }

    // Check if there are queued items that need to be processed
    const queue = await getQueuedSyncActions();
    if (queue.length === 0) {
      return { success: true, syncedCount: 0, errors: 0 };
    }

    // Start a fresh synchronization cycle
    this.activeSyncPromise = this.runSyncLoop().finally(() => {
      this.activeSyncPromise = null;
    });

    return await this.activeSyncPromise;
  }

  private async runSyncLoop(): Promise<{ success: boolean; syncedCount: number; errors: number }> {
    this.notify();
    let totalSynced = 0;
    let totalErrors = 0;

    try {
      while (this.isOnline()) {
        this.rerunRequested = false;
        const passResult = await this.performSyncPass();
        totalSynced += passResult.syncedCount;
        totalErrors += passResult.errors;

        // Stop if server failure or went offline
        if (passResult.errors > 0 || !this.isOnline()) {
          break;
        }

        // Drain any remaining items or items enqueued during the sync pass
        const remainingQueue = await getQueuedSyncActions();
        if (remainingQueue.length === 0) {
          break;
        }
      }
    } catch (globalErr: any) {
      this.addLog(`Global sync cycle error: ${globalErr.message}`, 'error');
      totalErrors++;
    } finally {
      this.notify();
    }

    return {
      success: totalErrors === 0,
      syncedCount: totalSynced,
      errors: totalErrors,
    };
  }

  private async performSyncPass(): Promise<{ syncedCount: number; errors: number }> {
    const queue = await getQueuedSyncActions();
    if (queue.length === 0) {
      this.addLog('Sync queue is empty. Everything is up to date.', 'info');
      return { syncedCount: 0, errors: 0 };
    }

    this.addLog(`Processing ${queue.length} queued action(s) in FIFO order...`, 'info');
    let syncedCount = 0;
    let errors = 0;

    for (const action of queue) {
      if (!this.isOnline()) {
        this.addLog('Connection lost mid-sync. Preserving queued changes.', 'warning');
        break;
      }

      // Safe retry & server error simulation check
      if (this.simulateServerError) {
        action.retryCount = (action.retryCount || 0) + 1;
        action.status = 'failed';
        action.lastError = '503 Service Unavailable (Simulated Server Fault)';
        await updateSyncAction(action);
        this.addLog(
          `Sync failed for task "${action.taskId}": Simulated 503 Server Error. Change preserved in queue (Retry #${action.retryCount}).`,
          'error'
        );
        errors++;
        // Never delete queued changes on server error!
        break;
      }

      // Safe retry backoff check if retryCount is abnormally high
      if (action.retryCount > 8) {
        this.addLog(
          `Action ${action.id} has reached retry limit (${action.retryCount}). Pausing automatic retries until manual review.`,
          'warning'
        );
        errors++;
        continue;
      }

      // Idempotency verification: prevent duplicate executions
      if (this.processedMutationIds.has(action.clientMutationId)) {
        this.addLog(`Idempotent guard: Mutation "${action.clientMutationId}" was already processed. Safely resolving.`, 'info');
        await removeSyncAction(action.id);
        syncedCount++;
        continue;
      }

      // Process action based on type
      try {
        const outcome = await this.processSingleAction(action);

        if (outcome.status === 'success') {
          this.processedMutationIds.add(action.clientMutationId);
          // Requirement 4: Remove an operation from the persistent queue only after it has synchronized successfully
          await removeSyncAction(action.id);
          syncedCount++;
          this.addLog(`Action "${action.action}" on task "${action.taskId}" synced successfully. Removed from queue.`, 'success');
        } else if (outcome.status === 'conflict') {
          action.status = 'conflict';
          action.lastError = 'Conflict detected: remote version was modified concurrently';
          await updateSyncAction(action);
          this.addLog(
            `Conflict detected on task "${action.taskId}". Preserved in queue and awaiting resolution.`,
            'warning'
          );
          errors++;
        } else {
          // Requirement 5: If synchronization fails, retain the operation and allow a safe retry
          action.retryCount = (action.retryCount || 0) + 1;
          action.status = 'failed';
          action.lastError = outcome.error || 'Unknown sync error';
          await updateSyncAction(action);
          this.addLog(`Sync error for task "${action.taskId}": ${action.lastError}`, 'error');
          errors++;
        }
      } catch (itemErr: any) {
        action.retryCount = (action.retryCount || 0) + 1;
        action.status = 'failed';
        action.lastError = itemErr.message || 'Network exception';
        await updateSyncAction(action);
        errors++;
        this.addLog(`Exception syncing action ${action.id}: ${itemErr.message}`, 'error');
      }
    }

    // Check if all items in task store with pending status can be cleaned up
    const remainingQueue = await getQueuedSyncActions();
    const pendingTaskIds = new Set(remainingQueue.map(q => q.taskId));
    const allTasks = await getAllTasks();

    for (const t of allTasks) {
      if (!pendingTaskIds.has(t.id) && t.syncStatus === 'pending') {
        t.syncStatus = 'synced';
        await saveTask(t);
      }
    }

    return { syncedCount, errors };
  }

  /**
   * Process a single action against the remote store
   */
  private async processSingleAction(
    action: SyncAction
  ): Promise<{ status: 'success' | 'conflict' | 'failed'; error?: string }> {
    const remoteTask = await getRemoteTask(action.taskId);
    const localTask = await getTaskById(action.taskId);

    // Conflict simulation hook
    if (this.simulateRemoteConflict && action.action === 'update' && remoteTask) {
      this.simulateRemoteConflict = false; // consume the trigger
      // Advance remote task behind user's back to simulate concurrent device edit
      remoteTask.version += 1;
      remoteTask.title = remoteTask.title + ' [Remote Updated by Peer]';
      remoteTask.description = 'Conflicting updates made from another device or web tab.';
      remoteTask.updatedAt = Date.now();
      await saveRemoteTask(remoteTask);
      this.addLog('Simulated concurrent remote update planted in remote server!', 'warning');
    }

    if (action.action === 'create') {
      const taskData = action.payload as Task;
      if (!taskData) return { status: 'failed', error: 'Missing task payload' };

      // Save to remote store
      const remoteRecord: Task = {
        ...taskData,
        version: 1,
        syncStatus: 'synced',
        updatedAt: Date.now(),
      };
      await saveRemoteTask(remoteRecord);

      if (localTask) {
        localTask.syncStatus = 'synced';
        localTask.version = 1;
        await saveTask(localTask);
      }
      return { status: 'success' };
    }

    if (action.action === 'delete') {
      await deleteRemoteTask(action.taskId);
      return { status: 'success' };
    }

    if (action.action === 'update' || action.action === 'reorder') {
      if (!remoteTask) {
        // If remote doesn't exist, create it from local
        if (localTask) {
          await saveRemoteTask({
            ...localTask,
            version: 1,
            syncStatus: 'synced',
          });
          localTask.syncStatus = 'synced';
          localTask.version = 1;
          await saveTask(localTask);
          return { status: 'success' };
        }
        return { status: 'success' };
      }

      // Concurrency & Conflict Detection
      // If remote version has progressed beyond the baseVersion this action was prepared from:
      if (remoteTask.version > action.baseVersion) {
        // Compare payload to see if there is an actual conflict
        const payload = action.payload || {};
        const isConflict = this.hasConflictingEdits(localTask, remoteTask, payload);

        if (isConflict && localTask) {
          // Record conflict in IndexedDB
          const conflictId = 'conflict-' + action.taskId + '-' + Date.now();
          const conflictRecord: ConflictRecord = {
            id: conflictId,
            taskId: action.taskId,
            localTask: { ...localTask },
            remoteTask: { ...remoteTask },
            timestamp: Date.now(),
            resolved: false,
          };
          await saveConflictRecord(conflictRecord);

          // Mark local task as having a conflict
          localTask.syncStatus = 'conflict';
          await saveTask(localTask);

          return { status: 'conflict' };
        }
      }

      // Safe update without conflict
      const updatedRemote: Task = {
        ...remoteTask,
        ...(action.payload as Partial<Task>),
        version: remoteTask.version + 1,
        updatedAt: Date.now(),
        syncStatus: 'synced',
      };
      await saveRemoteTask(updatedRemote);

      if (localTask) {
        localTask.version = updatedRemote.version;
        localTask.syncStatus = 'synced';
        await saveTask(localTask);
      }

      return { status: 'success' };
    }

    return { status: 'failed', error: 'Unsupported action type' };
  }

  private hasConflictingEdits(
    localTask: Task | null,
    remoteTask: Task,
    _payload: Partial<Task>
  ): boolean {
    if (!localTask) return false;
    // If title or description or completed status diverge
    if (localTask.title !== remoteTask.title) return true;
    if (localTask.completed !== remoteTask.completed) return true;
    if (localTask.dueDate !== remoteTask.dueDate) return true;
    if ((localTask.description || '') !== (remoteTask.description || '')) return true;
    if (localTask.priority !== remoteTask.priority) return true;
    return false;
  }

  /**
   * Conflict Resolution handler
   * resolution: 'local' (keep local), 'remote' (accept remote), 'merged' (merge fields)
   */
  public async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'remote' | 'merged',
    mergedTask?: Task
  ): Promise<void> {
    const conflicts = await getConflicts();
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    const { taskId, localTask, remoteTask } = conflict;

    if (resolution === 'local') {
      // User chooses their local version: force update remote with bumped version
      const newVersion = Math.max(localTask.version, remoteTask.version) + 1;
      const resolvedTask: Task = {
        ...localTask,
        version: newVersion,
        syncStatus: 'synced',
        updatedAt: Date.now(),
      };
      await saveTask(resolvedTask);
      await saveRemoteTask(resolvedTask);
      this.addLog(`Conflict on "${resolvedTask.title}" resolved: Kept local changes.`, 'success');
    } else if (resolution === 'remote') {
      // User chooses remote version: overwrite local
      const resolvedTask: Task = {
        ...remoteTask,
        syncStatus: 'synced',
      };
      await saveTask(resolvedTask);
      this.addLog(`Conflict on "${resolvedTask.title}" resolved: Accepted remote version.`, 'info');
    } else if (resolution === 'merged') {
      // User merged changes
      const chosen = mergedTask || {
        ...remoteTask,
        ...localTask,
        version: Math.max(localTask.version, remoteTask.version) + 1,
        syncStatus: 'synced',
        updatedAt: Date.now(),
      };
      await saveTask(chosen);
      await saveRemoteTask(chosen);
      this.addLog(`Conflict on "${chosen.title}" resolved: Merged both changes.`, 'success');
    }

    // Clean up corresponding queued conflict action if any
    const queue = await getQueuedSyncActions();
    const queuedAction = queue.find(q => q.taskId === taskId && q.status === 'conflict');
    if (queuedAction) {
      await removeSyncAction(queuedAction.id);
    }

    // Delete conflict record
    await deleteConflictRecord(conflictId);
    this.notify();
  }

  /**
   * Helper to manually seed a remote divergence for demo & testing purposes
   */
  public async plantRemoteChange(taskId: string, newTitle: string): Promise<boolean> {
    const remote = await getRemoteTask(taskId);
    if (!remote) return false;
    remote.title = newTitle;
    remote.version += 1;
    remote.updatedAt = Date.now();
    await saveRemoteTask(remote);
    this.addLog(`Planted remote change on "${taskId}" (Version ${remote.version}). Now editing locally will trigger a conflict!`, 'warning');
    this.notify();
    return true;
  }
}

export const syncEngine = new SyncEngine();
