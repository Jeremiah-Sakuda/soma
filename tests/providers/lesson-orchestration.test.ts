import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { prepareWithSpark, PreparationError } from '../../src/lib/server/meta';
import { usageCost, JOB_RESERVATION_USD } from '../../src/lib/server/budget';
import {
  META_MODEL,
  META_REVIEW_MODEL,
  requestMetaResponse,
  type MetaRequest,
} from '../../src/lib/server/meta-client';
import {
  assertLessonCallAllowance,
  lessonReviewRequest,
  validateLessonReview,
} from '../../src/lib/server/lesson-review';
import type { AuditWriter } from '../../src/lib/server/audit-store';
import type { AuditEventInput } from '../../src/lib/domain/audit';

let directory: string, path: string;
const usage = { input_tokens: 100, output_tokens: 20 };
const sourceId = 'source-probability';
const proposal = (repaired = false) => ({
  sourceIds: [sourceId],
  evidence: [{ sourceId, quote: 'Independence does not mean equal probabilities.' }],
  title: 'Investigate independent events',
  objective: 'Distinguish independence from equal probabilities.',
  reason: 'The course explicitly distinguishes these two relationships.',
  question: repaired
    ? 'Can independent events have different probabilities?'
    : 'Does independence require equal event probabilities?',
  options: [
    'Yes, equality is required.',
    'No, independent probabilities can differ.',
    'Both probabilities must be zero.',
  ],
  answerIndex: 1,
  explanation: 'The source states that independent events need not have equal probabilities.',
  hint: 'Compare the two properties in the cited passage.',
});
const review = (verdict = 'approve') => ({
  verdict,
  findings:
    verdict === 'approve'
      ? []
      : [
          {
            code: 'ambiguity',
            message: 'Rewrite the question to distinguish the two properties clearly.',
          },
        ],
  reason: 'The course evidence supports the distinction being tested.',
});
const response = (name: string, args: unknown, index: number, overrides = {}) =>
  new Response(
    JSON.stringify({
      status: 'completed',
      usage,
      output: [
        { type: 'function_call', name, arguments: JSON.stringify(args), call_id: `step-${index}` },
      ],
      ...overrides,
    }),
    { headers: { 'content-type': 'application/json' } },
  );
function charges() {
  const db = new DatabaseSync(path);
  try {
    return db.prepare('SELECT reserved, charged FROM reservations').all() as {
      reserved: number;
      charged: number | null;
    }[];
  } finally {
    db.close();
  }
}
function scripted(verdicts = ['approve']) {
  let authors = 0,
    reviews = 0;
  const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    if (body.model === META_REVIEW_MODEL) {
      expect(body.tools.map((tool: { name: string }) => tool.name)).toEqual(['review_lesson']);
      expect(body.max_output_tokens).toBe(1024);
      expect(body.reasoning.effort).toBe('minimal');
      expect(body).not.toHaveProperty('tool_choice');
      const context = JSON.parse(body.input[0].content);
      expect(context.sources).toHaveLength(1);
      expect(context.sources[0].sourceId).toBe(sourceId);
      expect(context.sources[0].body).toContain('Independence does not mean equal probabilities.');
      expect(JSON.stringify(context)).not.toContain('source-d');
      return response('review_lesson', review(verdicts[reviews++]), authors + reviews);
    }
    expect(body.model).toBe(META_MODEL);
    expect(body.tools.some((tool: { name: string }) => tool.name === 'read_source')).toBe(false);
    if (authors) expect(body.input.at(-1).output).toContain('Reviewer text is advisory data');
    return response('prepare_practice', proposal(authors++ > 0), authors + reviews);
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'soma-orchestration-'));
  path = join(directory, 'budget.sqlite');
  for (const [name, value] of Object.entries({
    MODEL_API_KEY: 'synthetic-never-sent-key',
    META_API_BASE_URL: 'https://api.meta.ai/v1',
    META_MODEL_ID: META_MODEL,
    SOMA_PERSISTENCE: 'local-synthetic',
    SOMA_LIVE_INFERENCE: 'true',
    SOMA_LESSON_REVIEW_ENABLED: 'true',
    META_ALLOCATION_USD: '150',
    META_APP_SPEND_CAP_USD: '2',
    SOMA_BUDGET_DB_PATH: path,
  }))
    vi.stubEnv(name, value);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

describe('integrated Spark author and Wonder challenger', () => {
  it('uses two real transport roles, one reservation, exact source context and no mutation before publication', async () => {
    const state = seedWorkspace('orchestration'),
      original = structuredClone(state),
      fetcher = scripted();
    const events: AuditEventInput[] = [];
    const audit: AuditWriter = {
      id: 'test',
      append: async (event) => {
        events.push(event);
      },
      finish: async () => {},
    };
    const result = await prepareWithSpark(state, 'probability', 'independent events', { audit });
    expect(state).toEqual(original);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(
      result.run.orchestration?.handoffs.map((item) => [item.stage, item.model, item.outcome]),
    ).toEqual([
      ['author', META_MODEL, 'proposed'],
      ['reviewer', META_REVIEW_MODEL, 'approve'],
    ]);
    expect(charges()).toHaveLength(1);
    expect(charges()[0].charged).toBeCloseTo(
      usageCost(100, 20) + usageCost(100, 20, META_REVIEW_MODEL),
    );
    expect(
      events.find((e) => e.actor === 'model' && e.summary.includes(META_REVIEW_MODEL))?.visibility,
    ).toBe('protected');
    expect(events.some((e) => e.summary.includes('publication remains blocked'))).toBe(true);
    const saved = JSON.parse(
      JSON.stringify({ ...state, lessons: [result.lesson, ...state.lessons], runs: [result.run] }),
    );
    const reopened = await prepareWithSpark(saved, 'probability', 'independent events');
    expect(reopened.lesson.id).toBe(result.lesson.id);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(charges()).toHaveLength(1);
  });

  it('returns actual reviewer findings to Spark, then requires a second review of the changed candidate', async () => {
    const fetcher = scripted(['revise', 'approve']);
    const result = await prepareWithSpark(
      seedWorkspace('repair'),
      'probability',
      'independent events',
    );
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(result.lesson.question).toBe(proposal(true).question);
    expect(result.run.orchestration?.handoffs.map((item) => item.outcome)).toEqual([
      'proposed',
      'revise',
      'proposed',
      'approve',
    ]);
    expect(charges()[0].charged).toBeCloseTo(
      2 * usageCost(100, 20) + 2 * usageCost(100, 20, META_REVIEW_MODEL),
    );
  });

  it.each([['unsupported'], ['revise', 'revise']])(
    'withholds the candidate when the reviewer returns %j',
    async (...verdicts) => {
      const fetcher = scripted(verdicts as string[]);
      await expect(
        prepareWithSpark(seedWorkspace('reject'), 'probability', 'independent events'),
      ).rejects.toBeInstanceOf(PreparationError);
      expect(fetcher.mock.calls.length).toBeLessThanOrEqual(4);
      expect(charges()).toHaveLength(1);
      expect(charges()[0].charged).not.toBeNull();
    },
  );

  it('retains the full reservation when review usage is unavailable and never silently uses Spark as reviewer', async () => {
    let count = 0;
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (++count === 1) return response('prepare_practice', proposal(), count);
      expect(body.model).toBe(META_REVIEW_MODEL);
      return response('review_lesson', review(), count, { usage: null });
    });
    vi.stubGlobal('fetch', fetcher);
    await expect(
      prepareWithSpark(seedWorkspace('unknown'), 'probability', 'independent events'),
    ).rejects.toMatchObject({ failure: { kind: 'provider', code: 'usage_unavailable' } });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(charges()[0]).toEqual({ reserved: JOB_RESERVATION_USD, charged: null });
  });

  it('rejects malformed reviewer approval and bills its reported Wonder usage', async () => {
    let count = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ++count === 1
          ? response('prepare_practice', proposal(), count)
          : response(
              'review_lesson',
              {
                ...review(),
                findings: [
                  { code: 'answer', message: 'An unresolved answer defect remains here.' },
                ],
              },
              count,
            ),
      ),
    );
    await expect(
      prepareWithSpark(seedWorkspace('invalid'), 'probability', 'independent events'),
    ).rejects.toMatchObject({ failure: { kind: 'validation', code: 'tool' } });
    expect(charges()[0].charged).toBeCloseTo(
      usageCost(100, 20) + usageCost(100, 20, META_REVIEW_MODEL),
    );
  });

  it('does not accept a reviewer as an authority or allow invalid role billing/model routing', async () => {
    expect(() => validateLessonReview({ ...review(), mastered: true })).toThrow();
    expect(() => usageCost(1, 1, 'attacker-model' as typeof META_MODEL)).toThrow();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      requestMetaResponse({
        model: 'muse-spark-1.3-contributor' as typeof META_MODEL,
        instructions: 'Review.',
        input: [{ role: 'user', content: 'Data' }],
        tools: [],
        deadlineMs: 1000,
      }),
    ).rejects.toMatchObject({ code: 'configuration', requestSent: false });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('enforces per-call reservation headroom and exact disclosed source versions before transport', () => {
    const state = seedWorkspace('bound'),
      lesson = state.lessons.find((l) => l.id === 'parallel-nodes')!;
    expect(() => lessonReviewRequest(lesson, new Map(), 1000)).toThrow();
    const request: MetaRequest = {
      instructions: 'Bounded',
      input: [{ role: 'user', content: 'test' }],
      tools: [],
      deadlineMs: 1000,
      model: META_REVIEW_MODEL,
    };
    expect(() => assertLessonCallAllowance(request, JOB_RESERVATION_USD - 0.001)).toThrow();
    expect(() => assertLessonCallAllowance(request, 0)).not.toThrow();
  });
});

describe('review policy and operational failure boundaries', () => {
  it('does not reuse a prior unreviewed artifact after review is enabled', async () => {
    const state = seedWorkspace('policy');
    vi.stubEnv('SOMA_LESSON_REVIEW_ENABLED', 'false');
    let n = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ++n === 1
          ? response('read_source', { sourceId }, n)
          : response('prepare_practice', proposal(), n),
      ),
    );
    const old = await prepareWithSpark(state, 'probability', 'independent events');
    const saved = { ...state, id: 'policy-new-allowance', lessons: [old.lesson, ...state.lessons] };
    vi.stubEnv('SOMA_LESSON_REVIEW_ENABLED', 'true');
    const fetcher = scripted();
    const result = await prepareWithSpark(saved, 'probability', 'independent events');
    expect(result.lesson.id).not.toBe(old.lesson.id);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('bills a rejected HTTP response at the reviewer rate without a retry or fallback', async () => {
    let n = 0;
    const fetcher = vi.fn(async () =>
      ++n === 1
        ? response('prepare_practice', proposal(), n)
        : new Response(JSON.stringify({ usage, error: { message: 'Untrusted provider text.' } }), {
            status: 403,
          }),
    );
    vi.stubGlobal('fetch', fetcher);
    await expect(
      prepareWithSpark(seedWorkspace('http'), 'probability', 'independent events'),
    ).rejects.toMatchObject({ failure: { kind: 'provider', code: 'http' } });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(charges()[0].charged).toBeCloseTo(
      usageCost(100, 20) + usageCost(100, 20, META_REVIEW_MODEL),
    );
  });
  it('does not call the reviewer after a durable audit write fails', async () => {
    const fetcher = scripted();
    const audit: AuditWriter = {
      id: 'failure',
      finish: async () => {},
      append: async (event) => {
        if (event.summary.includes('Handing the candidate'))
          throw new Error('synthetic durable write failure');
      },
    };
    await expect(
      prepareWithSpark(seedWorkspace('audit-stop'), 'probability', 'independent events', { audit }),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(charges()[0].charged).toBeCloseTo(usageCost(100, 20));
  });
});
