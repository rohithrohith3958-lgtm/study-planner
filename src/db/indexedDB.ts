import { Task, SyncAction, ConflictRecord } from '../types';

const DB_NAME = 'StudySyncDB';
const DB_VERSION = 1;

export const STORES = {
  TASKS: 'tasks',
  SYNC_QUEUE: 'syncQueue',
  CONFLICTS: 'conflicts',
  REMOTE_STORAGE: 'remoteServerStore', // Simulates remote server replica store
  SETTINGS: 'appSettings',
} as const;

let dbInstance: IDBDatabase | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Local Tasks store
      if (!db.objectStoreNames.contains(STORES.TASKS)) {
        const taskStore = db.createObjectStore(STORES.TASKS, { keyPath: 'id' });
        taskStore.createIndex('dueDate', 'dueDate', { unique: false });
        taskStore.createIndex('completed', 'completed', { unique: false });
        taskStore.createIndex('order', 'order', { unique: false });
        taskStore.createIndex('subject', 'subject', { unique: false });
      }

      // 2. Persistent Sync Queue store
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const queueStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        queueStore.createIndex('taskId', 'taskId', { unique: false });
        queueStore.createIndex('status', 'status', { unique: false });
        queueStore.createIndex('clientMutationId', 'clientMutationId', { unique: true });
      }

      // 3. Conflicts store
      if (!db.objectStoreNames.contains(STORES.CONFLICTS)) {
        const conflictStore = db.createObjectStore(STORES.CONFLICTS, { keyPath: 'id' });
        conflictStore.createIndex('taskId', 'taskId', { unique: false });
        conflictStore.createIndex('resolved', 'resolved', { unique: false });
      }

      // 4. Remote Server store (persistent representation of remote server state)
      if (!db.objectStoreNames.contains(STORES.REMOTE_STORAGE)) {
        const remoteStore = db.createObjectStore(STORES.REMOTE_STORAGE, { keyPath: 'id' });
        remoteStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // 5. Settings store
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

// ----------------- TASK OPERATIONS -----------------

export async function getAllTasks(): Promise<Task[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TASKS, 'readonly');
    const store = tx.objectStore(STORES.TASKS);
    const request = store.getAll();

    request.onsuccess = () => {
      const tasks: Task[] = request.result || [];
      // Sort primarily by order, then by createdAt
      tasks.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
      resolve(tasks);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getTaskById(id: string): Promise<Task | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TASKS, 'readonly');
    const store = tx.objectStore(STORES.TASKS);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveTask(task: Task): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TASKS, 'readwrite');
    const store = tx.objectStore(STORES.TASKS);
    const request = store.put(task);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteTask(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TASKS, 'readwrite');
    const store = tx.objectStore(STORES.TASKS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function bulkSaveTasks(tasks: Task[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TASKS, 'readwrite');
    const store = tx.objectStore(STORES.TASKS);
    tasks.forEach(task => store.put(task));

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ----------------- SYNC QUEUE OPERATIONS -----------------

export async function enqueueSyncAction(action: SyncAction): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const request = store.put(action);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getQueuedSyncActions(): Promise<SyncAction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const request = store.getAll();

    request.onsuccess = () => {
      const actions: SyncAction[] = request.result || [];
      // FIFO execution order
      actions.sort((a, b) => a.timestamp - b.timestamp);
      resolve(actions);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateSyncAction(action: SyncAction): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const request = store.put(action);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function removeSyncAction(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllSyncActions(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ----------------- CONFLICT OPERATIONS -----------------

export async function saveConflictRecord(conflict: ConflictRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CONFLICTS, 'readwrite');
    const store = tx.objectStore(STORES.CONFLICTS);
    const request = store.put(conflict);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getConflicts(): Promise<ConflictRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CONFLICTS, 'readonly');
    const store = tx.objectStore(STORES.CONFLICTS);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteConflictRecord(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CONFLICTS, 'readwrite');
    const store = tx.objectStore(STORES.CONFLICTS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ----------------- REMOTE STORAGE (Simulated Server) -----------------

export async function getRemoteTasks(): Promise<Task[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.REMOTE_STORAGE, 'readonly');
    const store = tx.objectStore(STORES.REMOTE_STORAGE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getRemoteTask(id: string): Promise<Task | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.REMOTE_STORAGE, 'readonly');
    const store = tx.objectStore(STORES.REMOTE_STORAGE);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveRemoteTask(task: Task): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.REMOTE_STORAGE, 'readwrite');
    const store = tx.objectStore(STORES.REMOTE_STORAGE);
    const request = store.put(task);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteRemoteTask(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.REMOTE_STORAGE, 'readwrite');
    const store = tx.objectStore(STORES.REMOTE_STORAGE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ----------------- SAMPLE DATA SEEDING -----------------

export async function seedInitialTasksIfEmpty(): Promise<boolean> {
  const existing = await getAllTasks();
  if (existing.length > 0) {
    return false;
  }

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const twoDays = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];

  const initialTasks: Task[] = [
    {
      id: 'task-seed-1',
      title: 'Review Calculus: Multivariable Integration',
      subject: 'Mathematics',
      description: 'Practice polar coordinates, double integrals, and Stokes theorem problems 14 to 28.',
      priority: 'high',
      estimatedMinutes: 60,
      completed: false,
      dueDate: today,
      order: 0,
      createdAt: Date.now() - 3600000 * 4,
      updatedAt: Date.now() - 3600000 * 4,
      version: 1,
      tags: ['Midterm Prep', 'Calculus'],
      syncStatus: 'synced',
    },
    {
      id: 'task-seed-2',
      title: 'Data Structures: Implement Red-Black Tree',
      subject: 'Computer Science',
      description: 'Finish balancing rotation logic and test deletion re-coloring cases.',
      priority: 'urgent',
      estimatedMinutes: 90,
      completed: false,
      dueDate: today,
      order: 1,
      createdAt: Date.now() - 3600000 * 3,
      updatedAt: Date.now() - 3600000 * 3,
      version: 1,
      tags: ['Assignment 3', 'Algorithms'],
      syncStatus: 'synced',
    },
    {
      id: 'task-seed-3',
      title: 'Cellular Biology: Diagram ATP Synthesis Chain',
      subject: 'Biology',
      description: 'Draw mitochondria electron transport complex I-IV diagrams and summarize Chemiosmosis.',
      priority: 'medium',
      estimatedMinutes: 45,
      completed: true,
      dueDate: today,
      order: 2,
      createdAt: Date.now() - 3600000 * 2,
      updatedAt: Date.now() - 3600000 * 1,
      version: 1,
      tags: ['Notes', 'Diagrams'],
      syncStatus: 'synced',
    },
    {
      id: 'task-seed-4',
      title: 'Read Shakespeare: Hamlet Act III Scene 1 Analysis',
      subject: 'Literature',
      description: 'Annotate the soliloquy "To be or not to be" and prepare 3 discussion prompts for seminar.',
      priority: 'low',
      estimatedMinutes: 35,
      completed: false,
      dueDate: tomorrow,
      order: 3,
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 3600000,
      version: 1,
      tags: ['Reading', 'Seminar'],
      syncStatus: 'synced',
    },
    {
      id: 'task-seed-5',
      title: 'Organic Chemistry: Reaction Mechanisms Flashcards',
      subject: 'Chemistry',
      description: 'Spaced repetition deck review: SN1 vs SN2 nucleophilic substitution and elimination reactions.',
      priority: 'medium',
      estimatedMinutes: 30,
      completed: false,
      dueDate: twoDays,
      order: 4,
      createdAt: Date.now() - 1800000,
      updatedAt: Date.now() - 1800000,
      version: 1,
      tags: ['Flashcards', 'Exam'],
      syncStatus: 'synced',
    },
  ];

  await bulkSaveTasks(initialTasks);
  // Also populate the initial remote replica so everything starts nicely synced
  for (const t of initialTasks) {
    await saveRemoteTask({ ...t });
  }

  return true;
}

export async function resetDatabase(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([STORES.TASKS, STORES.SYNC_QUEUE, STORES.CONFLICTS, STORES.REMOTE_STORAGE], 'readwrite');
  tx.objectStore(STORES.TASKS).clear();
  tx.objectStore(STORES.SYNC_QUEUE).clear();
  tx.objectStore(STORES.CONFLICTS).clear();
  tx.objectStore(STORES.REMOTE_STORAGE).clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
