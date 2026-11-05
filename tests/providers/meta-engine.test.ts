import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { applyAction } from '../../src/lib/domain/learning';
import { prepareWithSpark, PreparationError, selectSparkSources } from '../../src/lib/server/meta';
import { AuditStoreError, type AuditWriter } from '../../src/lib/server/audit-store';
import type { AuditEventInput } from '../../src/lib/domain/audit';
import { usageCost } from '../../src/lib/server/budget';

const sourceId = 'source-probability';
const proposal = () => ({
  sourceIds: [sourceId],
  evidence: [{ sourceId, quote: 'Independence does not mean equal probabilities.' }],
  title: 'Compare independent events',
  objective: 'Distinguish independence from equality of probabilities.',
  reason: 'The source explicitly separates these two properties.',
  question: 'Does independence require the probabilities of two events to be equal?',
  options: ['Yes, they must match.', 'No, they may differ.', 'Both probabilities must be zero.'],
  answerIndex: 1,
  explanation: 'The source states that independence does not mean equal probabilities.',
  hint: 'Read the distinction in the cited source.',
});
const usage = { input_tokens: 100, output_tokens: 10 };
const toolResponse = (name: string, args: unknown, ordinal: number, extra = {}) =>
  new Response(
    JSON.stringify({
      status: 'completed',
      usage,
      output: [
        {
          type: 'function_call',
          id: `fc_${ordinal}`,
          call_id: `call_${ordinal}`,
          name,
          arguments: JSON.stringify(args),
          status: 'completed',
        },
      ],
      ...extra,
    }),
    { status: 200 },
  );
let directory: string, path: string;
function charges() {
  const db = new DatabaseSync(path);
  try {
    return db.prepare('SELECT reserved, charged FROM reservations').all();
  } finally {
    db.close();
  }
}

describe('Spark engine across real validation, transport and budget boundaries', () => {
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'soma-meta-engine-'));
    path = join(directory, 'budget.sqlite');
    for (const [key, value] of Object.entries({
      MODEL_API_KEY: 'original-synthetic-test-key',
      META_API_BASE_URL: 'https://api.meta.ai/v1',
      META_MODEL_ID: 'muse-spark-1.3',
      SOMA_PERSISTENCE: 'local-synthetic',
      SOMA_LIVE_INFERENCE: 'true',
      META_ALLOCATION_USD: '150',
      META_APP_SPEND_CAP_USD: '1',
      SOMA_BUDGET_DB_PATH: path,
    }))
      vi.stubEnv(key, value);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    rmSync(directory, { recursive: true, force: true });
  });

  it('reads before grounded ordinary practice, preserves evidence and reopens unchanged artifacts without another call', async () => {
    const state = seedWorkspace('engine');
    const before = structuredClone(state);
    let call = 0;
    const provider = vi.fn(async (_url: unknown, options: RequestInit) => {
      call++;
      const body = JSON.parse(String(options.body));
      expect(body.tools.some((tool: { name: string }) => tool.name === 'prepare_lesson')).toBe(
        false,
      );
      if (call === 1) return toolResponse('read_source', { sourceId }, call);
      expect(body.input[2].output).toContain('Independence does not mean equal probabilities.');
      return toolResponse('prepare_practice', proposal(), call);
    });
    vi.stubGlobal('fetch', provider);
    const result = await prepareWithSpark(state, 'probability', 'Compare independent events');
    expect(result.lesson.kind).toBe('practice');
    expect(result.lesson.examEligible).toBe(false);
    expect(result.lesson.sourceVersions).toEqual({ [sourceId]: 1 });
    expect(state).toEqual(before);
    expect(charges()[0].charged).toBeCloseTo(2 * usageCost(100, 10));
    const persisted = {
      ...structuredClone(state),
      lessons: [result.lesson, ...state.lessons],
      revision: 9,
    };
    const reopened = await prepareWithSpark(persisted, 'probability', 'Compare independent events');
    expect(reopened.lesson.id).toBe(result.lesson.id);
    expect(reopened.run).toMatchObject({ status: 'unchanged', mode: 'prepared' });
    expect(provider).toHaveBeenCalledTimes(2);
    expect(charges()).toHaveLength(1);
    const obsolete = structuredClone(persisted);
    obsolete.lessons[0].modelVersion = 'obsolete-model';
    await expect(
      prepareWithSpark(obsolete, 'probability', 'Compare independent events'),
    ).rejects.toThrow('allowance');
    const authored = structuredClone(persisted);
    authored.lessons[0].mode = 'prepared';
    await expect(
      prepareWithSpark(authored, 'probability', 'Compare independent events'),
    ).rejects.toThrow('allowance');
    const answered = applyAction(persisted, {
      type: 'attempt',
      lessonId: result.lesson.id,
      optionIndex: 1,
    });
    expect(answered.attempts).toHaveLength(1);
    expect(answered.lessons).toHaveLength(persisted.lessons.length);
    await expect(
      prepareWithSpark(answered, 'probability', 'Compare independent events'),
    ).rejects.toThrow('allowance');
  });

  it('uses exactly the queued source versions, even when the selected source is later than four old records', async () => {
    const state = seedWorkspace('scoped');
    const source = state.sources.find((item) => item.id === sourceId)!;
    for (let index = 0; index < 6; index++)
      state.sources.push({ ...source, id: `old-${index}`, title: `Old note ${index}` });
    const refs = [{ sourceId, version: 1 }];
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, options: RequestInit) => {
        const body = JSON.parse(String(options.body));
        expect(
          JSON.parse(body.input[0].content).sources.map((item: { id: string }) => item.id),
        ).toEqual([sourceId]);
        return ++call === 1
          ? toolResponse('read_source', { sourceId }, call)
          : toolResponse('prepare_practice', proposal(), call);
      }),
    );
    const result = await prepareWithSpark(state, 'probability', 'Course note updated', {
      sourceRefs: refs,
      trigger: 'source-change',
    });
    expect(result.run.trigger).toBe('Collected course source change');
    expect(result.lesson.sourceIds).toEqual([sourceId]);
    expect(() =>
      selectSparkSources(state, 'probability', 'x', [{ sourceId: 'source-d', version: 1 }]),
    ).toThrow();
    expect(() =>
      selectSparkSources(state, 'probability', 'x', [{ sourceId, version: 2 }]),
    ).toThrow();
  });

  it('fails before billing when a course has no authorized current sources', async () => {
    const state = seedWorkspace('empty');
    state.sources = [];
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    await expect(prepareWithSpark(state, 'probability', 'Practice')).rejects.toThrow(
      'Current course material',
    );
    expect(provider).not.toHaveBeenCalled();
    expect(existsSync(path)).toBe(false);
  });

  it('retains the full reservation when a later provider call has unknown usage', async () => {
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ++call === 1
          ? toolResponse('read_source', { sourceId }, call)
          : toolResponse('prepare_practice', proposal(), call, { usage: null }),
      ),
    );
    await expect(
      prepareWithSpark(seedWorkspace('uncertain'), 'probability', 'Practice independence'),
    ).rejects.toBeInstanceOf(PreparationError);
    expect(charges()[0]).toMatchObject({ reserved: 0.2, charged: null });
  });

  it('reconciles reported incomplete usage without executing truncated tools', async () => {
    const provider = vi.fn(async () =>
      toolResponse('prepare_practice', proposal(), 1, { status: 'incomplete' }),
    );
    vi.stubGlobal('fetch', provider);
    await expect(
      prepareWithSpark(seedWorkspace('incomplete'), 'probability', 'Practice independence'),
    ).rejects.toBeInstanceOf(PreparationError);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(charges()[0].charged).toBeCloseTo(usageCost(100, 10));
  });

  it('rejects invented supporting passages while preserving original records and charging known usage', async () => {
    const state = seedWorkspace('bad-quote'),
      before = structuredClone(state);
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ++call === 1
          ? toolResponse('read_source', { sourceId }, call)
          : toolResponse(
              'prepare_practice',
              {
                ...proposal(),
                evidence: [
                  { sourceId, quote: 'This invented quotation does not occur in the source.' },
                ],
              },
              call,
            ),
      ),
    );
    await expect(
      prepareWithSpark(state, 'probability', 'Practice independence'),
    ).rejects.toBeInstanceOf(PreparationError);
    expect(state).toEqual(before);
    expect(charges()[0].charged).toBeCloseTo(3 * usageCost(100, 10));
    expect(call).toBe(3);
  });
  it('permits one validator-guided repair within the shared four-call budget', async () => {
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, options: RequestInit) => {
        call++;
        const body = JSON.parse(String(options.body));
        if (call === 1) return toolResponse('read_source', { sourceId }, call);
        if (call === 2)
          return toolResponse('prepare_practice', { ...proposal(), title: 'x' }, call);
        expect(JSON.parse(body.input.at(-1).output)).toMatchObject({
          accepted: false,
          validation: 'schema (title)',
        });
        return toolResponse('prepare_practice', proposal(), call);
      }),
    );
    const result = await prepareWithSpark(
      seedWorkspace('repair'),
      'probability',
      'Practice independence',
    );
    expect(result.lesson.kind).toBe('practice');
    expect(call).toBe(3);
    expect(result.run.steps.some((step) => step.includes('one permitted repair'))).toBe(true);
    expect(charges()[0].charged).toBeCloseTo(3 * usageCost(100, 10));
  });

  it('journals model justification separately from observed reads and validation without copying sources or the private task', async () => {
    const events: AuditEventInput[] = [];
    const audit: AuditWriter = {
      id: 'synthetic-audit',
      append: async (event) => {
        events.push(event);
      },
      finish: vi.fn(),
    };
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, options: RequestInit) => {
        const body = JSON.parse(String(options.body));
        expect(
          body.tools.every((tool: { parameters: { required: string[] } }) =>
            tool.parameters.required.includes('auditRationale'),
          ),
        ).toBe(true);
        return ++call === 1
          ? toolResponse(
              'read_source',
              {
                sourceId,
                auditRationale: 'Check the exact course distinction before selecting practice.',
              },
              call,
            )
          : toolResponse(
              'prepare_practice',
              {
                ...proposal(),
                auditRationale: 'Test the distinction supported by the disclosed course passage.',
              },
              call,
            );
      }),
    );
    const result = await prepareWithSpark(
      seedWorkspace('audited'),
      'probability',
      'Private task text should not enter the journal',
      { audit },
    );
    expect(result.lesson.kind).toBe('practice');
    expect(events.filter((event) => event.actor === 'model')).toHaveLength(2);
    expect(
      events
        .filter((event) => event.actor === 'model')
        .every((event) => event.visibility === 'protected' && event.rationale),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.actor === 'application' &&
          event.kind === 'observation' &&
          event.evidence?.some((ref) => ref.sourceId === sourceId && ref.version === 1),
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.kind === 'validation' && event.summary.includes('Publication still requires'),
      ),
    ).toBe(true);
    expect(events.some((event) => event.kind === 'publication')).toBe(false);
    expect(audit.finish).not.toHaveBeenCalled(); // The caller owns actual CAS publication.
    expect(JSON.stringify(events)).not.toContain('Private task text');
    expect(JSON.stringify(events)).not.toContain('Independence does not mean equal probabilities.');
    expect(call).toBe(2);
  });

  it('keeps a missing legacy tool rationale unrecorded and preserves rejection plus repair events', async () => {
    const events: AuditEventInput[] = [];
    let call = 0;
    const audit: AuditWriter = {
      id: 'legacy-audit',
      append: async (event) => {
        events.push(event);
      },
      finish: vi.fn(),
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ++call === 1
          ? toolResponse('read_source', { sourceId }, call)
          : toolResponse(
              'prepare_practice',
              { ...proposal(), title: call === 2 ? 'x' : proposal().title },
              call,
            ),
      ),
    );
    await prepareWithSpark(
      seedWorkspace('legacy-audited'),
      'probability',
      'Practice independence',
      { audit },
    );
    expect(
      events.filter((event) => event.actor === 'model').every((event) => !('rationale' in event)),
    ).toBe(true);
    expect(
      events.some(
        (event) => event.kind === 'validation' && event.summary.includes('failed schema'),
      ),
    ).toBe(true);
    expect(events.at(-1)?.kind).toBe('usage');
    expect(call).toBe(3);
  });

  it('stops before another model request when the durable journal becomes unavailable', async () => {
    let append = 0;
    const events: AuditEventInput[] = [];
    const audit: AuditWriter = {
      id: 'failed-audit',
      append: async (event) => {
        if (++append === 5)
          throw new AuditStoreError('Audit storage unavailable.', 503, 'audit_storage_unavailable');
        events.push(event);
      },
      finish: vi.fn(),
    };
    const provider = vi.fn(async () => toolResponse('read_source', { sourceId }, 1));
    vi.stubGlobal('fetch', provider);
    await expect(
      prepareWithSpark(seedWorkspace('audit-outage'), 'probability', 'Practice independence', {
        audit,
      }),
    ).rejects.toBeInstanceOf(AuditStoreError);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(events.some((event) => event.kind === 'publication')).toBe(false);
    expect(charges()[0].charged).toBeCloseTo(usageCost(100, 10));
  });
});
