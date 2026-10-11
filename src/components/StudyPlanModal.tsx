import React, { useState } from 'react';
import { Task, TaskPriority } from '../types';
import {
  SubjectInput,
  StudyPlanConfig,
  GeneratedPlan,
  generateStudyPlan,
  convertPlanSessionsToTasks,
} from '../utils/studyPlanner';
import { bulkSaveTasks, enqueueSyncAction } from '../db/indexedDB';
import { syncEngine } from '../sync/syncEngine';
import {
  X,
  Sparkles,
  Calendar,
  Clock,
  BookOpen,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Brain,
  Layers,
} from 'lucide-react';

interface StudyPlanModalProps {
  isOpen: boolean;
  tasksCount: number;
  onClose: () => void;
  onPlanImported: () => void;
}

export const StudyPlanModal: React.FC<StudyPlanModalProps> = ({
  isOpen,
  tasksCount,
  onClose,
  onPlanImported,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const inOneWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const inTwoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  const [subjects, setSubjects] = useState<SubjectInput[]>([
    {
      name: 'Calculus II',
      difficulty: 4,
      deadline: inOneWeek,
      priority: 'urgent',
      topics: 'Integration Techniques, Power Series, Differential Equations, Vector Calculus',
    },
    {
      name: 'Computer Architecture',
      difficulty: 4,
      deadline: inTwoWeeks,
      priority: 'high',
      topics: 'Assembly Instructions, Pipelining Hazards, Cache Memory, Virtual Memory',
    },
    {
      name: 'Cell Biology',
      difficulty: 3,
      deadline: inOneWeek,
      priority: 'medium',
      topics: 'Cellular Respiration, Photosynthesis, Signal Transduction, Mitosis vs Meiosis',
    },
  ]);

  const [dailyHours, setDailyHours] = useState<number>(3);
  const [sessionLength, setSessionLength] = useState<25 | 45 | 60>(45);
  const [planDays, setPlanDays] = useState<number>(7);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const handleAddSubject = () => {
    setSubjects([
      ...subjects,
      {
        name: '',
        difficulty: 3,
        deadline: inOneWeek,
        priority: 'medium',
        topics: '',
      },
    ]);
  };

  const handleRemoveSubject = (index: number) => {
    setSubjects(subjects.filter((_, i) => i !== index));
  };

  const handleSubjectChange = (index: number, field: keyof SubjectInput, value: any) => {
    const updated = [...subjects];
    updated[index] = { ...updated[index], [field]: value };
    setSubjects(updated);
  };

  const handleGenerate = () => {
    const config: StudyPlanConfig = {
      dailyHours,
      sessionLengthMinutes: sessionLength,
      planDurationDays: planDays,
      includeBreaks: true,
      startDate: todayStr,
    };
    const plan = generateStudyPlan(subjects, config);
    setGeneratedPlan(plan);
  };

  const handleImportTasks = async () => {
    if (!generatedPlan) return;
    setIsImporting(true);

    const allSessions = generatedPlan.sessionsByDay.flatMap((d) => d.sessions);
    const newTasks = convertPlanSessionsToTasks(allSessions, tasksCount);

    await bulkSaveTasks(newTasks);

    // Queue sync actions for all created tasks
    for (const t of newTasks) {
      await enqueueSyncAction({
        id: 'plan-act-' + t.id,
        clientMutationId: `plan-mut-${t.id}-${Date.now()}`,
        taskId: t.id,
        action: 'create',
        payload: t,
        timestamp: Date.now(),
        baseVersion: 1,
        retryCount: 0,
        status: 'queued',
      });
    }

    syncEngine.addLog(
      `Imported ${newTasks.length} study sessions from Algorithmic Planner into IndexedDB.`,
      'success'
    );
    syncEngine.attemptSync();

    setIsImporting(false);
    onPlanImported();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-sky-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-xs">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Algorithmic Study Plan Generator</h3>
                <span className="bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  100% Offline / Client-Side
                </span>
              </div>
              <p className="text-xs text-indigo-100">
                Optimizes cognitive load, deadlines, and spaced interleaving without external AI APIs
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Schedule Constraints Bar */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                Daily Available Study Time
              </label>
              <select
                value={dailyHours}
                onChange={(e) => setDailyHours(Number(e.target.value))}
                className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value={1}>1 hour / day (Light review)</option>
                <option value={2}>2 hours / day (Moderate)</option>
                <option value={3}>3 hours / day (Standard student)</option>
                <option value={4}>4 hours / day (Intensive prep)</option>
                <option value={6}>6 hours / day (Exam crunch)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                Focus Block Duration
              </label>
              <select
                value={sessionLength}
                onChange={(e) => setSessionLength(Number(e.target.value) as any)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value={25}>25 mins (Pomodoro technique)</option>
                <option value={45}>45 mins (Balanced cognitive focus)</option>
                <option value={60}>60 mins (Deep immersion)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                Plan Horizon
              </label>
              <select
                value={planDays}
                onChange={(e) => setPlanDays(Number(e.target.value))}
                className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value={3}>3-Day Sprint</option>
                <option value={5}>5-Day Weekday Plan</option>
                <option value={7}>7-Day Full Week</option>
                <option value={14}>14-Day Midterm Plan</option>
              </select>
            </div>
          </div>

          {/* Subjects Table & Inputs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                Subjects & Exam Deadlines ({subjects.length})
              </span>
              <button
                type="button"
                onClick={handleAddSubject}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Subject
              </button>
            </div>

            <div className="space-y-3">
              {subjects.map((subj, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs space-y-2.5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        placeholder="Subject name (e.g. Calculus, Bio)"
                        value={subj.name}
                        onChange={(e) => handleSubjectChange(idx, 'name', e.target.value)}
                        className="w-full text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-slate-500 font-medium">Difficulty:</span>
                        <select
                          value={subj.difficulty}
                          onChange={(e) =>
                            handleSubjectChange(idx, 'difficulty', Number(e.target.value))
                          }
                          className="text-xs font-semibold px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
                        >
                          <option value={1}>1 (Easy)</option>
                          <option value={2}>2 (Mild)</option>
                          <option value={3}>3 (Medium)</option>
                          <option value={4}>4 (Hard)</option>
                          <option value={5}>5 (Critical)</option>
                        </select>
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-slate-500 font-medium">Exam:</span>
                        <input
                          type="date"
                          value={subj.deadline}
                          onChange={(e) => handleSubjectChange(idx, 'deadline', e.target.value)}
                          className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-300"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2 flex items-center justify-end gap-1">
                      <select
                        value={subj.priority}
                        onChange={(e) =>
                          handleSubjectChange(idx, 'priority', e.target.value as TaskPriority)
                        }
                        className="text-xs font-semibold px-2 py-1.5 rounded-lg border border-slate-300 bg-white capitalize"
                      >
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Med</option>
                        <option value="low">Low</option>
                      </select>
                      {subjects.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSubject(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Key topics to cover (e.g. Limits, Derivatives, Integration by Parts)"
                      value={subj.topics}
                      onChange={(e) => handleSubjectChange(idx, 'topics', e.target.value)}
                      className="w-full text-xs text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleGenerate}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold shadow-sm transition"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                Generate Algorithmic Schedule
              </button>
            </div>
          </div>

          {/* Generated Plan Preview */}
          {generatedPlan && (
            <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-indigo-200">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Generated Schedule: {generatedPlan.totalSessions} Study Sessions
                    </h4>
                    <p className="text-xs text-slate-500">
                      Total Allocated Focus Time: {generatedPlan.totalStudyHours} hours across {generatedPlan.sessionsByDay.length} days
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleImportTasks}
                  disabled={isImporting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isImporting ? 'Saving to Tasks...' : 'Add All to My Tasks'}
                </button>
              </div>

              {/* Urgency breakdown chips */}
              <div className="flex flex-wrap gap-2">
                {generatedPlan.subjectBreakdown.map((sb) => (
                  <div
                    key={sb.subject}
                    className="px-3 py-1.5 rounded-lg bg-white border border-indigo-100 text-xs shadow-2xs flex items-center gap-2"
                  >
                    <span className="font-bold text-slate-800">{sb.subject}</span>
                    <span className="text-slate-400">&bull;</span>
                    <span className="text-indigo-600 font-semibold">{sb.totalMinutes} min</span>
                    <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">
                      Urgency {sb.urgencyScore}
                    </span>
                  </div>
                ))}
              </div>

              {/* Day-by-Day Timetable */}
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {generatedPlan.sessionsByDay.map((day) => (
                  <div key={day.date} className="p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        {day.dayLabel} ({day.totalMinutes}m planned)
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {day.sessions.length} sessions
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {day.sessions.map((sess, sIdx) => (
                        <div
                          key={sIdx}
                          className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 truncate">
                              {sess.subject}
                            </span>
                            <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                              {sess.durationMinutes}m
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 font-medium truncate">
                            {sess.topicTitle.replace(`${sess.subject}: `, '')}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {sess.rationale}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Algorithm uses cognitive interleaving to balance subjects and prevent burnout.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-semibold text-slate-700 hover:text-slate-900 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
