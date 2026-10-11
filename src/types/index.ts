export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  subject: string;
  description?: string;
  priority: TaskPriority;
  estimatedMinutes: number;
  completed: boolean;
  dueDate: string; // YYYY-MM-DD
  order: number;
  createdAt: number;
  updatedAt: number;
  version: number; // Incrementing version for optimistic concurrency & conflict detection
  tags?: string[];
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export type SyncActionType = 'create' | 'update' | 'delete' | 'reorder';

export interface SyncAction {
  id: string; // Action ID
  clientMutationId: string; // Idempotency key to prevent duplicate operations
  taskId: string;
  action: SyncActionType;
  payload: Partial<Task> | { order: number } | null;
  timestamp: number;
  baseVersion: number; // The version of the task when mutation was created
  retryCount: number;
  status: 'queued' | 'in_flight' | 'failed' | 'conflict';
  lastError?: string;
}

export interface ConflictRecord {
  id: string;
  taskId: string;
  localTask: Task;
  remoteTask: Task;
  timestamp: number;
  resolved: boolean;
  resolution?: 'local' | 'remote' | 'merged';
}

export interface SyncLogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  details?: string;
}

export interface SubjectPreference {
  name: string;
  difficulty: 1 | 2 | 3 | 4 | 5; // 1 easiest, 5 hardest
  examDate?: string;
  remainingTopics?: string[];
}

export interface GeneratedStudySession {
  date: string;
  subject: string;
  topicTitle: string;
  durationMinutes: number;
  priority: TaskPriority;
  rationale: string;
}

export interface TestResult {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'running' | 'passed' | 'failed';
  durationMs?: number;
  message?: string;
  logs: string[];
}
