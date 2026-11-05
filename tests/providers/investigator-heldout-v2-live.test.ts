import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { describe, it } from 'vitest';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import type { Lesson, Source, WorkspaceState } from '../../src/lib/domain/types';
import {
  investigateWithSpark,
  publishInvestigation,
  type InvestigationRequest,
  type InvestigationResult,
} from '../../src/lib/server/investigator';
import { getServerFirestore } from '../../src/lib/server/firebase-config';
import {
  budgetLimit,
  INVESTIGATION_RESERVATION_USD,
  MAX_INVESTIGATION_CALLS,
} from '../../src/lib/server/budget';

// Fresh original evaluation cases, authored after engine v4 was frozen. These are
// not product examples or tuning data. One live attempt per stage; never refund
// provider charges, raise the application cap, or rerun a failed held-out stage.
const enabled = process.env.SOMA_LIVE_INVESTIGATION_V2_TEST === 'true';
const evaluationId = randomUUID();
const knownTools = new Set([
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
  if (!value) throw new Error(`Held-out v2 assertion: ${stage}.`);
}
function stateFor(courseId: string, title: string): WorkspaceState {
  const state = seedEmptyAccountWorkspace(`heldout-v2-${randomUUID()}`);
  state.courses = [
    {
      id: courseId,
      title,
      code: 'SYN',
      instructor: '',
      color: '#315779',
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
): Source {
  return {
    id,
    courseId: state.courses[0].id,
    title,
    body,
    context,
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
    description: 'Original synthetic held-out practice.',
    reason: 'Previously selected course activity.',
    duration: 8,
    kind: 'practice',
    circuit: { topology: 'series', voltage: 1, r1: 1, r2: 1 },
    sourceIds: [sourceId],
    sourceVersions: { [sourceId]: 1 },
    modelVersion: 'authored-heldout-v2',
    version: 1,
    state: 'ready',
    examEligible: false,
    mode: 'prepared',
    question: 'Which action serves the stated course objective?',
    options: [
      'Apply the cited course criterion.',
      'Ignore the course criterion.',
      'Assume every activity has the same purpose.',
    ],
    answerIndex: 0,
    explanation: 'The course criterion supports the selected action.',
    hint: 'Use the stated course criterion.',
  };
}
function classify(detail: unknown): string {
  if (typeof detail !== 'string') return 'unclassified';
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
async function evaluate(
  stage: string,
  state: WorkspaceState,
  request: InvestigationRequest,
  verify: (result: InvestigationResult) => void,
): Promise<InvestigationResult> {
  const started = Date.now(),
    original = JSON.stringify(state),
    originalFetch = globalThis.fetch;
  let calls = 0,
    result: InvestigationResult | undefined,
    effect = '',
    steps: string[] = [],
    outcome = 'failed',
    preflightConsumed: number | null = null;
  const validationClasses = new Map<string, string>();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === 'https://api.meta.ai/v1/responses') {
      calls++;
      check(calls <= MAX_INVESTIGATION_CALLS, 'actual call ceiling');
      if (typeof init?.body === 'string') {
        const body = JSON.parse(init.body) as {
          input?: { type?: string; call_id?: string; output?: string }[];
        };
        for (const item of body.input ?? [])
          if (item.type === 'function_call_output' && item.output) {
            const output: unknown = JSON.parse(item.output);
            if (
              output &&
              typeof output === 'object' &&
              'accepted' in output &&
              output.accepted === false
            )
              validationClasses.set(
                item.call_id ?? '',
                classify('detail' in output ? output.detail : undefined),
              );
          }
      }
    }
    return originalFetch(input, init);
  }) as typeof fetch;
  try {
    check(
      process.env.SOMA_PERSISTENCE === 'firestore' &&
        process.env.SOMA_LIVE_INFERENCE === 'true' &&
        Boolean(process.env.MODEL_API_KEY),
      'actual configured provider and persistence',
    );
    check(
      !process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_AUTH_EMULATOR_HOST,
      'no emulator fallback',
    );
    const cap = Number(process.env.META_APP_SPEND_CAP_USD || '1');
    check(cap > 0 && cap <= 1, 'unchanged maximum one-dollar cap');
    preflightConsumed = Number(
      (await getServerFirestore().doc('somaBudget/global').get()).data()?.consumed || 0,
    );
    if (
      preflightConsumed + INVESTIGATION_RESERVATION_USD >
      budgetLimit(Number(process.env.META_ALLOCATION_USD), cap)
    ) {
      outcome = 'budget-blocked';
      throw new Error('Held-out v2 assertion: insufficient existing budget; no request made.');
    }
    result = await investigateWithSpark(state, request);
    check(
      !result.reused && result.run.mode === 'live' && result.run.status === 'completed',
      'actual live completion',
    );
    check(
      calls >= 1 && calls <= MAX_INVESTIGATION_CALLS && result.record.usage?.calls === calls,
      'actual call accounting',
    );
    check(
      (result.record.usage?.costUsd ?? Infinity) <= INVESTIGATION_RESERVATION_USD,
      'cost within reservation',
    );
    check(JSON.stringify(state) === original, 'input remains immutable');
    check(
      result.record.workspaceId === state.id && result.record.courseId === request.courseId,
      'owned decision',
    );
    check(result.record.sourceRefs.length > 0, 'source-supported decision');
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
        'exact disclosed source version',
      );
    }
    const published = publishInvestigation(state, result);
    check(
      JSON.stringify(published.sources) === JSON.stringify(state.sources) &&
        JSON.stringify(published.attempts) === JSON.stringify(state.attempts),
      'observations unchanged at publication',
    );
    check(
      JSON.stringify(published.investigations?.slice(0, state.investigations?.length ?? 0)) ===
        JSON.stringify(state.investigations ?? []),
      'older investigations immutable',
    );
    check(
      published.investigations?.at(-1)?.id === result.record.id &&
        JSON.stringify(state) === original,
      'new decision appended',
    );
    verify(result);
    outcome = 'passed';
    return result;
  } catch (error) {
    const run = (error as { run?: { effect?: string; steps?: string[] } }).run;
    effect = run?.effect ?? '';
    steps = run?.steps ?? [];
    if (error instanceof Error && error.message.startsWith('Held-out v2 assertion:')) throw error;
    throw new Error(`Held-out v2 stage ${stage} did not complete; body-free result persisted.`);
  } finally {
    globalThis.fetch = originalFetch;
    const billing = steps
      .map((step) =>
        step.match(/(\d+) Meta calls; estimated token cost \$(\d+(?:\.\d+)?); (\d+) ms\./),
      )
      .find(Boolean);
    const metrics = {
      evaluation: 'heldout-investigation-v2',
      evaluationId,
      stage,
      outcome,
      calls,
      elapsedMs: Date.now() - started,
      preflightConsumedUsd: preflightConsumed,
      costUsd: result?.record.usage?.costUsd ?? (billing ? Number(billing[2]) : null),
      tools:
        result?.record.toolActivity
          ?.map((item) => item.tool)
          .filter((name) => knownTools.has(name)) ??
        steps.map((step) => step.split(':')[0]).filter((name) => knownTools.has(name)),
      failureCode: effect.match(/Investigation stopped safely \(([a-z_]+)\)/)?.[1] ?? null,
      failureClass: effect ? classify(effect) : null,
      usageCertain: result
        ? true
        : effect.includes('Reported usage reconciled.')
          ? true
          : effect.includes('Unknown usage')
            ? false
            : null,
      validationClasses: [...validationClasses.values()],
      rejectedTools: steps
        .filter((step) => step.includes('Rejected by application validation'))
        .map((step) => ({
          tool: knownTools.has(step.split(':')[0]) ? step.split(':')[0] : 'unknown',
          classification: classify(step),
        })),
    };
    mkdirSync('.local', { recursive: true, mode: 0o700 });
    appendFileSync('.local/investigator-heldout-v2-metrics.jsonl', JSON.stringify(metrics) + '\n', {
      mode: 0o600,
    });
    console.info(JSON.stringify(metrics));
  }
}

describe.skipIf(!enabled)('fresh independent frozen-v4 investigative evaluation', () => {
  it(
    'case E: declared replacement then a nonacademic update',
    { timeout: 215_000, retry: 0 },
    async () => {
      let state = stateFor('synthetic-workshop', 'Original synthetic writing workshop');
      const courseId = state.courses[0].id;
      state.sources = [
        source(
          state,
          'earlier-staff-plan',
          'Earlier staff workshop plan',
          'For the cedar workshop assessment, prepare by correcting sentence punctuation. The workshop assesses copy-editing decisions.',
          { role: 'instructor-update', assessmentId: 'cedar' },
        ),
        source(
          state,
          'replacement-staff-plan',
          'Replacement staff workshop plan',
          'The cedar workshop assessment now evaluates how evidence supports a claim. This replacement staff plan supersedes the earlier staff workshop plan. Prepare to distinguish a relevant supporting example from an unrelated example; punctuation editing belongs to later practice.',
          {
            role: 'instructor-update',
            assessmentId: 'cedar',
            supersedes: [{ sourceId: 'earlier-staff-plan', version: 1 }],
          },
        ),
      ];
      state.lessons = [
        practice(
          state,
          'copy-editing',
          'Correct sentence punctuation for the cedar workshop',
          'earlier-staff-plan',
        ),
        practice(
          state,
          'evidence-selection',
          'Distinguish relevant supporting evidence from an unrelated example',
          'replacement-staff-plan',
        ),
      ];
      state.recommendedLessonId = 'copy-editing';
      const first = await evaluate(
        'E1',
        state,
        {
          courseId,
          initialSourceIds: ['earlier-staff-plan', 'replacement-staff-plan'],
          goal: 'Check which staff guidance applies to the cedar workshop and whether my selected activity is still useful preparation.',
        },
        (result) => {
          check(
            result.decision.decision === 'revise-session' &&
              result.selectedLessonId === 'evidence-selection',
            'E1 supported replacement selected',
          );
          check(
            result.decision.assessmentId === 'cedar' &&
              result.decision.conflicts.some(
                (conflict) =>
                  conflict.resolution === 'explicit-supersession' &&
                  conflict.preferredSourceId === 'replacement-staff-plan' &&
                  conflict.sourceIds.includes('earlier-staff-plan'),
              ),
            'E1 declared authority preserved',
          );
          check(!result.lesson, 'E1 existing supported activity reused');
        },
      );
      state = publishInvestigation(state, first);
      state.sources.push(
        source(
          state,
          'room-notice',
          'Workshop room notice',
          'The cedar workshop meets in the upstairs classroom. Its learning objective remains choosing relevant evidence for a claim, as specified by the replacement staff workshop plan. This room notice does not change the academic preparation.',
          { role: 'instructor-update', assessmentId: 'cedar' },
        ),
      );
      state.revision++;
      await evaluate(
        'E2',
        state,
        {
          courseId,
          initialSourceIds: ['room-notice'],
          goal: 'Check the newly received room notice for the cedar workshop and decide whether the next activity needs to change again.',
        },
        (result) => {
          check(
            result.decision.decision === 'keep-current' &&
              !result.lesson &&
              !result.selectedLessonId,
            'E2 no-effect update retained',
          );
          check(
            publishInvestigation(state, result).recommendedLessonId === 'evidence-selection',
            'E2 useful activity retained',
          );
        },
      );
    },
  );

  it(
    'case F: competing literary interpretations and a contrary observation',
    { timeout: 215_000, retry: 0 },
    async () => {
      let state = stateFor('synthetic-narrative', 'Original synthetic narrative workshop');
      const courseId = state.courses[0].id;
      state.sources = [
        source(
          state,
          'narrative-principles',
          'Viewpoint and trustworthiness',
          'First-person narration identifies a speaker within the story. It does not by itself determine whether the account is trustworthy. Reliability is evaluated using evidence such as contradictions between the narrator and events. A first-person account can be consistent, and a third-person account can contain misleading judgments.',
          { role: 'teaching-material' },
        ),
      ];
      const first = await evaluate(
        'F1',
        state,
        {
          courseId,
          initialSourceIds: ['narrative-principles'],
          goal: 'I said a passage must be unreliable because its narrator says I. Investigate plausible explanations for that response and offer an optional fresh interaction that could distinguish them.',
        },
        (result) => {
          check(
            result.decision.decision === 'revise-session' &&
              result.record.diagnosticPlan?.kind === 'text' &&
              result.lesson?.kind === 'practice',
            'F1 optional text diagnostic',
          );
          check(
            result.record.diagnosticPlan.hypotheses.length === 2 &&
              result.record.diagnosticPlan.hypotheses.every((item) => item.status === 'plausible'),
            'F1 revisable hypotheses',
          );
          check(!result.lesson.examEligible, 'F1 no invented assessment applicability');
        },
      );
      state = publishInvestigation(state, first);
      const plan = first.record.diagnosticPlan!,
        lesson = first.lesson!,
        challengedId = plan.hypotheses[0].id;
      const alternative = plan.predictions.find((item) => item.hypothesisId !== challengedId)!;
      const attemptId = `original-response-${randomUUID()}`;
      state.attempts.push({
        id: attemptId,
        lessonId: lesson.id,
        lessonVersion: lesson.version,
        modelVersion: lesson.modelVersion,
        question: lesson.question,
        response: lesson.options[alternative.predictedOptionIndex],
        correct: null,
        assisted: false,
        assistance: [],
        novel: true,
        exposure: 'fresh-no-diagram',
        sourceVersions: structuredClone(lesson.sourceVersions),
        createdAt: new Date().toISOString(),
        feedback: 'Original synthetic ungraded observation for independent evaluation.',
      });
      state.revision++;
      await evaluate(
        'F2',
        state,
        {
          courseId,
          previousInvestigationId: first.record.id,
          attemptId,
          goal: 'Reconsider both provisional explanations using the saved response. Choose a supported next interaction while retaining uncertainty where the observation is insufficient.',
        },
        (result) => {
          check(
            result.record.supersedesId === first.record.id &&
              result.record.attemptIds?.includes(attemptId),
            'F2 original evidence linked',
          );
          check(
            result.record.hypothesisRevisions?.some(
              (item) =>
                item.hypothesisId === challengedId &&
                ['weakened', 'unresolved'].includes(item.status),
            ),
            'F2 contrary observation respected',
          );
          check(
            result.record.hypothesisRevisions?.every(
              (item) =>
                item.status === 'unresolved' ||
                (item.hypothesisId === alternative.hypothesisId
                  ? item.status === 'supported'
                  : item.status === 'weakened'),
            ),
            'F2 actual prediction constraint respected',
          );
          check(
            state.attempts.at(-1)?.correct === null && !state.attempts.at(-1)?.assisted,
            'F2 original ungraded observation preserved',
          );
        },
      );
    },
  );
});
