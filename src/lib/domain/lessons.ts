import type { Lesson, Source } from './types';

export const MODEL_VERSION = 'ideal-dc-two-resistor-v1-development';
export const PREPARED_MODEL = 'prepared-original-fixture-v1';

export function sourceVersions(sources: Source[], ids: string[]): Record<string, number> {
  return Object.fromEntries(
    ids.map((id) => {
      const source = sources
        .filter((item) => item.id === id)
        .sort((a, b) => b.version - a.version)[0];
      if (!source || source.status !== 'current')
        throw new Error('Referenced source is unavailable or stale.');
      return [id, source.version];
    }),
  );
}

export function preparedLessons(sources: Source[]): Lesson[] {
  const base = {
    duration: 8,
    circuit: { topology: 'parallel' as const, voltage: 12, r1: 6, r2: 3 },
    modelVersion: PREPARED_MODEL,
    version: 1,
    state: 'ready' as const,
    examEligible: false,
    mode: 'prepared' as const,
  };
  const entries: Omit<Lesson, 'sourceVersions'>[] = [
    {
      ...base,
      id: 'parallel-nodes',
      courseId: 'circuits',
      kind: 'circuit',
      title: 'Same voltage. Different currents.',
      description: 'Explore why unequal parallel resistors carry different currents.',
      objective: 'Explain equal voltage using shared nodes, then apply Ohm’s law to each branch.',
      reason:
        'The synthetic returned quiz suggests a possible equal-current confusion. Explore first, then check if that hypothesis still fits.',
      sourceIds: ['source-d', 'source-e', 'source-f'],
      examEligible: true,
      question:
        'Two unequal ideal resistors connect between the same two nodes. What must be equal, and why?',
      options: [
        'Voltage: each resistor connects to the same two node potentials.',
        'Current: being parallel forces identical branch currents.',
        'Power: the source divides its power equally.',
      ],
      answerIndex: 0,
      explanation:
        'Both branches connect to the same two nodes, so both have the same potential difference. Current is V/R, so unequal resistances carry unequal currents.',
      hint: 'Compare the two endpoints of each resistor. Which potentials do they share?',
    },
    {
      ...base,
      id: 'series-contrast',
      courseId: 'circuits',
      kind: 'circuit',
      title: 'One path. One current.',
      description: 'Contrast one series path with parallel branches.',
      objective: 'Explain equal series current and unequal voltage drops.',
      circuit: { topology: 'series', voltage: 12, r1: 2, r2: 4 },
      sourceIds: ['source-d'],
      examEligible: true,
      reason: 'A prepared contrast helps separate series behavior from parallel behavior.',
      question:
        'A 12 V source drives 2 Ω and 4 Ω in series. Which answer describes the current and voltage drops?',
      options: [
        '3 A through each; 6 V across each.',
        '2 A through each; 4 V and 8 V respectively.',
        '2 A and 4 A respectively; 12 V across each.',
      ],
      answerIndex: 1,
      explanation:
        'The resistance is 6 Ω, giving 2 A in the single path. V = IR gives 4 V and 8 V; together they equal the 12 V source.',
      hint: 'Add the resistances first. Then use the same current for both voltage drops.',
    },
    {
      ...base,
      id: 'independent-events',
      courseId: 'probability',
      kind: 'practice',
      title: 'Independent does not mean equal',
      description: 'Choose the operation supported by independence.',
      objective: 'Multiply independent event probabilities.',
      sourceIds: ['source-probability'],
      reason: 'Original synthetic practice for the upcoming Probability quiz.',
      question: 'A and B are independent, with P(A) = 0.4 and P(B) = 0.5. What is P(A and B)?',
      options: [
        '0.9, by adding the probabilities.',
        '0.2, by multiplying the probabilities.',
        '0.4, because independence makes the probabilities equal.',
      ],
      answerIndex: 1,
      explanation: 'For independent events, P(A and B) = P(A) × P(B) = 0.4 × 0.5 = 0.2.',
      hint: 'The source gives a rule for “and” when events are independent.',
    },
    {
      ...base,
      id: 'writing-evidence',
      courseId: 'writing',
      kind: 'practice',
      title: 'Make the evidence do work',
      description: 'Connect a finding to a bounded claim.',
      objective: 'Distinguish observations from causal conclusions.',
      sourceIds: ['source-writing'],
      reason: 'The synthetic writing draft is the nearest deadline.',
      question: 'A small observational study finds an association. Which claim is supported?',
      options: [
        'The intervention caused the outcome for everyone.',
        'The variables were associated in this sample; causation remains unestablished.',
        'The study proves the mechanism.',
      ],
      answerIndex: 1,
      explanation:
        'An observational association supports a bounded association claim, not an untested causal mechanism.',
      hint: 'Separate what was observed from the explanation you might propose.',
    },
    {
      ...base,
      id: 'programming-boundaries',
      courseId: 'programming',
      kind: 'practice',
      title: 'Check the boundary',
      description: 'Reason about one-past-the-end indexing.',
      objective: 'Identify valid indices for a zero-indexed collection.',
      sourceIds: ['source-programming'],
      reason: 'Prepare for the synthetic programming exercise.',
      question:
        'An array has length 5 and starts at index 0. Which loop condition visits every valid index once?',
      options: ['i <= 5, starting from 0.', 'i < 5, starting from 0.', 'i < 4, starting from 0.'],
      answerIndex: 1,
      explanation:
        'Valid indices are 0 through 4. The condition i < 5 includes each and excludes index 5.',
      hint: 'List the first and last valid index before choosing a condition.',
    },
    {
      ...base,
      id: 'design-observation',
      courseId: 'design',
      kind: 'practice',
      title: 'Observation before interpretation',
      description: 'Prepare a useful critique note.',
      objective: 'Separate observable behavior from an inferred explanation.',
      sourceIds: ['source-design'],
      reason: 'A prepared prompt supports the upcoming synthetic design critique.',
      question: 'Which critique note is an observation rather than an interpretation?',
      options: [
        'The user is careless.',
        'The navigation is inherently confusing.',
        'The participant opened three menus before locating Export.',
      ],
      answerIndex: 2,
      explanation:
        'Opening three menus is observable behavior. Its cause remains a hypothesis to investigate.',
      hint: 'Choose the note another observer could directly verify.',
    },
  ];
  return entries.map((lesson) => ({
    ...lesson,
    modelVersion: lesson.kind === 'circuit' ? MODEL_VERSION : PREPARED_MODEL,
    sourceVersions: sourceVersions(sources, lesson.sourceIds),
  }));
}

export class AuthoredFollowupUnavailableError extends Error {
  constructor() {
    super(
      'No different authored question is available for this lesson. Request another source-grounded question.',
    );
  }
}

/** Authored deterministic follow-up. This is not live model generation or an unseen evaluation. */
export function followupLesson(parent: Lesson, ordinal: number, assisted: boolean): Lesson {
  // Course labels alone do not establish fit for an authored fixture. Live ordinary practice needs a new grounded model proposal.
  if (
    parent.kind === 'practice' &&
    (parent.mode !== 'prepared' ||
      parent.modelVersion !== PREPARED_MODEL ||
      !['probability', 'writing', 'programming', 'design'].includes(parent.courseId) ||
      !parent.sourceIds.includes(`source-${parent.courseId}`))
  )
    throw new AuthoredFollowupUnavailableError();
  const next = structuredClone(parent);
  delete next.generationKey;
  next.id = `${parent.id.split('-followup-')[0]}-followup-${ordinal}`;
  next.version = 1;
  next.mode = 'prepared';
  next.description =
    parent.kind === 'circuit'
      ? 'Authored parameterized practice for the ideal DC resistor model. Independent source-fit and scientific review remain pending.'
      : 'Authored development practice from the original synthetic course fixture.';
  next.validation = { status: 'development-preview', modelVersion: next.modelVersion };
  next.title = assisted ? 'Try a fresh application' : 'Take the idea further';
  next.reason = assisted
    ? 'Prior support is preserved. This different question offers another application; external help is unknown.'
    : 'A new response updates the working hypothesis. Try a different application, or keep exploring.';
  if (parent.kind === 'circuit') {
    const voltage = 6 + (ordinal % 18);
    const r1 = 2 + (ordinal % 17);
    const r2 = r1 * 2;
    next.circuit = { topology: parent.circuit.topology, voltage, r1, r2 };
    if (parent.circuit.topology === 'parallel') {
      next.question = `An ideal ${voltage} V source connects across parallel ${r1} Ω and ${r2} Ω resistors. Which branch carries more current, and why?`;
      next.options = [
        `The ${r1} Ω branch carries twice the current: both branches share ${voltage} V and I = V/R.`,
        'Both currents are equal because the resistors are parallel.',
        `The ${r2} Ω branch carries twice the current because it has twice the resistance.`,
      ];
      next.answerIndex = 0;
      next.explanation = `Both branches share the same node potentials. Dividing ${voltage} V by ${r1} Ω gives twice the current obtained by dividing by ${r2} Ω.`;
    } else {
      next.question = `An ideal ${voltage} V source drives ${r1} Ω and ${r2} Ω in one series path. Which resistor has the larger voltage drop?`;
      next.options = [
        'Both drops must be equal.',
        `The ${r2} Ω resistor: the shared current times twice the resistance gives twice the drop.`,
        `The ${r1} Ω resistor because lower resistance always means higher voltage.`,
      ];
      next.answerIndex = 1;
      next.explanation =
        'The single path carries one current. By V = IR, doubling resistance doubles the drop; the two drops sum to the source voltage.';
    }
  } else if (parent.courseId === 'probability') {
    const a = (1 + (ordinal % 8)) / 10;
    const b = (2 + (ordinal % 7)) / 10;
    next.question = `Independent events have probabilities ${a} and ${b}. What is the probability that both occur, and why?`;
    next.options = [
      `${Number((a * b).toFixed(2))}: multiply because the events are independent.`,
      `${Number((a + b).toFixed(2))}: add because they are independent.`,
      `${a}: independent events must have equal probabilities.`,
    ];
    next.answerIndex = 0;
    next.explanation = `Independence permits multiplication: ${a} × ${b} = ${Number((a * b).toFixed(2))}.`;
  } else {
    const cases: Record<string, [string, string[], number, string]> = {
      writing: [
        'A survey finds that students who study in groups report higher confidence. Which conclusion fits?',
        [
          'Group study is proven to cause confidence.',
          'In this survey, group study and confidence were associated; other explanations remain possible.',
          'Group study works for every student.',
        ],
        1,
        'A survey association does not establish causation or a universal effect.',
      ],
      programming: [
        'A zero-indexed list contains 8 items. What is the last valid index?',
        ['8', '9', '7'],
        2,
        'Indices begin at 0, so the last valid index is length minus one: 7.',
      ],
      design: [
        'A participant taps Save twice and then asks whether the document was saved. Which note stays closest to observation?',
        [
          'The participant tapped Save twice and asked about save status.',
          'The participant dislikes the product.',
          'All users will distrust saving.',
        ],
        0,
        'Record the actions and words before proposing explanations or generalizing.',
      ],
    };
    const item = cases[parent.courseId];
    if (item) [next.question, next.options, next.answerIndex, next.explanation] = item;
  }
  const normalize = (value: string) =>
    value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  if (normalize(next.question) === normalize(parent.question))
    throw new AuthoredFollowupUnavailableError();
  return next;
}

/** Unsaved renderer candidate. Source fit must still be established by the caller; this grants no exam eligibility. */
export function circuitCandidate(
  courseId: string,
  sources: Source[],
  topology: 'series' | 'parallel',
): Lesson {
  const current = sources
    .filter(
      (source) =>
        source.courseId === courseId &&
        source.status === 'current' &&
        !sources.some((newer) => newer.id === source.id && newer.version > source.version),
    )
    .slice(0, 4);
  if (!current.length)
    throw new Error('Current course sources are required before proposing a circuit lesson.');
  const parallel = topology === 'parallel';
  return {
    id: `candidate-${courseId}-${topology}`,
    courseId,
    title: parallel ? 'Shared nodes, separate currents' : 'One path, one current',
    description:
      'An authored ideal DC renderer candidate; source and instructional fit must be checked before use.',
    objective: parallel
      ? 'Explain equal voltage using shared nodes and apply Ohm’s law to each branch.'
      : 'Explain equal series current and how resistance sets each voltage drop.',
    reason:
      'Candidate selected for source-fit investigation; no assessment eligibility has been established.',
    duration: 8,
    kind: 'circuit',
    circuit: parallel
      ? { topology, voltage: 12, r1: 6, r2: 3 }
      : { topology, voltage: 12, r1: 2, r2: 4 },
    sourceIds: current.map((source) => source.id),
    sourceVersions: Object.fromEntries(current.map((source) => [source.id, source.version])),
    modelVersion: MODEL_VERSION,
    version: 1,
    state: 'ready',
    examEligible: false,
    mode: 'prepared',
    exposure: 'lab',
    validation: { status: 'development-preview', modelVersion: MODEL_VERSION },
    question: parallel
      ? 'What is equal across two unequal parallel resistors, and why?'
      : 'What is equal through two resistors in one series path, and why?',
    options: parallel
      ? [
          'Voltage, because both branches share the same two nodes.',
          'Current, because parallel resistors always divide current equally.',
          'Power, because the source shares power equally.',
        ]
      : [
          'Current, because charge follows one unbranched path.',
          'Voltage, because every series resistor has the same drop.',
          'Resistance, because the resistors share a loop.',
        ],
    answerIndex: 0,
    explanation: parallel
      ? 'Shared endpoints establish the same potential difference. Each branch current follows I = V/R.'
      : 'One series path carries the same current throughout. Each drop follows V = IR.',
    hint: parallel
      ? 'Compare each resistor’s endpoint potentials.'
      : 'Trace the single path before calculating.',
  };
}
