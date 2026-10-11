import React, { useState, useEffect } from 'react';
import { Task, TaskPriority, SyncAction } from '../types';
import { saveTask, enqueueSyncAction } from '../db/indexedDB';
import { syncEngine } from '../sync/syncEngine';
import { X, Check, BookOpen, Clock, Calendar, AlertCircle } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  taskToEdit: Task | null;
  tasksCount: number;
  onClose: () => void;
  onSaved: () => void;
}

const COMMON_SUBJECTS = [
  'Mathematics',
  'Computer Science',
  'Biology',
  'Chemistry',
  'Physics',
  'Literature',
  'History',
  'Economics',
  'Psychology',
  'Philosophy',
];

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  taskToEdit,
  tasksCount,
  onClose,
  onSaved,
}) => {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(COMMON_SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [estimatedMinutes, setEstimatedMinutes] = useState(45);
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      if (COMMON_SUBJECTS.includes(taskToEdit.subject)) {
        setSubject(taskToEdit.subject);
        setCustomSubject('');
      } else {
        setSubject('Other');
        setCustomSubject(taskToEdit.subject);
      }
      setPriority(taskToEdit.priority);
      setEstimatedMinutes(taskToEdit.estimatedMinutes);
      setDueDate(taskToEdit.dueDate);
      setDescription(taskToEdit.description || '');
      setTagInput(taskToEdit.tags?.join(', ') || '');
    } else {
      setTitle('');
      setSubject(COMMON_SUBJECTS[0]);
      setCustomSubject('');
      setPriority('medium');
      setEstimatedMinutes(45);
      setDueDate(new Date().toISOString().split('T')[0]);
      setDescription('');
      setTagInput('');
    }
    setError('');
  }, [taskToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }

    const finalSubject = subject === 'Other' ? (customSubject.trim() || 'General') : subject;
    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const now = Date.now();

    if (taskToEdit) {
      // Update existing task
      const baseVer = taskToEdit.version;
      const updatedTask: Task = {
        ...taskToEdit,
        title: title.trim(),
        subject: finalSubject,
        priority,
        estimatedMinutes: Number(estimatedMinutes),
        dueDate,
        description: description.trim(),
        tags,
        updatedAt: now,
        syncStatus: 'pending',
      };

      await saveTask(updatedTask);

      // Enqueue sync action
      const action: SyncAction = {
        id: 'action-upd-' + now + '-' + Math.random().toString(36).substring(2, 7),
        clientMutationId: `mut-upd-${updatedTask.id}-${now}`,
        taskId: updatedTask.id,
        action: 'update',
        payload: {
          title: updatedTask.title,
          subject: updatedTask.subject,
          priority: updatedTask.priority,
          estimatedMinutes: updatedTask.estimatedMinutes,
          dueDate: updatedTask.dueDate,
          description: updatedTask.description,
          tags: updatedTask.tags,
        },
        timestamp: now,
        baseVersion: baseVer,
        retryCount: 0,
        status: 'queued',
      };
      await enqueueSyncAction(action);
      syncEngine.addLog(`Task "${updatedTask.title}" updated and queued for sync.`, 'info');
    } else {
      // Create new task
      const newTask: Task = {
        id: 'task-' + now + '-' + Math.random().toString(36).substring(2, 7),
        title: title.trim(),
        subject: finalSubject,
        priority,
        estimatedMinutes: Number(estimatedMinutes),
        completed: false,
        dueDate,
        order: tasksCount,
        createdAt: now,
        updatedAt: now,
        version: 1,
        tags,
        syncStatus: 'pending',
      };

      await saveTask(newTask);

      const action: SyncAction = {
        id: 'action-create-' + now + '-' + Math.random().toString(36).substring(2, 7),
        clientMutationId: `mut-create-${newTask.id}-${now}`,
        taskId: newTask.id,
        action: 'create',
        payload: newTask,
        timestamp: now,
        baseVersion: 1,
        retryCount: 0,
        status: 'queued',
      };
      await enqueueSyncAction(action);
      syncEngine.addLog(`Task "${newTask.title}" created in IndexedDB and queued for sync.`, 'info');
    }

    // Attempt sync in background
    syncEngine.attemptSync();
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {taskToEdit ? 'Edit Study Task' : 'New Study Task'}
              </h3>
              <p className="text-xs text-slate-400">
                Saved immediately to IndexedDB &bull; Offline safe
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Organic Chemistry: Chapter 7 Problem Set"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Subject & Custom Subject */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Subject
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              >
                {COMMON_SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value="Other">Other / Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {subject === 'Other' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Custom Subject Name
              </label>
              <input
                type="text"
                placeholder="Enter subject name"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Estimated Minutes & Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Est. Duration (Mins)
              </label>
              <input
                type="number"
                min={5}
                max={480}
                step={5}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Study Notes / Breakdown
            </label>
            <textarea
              rows={3}
              placeholder="Key concepts, textbook pages, exercise numbers, or study objectives..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Tags (Comma separated)
            </label>
            <input
              type="text"
              placeholder="Exam, Midterm, Lab, Flashcards"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-xs transition"
            >
              <Check className="w-4 h-4" />
              {taskToEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
