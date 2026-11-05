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
import {
  INVESTIGATION_RESERVATION_USD,
  MAX_INVESTIGATION_CALLS,
} from '../../src/lib/server/budget';

// Held-out original synthetic evaluation. Not product examples or prompt tuning data.
// One attempt per case after the orchestrator prompt was declared frozen. No private accounts.
// Real provider charges remain in the normal budget ledger; never delete or refund them here.
function check(value: unknown, stage: string): asserts value {
  if (!value) throw new Error(`Held-out investigation check failed: ${stage}.`);
}
const courseId = 'heldout-methods';
function workspace(): WorkspaceState {
  const state = seedEmptyAccountWorkspace(`heldout-investigation-${randomUUID()}`);
  state.courses = [
    {
      id: courseId,
      code: 'SYN',
      title: 'Original synthetic methods course',
      instructor: '',
      color: '#245683',
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
  context?: Source['context'],
  url?: string,
): Source {
  return {
    id,
    courseId,
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
function activity(id: string, objective: string, sourceId: string): Lesson {
  return {
    id,
    courseId,
    title: objective,
    objective,
    description: 'Original synthetic held-out activity.',
    reason: 'Previously selected from original synthetic course material.',
    duration: 8,
    kind: 'practice',
    circuit: { topology: 'series', voltage: 1, r1: 1, r2: 1 },
    sourceIds: [sourceId],
    sourceVersions: { [sourceId]: 1 },
    modelVersion: 'heldout-authored-v1',
    version: 1,
    state: 'ready',
    examEligible: false,
    mode: 'prepared',
    question: 'Which statement matches the cited methods principle?',
    options: [
      'Use the stated procedure.',
      'Ignore the stated procedure.',
      'Assume every procedure is identical.',
    ],
    answerIndex: 0,
    explanation: 'The stated course procedure determines the supported interpretation.',
    hint: 'Consult the original course passage.',
  };
}
const toolNames = new Set([
  'list_sources',
  'read_source',
  'follow_reference',
  'evaluate_experiment',
  'prepare_diagnostic',
  'revise_interpretation',
  'finish_investigation',
]);
// Added after the original one-pass evaluation: preserve classifications for future
// independent cases without saving provider arguments, source text, or reasoning.
function validationClass(detail: unknown): string {
  if (typeof detail !== 'string') return 'unclassified-validation';
  if (detail.includes('"code"') && detail.includes('"path"')) return 'tool-argument-schema';
  if (/quote|disclosed|read source/i.test(detail)) return 'source-evidence';
  if (/authority|supersed|conflict|assessment/i.test(detail)) return 'source-authority';
  if (/prediction|hypothes|diagnostic|experiment/i.test(detail)) return 'diagnostic-contract';
  if (/selected|session|activity|lesson/i.test(detail)) return 'activity-selection';
  return 'unclassified-validation';
}
async function measured(
  caseId: string,
  state: WorkspaceState,
  request: InvestigationRequest,
  verify: (result: InvestigationResult) => void,
): Promise<InvestigationResult> {
  const cap = Number(process.env.META_APP_SPEND_CAP_USD || '1');
  check(
    cap > 0 &&
      cap <= 1 &&
      process.env.SOMA_LIVE_INFERENCE === 'true' &&
      Boolean(process.env.MODEL_API_KEY),
    'configured unchanged application cap',
  );
  check(
    !process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_AUTH_EMULATOR_HOST,
    'no emulator fallback',
  );
  const original = JSON.stringify(state),
    started = Date.now(),
    originalFetch = globalThis.fetch;
  let calls = 0,
    result: InvestigationResult | undefined,
    failureSteps: string[] = [],
    failureEffect = '',
    outcome = 'failed';
  const validations = new Set<string>();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === 'https://api.meta.ai/v1/responses') {
      calls++;
      check(calls <= MAX_INVESTIGATION_CALLS, 'actual provider call ceiling');
      if (typeof init?.body === 'string') {
        const body = JSON.parse(init.body) as {
          input?: { type?: string; call_id?: string; output?: string }[];
        };
        for (const item of body.input ?? [])
          if (item.type === 'function_call_output' && item.output) {
            const output = JSON.parse(item.output) as { accepted?: boolean; detail?: unknown };
            if (output.accepted === false)
              validations.add(`${item.call_id ?? ''}:${validationClass(output.detail)}`);
          }
      }
    }
    return originalFetch(input, init);
  }) as typeof fetch;
  try {
    result = await investigateWithSpark(state, request);
    check(JSON.stringify(state) === original, 'input evidence immutability');
    check(
      result.run.mode === 'live' && result.run.status === 'completed' && !result.reused,
      'actual live completion',
    );
    check(
      calls >= 1 && calls <= MAX_INVESTIGATION_CALLS && result.record.usage?.calls === calls,
      'reported actual call count',
    );
    check(
      (result.record.usage?.costUsd ?? Infinity) <= INVESTIGATION_RESERVATION_USD,
      'reported cost within reservation',
    );
    check(
      result.record.workspaceId === state.id && result.record.courseId === courseId,
      'owned decision',
    );
    check(result.record.sourceRefs.length > 0, 'supporting sources present');
    for (const ref of result.record.sourceRefs) {
      const originalSource = state.sources.find(
        (item) =>
          item.id === ref.sourceId &&
          item.version === ref.version &&
          item.courseId === courseId &&
          item.status === 'current',
      );
      const read = result.reads.get(ref.sourceId);
      check(
        originalSource &&
          read?.version === ref.version &&
          (read.segments ?? [{ offset: 0, body: read.body ?? '' }]).some(
            (segment) =>
              originalSource.body.slice(segment.offset, segment.offset + segment.body.length) ===
                segment.body && segment.body.includes(ref.quote),
          ),
        'disclosed exact citation',
      );
    }
    const published = publishInvestigation(state, result);
    check(
      JSON.stringify(state) === original &&
        JSON.stringify(published.attempts) === JSON.stringify(state.attempts) &&
        JSON.stringify(published.sources) === JSON.stringify(state.sources),
      'publication preserves original observations',
    );
    check(
      published.investigations?.some((record) => record.id === result!.record.id),
      'persistent decision shape',
    );
    verify(result);
    outcome = 'passed';
    return result;
  } catch (error) {
    const run = (error as { run?: { steps?: string[]; effect?: string } }).run;
    failureSteps = run?.steps ?? [];
    failureEffect = run?.effect ?? '';
    // Never print provider messages, source bodies, hypotheses, or diagnostic questions.
    if (error instanceof Error && error.message.startsWith('Held-out investigation check failed:'))
      throw error;
    throw new Error(`Held-out investigation ${caseId} did not complete; see body-free metrics.`);
  } finally {
    globalThis.fetch = originalFetch;
    const billing = failureSteps
      .map((step) =>
        step.match(/(\d+) Meta calls; estimated token cost \$(\d+(?:\.\d+)?); (\d+) ms\./),
      )
      .find(Boolean);
    const tools =
      result?.record.toolActivity?.map((item) => item.tool).filter((name) => toolNames.has(name)) ??
      failureSteps.map((step) => step.split(':')[0]).filter((name) => toolNames.has(name));
    const metrics = {
      evaluation: 'heldout-investigation-v1',
      caseId,
      outcome,
      calls,
      elapsedMs: Date.now() - started,
      costUsd: result?.record.usage?.costUsd ?? (billing ? Number(billing[2]) : null),
      tools,
      failureCode: failureEffect.match(/Investigation stopped safely \(([a-z_]+)\)/)?.[1] ?? null,
      usageCertain: !failureEffect.includes('Unknown usage'),
      validationClasses: [...validations].map((value) => value.slice(value.lastIndexOf(':') + 1)),
      failureStages: failureSteps
        .filter((step) => /^[a-z_]+:/.test(step))
        .map((step) => ({
          tool: step.split(':')[0],
          rejected: step.includes('Rejected by application validation'),
        })),
    };
    mkdirSync('.local', { recursive: true, mode: 0o700 });
    appendFileSync('.local/investigator-live-metrics.jsonl', JSON.stringify(metrics) + '\n', {
      mode: 0o600,
    });
    console.info(JSON.stringify(metrics));
  }
}

describe.skipIf(process.env.SOMA_LIVE_INVESTIGATION_TEST !== 'true')(
  'held-out original synthetic investigative behavior',
  () => {
    it(
      'case A: applicable authority update through a registered source reference',
      { timeout: 110_000, retry: 0 },
      async () => {
        const state = workspace();
        const revisedUrl = 'https://original-fixture.example.invalid/assessment-kappa-correction';
        state.sources = [
          source(
            state,
            'a-notice',
            'Assessment kappa notice',
            `Assessment kappa has a posted clarification. Follow the official course reference ${revisedUrl} before deciding which practice to prioritize.`,
            { role: 'teaching-material', assessmentId: 'kappa' },
          ),
          source(
            state,
            'b-outline',
            'Original assessment outline',
            'Assessment kappa focuses on describing a sample using counts and medians. Confidence intervals belong to the later unit.',
            { role: 'syllabus', assessmentId: 'kappa' },
          ),
          ...Array.from({ length: 6 }, (_, index) =>
            source(
              state,
              `m-background-${index}`,
              `Background catalog ${index}`,
              'This original synthetic background note concerns general classroom organization rather than assessment coverage.',
              { role: 'teaching-material' },
            ),
          ),
          source(
            state,
            'z-correction',
            'Instructor correction for kappa',
            'This correction replaces the Original assessment outline for assessment kappa: prioritize interpreting confidence intervals and their repeated-sampling meaning. Descriptive summaries remain background preparation.',
            { role: 'instructor-update', assessmentId: 'kappa' },
            revisedUrl,
          ),
        ];
        state.lessons = [
          activity('old-summary-practice', 'Describe sample counts and medians', 'b-outline'),
          activity(
            'interval-practice',
            'Interpret confidence intervals using repeated sampling',
            'z-correction',
          ),
        ];
        state.recommendedLessonId = 'old-summary-practice';
        await measured(
          'A',
          state,
          {
            courseId,
            initialSourceIds: ['a-notice', 'b-outline'],
            goal: 'Investigate the assessment notice and determine whether my next selected activity still fits the applicable course guidance.',
          },
          (result) => {
            check(
              result.decision.decision === 'revise-session' &&
                result.decision.assessmentId === 'kappa',
              'A applicable revision',
            );
            check(
              result.record.sourceRefs.some((ref) => ref.sourceId === 'z-correction') &&
                result.record.sourceRefs.some((ref) => ref.sourceId === 'b-outline'),
              'A competing authority evidence',
            );
            check(
              result.record.toolActivity?.some((item) => item.tool === 'follow_reference'),
              'A actual registered reference following',
            );
            check(
              result.selectedLessonId && result.selectedLessonId !== 'old-summary-practice',
              'A changed selected activity',
            );
          },
        );
      },
    );

    it(
      'case B: conflicting equal-role instructions remain unresolved',
      { timeout: 110_000, retry: 0 },
      async () => {
        const state = workspace();
        state.sources = [
          source(
            state,
            'instruction-one',
            'Instructor note one',
            'For assessment lambda, the practice scope is interpreting interval estimates; sampling-design explanations are outside its scope.',
            { role: 'instructor-update', assessmentId: 'lambda' },
          ),
          source(
            state,
            'instruction-two',
            'Instructor note two',
            'For assessment lambda, the practice scope is explaining sampling design; interval-estimate interpretations are outside its scope.',
            { role: 'instructor-update', assessmentId: 'lambda' },
          ),
        ];
        state.lessons = [
          activity(
            'sampling-practice',
            'Explain how a sampling design supports an inference',
            'instruction-two',
          ),
        ];
        state.recommendedLessonId = 'sampling-practice';
        await measured(
          'B',
          state,
          {
            courseId,
            initialSourceIds: ['instruction-one', 'instruction-two'],
            goal: 'Review the available assessment instructions and decide whether my selected practice needs to change.',
          },
          (result) => {
            check(result.decision.decision === 'needs-evidence', 'B unresolved decision');
            check(
              result.decision.conflicts.some(
                (conflict) =>
                  conflict.resolution === 'unresolved' &&
                  conflict.sourceIds.includes('instruction-one') &&
                  conflict.sourceIds.includes('instruction-two'),
              ),
              'B competing quotes retained',
            );
            check(!result.lesson && !result.selectedLessonId, 'B no unsupported replacement');
          },
        );
      },
    );

    it(
      'case C: a confirming update avoids unnecessary regeneration',
      { timeout: 110_000, retry: 0 },
      async () => {
        const state = workspace();
        state.sources = [
          source(
            state,
            'confirmation',
            'Current instructor confirmation',
            'Assessment mu retains its existing focus: explain how random sampling supports population representation. The current practice on sampling design remains aligned with this objective.',
            { role: 'instructor-update', assessmentId: 'mu' },
          ),
        ];
        state.lessons = [
          activity(
            'aligned-practice',
            'Explain how random sampling supports population representation',
            'confirmation',
          ),
        ];
        state.recommendedLessonId = 'aligned-practice';
        await measured(
          'C',
          state,
          {
            courseId,
            initialSourceIds: ['confirmation'],
            goal: 'Investigate the new course confirmation and choose the appropriate consequence for my next activity.',
          },
          (result) => {
            check(result.decision.decision === 'keep-current', 'C no-effect decision');
            check(!result.lesson && !result.selectedLessonId, 'C no new lesson');
            check(
              publishInvestigation(state, result).recommendedLessonId === 'aligned-practice',
              'C recommendation retained',
            );
          },
        );
      },
    );

    it(
      'case D: a contrary saved diagnostic response constrains the next interpretation',
      { timeout: 210_000, retry: 0 },
      async () => {
        let state = workspace();
        state.sources = [
          source(
            state,
            'methods-passage',
            'Original methods distinctions',
            'Random sampling concerns how observations are selected and can support representativeness. Random assignment concerns how an intervention is allocated and can reduce systematic confounding. An observational association alone leaves alternative explanations unresolved.',
            { role: 'teaching-material' },
          ),
        ];
        const first = await measured(
          'D1',
          state,
          {
            courseId,
            initialSourceIds: ['methods-passage'],
            goal: 'My explanation used a representative observational survey to claim causation. Investigate competing explanations for this response and choose an optional fresh diagnostic that could distinguish them.',
          },
          (result) => {
            check(
              result.decision.decision === 'revise-session' &&
                result.record.diagnosticPlan &&
                result.lesson?.kind === 'practice',
              'D1 optional ordinary diagnostic',
            );
          },
        );
        state = publishInvestigation(state, first);
        const plan = first.record.diagnosticPlan!,
          lesson = first.lesson!;
        const firstHypothesis = plan.hypotheses[0].id;
        const contraryPrediction = plan.predictions.find(
          (prediction) => prediction.hypothesisId !== firstHypothesis,
        )!;
        const attemptId = `heldout-response-${randomUUID()}`;
        state.attempts.push({
          id: attemptId,
          lessonId: lesson.id,
          lessonVersion: lesson.version,
          modelVersion: lesson.modelVersion,
          question: lesson.question,
          response: lesson.options[contraryPrediction.predictedOptionIndex],
          correct: null,
          assisted: false,
          assistance: [],
          novel: true,
          exposure: 'fresh-no-diagram',
          sourceVersions: structuredClone(lesson.sourceVersions),
          createdAt: new Date().toISOString(),
          feedback: 'Original synthetic ungraded response for held-out evaluation.',
        });
        state.revision++;
        const originalEvidence = JSON.stringify({
          attempts: state.attempts,
          first: state.investigations?.[0],
        });
        await measured(
          'D2',
          state,
          {
            courseId,
            previousInvestigationId: first.record.id,
            attemptId,
            goal: 'Reconsider the provisional explanations using my saved diagnostic response and choose a supported next activity or retain uncertainty.',
          },
          (result) => {
            check(
              result.record.supersedesId === first.record.id &&
                result.record.attemptIds?.includes(attemptId),
              'D2 traceable revision',
            );
            check(
              result.record.hypothesisRevisions?.some(
                (revision) =>
                  revision.hypothesisId === firstHypothesis &&
                  ['weakened', 'unresolved'].includes(revision.status),
              ),
              'D2 contrary response respected',
            );
            check(
              result.record.hypothesisRevisions?.every(
                (revision) =>
                  revision.status === 'unresolved' ||
                  (revision.hypothesisId === contraryPrediction.hypothesisId
                    ? revision.status === 'supported'
                    : revision.status === 'weakened'),
              ),
              'D2 no reversed response evidence',
            );
            check(
              JSON.stringify({ attempts: state.attempts, first: state.investigations?.[0] }) ===
                originalEvidence,
              'D2 immutable earlier evidence',
            );
          },
        );
      },
    );
  },
);
