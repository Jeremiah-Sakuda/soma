import { preparedLessons } from './lessons';
import { withLessonMetadata } from './prediction';
import type { Source, WorkspaceState } from './types';

/** Original public synthetic semester. Dates in source text are simulated; retrieval/run times are actual. */
export function seedWorkspace(id: string, now: Date | string = new Date()): WorkspaceState {
  const date = new Date(now);
  const timestamp = date.toISOString();
  const courseSeeds = [
    [
      'circuits',
      'EE 201',
      'Circuit Foundations',
      'Dr. Rivera',
      '#baf265',
      'Exam 2',
      '2026-11-02T10:00:00-05:00',
    ],
    [
      'probability',
      'MATH 240',
      'Probability',
      'Dr. Chen',
      '#a3bffa',
      'Quiz',
      '2026-11-03T11:00:00-05:00',
    ],
    [
      'writing',
      'WRIT 210',
      'Scientific Writing',
      'Dr. Okafor',
      '#ffca95',
      'Draft due',
      '2026-10-29T17:00:00-04:00',
    ],
    [
      'programming',
      'CS 150',
      'Programming',
      'Prof. Patel',
      '#cfb4ff',
      'Exercise due',
      '2026-10-31T23:59:00-04:00',
    ],
    [
      'design',
      'DES 110',
      'Design Studio',
      'Prof. Kim',
      '#f6a9c0',
      'Critique',
      '2026-11-04T14:00:00-05:00',
    ],
  ];
  const sourceSeeds = [
    [
      'source-a',
      'circuits',
      'Assessment notice · synthetic',
      'Synthetic October 20 notice: Exam 2 is Monday, November 2 at 10 AM. Coverage: series circuits, parallel circuits, and capacitor transients. Bring a calculator.',
    ],
    [
      'source-d',
      'circuits',
      'Lecture 8 · original synthetic excerpt',
      'In a series path without branches, the same current passes through every component. For ideal resistors, voltage drop equals current times resistance. Resistors connected in parallel share both endpoint nodes, so their voltage differences are equal. Their branch currents depend on their resistances. A 12 V ideal source across parallel 6 Ω and 3 Ω resistors gives branch currents of 2 A and 4 A; the total current is 6 A.',
    ],
    [
      'source-e',
      'circuits',
      'Lecture transcript · original synthetic source',
      'When you justify a parallel-circuit answer, name the shared nodes. Saying “parallel means equal current” confuses the topology. Explain your reasoning as well as doing the arithmetic.',
    ],
    [
      'source-f',
      'circuits',
      'Returned Quiz 3 · synthetic student example',
      'Question: An ideal 12 V source is connected across two parallel resistors, 6 Ω and 3 Ω. Find the branch currents. Synthetic student response: “The currents are equal because the resistors are in parallel, so each gets 3 A.” Instructor feedback: “Same two nodes imply equal voltage, not equal current. Apply Ohm’s law separately to each branch.” This is an original development example, not an actual learner attempt.',
    ],
    [
      'source-g',
      'circuits',
      'Study task · synthetic read-only record',
      'Review Circuit Foundations Lecture 8. Planned date: October 29. Status: Not started. Available study time: 20 minutes.',
    ],
    [
      'source-calendar',
      '',
      'Selected calendar · synthetic empty baseline',
      'Original synthetic selected calendar: no confirmed event overlaps the declared October 28 16:00–16:45 America/New_York focus window. This is a demonstration baseline, not an actual calendar read.',
    ],
    [
      'source-probability',
      'probability',
      'Independent events · synthetic note',
      'For independent events A and B, P(A and B) = P(A) × P(B). Independence does not mean equal probabilities. The synthetic quiz is November 3 at 11 AM.',
    ],
    [
      'source-writing',
      'writing',
      'Draft guidance · original synthetic note',
      'The synthetic draft is due October 29 at 5 PM. Distinguish an observed association from an inferred causal explanation. An observational association does not by itself establish causation. Bound claims to the observed sample.',
    ],
    [
      'source-programming',
      'programming',
      'Indexing practice · original synthetic note',
      'The synthetic exercise is due October 31 at 11:59 PM. A zero-indexed array of length n has valid indices 0 through n - 1. Loop with i starting at 0 and i < n.',
    ],
    [
      'source-design',
      'design',
      'Critique preparation · original synthetic note',
      'The synthetic critique is November 4 at 2 PM. Record observable actions and words separately from interpretations of their causes. A diagnosis is a hypothesis, and one observation does not justify a universal claim.',
    ],
  ];
  const sources: Source[] = sourceSeeds.map(([sourceId, courseId, title, body]) => ({
    id: sourceId,
    ...(courseId ? { courseId } : {}),
    title,
    body,
    version: 1,
    kind: 'synthetic',
    retrievedAt: timestamp,
    status: 'current',
  }));
  return {
    id,
    mode: 'demo',
    createdAt: timestamp,
    expiresAt: new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    revision: 0,
    courses: courseSeeds.map(([courseId, code, title, instructor, color, nextEvent, deadline]) => ({
      id: courseId,
      code,
      title,
      instructor,
      color,
      nextEvent,
      deadline,
    })),
    timezone: 'America/New_York',
    demoClock: '2026-10-28T13:30:00.000Z',
    focusWindows: [
      {
        id: 'focus-oct28',
        startAt: '2026-10-28T16:00:00-04:00',
        endAt: '2026-10-28T16:45:00-04:00',
        timezone: 'America/New_York',
        declaredAt: timestamp,
      },
    ],
    calendarContext: {
      status: 'current',
      sourceRefs: [{ sourceId: 'source-calendar', version: 1 }],
      checkedAt: timestamp,
      mode: 'synthetic',
    },
    commitments: [],
    commitmentObservations: [],
    corrections: [],
    consequences: [],
    predictions: [],
    predictionStates: {},
    freshRequests: [],
    sources,
    lessons: preparedLessons(sources).map(withLessonMetadata),
    attempts: [],
    runs: [
      {
        id: 'run-seed',
        trigger: 'Prepared synthetic semester',
        mode: 'synthetic',
        status: 'completed',
        createdAt: timestamp,
        steps: [
          'Loaded original public synthetic sources.',
          'Selected authored prepared lesson specifications; no live inference or external collection occurred.',
        ],
        effect:
          'Six prepared lessons across five fictional courses. Circuit model is a development preview, pending independent scientific and instructional review.',
        sourceIds: sources.map((source) => source.id),
      },
    ],
    interpretations: [
      {
        id: 'interpretation-quiz',
        courseId: 'circuits',
        claim:
          'The fictional returned quiz suggests a possible confusion between equal voltage and equal current.',
        status: 'suspected',
        evidenceIds: ['source-f'],
        reason:
          'An older synthetic response is only a hypothesis. A new diagnostic may contradict it.',
        updatedAt: timestamp,
      },
    ],
    preferences: { sessionMinutes: 20, workedExamples: false },
    assistance: {},
    savedInputs: {},
    reviews: [],
  };
}

/** Private accounts start empty; original demo material never masquerades as imported user records. */
export function seedEmptyAccountWorkspace(
  id: string,
  now: Date | string = new Date(),
): WorkspaceState {
  const timestamp = new Date(now).toISOString();
  return {
    id,
    mode: 'account',
    createdAt: timestamp,
    expiresAt: new Date(new Date(now).getTime() + 24 * 60 * 60 * 1000).toISOString(),
    revision: 0,
    timezone: 'America/New_York',
    courses: [],
    sources: [],
    lessons: [],
    attempts: [],
    runs: [],
    interpretations: [],
    preferences: { sessionMinutes: 20, workedExamples: false },
    assistance: {},
    savedInputs: {},
    reviews: [],
    focusWindows: [],
    commitments: [],
    commitmentObservations: [],
    corrections: [],
    consequences: [],
    predictions: [],
    predictionStates: {},
    freshRequests: [],
    calendarContext: {
      status: 'missing',
      sourceRefs: [],
      checkedAt: timestamp,
      mode: 'manual-import',
    },
  };
}
