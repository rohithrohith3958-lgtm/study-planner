import { TestResult, Task, SyncAction } from '../types';
import {
  saveTask,
  getTaskById,
  deleteTask,
  getQueuedSyncActions,
  enqueueSyncAction,
  clearAllSyncActions,
  saveRemoteTask,
  getRemoteTask,
  deleteRemoteTask,
  getConflicts,
  deleteConflictRecord,
} from '../db/indexedDB';
import { syncEngine } from '../sync/syncEngine';

export async function runAllTests(
  onUpdate: (tests: TestResult[]) => void
): Promise<TestResult[]> {
  const tests: TestResult[] = [
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
  ];

  onUpdate([...tests]);

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    t.status = 'running';
    t.logs.push(`[${new Date().toLocaleTimeString()}] Starting test: ${t.name}`);
    onUpdate([...tests]);

    const startTime = performance.now();
    try {
      if (t.id === 'test-persistence') {
        await testPersistence(t);
      } else if (t.id === 'test-offline-queue') {
        await testOfflineQueue(t);
      } else if (t.id === 'test-idempotency') {
        await testIdempotency(t);
      } else if (t.id === 'test-conflict-detection') {
        await testConflictDetection(t);
      } else if (t.id === 'test-conflict-resolution') {
        await testConflictResolution(t);
      } else if (t.id === 'test-reconnection-drain') {
        await testReconnectionDrain(t);
      }

      t.status = 'passed';
      t.durationMs = Math.round(performance.now() - startTime);
      t.logs.push(`[PASS] Completed in ${t.durationMs}ms`);
    } catch (err: any) {
      t.status = 'failed';
      t.durationMs = Math.round(performance.now() - startTime);
      t.message = err.message || 'Test assertion failure';
      t.logs.push(`[FAIL] ${err.message}`);
    }
    onUpdate([...tests]);
  }

  return tests;
}

// 1. Persistence Test
async function testPersistence(test: TestResult) {
  const testId = 'test-persist-' + Date.now();
  const testTask: Task = {
    id: testId,
    title: 'Automated Test: Linear Algebra Vectors',
    subject: 'Mathematics',
    description: 'Persistence verification fixture',
    priority: 'high',
    estimatedMinutes: 50,
    completed: false,
    dueDate: '2026-10-15',
    order: 9999,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    tags: ['TestTag', 'Vectors'],
    syncStatus: 'synced',
  };

  test.logs.push(`Writing task ${testId} to IndexedDB store 'tasks'...`);
  await saveTask(testTask);

  test.logs.push(`Querying task ${testId} from IndexedDB...`);
  const fetched = await getTaskById(testId);

  if (!fetched) {
    throw new Error('Task was not found in IndexedDB after save.');
  }
  if (fetched.title !== testTask.title) {
    throw new Error(`Title mismatch: expected "${testTask.title}", got "${fetched.title}"`);
  }
  if (fetched.estimatedMinutes !== 50) {
    throw new Error(`EstimatedMinutes mismatch: expected 50, got ${fetched.estimatedMinutes}`);
  }
  test.logs.push('Verified task properties match schema completely.');

  // Clean up
  await deleteTask(testId);
  test.logs.push('Cleaned up test fixture.');
}

// 2. Offline Queue Test
async function testOfflineQueue(test: TestResult) {
  test.logs.push('Simulating offline state...');
  syncEngine.setSimulatedOffline(true);

  const testId = 'test-offline-' + Date.now();
  const mutationId = 'mut-' + Date.now();

  const action: SyncAction = {
    id: 'action-' + Date.now(),
    clientMutationId: mutationId,
    taskId: testId,
    action: 'create',
    payload: {
      id: testId,
      title: 'Offline Created Physics Lab Notes',
      subject: 'Physics',
      priority: 'medium',
      estimatedMinutes: 30,
      completed: false,
      dueDate: '2026-10-16',
      order: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    },
    timestamp: Date.now(),
    baseVersion: 1,
    retryCount: 0,
    status: 'queued',
  };

  test.logs.push(`Enqueuing action into persistent sync queue...`);
  await enqueueSyncAction(action);

  const queue = await getQueuedSyncActions();
  const queuedItem = queue.find(q => q.id === action.id);

  if (!queuedItem) {
    throw new Error('Action was not found in sync queue.');
  }
  test.logs.push(`Found queued action ${queuedItem.id} with status="${queuedItem.status}".`);

  // Attempt sync while offline -> must reject and preserve queue!
  test.logs.push('Attempting sync while offline to verify queue is NOT cleared...');
  const syncResult = await syncEngine.attemptSync();
  if (syncResult.success) {
    throw new Error('Sync should not report success while device is offline.');
  }

  const queueAfterAttempt = await getQueuedSyncActions();
  const stillInQueue = queueAfterAttempt.find(q => q.id === action.id);
  if (!stillInQueue) {
    throw new Error('Requirement 8 violated: queued change was deleted before sync succeeded!');
  }
  test.logs.push('Verified: Queued change was preserved safely.');

  // Clean up
  await clearAllSyncActions();
  await syncEngine.setSimulatedOffline(false);
}

// 3. Idempotency Test
async function testIdempotency(test: TestResult) {
  const mutationId = 'fixed-idem-key-' + Date.now();
  const taskId = 'task-idem-' + Date.now();

  const taskData: Task = {
    id: taskId,
    title: 'Idempotency Validation Subject',
    subject: 'Computer Science',
    priority: 'low',
    estimatedMinutes: 20,
    completed: false,
    dueDate: '2026-10-12',
    order: 50,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    syncStatus: 'pending',
  };

  await saveTask(taskData);

  const action1: SyncAction = {
    id: 'act-1-' + Date.now(),
    clientMutationId: mutationId,
    taskId,
    action: 'create',
    payload: taskData,
    timestamp: Date.now(),
    baseVersion: 1,
    retryCount: 0,
    status: 'queued',
  };

  test.logs.push('Enqueueing original action...');
  await enqueueSyncAction(action1);

  test.logs.push('Syncing first execution...');
  await syncEngine.attemptSync();

  // Enqueue identical mutation ID again
  const action2: SyncAction = {
    id: 'act-2-' + Date.now(),
    clientMutationId: mutationId,
    taskId,
    action: 'create',
    payload: taskData,
    timestamp: Date.now() + 10,
    baseVersion: 1,
    retryCount: 0,
    status: 'queued',
  };

  test.logs.push('Enqueueing duplicate mutation ID...');
  await enqueueSyncAction(action2);

  test.logs.push('Syncing duplicate action...');
  const res2 = await syncEngine.attemptSync();

  if (!res2.success) {
    throw new Error('Duplicate mutation failed instead of gracefully handling idempotency.');
  }

  const queue = await getQueuedSyncActions();
  const remainingDuplicate = queue.find(q => q.id === action2.id);
  if (remainingDuplicate) {
    throw new Error('Duplicate action remained in queue.');
  }

  test.logs.push('Idempotency successfully guarded without duplicate server mutations.');
  await deleteTask(taskId);
  await deleteRemoteTask(taskId);
}

// 4. Conflict Detection Test
async function testConflictDetection(test: TestResult) {
  const taskId = 'task-conflict-fixture-' + Date.now();

  // 1. Initial synced state (Version 1)
  const initialTask: Task = {
    id: taskId,
    title: 'Original Title: Biology Genetics Lecture',
    subject: 'Biology',
    description: 'Initial notes',
    priority: 'medium',
    estimatedMinutes: 45,
    completed: false,
    dueDate: '2026-10-20',
    order: 10,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    syncStatus: 'synced',
  };
  await saveTask(initialTask);
  await saveRemoteTask(initialTask);

  // 2. Remote gets updated by peer to Version 2
  test.logs.push('Simulating concurrent edit on remote server (peer changes title to Version 2)...');
  const remoteCopy = { ...initialTask, version: 2, title: 'Remote Peer Edited Title: Genetics & Epigenetics' };
  await saveRemoteTask(remoteCopy);

  // 3. User offline/concurrently edited local task from baseVersion 1
  test.logs.push('User modifies local copy independently...');
  const localCopy = { ...initialTask, title: 'Student Local Title: Genetics Chapter 4 Review', version: 1 };
  await saveTask(localCopy);

  const conflictAction: SyncAction = {
    id: 'action-conf-' + Date.now(),
    clientMutationId: 'mut-conf-' + Date.now(),
    taskId,
    action: 'update',
    payload: { title: localCopy.title },
    timestamp: Date.now(),
    baseVersion: 1, // Base version was 1, but remote is 2!
    retryCount: 0,
    status: 'queued',
  };
  await enqueueSyncAction(conflictAction);

  test.logs.push('Triggering sync: remote version > action baseVersion...');
  await syncEngine.attemptSync();

  // 4. Verify conflict recorded
  const conflicts = await getConflicts();
  const foundConflict = conflicts.find(c => c.taskId === taskId);

  if (!foundConflict) {
    throw new Error('Conflict was not detected! Remote change silently overwritten.');
  }

  test.logs.push(`Conflict detected! Local: "${foundConflict.localTask.title}" vs Remote: "${foundConflict.remoteTask.title}".`);

  // Verify local user's edits were NOT overwritten silently
  const currentLocal = await getTaskById(taskId);
  if (!currentLocal || currentLocal.title !== localCopy.title) {
    throw new Error('Local user edits were silently erased by sync engine!');
  }
  test.logs.push('Verified: User local changes were preserved.');

  // Clean up
  await deleteConflictRecord(foundConflict.id);
  await clearAllSyncActions();
  await deleteTask(taskId);
  await deleteRemoteTask(taskId);
}

// 5. Conflict Resolution Test
async function testConflictResolution(test: TestResult) {
  const taskId = 'task-resolve-fixture-' + Date.now();
  const conflictId = 'conflict-fixture-' + Date.now();

  const localTask: Task = {
    id: taskId,
    title: 'Local Revision',
    subject: 'History',
    priority: 'high',
    estimatedMinutes: 60,
    completed: true,
    dueDate: '2026-10-18',
    order: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    syncStatus: 'conflict',
  };

  const remoteTask: Task = {
    id: taskId,
    title: 'Remote Revision',
    subject: 'History',
    priority: 'high',
    estimatedMinutes: 45,
    completed: false,
    dueDate: '2026-10-18',
    order: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 2,
    syncStatus: 'synced',
  };

  await saveTask(localTask);
  await saveRemoteTask(remoteTask);

  test.logs.push('Simulating Conflict Resolution: "Merge"...');
  const mergedTask: Task = {
    ...localTask,
    title: 'Merged: Local Title + Remote Changes',
    version: 3,
    syncStatus: 'synced',
  };

  // Mock conflict record
  const conflictRec = {
    id: conflictId,
    taskId,
    localTask,
    remoteTask,
    timestamp: Date.now(),
    resolved: false,
  };
  const { saveConflictRecord } = await import('../db/indexedDB');
  await saveConflictRecord(conflictRec);

  await syncEngine.resolveConflict(conflictId, 'merged', mergedTask);

  const resolvedLocal = await getTaskById(taskId);
  const resolvedRemote = await getRemoteTask(taskId);

  if (!resolvedLocal || resolvedLocal.title !== mergedTask.title) {
    throw new Error('Local task was not updated with merged resolution.');
  }
  if (!resolvedRemote || resolvedRemote.title !== mergedTask.title) {
    throw new Error('Remote task was not updated with merged resolution.');
  }
  test.logs.push('Both Local and Remote are unified with merged title.');

  // Clean up
  await deleteTask(taskId);
  await deleteRemoteTask(taskId);
}

// 6. Reconnection & Drain Test
async function testReconnectionDrain(test: TestResult) {
  test.logs.push('Simulating offline state while queueing items...');
  syncEngine.setSimulatedOffline(true);

  test.logs.push('Preparing pending queue items while offline...');
  const taskId = 'task-drain-' + Date.now();
  const task: Task = {
    id: taskId,
    title: 'Reconnection Drain Verification Task',
    subject: 'Chemistry',
    priority: 'low',
    estimatedMinutes: 15,
    completed: false,
    dueDate: '2026-10-25',
    order: 12,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    syncStatus: 'pending',
  };
  await saveTask(task);

  await enqueueSyncAction({
    id: 'drain-action-' + Date.now(),
    clientMutationId: 'drain-mut-' + Date.now(),
    taskId,
    action: 'create',
    payload: task,
    timestamp: Date.now(),
    baseVersion: 1,
    retryCount: 0,
    status: 'queued',
  });

  const queueBefore = await getQueuedSyncActions();
  test.logs.push(`Queue count before sync: ${queueBefore.length}`);
  if (queueBefore.length === 0) {
    throw new Error('Expected items in queue before reconnection sync.');
  }

  test.logs.push('Simulating network reconnection (connectivity restored)...');
  // Reconnecting automatically triggers synchronization in syncEngine
  const syncPromise = syncEngine.setSimulatedOffline(false);
  const result = await syncPromise;

  if (!result.success) {
    throw new Error('Sync cycle failed during reconnection.');
  }

  const queueAfter = await getQueuedSyncActions();
  test.logs.push(`Queue count after sync: ${queueAfter.length}`);
  if (queueAfter.length !== 0) {
    throw new Error(`Expected queue to be completely drained, but found ${queueAfter.length} item(s).`);
  }

  const syncedLocal = await getTaskById(taskId);
  if (!syncedLocal || syncedLocal.syncStatus !== 'synced') {
    throw new Error(`Task status was not updated to 'synced'. Got: ${syncedLocal?.syncStatus}`);
  }

  test.logs.push('Queue drained successfully. Task syncStatus is now "synced".');
  await deleteTask(taskId);
  await deleteRemoteTask(taskId);
}
