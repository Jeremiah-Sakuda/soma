import type { Attempt, Lesson, WorkspaceState } from './types';

/** Evidence-derived station state. Order matters: a stronger state wins. */
export type StationStatus = 'own' | 'split' | 'help' | 'tried' | 'ready';
export type StationEvidence = { who: 'You' | 'Soma' | 'Source'; text: string; at?: string };
export type MapStation = {
  lessonId: string;
  title: string;
  objective: string;
  kind: Lesson['kind'];
  duration: number;
  status: StationStatus;
  word: string;
  stale: boolean;
  recommended: boolean;
  attempts: number;
  evidence: StationEvidence[];
};
export type MapMilestone = { id: string; title: string; at: string };
export type MapLine = {
  courseId: string;
  code: string;
  title: string;
  color: string;
  stations: MapStation[];
  milestones: MapMilestone[];
};

export const STATUS_WORD: Record<StationStatus, string> = {
  own: 'On your own',
  split: 'Two explanations',
  help: 'With help',
  tried: 'Worked in the lesson',
  ready: 'Ready, not started',
};

const describe = (attempt: Attempt) => {
  const outcome =
    attempt.correct === true
      ? 'Matched the checked answer'
      : attempt.correct === false
        ? 'Not what the model gives'
        : 'Response saved';
  return `${outcome} · ${attempt.assisted ? 'with help' : 'no help recorded'}${attempt.exposure === 'fresh-no-diagram' ? ' · fresh question, no diagram' : ''}`;
};

/** A lesson tests an open interpretation when the graph links it to one that is still plausible or unresolved. */
function openInterpretation(ws: WorkspaceState, lesson: Lesson) {
  const graph = ws.learningGraph ?? [];
  const tested = new Set(
    graph
      .filter(
        (r) =>
          r.kind === 'relationship' &&
          r.relation === 'tests' &&
          r.from.kind === 'activity' &&
          r.from.id === lesson.id,
      )
      .map((r) => (r.kind === 'relationship' ? r.to.id : '')),
  );
  const open = graph.some(
    (r) =>
      r.kind === 'interpretation' &&
      tested.has(r.id) &&
      (r.status === 'plausible' || r.status === 'unresolved') &&
      !graph.some((n) => n.kind === 'interpretation' && n.id === r.id && n.version > r.version),
  );
  return (
    open ||
    (!!lesson.diagnosticInvestigationId &&
      !(ws.attempts ?? []).some((a) => a.lessonId === lesson.id && !a.responseKind))
  );
}

/**
 * Projects saved workspace records onto course lines. Fresh follow-up lessons are folded into
 * their parent station, so one idea is one station. Nothing here creates evidence.
 */
export function semesterMap(ws: WorkspaceState): MapLine[] {
  const childOf = new Map<string, string>();
  for (const lesson of ws.lessons)
    if (lesson.parentLessonId) childOf.set(lesson.id, lesson.parentLessonId);
  for (const request of ws.freshRequests ?? [])
    childOf.set(request.lessonId, request.parentLessonId);
  const root = (id: string) => {
    let current = id;
    const seen = new Set<string>();
    while (childOf.has(current) && !seen.has(current)) {
      seen.add(current);
      current = childOf.get(current)!;
    }
    return current;
  };
  const latest = new Map<string, Lesson>();
  for (const lesson of ws.lessons) {
    const previous = latest.get(lesson.id);
    if (!previous || previous.version <= lesson.version) latest.set(lesson.id, lesson);
  }

  return ws.courses.map((course) => {
    const roots = [...latest.values()].filter(
      (l) => l.courseId === course.id && root(l.id) === l.id,
    );
    const stations = roots.map<MapStation>((lesson) => {
      const family = [...latest.values()].filter((l) => root(l.id) === lesson.id).map((l) => l.id);
      const attempts = (ws.attempts ?? [])
        .filter((a) => family.includes(a.lessonId) && !a.responseKind)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const helped =
        attempts.some((a) => a.assisted) ||
        family.some((id) => (ws.assistance[id] ?? []).length > 0);
      const own = attempts.some(
        (a) => a.correct === true && !a.assisted && a.exposure === 'fresh-no-diagram',
      );
      const status: StationStatus = own
        ? 'own'
        : openInterpretation(ws, lesson)
          ? 'split'
          : helped
            ? 'help'
            : attempts.length
              ? 'tried'
              : 'ready';
      const evidence: StationEvidence[] = [
        ...lesson.sourceIds
          .map((id) =>
            ws.sources.find((s) => s.id === id && s.version === lesson.sourceVersions[id]),
          )
          .filter(Boolean)
          .map((s) => ({ who: 'Source' as const, text: s!.title, at: s!.retrievedAt })),
        { who: 'Soma', text: lesson.reason },
        ...attempts.map((a) => ({ who: 'You' as const, text: describe(a), at: a.createdAt })),
      ];
      return {
        lessonId: lesson.id,
        title: lesson.title,
        objective: lesson.objective,
        kind: lesson.kind,
        duration: lesson.duration,
        status,
        word: STATUS_WORD[status],
        stale: lesson.state === 'stale',
        recommended: ws.recommendedLessonId === lesson.id,
        attempts: attempts.length,
        evidence,
      };
    });
    const dated = (course.assessments ?? [])
      .filter((a) => a.deadlineAt)
      .map((a) => ({ id: a.id, title: a.title, at: a.deadlineAt! }));
    const milestones = (
      dated.length
        ? dated
        : course.deadline
          ? [{ id: `${course.id}:deadline`, title: course.nextEvent, at: course.deadline }]
          : []
    ).sort((a, b) => a.at.localeCompare(b.at));
    return {
      courseId: course.id,
      code: course.code,
      title: course.title,
      color: course.color,
      stations,
      milestones,
    };
  });
}
