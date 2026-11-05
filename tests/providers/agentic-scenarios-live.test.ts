import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { describe, it, type TestContext } from 'vitest';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import type { Lesson, Source, WorkspaceState } from '../../src/lib/domain/types';
import { recheckDiagnosticExperimentInput } from '../../src/lib/domain/diagnostics';
import {
  investigateWithSpark,
  publishInvestigation,
  type InvestigationRequest,
  type InvestigationResult,
} from '../../src/lib/server/investigator';
import {
  budgetLimit,
  INVESTIGATION_RESERVATION_USD,
  MAX_INVESTIGATION_CALLS,
} from '../../src/lib/server/budget';
import { getServerFirestore } from '../../src/lib/server/firebase-config';
import { META_ENDPOINT } from '../../src/lib/server/meta-client';

// Original synthetic scenarios, independent of prior development/evaluation cases.
// Actual provider choices are never stubbed or scripted. Only explicitly gated,
// coordinated runs may spend; each stage checks the existing global reservation
// headroom. The user authorized a $2 total cap; never exceed it or change provider
// configuration here, and never rerun failures for tuning.
const enabled = process.env.SOMA_LIVE_AGENTIC_SCENARIOS_TEST === 'true';
const evaluationId = randomUUID();
const tools = new Set([
  'list_sources',
  'read_source',
  'follow_reference',
  'evaluate_experiment',
  'prepare_diagnostic',
  'prepare_experiment_diagnostic',
  'revise_interpretation',
  'finish_investigation',
]);
function check(value: unknown, stage: string): asserts value {
  if (!value) throw new Error(`Agentic scenario assertion: ${stage}.`);
}
function report(value: Record<string, unknown>) {
  const entry = { evaluation: 'agentic-scenarios-v1', evaluationId, ...value };
  mkdirSync('.local', { recursive: true, mode: 0o700 });
  appendFileSync('.local/agentic-scenarios-live.jsonl', JSON.stringify(entry) + '\n', {
    mode: 0o600,
  });
  console.info(JSON.stringify(entry));
}
function workspace(courseId: string): WorkspaceState {
  const state = seedEmptyAccountWorkspace(`agentic-synthetic-${randomUUID()}`);
  state.courses = [
    {
      id: courseId,
      code: 'SYN',
      title: 'Original synthetic course',
      instructor: '',
      color: '#345678',
      deadline: '',
      nextEvent: '',
    },
  ];
  return state;
}
function source(
  state: WorkspaceState,
  id: string,
  title: string,
  body: string,
  context: NonNullable<Source['context']>,
  url?: string,
): Source {
  return {
    id,
    courseId: state.courses[0].id,
    title,
    body,
    context,
    ...(url ? { url } : {}),
    version: 1,
    kind: 'synthetic',
    origin: 'synthetic',
    status: 'current',
    retrievedAt: state.createdAt,
  };
}
function practice(state: WorkspaceState, id: string, objective: string, sourceId: string): Lesson {
  return {
    id,
    courseId: state.courses[0].id,
    title: objective,
    objective,
    description: 'Original synthetic practice.',
    reason: 'Previously selected from course guidance.',
    duration: 8,
    kind: 'practice',
    circuit: { topology: 'series', voltage: 1, r1: 1, r2: 1 },
    sourceIds: [sourceId],
    sourceVersions: { [sourceId]: 1 },
    modelVersion: 'authored-scenario-v1',
    version: 1,
    state: 'ready',
    examEligible: false,
    mode: 'prepared',
    question: 'Which choice follows the stated course objective?',
    options: [
      'Use the stated criterion.',
      'Ignore the stated criterion.',
      'Assume every criterion is interchangeable.',
    ],
    answerIndex: 0,
    explanation: 'The stated criterion supports this choice.',
    hint: 'Review the source criterion.',
  };
}
/** Authored prepared baseline only: no previous live decision, response, or run. */
function authorityFixture(): WorkspaceState {
  const state = workspace('synthetic-visual-communication');
  const correctionUrl = 'https://scenario.example.invalid/birch-correction';
  state.sources = [
    source(
      state,
      'a-reading-note',
      'Workshop reading note',
      `The birch assessment has an official scope correction. Read its registered reference before selecting preparation: ${correctionUrl}`,
      { role: 'teaching-material', assessmentId: 'birch' },
    ),
    source(
      state,
      'b-outline',
      'First workshop outline',
      'The birch assessment asks students to make text edges align consistently. Prepare by comparing alignment choices; visual hierarchy belongs to a later workshop.',
      { role: 'syllabus', assessmentId: 'birch' },
    ),
    ...Array.from({ length: 6 }, (_, index) =>
      source(
        state,
        `m-reference-${index}`,
        `General reference ${index}`,
        'This original synthetic reference concerns shared studio supplies rather than the assessment scope.',
        { role: 'teaching-material' },
      ),
    ),
    source(
      state,
      'z-official-correction',
      'Birch scope correction',
      'This correction replaces the First workshop outline for the birch assessment. Prepare to identify a clear reading order using visual hierarchy. Alignment remains background preparation.',
      { role: 'instructor-update', assessmentId: 'birch' },
      correctionUrl,
    ),
  ];
  state.lessons = [
    practice(state, 'practice-prior', 'Compare text-edge alignment choices', 'b-outline'),
    practice(
      state,
      'practice-revised',
      'Identify a clear reading order through visual hierarchy',
      'z-official-correction',
    ),
  ];
  state.recommendedLessonId = 'practice-prior';
  return state;
}
function classify(detail: unknown): string {
  if (typeof detail !== 'string') return 'unclassified';
  if (detail.includes('Cite each source once.')) return 'duplicate-source-citation';
  if (/request_limit/.test(detail)) return 'request-limit';
  if (/"code"[\s\S]*"path"/.test(detail)) return 'tool-argument-schema';
  if (/quote|disclosed|read source/i.test(detail)) return 'source-evidence';
  if (/authority|supersed|conflict|assessment/i.test(detail)) return 'source-authority';
  if (/prediction|hypothes|diagnostic|experiment/i.test(detail)) return 'diagnostic-contract';
  if (/selected|session|activity|lesson/i.test(detail)) return 'activity-selection';
  if (/call limit/i.test(detail)) return 'call-limit';
  if (/time limit|timeout|deadline/i.test(detail)) return 'deadline';
  return 'unclassified';
}
type Trial = { informative: boolean; baselineZeroVoltage: boolean; changedZeroVoltage: boolean };
type Trace = { experiments: Map<string, Trial>; behavioralOutcome?: string };
async function evaluate(
  context: TestContext,
  stage: string,
  state: WorkspaceState,
  request: InvestigationRequest,
  verify: (result: InvestigationResult, trace: Trace) => void,
): Promise<InvestigationResult> {
  check(
    process.env.SOMA_PERSISTENCE === 'firestore' &&
      process.env.SOMA_LIVE_INFERENCE === 'true' &&
      Boolean(process.env.MODEL_API_KEY),
    'actual configured provider',
  );
  check(
    !process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_AUTH_EMULATOR_HOST,
    'no emulator fallback',
  );
  const cap = Number(process.env.META_APP_SPEND_CAP_USD || '1');
  check(cap > 0 && cap <= 2, 'user-authorized maximum two-dollar total cap');
  const consumed = Number(
    (await getServerFirestore().doc('somaBudget/global').get()).data()?.consumed || 0,
  );
  if (
    consumed + INVESTIGATION_RESERVATION_USD >
    budgetLimit(Number(process.env.META_ALLOCATION_USD), cap)
  ) {
    report({
      stage,
      outcome: 'budget-blocked',
      calls: 0,
      costUsd: 0,
      preflightConsumedUsd: consumed,
      configuredCapUsd: cap,
      baseline: 'authored-prepared-synthetic',
      priorInvestigationCount: state.investigations?.length ?? 0,
    });
    context.skip(
      'Existing global budget cannot reserve the next investigation; no inference attempted.',
    );
  }
  const original = JSON.stringify(state),
    started = Date.now(),
    originalFetch = globalThis.fetch;
  let calls = 0,
    result: InvestigationResult | undefined,
    effect = '',
    steps: string[] = [],
    outcome = 'failed',
    publishedRecommendation: string | null = null;
  const validations = new Map<string, { tool: string; classification: string }>(),
    trace: Trace = { experiments: new Map() };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === META_ENDPOINT) {
      calls++;
      check(calls <= MAX_INVESTIGATION_CALLS, 'actual call ceiling');
      if (typeof init?.body === 'string') {
        const body = JSON.parse(init.body) as {
          input?: { type?: string; name?: string; call_id?: string; output?: string }[];
        };
        for (const item of body.input ?? [])
          if (item.type === 'function_call_output' && item.output) {
            const value = JSON.parse(item.output) as Record<string, unknown> | null;
            if (!value || typeof value !== 'object') continue;
            const name =
              body.input?.find(
                (call) => call.type === 'function_call' && call.call_id === item.call_id,
              )?.name ?? 'unknown';
            if (value.accepted === false)
              validations.set(item.call_id ?? '', {
                tool: tools.has(name) ? name : 'unknown',
                classification: classify(value.detail),
              });
            if (
              name === 'evaluate_experiment' &&
              typeof value.id === 'string' &&
              typeof value.informative === 'boolean'
            ) {
              const input = value.input as { baseline?: { voltage?: number } } | undefined;
              const changed = value.changed as { voltage?: number } | undefined;
              trace.experiments.set(value.id, {
                informative: value.informative,
                baselineZeroVoltage: input?.baseline?.voltage === 0,
                changedZeroVoltage: changed?.voltage === 0,
              });
            }
          }
      }
    }
    return originalFetch(input, init);
  }) as typeof fetch;
  try {
    result = await investigateWithSpark(state, request);
    check(
      !result.reused && result.run.mode === 'live' && result.run.status === 'completed',
      'actual live completion',
    );
    check(
      calls > 0 && calls <= MAX_INVESTIGATION_CALLS && result.record.usage?.calls === calls,
      'actual call accounting',
    );
    check(
      (result.record.usage?.costUsd ?? Infinity) <= INVESTIGATION_RESERVATION_USD,
      'bounded cost',
    );
    check(JSON.stringify(state) === original, 'original state immutable');
    check(
      result.record.workspaceId === state.id && result.record.courseId === request.courseId,
      'owned decision',
    );
    for (const ref of result.record.sourceRefs) {
      const observed = state.sources.find(
        (item) =>
          item.id === ref.sourceId &&
          item.version === ref.version &&
          item.courseId === request.courseId &&
          item.status === 'current',
      );
      const read = result.reads.get(ref.sourceId);
      check(
        observed &&
          read?.version === ref.version &&
          (read.segments ?? []).some(
            (segment) =>
              segment.body.includes(ref.quote) &&
              observed.body.slice(segment.offset, segment.offset + segment.body.length) ===
                segment.body,
          ),
        'exact current disclosed citation',
      );
    }
    const published = publishInvestigation(state, result);
    publishedRecommendation = published.recommendedLessonId ?? null;
    check(
      JSON.stringify(published.sources) === JSON.stringify(state.sources) &&
        JSON.stringify(published.attempts) === JSON.stringify(state.attempts),
      'observations unchanged',
    );
    check(
      JSON.stringify(published.investigations?.slice(0, state.investigations?.length ?? 0)) ===
        JSON.stringify(state.investigations ?? []),
      'prior decisions unchanged',
    );
    check(
      published.investigations?.at(-1)?.id === result.record.id &&
        JSON.stringify(state) === original,
      'new immutable decision appended',
    );
    verify(result, trace);
    outcome = 'passed';
    return result;
  } catch (error) {
    const run = (error as { run?: { effect?: string; steps?: string[] } }).run;
    effect = run?.effect ?? '';
    steps = run?.steps ?? [];
    if (error instanceof Error && error.message.startsWith('Agentic scenario assertion:'))
      throw error;
    throw new Error(`Agentic scenario ${stage} did not complete; body-free metrics persisted.`);
  } finally {
    globalThis.fetch = originalFetch;
    const billing = steps
      .map((step) =>
        step.match(/(\d+) Meta calls; estimated token cost \$(\d+(?:\.\d+)?); (\d+) ms\./),
      )
      .find(Boolean);
    report({
      stage,
      outcome,
      calls,
      elapsedMs: Date.now() - started,
      preflightConsumedUsd: consumed,
      configuredCapUsd: cap,
      baseline: 'authored-prepared-synthetic',
      priorInvestigationCount: state.investigations?.length ?? 0,
      costUsd: result?.record.usage?.costUsd ?? (billing ? Number(billing[2]) : null),
      engineVersion: result?.record.engineVersion ?? null,
      runtimeModel: result?.record.runtimeModel ?? null,
      decision: result?.decision.decision ?? null,
      selectedLessonId: result?.selectedLessonId ?? null,
      previousRecommendation: state.recommendedLessonId ?? null,
      publishedRecommendation,
      newLessonId: result?.lesson?.id ?? null,
      diagnosticKind: result?.record.diagnosticPlan?.kind ?? null,
      hypothesisRevisions:
        result?.record.hypothesisRevisions?.map((item) => ({
          hypothesisId: item.hypothesisId,
          status: item.status,
        })) ?? [],
      tools:
        result?.record.toolActivity?.map((item) => item.tool).filter((name) => tools.has(name)) ??
        steps.map((step) => step.split(':')[0]).filter((name) => tools.has(name)),
      failureCode: effect.match(/Investigation stopped safely \(([a-z_]+)\)/)?.[1] ?? null,
      failureClass: effect ? classify(effect) : null,
      usageCertain: result
        ? true
        : effect.includes('Reported usage reconciled.')
          ? true
          : effect.includes('Unknown usage')
            ? false
            : null,
      validations: [...validations.values()],
      experiments: [...trace.experiments.values()],
      behavioralOutcome: trace.behavioralOutcome ?? null,
    });
  }
}

describe.skipIf(!enabled)('independent live agentic scenarios', () => {
  it(
    'source authority follows a registered correction and reuses unchanged work',
    { timeout: 115_000, retry: 0 },
    async (context) => {
      const state = authorityFixture(),
        courseId = state.courses[0].id;
      const request = {
        courseId,
        initialSourceIds: ['a-reading-note', 'b-outline'],
        goal: 'Investigate the reading note and its official reference, then decide which available activity fits the birch assessment.',
      };
      const result = await evaluate(context, 'source-authority', state, request, (value) => {
        check(
          value.decision.decision === 'revise-session' &&
            value.selectedLessonId === 'practice-revised',
          'supported activity replaces prior recommendation',
        );
        check(
          value.record.toolActivity?.some((item) => item.tool === 'follow_reference'),
          'actual registered reference followed',
        );
        check(
          value.decision.conflicts.some(
            (item) =>
              item.resolution === 'explicit-supersession' &&
              item.preferredSourceId === 'z-official-correction' &&
              item.sourceIds.includes('b-outline'),
          ),
          'authority conflict explicitly resolved',
        );
        check(!value.lesson, 'existing validated activity reused');
      });
      const authorityState = publishInvestigation(state, result);
      const reservationsBefore = await getServerFirestore()
        .collection('somaBudgetReservations')
        .where('workspaceId', '==', state.id)
        .get();
      const originalFetch = globalThis.fetch,
        before = JSON.stringify(authorityState);
      let cacheCalls = 0;
      globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
        const input = args[0];
        if ((input instanceof Request ? input.url : String(input)) === META_ENDPOINT) cacheCalls++;
        return originalFetch(...args);
      }) as typeof fetch;
      try {
        const cached = await investigateWithSpark(authorityState, request);
        const reservationsAfter = await getServerFirestore()
          .collection('somaBudgetReservations')
          .where('workspaceId', '==', state.id)
          .get();
        check(
          cached.reused &&
            cached.record.id === result.record.id &&
            cacheCalls === 0 &&
            cached.run.status === 'unchanged',
          'unchanged request makes no provider call',
        );
        check(
          reservationsBefore.size === reservationsAfter.size,
          'unchanged request creates no budget reservation',
        );
        check(
          JSON.stringify(authorityState) === before &&
            publishInvestigation(authorityState, cached) === authorityState,
          'cached result does not duplicate observations',
        );
        report({
          stage: 'source-cache',
          outcome: 'passed',
          calls: cacheCalls,
          costUsd: 0,
          additionalReservations: reservationsAfter.size - reservationsBefore.size,
          decision: cached.decision.decision,
          selectedLessonId: cached.selectedLessonId ?? null,
          reused: true,
        });
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );

  it(
    'source no-effect follow-up retains useful preparation when budget permits',
    { timeout: 115_000, retry: 0 },
    async (context) => {
      const state = authorityFixture(),
        courseId = state.courses[0].id;
      state.recommendedLessonId = 'practice-revised';
      check(
        !state.investigations?.length &&
          !state.runs.length &&
          state.lessons.every((lesson) => lesson.mode === 'prepared'),
        'authored prepared baseline has no fabricated live history',
      );
      state.sources.push(
        source(
          state,
          'later-logistics',
          'Studio materials notice',
          'For the birch assessment, bring a blank sheet to the studio. The preparation objective remains visual hierarchy and reading order from the official scope correction. Bringing a sheet changes supplies, not the learning objective.',
          { role: 'instructor-update', assessmentId: 'birch' },
        ),
      );
      state.revision++;
      await evaluate(
        context,
        'source-no-effect',
        state,
        {
          courseId,
          initialSourceIds: ['later-logistics'],
          goal: 'Check the new studio materials notice and decide whether my next preparation activity needs to change.',
        },
        (result) => {
          check(
            result.decision.decision === 'keep-current' &&
              !result.lesson &&
              !result.selectedLessonId,
            'no academic change requires no replacement',
          );
          check(
            publishInvestigation(state, result).recommendedLessonId === 'practice-revised',
            'current useful recommendation retained',
          );
        },
      );
    },
  );

  it(
    'uninformative zero-voltage proposal is repaired or safely avoided',
    { timeout: 115_000, retry: 0 },
    async (context) => {
      const state = workspace('synthetic-resistor-lab'),
        courseId = state.courses[0].id;
      state.sources = [
        source(
          state,
          'model-source',
          'Original ideal resistor lab note',
          'Ideal resistors in parallel share both endpoint nodes and therefore the same voltage. Each branch current equals its voltage divided by its resistance. At zero source voltage, both branch currents are zero for every positive resistance. Changing one branch resistance at zero voltage cannot distinguish an equal-current claim from the shared-voltage relationship.',
          { role: 'teaching-material' },
        ),
      ];
      await evaluate(
        context,
        'zero-voltage-proposal',
        state,
        {
          courseId,
          initialSourceIds: ['model-source'],
          goal: 'I proposed parallel resistors 4 and 8 ohms at 0 V, changing the 8-ohm branch to 16 ohms, to test whether parallel branches always carry equal current. Investigate whether this check distinguishes explanations, then choose a useful optional diagnostic or retain uncertainty.',
        },
        (result, trace) => {
          const trials = [...trace.experiments.values()];
          const uninformativeIndex = trials.findIndex(
            (trial) => !trial.informative && trial.baselineZeroVoltage && trial.changedZeroVoltage,
          );
          trace.behavioralOutcome =
            result.record.diagnosticPlan?.kind === 'circuit-experiment'
              ? uninformativeIndex >= 0 &&
                trials.slice(uninformativeIndex + 1).some((trial) => trial.informative)
                ? 'repaired-after-uninformative-feedback'
                : 'avoided-uninformative-proposal-before-publication'
              : result.record.diagnosticPlan?.kind === 'text'
                ? uninformativeIndex >= 0
                  ? 'changed-to-text-after-uninformative-feedback'
                  : 'avoided-proposal-with-text-alternative'
                : 'retained-uncertainty-without-publishing-experiment';
          check(!result.lesson?.examEligible, 'no invented assessment applicability');
          if (result.record.diagnosticPlan?.kind === 'circuit-experiment') {
            check(
              result.lesson?.diagnosticExperiment && result.record.diagnosticPlan.experimentRunId,
              'actual renderer retains evaluated experiment',
            );
            const independent = recheckDiagnosticExperimentInput(
              result.lesson.diagnosticExperiment.input,
            );
            check(
              independent.informative,
              'published circuit independently distinguishes predictions',
            );
            check(
              !trace.experiments.get(result.record.diagnosticPlan.experimentRunId)
                ?.baselineZeroVoltage ||
                !trace.experiments.get(result.record.diagnosticPlan.experimentRunId)
                  ?.changedZeroVoltage,
              'unpowered proposal is never published as informative',
            );
            check(
              trace.experiments.get(result.record.diagnosticPlan.experimentRunId)?.informative,
              'published experiment was actually evaluated',
            );
          } else if (result.record.diagnosticPlan?.kind === 'text') {
            check(result.lesson?.kind === 'practice', 'safe text alternative rendered');
          } else {
            check(
              result.decision.decision === 'needs-evidence' &&
                !result.lesson &&
                !result.selectedLessonId,
              'uncertain alternative publishes no false diagnostic',
            );
          }
        },
      );
    },
  );
});
