import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { applyAction } from '../../src/lib/domain/learning';
import type { WorkspaceState } from '../../src/lib/domain/types';
import {
  ENGINE_VERSION,
  InvestigationError,
  investigateWithSpark,
  publishInvestigation,
} from '../../src/lib/server/investigator';
import * as meta from '../../src/lib/server/meta-client';
import { createWorkspace, updateWorkspace, closeLocalStore } from '../../src/lib/server/store';
import {
  createAuditRun,
  readAuditRuns,
  closeLocalAuditStore,
} from '../../src/lib/server/audit-store';

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'soma-initial-practice-'));
  for (const [key, value] of Object.entries({
    SOMA_PERSISTENCE: 'local-synthetic',
    SOMA_LOCAL_DATABASE_PATH: join(directory, 'workspace.sqlite'),
    SOMA_LIVE_INFERENCE: 'true',
    SOMA_LESSON_REVIEW_ENABLED: 'false',
    MODEL_API_KEY: 'synthetic-key-never-sent',
    META_API_BASE_URL: 'https://api.meta.ai/v1',
    META_MODEL_ID: 'muse-spark-1.3',
    META_ALLOCATION_USD: '150',
    META_APP_SPEND_CAP_USD: '2',
    SOMA_BUDGET_DB_PATH: join(directory, 'budget.sqlite'),
  }))
    vi.stubEnv(key, value);
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Unscripted request: no live provider access is permitted.');
    }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  closeLocalAuditStore();
  closeLocalStore();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});
const sourceId = 'source-probability';
const quote = 'Independence does not mean equal probabilities.';
const request = {
  courseId: 'probability',
  goal: 'Prepare useful ordinary practice from selected course material.',
  initialSourceIds: [sourceId],
};
const read = (offset = 0) => ({ name: 'read_source', args: { sourceId, offset } });
function fixture() {
  const state = seedWorkspace('original-initial-practice', '2026-10-28T12:00:00.000Z');
  state.lessons = [];
  state.attempts = [];
  state.investigations = [];
  state.recommendedLessonId = undefined;
  return state;
}
const proposal = () => ({
  sourceIds: [sourceId],
  evidence: [{ sourceId, quote }],
  title: 'Independence and probability',
  objective: 'Distinguish independence from equal probability.',
  reason: 'The current course note distinguishes these two properties.',
  question: 'What does independence alone tell us about the probabilities of two events?',
  options: [
    'Their probabilities must be equal.',
    'Their probabilities need not be equal.',
    'Both probabilities must be zero.',
  ],
  answerIndex: 1,
  explanation: 'The cited course note states that independence does not mean equal probabilities.',
  hint: 'Compare independence with the separate claim that probabilities match.',
  auditRationale: 'Prepare an ordinary example using the exact disclosed course distinction.',
});
const finish = (lessonId?: unknown, citedQuote = quote) => ({
  decision: lessonId ? 'revise-session' : 'keep-current',
  reason: lessonId
    ? 'The selected course material supports a useful ordinary practice preview.'
    : 'The source does not require replacing a valid recommendation.',
  sourceRefs: [{ sourceId, version: 1, quote: citedQuote }],
  applicability: 'course',
  assessmentIds: [],
  selectedLessonIds: lessonId ? [lessonId] : [],
  conflicts: [],
  academicUpdates: [],
  auditRationale: 'Complete the source-grounded decision without inventing learner evidence.',
});
type Body = {
  input: { type?: string; output?: string; content?: string }[];
  tools: { name: string; description: string; parameters: { required: string[] } }[];
};
type Step = { name: string; args: unknown } | ((body: Body) => { name: string; args: unknown });
function lastOutput(body: Body) {
  return JSON.parse(
    body.input.filter((item) => item.type === 'function_call_output').at(-1)!.output!,
  ) as Record<string, unknown>;
}
function script(steps: Step[]) {
  let index = 0;
  const provider = vi.fn(async (url: string, init?: RequestInit) => {
    expect(url).toBe(meta.META_ENDPOINT);
    const body = JSON.parse(String(init?.body)) as Body;
    expect(body.tools).toHaveLength(8);
    expect(new Set(body.tools.map((tool) => tool.name)).size).toBe(8);
    expect(body.tools.every((tool) => tool.parameters.required.includes('auditRationale'))).toBe(
      true,
    );
    const step = steps[index++];
    if (!step) throw new Error('Unexpected extra inference.');
    const action = typeof step === 'function' ? step(body) : step;
    return new Response(
      JSON.stringify({
        status: 'completed',
        usage: { input_tokens: 100, output_tokens: 20 },
        output: [
          {
            type: 'function_call',
            name: action.name,
            arguments: JSON.stringify(action.args),
            call_id: `original-practice-${index}`,
          },
        ],
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  });
  vi.stubGlobal('fetch', provider);
  return provider;
}

describe('initial source investigation to ordinary practice', () => {
  it('reads actual disclosed material, validates practice, publishes via the existing boundary, and reuses it without inference', async () => {
    const state = fixture(),
      original = structuredClone(state);
    const provider = script([
      (body) => {
        expect(body.tools.map((tool) => tool.name)).toContain('prepare_practice');
        expect(body.tools.map((tool) => tool.name)).not.toContain('revise_interpretation');
        expect(body.tools.find((tool) => tool.name === 'prepare_practice')!.description).toContain(
          'offset-zero',
        );
        expect(JSON.parse(body.input[0].content!).initialPracticePolicy).toContain(
          'Do not invent learner misconceptions',
        );
        return read();
      },
      (body) => {
        expect(lastOutput(body).body).toContain(quote);
        return { name: 'prepare_practice', args: proposal() };
      },
      (body) => {
        expect(lastOutput(body)).toMatchObject({
          accepted: true,
          kind: 'practice',
          validation: 'development-preview',
          examEligible: false,
        });
        return { name: 'finish_investigation', args: finish(lastOutput(body).lessonId) };
      },
    ]);
    const result = await investigateWithSpark(state, request);
    expect(result.record.engineVersion).toBe(ENGINE_VERSION);
    expect(result.lesson).toMatchObject({
      kind: 'practice',
      modelVersion: 'practice-v1-development',
      examEligible: false,
      validation: { status: 'development-preview' },
      sourceVersions: { [sourceId]: 1 },
      supportingPassages: [{ sourceId, version: 1, quote }],
    });
    expect(result.record.diagnosticPlan).toBeUndefined();
    expect(result.record.hypothesisRevisions).toBeUndefined();
    expect(result.lesson?.diagnosticInvestigationId).toBeUndefined();
    expect(result.protectUnpublishedActivity).toBe(false);
    expect(state).toEqual(original);
    const changed = structuredClone(state);
    changed.sources.find((source) => source.id === sourceId)!.version++;
    expect(() => publishInvestigation(changed, result)).toThrow();
    const published = publishInvestigation(state, result);
    expect(published.recommendedLessonId).toBe(result.lesson!.id);
    expect(published.lessons).toHaveLength(1);
    for (const key of ['sources', 'courses', 'attempts', 'interpretations'] as const)
      expect(published[key]).toEqual(original[key]);
    const cached = await investigateWithSpark(published, request);
    expect(cached.reused).toBe(true);
    expect(provider).toHaveBeenCalledTimes(3);
  });

  it.each([
    'unread-source',
    'unread-offset',
    'later-page-only',
    'missing-offset-zero',
    'forged-quote',
    'foreign-course',
  ] as const)('rejects %s practice and keeps the rejected activity unpublished', async (kind) => {
    const state = fixture(),
      plan = proposal();
    const steps: Step[] = [read()];
    if (kind === 'unread-source') {
      state.sources.push({
        ...state.sources.find((source) => source.id === sourceId)!,
        id: 'unread-note',
      });
      plan.sourceIds = ['unread-note'];
      plan.evidence = [{ sourceId: 'unread-note', quote }];
    }
    if (kind === 'unread-offset' || kind === 'later-page-only' || kind === 'missing-offset-zero') {
      const source = state.sources.find((source) => source.id === sourceId)!;
      source.body = `${source.body} ${'An introductory note. '.repeat(80)}Later-page distinction: independent events need not be equiprobable.`;
      plan.evidence[0].quote =
        'Later-page distinction: independent events need not be equiprobable.';
      if (kind === 'later-page-only') steps.push(read(1200));
      if (kind === 'missing-offset-zero') steps.splice(0, steps.length, read(1200));
    }
    if (kind === 'forged-quote')
      plan.evidence[0].quote =
        'This invented passage is absent from every disclosed course source.';
    if (kind === 'foreign-course') {
      plan.sourceIds = ['source-writing'];
      plan.evidence = [
        {
          sourceId: 'source-writing',
          quote: 'An observational association does not by itself establish causation.',
        },
      ];
    }
    steps.push({ name: 'prepare_practice', args: plan }, (body) => {
      expect(lastOutput(body).accepted).toBe(false);
      return {
        name: 'finish_investigation',
        args: finish(undefined, kind === 'missing-offset-zero' ? plan.evidence[0].quote : quote),
      };
    });
    script(steps);
    const result = await investigateWithSpark(state, request);
    expect(result.lesson).toBeUndefined();
    expect(result.selectedLessonId).toBeUndefined();
    expect(result.protectUnpublishedActivity).toBe(true);
    expect(publishInvestigation(state, result).lessons).toEqual([]);
    expect(result.record.diagnosticPlan).toBeUndefined();
    expect(result.record.hypothesisRevisions).toBeUndefined();
  });

  it('rejects an already exposed question even after whitespace and case changes', async () => {
    let state = seedWorkspace('original-exposed-question');
    const prior = state.lessons.find((lesson) => lesson.courseId === 'probability')!;
    state = applyAction(state, { type: 'attempt', lessonId: prior.id, optionIndex: 1 });
    state.attempts[0].question = `  ${proposal().question.toUpperCase().replace(/ /g, '  ')}  `;
    const original = structuredClone(state.attempts);
    script([
      read(),
      { name: 'prepare_practice', args: proposal() },
      (body) => {
        expect(lastOutput(body)).toMatchObject({ accepted: false });
        expect(lastOutput(body).detail).toContain('already exposed');
        return { name: 'finish_investigation', args: finish() };
      },
    ]);
    const result = await investigateWithSpark(state, request);
    expect(result.lesson).toBeUndefined();
    expect(result.protectUnpublishedActivity).toBe(true);
    expect(state.attempts).toEqual(original);
  });

  it('clears an earlier diagnostic when validated ordinary practice replaces the candidate', async () => {
    const state = fixture();
    const evidence = [{ sourceId, version: 1, quote }];
    script([
      read(),
      {
        name: 'prepare_diagnostic',
        args: {
          hypotheses: [
            {
              id: 'equal',
              claim: 'The learner may confuse independence with equal probabilities.',
              evidence,
              attemptIds: [],
            },
            {
              id: 'diagram',
              claim: 'The learner may have misread an event diagram.',
              evidence,
              attemptIds: [],
            },
          ],
          question: 'Must independent events have equal probability?',
          options: ['Always equal', 'They may differ', 'Always zero'],
          predictions: [
            { hypothesisId: 'equal', predictedOptionIndex: 0 },
            { hypothesisId: 'diagram', predictedOptionIndex: 1 },
          ],
          rationale: 'An optional comparison distinguishes the two provisional explanations.',
          nextActivity: 'Compare another independent-event example.',
        },
      },
      { name: 'prepare_practice', args: proposal() },
      (body) => ({ name: 'finish_investigation', args: finish(lastOutput(body).lessonId) }),
    ]);
    const result = await investigateWithSpark(state, request);
    expect(result.lesson?.modelVersion).toBe('practice-v1-development');
    expect(result.record.diagnosticPlan).toBeUndefined();
    expect(result.record.diagnosticLessonId).toBeUndefined();
    expect(result.protectUnpublishedActivity).toBe(true);
  });

  it('retains the original response-revision menu and refuses unoffered practice in a follow-up', async () => {
    const state = fixture();
    script([read(), { name: 'finish_investigation', args: finish() }]);
    const initial = await investigateWithSpark(state, request),
      saved = publishInvestigation(state, initial);
    const provider = script([
      (body) => {
        expect(body.tools.map((tool) => tool.name)).not.toContain('prepare_practice');
        expect(body.tools.map((tool) => tool.name)).toContain('revise_interpretation');
        return { name: 'prepare_practice', args: proposal() };
      },
    ]);
    await expect(
      investigateWithSpark(saved, { ...request, previousInvestigationId: initial.record.id }),
    ).rejects.toBeInstanceOf(InvestigationError);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(saved.lessons).toHaveLength(0);
  });

  it('rejects unoffered actions even if a transport bypasses provider parsing', async () => {
    const action = {
      type: 'function_call' as const,
      name: 'revise_interpretation',
      parsedArguments: {},
      arguments: '{}',
      call_id: 'forged-action',
    };
    const provider = vi.spyOn(meta, 'requestMetaResponse').mockResolvedValue({
      status: 'completed',
      tools: [action],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    await expect(investigateWithSpark(fixture(), request)).rejects.toBeInstanceOf(
      InvestigationError,
    );
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('allows administrative material to keep the current session without fabricating practice', async () => {
    const state = fixture(),
      administrative =
        'The class office is closed on Friday; the lecture content and assessments are unchanged.';
    state.sources.find((source) => source.id === sourceId)!.body = administrative;
    script([read(), { name: 'finish_investigation', args: finish(undefined, administrative) }]);
    const result = await investigateWithSpark(state, request);
    expect(result.record.decision).toBe('keep-current');
    expect(result.lesson).toBeUndefined();
    expect(result.protectUnpublishedActivity).toBe(false);
  });

  it('keeps a rejected practice rationale private in the real journal after a terminal source-only publication', async () => {
    const { token, workspace } = await createWorkspace(),
      access = { kind: 'demo' as const, token };
    const writer = await createAuditRun(access, workspace, {
      kind: 'investigation',
      trigger: 'Original synthetic ordinary-practice privacy test',
      mode: 'live',
      courseId: 'probability',
      model: 'muse-spark-1.3',
      engineVersion: ENGINE_VERSION,
      promptVersion: ENGINE_VERSION,
    });
    const spoiler =
      'PRIVATE rejected activity rationale: the intended answer is unequal probabilities.';
    script([
      read(),
      {
        name: 'prepare_practice',
        args: {
          ...proposal(),
          evidence: [{ sourceId, quote: 'A fabricated quote which the source never disclosed.' }],
          auditRationale: spoiler,
        },
      },
      (body) => {
        expect(lastOutput(body).accepted).toBe(false);
        return { name: 'finish_investigation', args: finish() };
      },
    ]);
    const result = await investigateWithSpark(workspace, request, { audit: writer });
    const published = await updateWorkspace(
      token,
      (current) => publishInvestigation(current, result),
      workspace.revision,
    );
    await writer.finish({
      status: 'published',
      protectUnpublishedActivity: result.protectUnpublishedActivity,
    });
    const [run] = await readAuditRuns(access, published, writer.id);
    expect(result.protectUnpublishedActivity).toBe(true);
    expect(run.status).toBe('published');
    expect(
      run.events
        .filter((event) => event.actor === 'model')
        .every((event) => event.protected && !event.rationale),
    ).toBe(true);
    expect(JSON.stringify(run)).not.toContain(spoiler);
    const db = new DatabaseSync(join(directory, 'workspace.sqlite'));
    try {
      expect(String(db.prepare('SELECT payload FROM audit_runs').get()?.payload)).toContain(
        spoiler,
      );
    } finally {
      db.close();
    }
  });
});
