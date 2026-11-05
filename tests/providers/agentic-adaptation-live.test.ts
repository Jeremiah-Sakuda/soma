import { randomUUID } from 'node:crypto';
import { appendFileSync, chmodSync, mkdirSync } from 'node:fs';
import { describe, it } from 'vitest';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import { applyAction } from '../../src/lib/domain/learning';
import type { Lesson, WorkspaceState } from '../../src/lib/domain/types';
import {
  investigateWithSpark,
  publishInvestigation,
  type InvestigationRequest,
  type InvestigationResult,
} from '../../src/lib/server/investigator';
import { getServerFirestore } from '../../src/lib/server/firebase-config';
import {
  INVESTIGATION_RESERVATION_USD,
  MAX_INVESTIGATION_CALLS,
  budgetLimit,
} from '../../src/lib/server/budget';

const courseId = 'synthetic-ecology-adaptation';
const names = new Set([
  'list_sources',
  'read_source',
  'follow_reference',
  'evaluate_experiment',
  'prepare_diagnostic',
  'prepare_experiment_diagnostic',
  'revise_interpretation',
  'finish_investigation',
]);
function check(value: unknown, label: string): asserts value {
  if (!value) throw new Error(label);
}
function classify(detail: unknown) {
  if (typeof detail !== 'string') return 'unclassified';
  if (/invalid_type|required|"code"|"path"/.test(detail)) return 'tool-schema';
  if (/quote|disclosed|source.*version/i.test(detail)) return 'source-evidence';
  if (/hypothes|diagnostic|prediction|attempt/i.test(detail)) return 'diagnostic-evidence';
  if (/lesson|selected|activity|session/i.test(detail)) return 'activity-selection';
  return 'other-validation';
}
class HeadroomBlocked extends Error {}
const metricPath = '.local/agentic-adaptation-live-metrics.jsonl';
function metric(value: unknown) {
  mkdirSync('.local', { recursive: true, mode: 0o700 });
  appendFileSync(metricPath, '', { mode: 0o600 });
  chmodSync(metricPath, 0o600);
  appendFileSync(metricPath, JSON.stringify(value) + '\n', { mode: 0o600 });
}
function fixture(): WorkspaceState {
  const state = seedEmptyAccountWorkspace(`synthetic-adaptation-${randomUUID()}`);
  state.courses = [
    {
      id: courseId,
      code: 'SYN',
      title: 'Original synthetic ecology concepts',
      instructor: '',
      color: '#245683',
      nextEvent: '',
      deadline: '',
    },
  ];
  state.sources = [
    {
      id: 'ecology-teaching-note',
      courseId,
      title: 'Original synthetic course distinctions',
      version: 1,
      kind: 'synthetic',
      origin: 'synthetic',
      status: 'current',
      retrievedAt: state.createdAt,
      context: { role: 'teaching-material' },
      body: 'Original synthetic ecology teaching note. Acclimation is a change within an individual during its lifetime in response to conditions; observing it does not establish that the change is inherited. Evolutionary adaptation concerns inherited population traits across generations. Natural selection can change the frequencies of existing heritable variants when those variants affect survival or reproduction. A useful comparison asks whether the observation concerns the same individuals over a short period or inherited differences across generations. Claims about inheritance need evidence involving descendants, not just a visible change in the original individuals.',
    },
    {
      id: 'ecology-returned-work',
      courseId,
      title: 'Original synthetic returned explanation',
      version: 1,
      kind: 'synthetic',
      origin: 'synthetic',
      status: 'current',
      retrievedAt: state.createdAt,
      context: { role: 'returned-work' },
      body: 'Original simulated returned work, not an actual learner record. Prompt: A group of plants is moved into shade. Those same plants produce larger leaves during the following week. What does this observation establish? Simulated response: The plants adapted, so their inherited traits changed. Simulated instructor feedback: Separate the time scale and unit of change from the evidence needed to infer inheritance. This response alone does not establish which distinction the student finds difficult; more than one explanation is plausible.',
    },
  ];
  const alternative: Lesson = {
    id: 'ecology-evidence-comparison',
    courseId,
    title: 'Compare evidence across generations',
    description: 'Original authored synthetic ordinary practice, not a reviewed release case.',
    objective:
      'Identify evidence that can distinguish individual change from inherited population change.',
    reason:
      'A different available activity compares short-term observations with observations of descendants.',
    duration: 8,
    kind: 'practice',
    circuit: { topology: 'series', voltage: 1, r1: 1, r2: 1 },
    sourceIds: ['ecology-teaching-note'],
    sourceVersions: { 'ecology-teaching-note': 1 },
    modelVersion: 'synthetic-ecology-practice-v1-development',
    version: 1,
    state: 'ready',
    examEligible: false,
    mode: 'prepared',
    question:
      'Which observation provides additional evidence relevant to whether a plant trait is inherited?',
    options: [
      'The original plants change appearance during one week.',
      'Descendants raised under comparable conditions retain a consistent difference.',
      'The original leaves move in the wind.',
    ],
    answerIndex: 1,
    explanation:
      'Comparing descendants under comparable conditions is relevant to inheritance; a short-term change in the original individuals alone does not establish it.',
    hint: 'Identify which observations include descendants.',
    validation: {
      status: 'development-preview',
      modelVersion: 'synthetic-ecology-practice-v1-development',
    },
  };
  state.lessons = [alternative];
  return state;
}
async function stage(
  runId: string,
  number: 1 | 2,
  state: WorkspaceState,
  request: InvestigationRequest,
  answeredLessonId?: string,
): Promise<InvestigationResult> {
  const started = Date.now(),
    originalFetch = globalThis.fetch;
  let result: InvestigationResult | undefined,
    failure = '',
    calls = 0,
    headroom: number | null = null;
  const toolSequence: string[] = [],
    repairs = new Map<string, string>();
  let beforeReservations = new Set<string>(),
    charged: number | null = null,
    settlement = 'not-checked';
  const db = getServerFirestore();
  try {
    const cap = Number(process.env.META_APP_SPEND_CAP_USD || '1'),
      allocation = Number(process.env.META_ALLOCATION_USD);
    check(
      cap > 0 &&
        cap <= 1 &&
        process.env.SOMA_LIVE_INFERENCE === 'true' &&
        process.env.SOMA_PERSISTENCE === 'firestore' &&
        !process.env.FIRESTORE_EMULATOR_HOST,
      'unchanged managed application budget',
    );
    const [global, reservations] = await Promise.all([
      db.doc('somaBudget/global').get(),
      db.collection('somaBudgetReservations').where('workspaceId', '==', state.id).get(),
    ]);
    beforeReservations = new Set(reservations.docs.map((document) => document.id));
    headroom = budgetLimit(allocation, cap) - Number(global.data()?.consumed || 0);
    if (headroom < INVESTIGATION_RESERVATION_USD)
      throw new HeadroomBlocked('Insufficient application headroom for this stage.');
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url !== 'https://api.meta.ai/v1/responses') return originalFetch(input, init);
      calls++;
      check(calls <= MAX_INVESTIGATION_CALLS, 'call ceiling');
      if (typeof init?.body === 'string') {
        const body = JSON.parse(init.body) as {
          input?: { type?: string; output?: string; call_id?: string }[];
        };
        for (const item of body.input ?? [])
          if (item.type === 'function_call_output' && item.output && item.call_id) {
            const output = JSON.parse(item.output);
            if (output.accepted === false) repairs.set(item.call_id, classify(output.detail));
          }
      }
      const response = await originalFetch(input, init);
      if (response.ok) {
        const data = (await response.clone().json()) as {
          output?: { type?: string; name?: string }[];
        };
        for (const item of data.output ?? [])
          if (item.type === 'function_call')
            toolSequence.push(item.name && names.has(item.name) ? item.name : 'unknown-tool');
      }
      return response;
    }) as typeof fetch;
    result = await investigateWithSpark(state, request);
    return result;
  } catch (error) {
    failure =
      error instanceof HeadroomBlocked
        ? 'headroom-blocked'
        : classify((error as { run?: { effect?: string } }).run?.effect ?? '');
    throw error;
  } finally {
    globalThis.fetch = originalFetch;
    try {
      const reservations = await db
        .collection('somaBudgetReservations')
        .where('workspaceId', '==', state.id)
        .get();
      const current = reservations.docs.filter((document) => !beforeReservations.has(document.id));
      if (current.length === 1) {
        charged = typeof current[0].get('charged') === 'number' ? current[0].get('charged') : null;
        settlement = charged === null ? 'reservation-retained' : 'settled';
      } else settlement = current.length ? 'multiple-unexpected-reservations' : 'no-reservation';
    } catch {
      settlement = 'unavailable';
    }
    // Persist each actual result before any behavioral assertion, including a partial second-stage success.
    metric({
      evaluation: 'one-original-synthetic-adaptation-development-case',
      runId,
      stage: number,
      at: new Date().toISOString(),
      providerOutcome: result ? 'completed' : 'stopped',
      failure,
      decision: result?.decision.decision ?? null,
      selectedLessonId: result?.selectedLessonId ?? null,
      answeredLessonId: answeredLessonId ?? null,
      selectedActivityChanged: Boolean(
        answeredLessonId &&
        result?.selectedLessonId &&
        result.selectedLessonId !== answeredLessonId,
      ),
      newValidatedLesson: Boolean(result?.lesson && result.selectedLessonId === result.lesson.id),
      hypothesisRevisionCount: result?.record.hypothesisRevisions?.length ?? 0,
      calls,
      costUsd: result?.record.usage?.costUsd ?? null,
      settledChargeUsd: charged,
      settlement,
      elapsedMs: Date.now() - started,
      headroomBeforeUsd: headroom,
      tools: toolSequence,
      repairClasses: [...repairs.values()],
    });
  }
}
function verifyCitations(result: InvestigationResult, state: WorkspaceState) {
  check(
    result.record.sourceRefs.length > 0 && result.decision.reason.length >= 10,
    'next action needs source evidence and a reason',
  );
  for (const ref of result.record.sourceRefs) {
    const source = state.sources.find(
      (item) =>
        item.id === ref.sourceId &&
        item.version === ref.version &&
        item.courseId === courseId &&
        item.status === 'current',
    );
    check(
      source &&
        result.reads
          .get(ref.sourceId)
          ?.segments?.some(
            (segment) =>
              source.body.slice(segment.offset, segment.offset + segment.body.length) ===
                segment.body && segment.body.includes(ref.quote),
          ),
      'exact disclosed current citation',
    );
  }
}

describe.skipIf(process.env.SOMA_AGENTIC_ADAPTATION_LIVE_TEST !== 'true')(
  'single two-stage original synthetic adaptive activity case',
  () => {
    it(
      'distinguishes a hypothesis revision from actually selecting a different next activity',
      { timeout: 220_000, retry: 0 },
      async (context) => {
        const runId = randomUUID();
        let state = fixture(),
          currentStage = 'first investigation';
        let partialHypothesisRevision = false,
          nextActivityChanged = false,
          failure: unknown;
        try {
          const firstInput = JSON.stringify(state);
          const first = await stage(runId, 1, state, {
            courseId,
            initialSourceIds: ['ecology-teaching-note', 'ecology-returned-work'],
            goal: 'Investigate the ambiguous returned explanation. Before deciding what I should practice, offer an optional new question that can distinguish two plausible explanations of this response; avoid assuming a single misconception.',
          });
          currentStage = 'first diagnostic criteria';
          check(JSON.stringify(state) === firstInput, 'first input immutable');
          verifyCitations(first, state);
          check(
            first.record.engineVersion === 'source-diagnostic-investigation-v4' &&
              first.record.diagnosticPlan?.kind === 'text' &&
              first.record.diagnosticPlan.hypotheses.length === 2 &&
              first.lesson?.kind === 'practice' &&
              first.lesson.diagnosticInvestigationId === first.record.id &&
              first.selectedLessonId === first.lesson.id,
            'first stage must prepare a selected ordinary diagnostic',
          );
          const firstPublished = publishInvestigation(state, first);
          state = JSON.parse(JSON.stringify(firstPublished)) as WorkspaceState;
          check(
            JSON.stringify(state) === JSON.stringify(firstPublished) &&
              state.investigations?.some((item) => item.id === first.record.id),
            'first publication survives serialize/reload',
          );
          const diagnostic = first.record.diagnosticPlan,
            lesson = first.lesson;
          const firstHypothesisId = diagnostic.hypotheses[0].id;
          const contrary = diagnostic.predictions.find(
            (prediction) => prediction.hypothesisId !== firstHypothesisId,
          )!;
          check(
            contrary &&
              contrary.predictedOptionIndex !==
                diagnostic.predictions.find(
                  (prediction) => prediction.hypothesisId === firstHypothesisId,
                )!.predictedOptionIndex,
            'contrary diagnostic mapping',
          );
          currentStage = 'actual diagnostic response';
          state = applyAction(state, {
            type: 'attempt',
            lessonId: lesson.id,
            optionIndex: contrary.predictedOptionIndex,
          });
          const attempt = state.attempts.at(-1)!;
          check(
            attempt.correct === null &&
              !attempt.assisted &&
              attempt.novel &&
              attempt.exposure === 'fresh-no-diagram',
            'saved ungraded unsupported novel response',
          );
          const originalEvidence = JSON.stringify({
            attempts: state.attempts,
            originalInvestigation: state.investigations!.find(
              (item) => item.id === first.record.id,
            ),
            originalLesson: state.lessons.find((item) => item.id === lesson.id),
          });
          currentStage = 'second investigation';
          const second = await stage(
            runId,
            2,
            state,
            {
              courseId,
              previousInvestigationId: first.record.id,
              attemptId: attempt.id,
              goal: 'Use my saved response to reconsider the competing explanations and choose the next useful activity for this course. I have already answered the diagnostic; help me act on what that response suggests rather than repeat the same question.',
            },
            lesson.id,
          );
          currentStage = 'second-stage adaptation criteria';
          partialHypothesisRevision = Boolean(second.record.hypothesisRevisions?.length);
          nextActivityChanged = Boolean(
            second.selectedLessonId && second.selectedLessonId !== lesson.id,
          );
          check(
            JSON.stringify({
              attempts: state.attempts,
              originalInvestigation: state.investigations!.find(
                (item) => item.id === first.record.id,
              ),
              originalLesson: state.lessons.find((item) => item.id === lesson.id),
            }) === originalEvidence,
            'original observations remain immutable',
          );
          verifyCitations(second, state);
          check(
            second.record.supersedesId === first.record.id &&
              second.record.attemptIds?.includes(attempt.id),
            'traceable actual-response reconsideration',
          );
          check(
            second.record.hypothesisRevisions?.some(
              (revision) =>
                revision.hypothesisId === firstHypothesisId &&
                ['weakened', 'unresolved'].includes(revision.status),
            ),
            'contrary response revises the first hypothesis',
          );
          check(
            second.record.hypothesisRevisions?.every(
              (revision) =>
                revision.status === 'unresolved' ||
                (revision.hypothesisId === contrary.hypothesisId
                  ? revision.status === 'supported'
                  : revision.status === 'weakened'),
            ),
            'provisional statuses respect actual observations',
          );
          // Stronger acceptance criterion: changing a hypothesis alone is explicitly insufficient.
          check(
            second.decision.decision === 'revise-session' && nextActivityChanged,
            'stronger criterion: select a different next activity',
          );
          const selected =
            second.lesson?.id === second.selectedLessonId
              ? second.lesson
              : state.lessons.find(
                  (item) =>
                    item.id === second.selectedLessonId &&
                    item.courseId === courseId &&
                    item.state === 'ready',
                );
          check(
            selected &&
              selected.id !== lesson.id &&
              selected.question.normalize('NFKC').trim() !==
                lesson.question.normalize('NFKC').trim(),
            'new validated or different ready lesson without repeating the answered item',
          );
          const published = publishInvestigation(state, second);
          check(
            published.recommendedLessonId === selected.id &&
              JSON.stringify(published.attempts) === JSON.stringify(state.attempts) &&
              JSON.stringify({
                attempts: published.attempts,
                originalInvestigation: published.investigations!.find(
                  (item) => item.id === first.record.id,
                ),
                originalLesson: published.lessons.find((item) => item.id === lesson.id),
              }) === originalEvidence,
            'different next activity with original evidence preserved',
          );
          const reloaded = JSON.parse(JSON.stringify(published)) as WorkspaceState;
          check(
            JSON.stringify(reloaded) === JSON.stringify(published) &&
              reloaded.recommendedLessonId === selected.id &&
              reloaded.investigations?.some((item) => item.id === second.record.id),
            'second publication survives serialize/reload',
          );
          currentStage = 'complete';
        } catch (error) {
          failure = error;
        } finally {
          metric({
            evaluation: 'one-original-synthetic-adaptation-development-case',
            runId,
            type: 'acceptance',
            outcome: failure
              ? failure instanceof HeadroomBlocked
                ? 'blocked-headroom'
                : 'failed'
              : 'passed',
            stoppedAt: currentStage,
            partialHypothesisRevision,
            strongerNextActivityCriterion: nextActivityChanged && !failure,
            publication:
              'in-memory publication with JSON serialize/reload; not managed persistence',
            noAutomaticRetries: true,
          });
        }
        if (failure instanceof HeadroomBlocked)
          context.skip(
            'Insufficient headroom; no cap change or retry. Earlier stage metrics are preserved.',
          );
        if (failure)
          throw new Error(
            `Synthetic adaptation check stopped at ${currentStage}; partial hypothesis revision and stronger next-activity criteria are recorded separately in body-free metrics.`,
          );
      },
    );
  },
);
