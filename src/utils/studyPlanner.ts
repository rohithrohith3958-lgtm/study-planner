import { GeneratedStudySession, Task, TaskPriority } from '../types';

export interface SubjectInput {
  name: string;
  difficulty: 1 | 2 | 3 | 4 | 5; // 1 easiest, 5 hardest
  deadline: string; // YYYY-MM-DD
  topics: string; // comma or newline separated
  priority: TaskPriority;
}

export interface StudyPlanConfig {
  dailyHours: number; // e.g. 2 to 8
  sessionLengthMinutes: 25 | 45 | 60;
  planDurationDays: number; // e.g. 3, 5, 7, 14
  includeBreaks: boolean;
  startDate?: string;
}

export interface GeneratedPlan {
  id: string;
  createdAt: number;
  totalStudyHours: number;
  totalSessions: number;
  sessionsByDay: {
    date: string;
    dayLabel: string;
    totalMinutes: number;
    sessions: GeneratedStudySession[];
  }[];
  subjectBreakdown: {
    subject: string;
    totalMinutes: number;
    sessionCount: number;
    urgencyScore: number;
  }[];
}

export function generateStudyPlan(
  subjects: SubjectInput[],
  config: StudyPlanConfig
): GeneratedPlan {
  const start = config.startDate ? new Date(config.startDate) : new Date();
  start.setHours(0, 0, 0, 0);

  // Parse topics and calculate urgency
  const parsedSubjects = subjects
    .filter(s => s.name.trim().length > 0)
    .map(s => {
      const topicList = s.topics
        .split(/[,\n]/)
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const topics = topicList.length > 0 ? topicList : [
        'Core Foundations & Concepts',
        'Practice Problem Set 1',
        'Deep Dive Review & Notes',
        'Mock Exam & Error Analysis',
      ];

      const deadlineDate = s.deadline ? new Date(s.deadline) : new Date(start.getTime() + 7 * 86400000);
      const diffMs = deadlineDate.getTime() - start.getTime();
      const daysUntil = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      const priorityMultiplier: Record<TaskPriority, number> = {
        urgent: 2.5,
        high: 1.8,
        medium: 1.2,
        low: 0.8,
      };

      // Urgency formula: (difficulty * priorityMultiplier * 10) / daysUntil
      const urgencyScore = Number(
        (((s.difficulty * 2.0 + 1) * (priorityMultiplier[s.priority] || 1.2) * 10) / daysUntil).toFixed(2)
      );

      return {
        ...s,
        topics,
        daysUntil,
        urgencyScore,
        unallocatedTopics: [...topics],
      };
    });

  if (parsedSubjects.length === 0) {
    return {
      id: 'plan-' + Date.now(),
      createdAt: Date.now(),
      totalStudyHours: 0,
      totalSessions: 0,
      sessionsByDay: [],
      subjectBreakdown: [],
    };
  }

  // Sort subjects by urgency (highest first)
  parsedSubjects.sort((a, b) => b.urgencyScore - a.urgencyScore);

  const sessionLen = config.sessionLengthMinutes;
  const maxDailyMinutes = config.dailyHours * 60;
  const sessionsPerDayTarget = Math.floor(maxDailyMinutes / sessionLen);

  const daysResult: GeneratedPlan['sessionsByDay'] = [];
  let totalStudyMinutes = 0;
  let totalSessionsCount = 0;

  const subjectAllocatedMinutes: Record<string, number> = {};
  const subjectSessionCount: Record<string, number> = {};
  parsedSubjects.forEach(s => {
    subjectAllocatedMinutes[s.name] = 0;
    subjectSessionCount[s.name] = 0;
  });

  // Distribute over days
  for (let dayIndex = 0; dayIndex < config.planDurationDays; dayIndex++) {
    const currentDayDate = new Date(start.getTime() + dayIndex * 86400000);
    const dateStr = currentDayDate.toISOString().split('T')[0];
    const dayLabel = currentDayDate.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    const daySessions: GeneratedStudySession[] = [];
    let dayMinutes = 0;

    // Pick subjects in round-robin weighted by urgency to achieve interleaved cognitive spacing
    for (let slot = 0; slot < sessionsPerDayTarget; slot++) {
      // Find candidate subject
      const subjectIndex = slot % parsedSubjects.length;
      const subj = parsedSubjects[subjectIndex];

      // Topic title selection
      let topic = subj.unallocatedTopics.shift();
      if (!topic) {
        // Recycle with progressive milestone
        const passNum = Math.floor(slot / parsedSubjects.length) + 1;
        topic = `Mastery Pass #${passNum}: ${subj.topics[slot % subj.topics.length]}`;
      }

      const session: GeneratedStudySession = {
        date: dateStr,
        subject: subj.name,
        topicTitle: `${subj.name}: ${topic}`,
        durationMinutes: sessionLen,
        priority: subj.priority,
        rationale: `Urgency score ${subj.urgencyScore} (due in ${Math.max(1, subj.daysUntil - dayIndex)}d). Spaced interleaving block.`,
      };

      daySessions.push(session);
      dayMinutes += sessionLen;
      totalStudyMinutes += sessionLen;
      totalSessionsCount++;

      subjectAllocatedMinutes[subj.name] = (subjectAllocatedMinutes[subj.name] || 0) + sessionLen;
      subjectSessionCount[subj.name] = (subjectSessionCount[subj.name] || 0) + 1;
    }

    daysResult.push({
      date: dateStr,
      dayLabel,
      totalMinutes: dayMinutes,
      sessions: daySessions,
    });
  }

  const subjectBreakdown = parsedSubjects.map(s => ({
    subject: s.name,
    totalMinutes: subjectAllocatedMinutes[s.name] || 0,
    sessionCount: subjectSessionCount[s.name] || 0,
    urgencyScore: s.urgencyScore,
  }));

  return {
    id: 'plan-' + Date.now(),
    createdAt: Date.now(),
    totalStudyHours: Number((totalStudyMinutes / 60).toFixed(1)),
    totalSessions: totalSessionsCount,
    sessionsByDay: daysResult,
    subjectBreakdown,
  };
}

/**
 * Convert generated plan sessions directly into StudySync Tasks for IndexedDB
 */
export function convertPlanSessionsToTasks(sessions: GeneratedStudySession[], startingOrder: number = 0): Task[] {
  return sessions.map((s, index) => {
    return {
      id: 'task-plan-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now(),
      title: s.topicTitle,
      subject: s.subject,
      description: `Generated Study Plan Session (${s.durationMinutes} min focus). ${s.rationale}`,
      priority: s.priority,
      estimatedMinutes: s.durationMinutes,
      completed: false,
      dueDate: s.date,
      order: startingOrder + index,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      tags: ['Study Plan', `${s.durationMinutes}m Session`],
      syncStatus: 'pending',
    };
  });
}
