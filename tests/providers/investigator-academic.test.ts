import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import { applySourceImport, sourceImportSchema } from '../../src/lib/server/imports';
import { investigateWithSpark, publishInvestigation } from '../../src/lib/server/investigator';
import { decodeAccountRecords, encodeAccountRecords } from '../../src/lib/server/account-store';
import { META_ENDPOINT } from '../../src/lib/server/meta-client';

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'soma-academic-investigation-'));
  for (const [key, value] of Object.entries({
    SOMA_PERSISTENCE: 'local-synthetic',
    SOMA_LIVE_INFERENCE: 'true',
    MODEL_API_KEY: 'synthetic-key-never-sent',
    META_API_BASE_URL: 'https://api.meta.ai/v1',
    META_MODEL_ID: 'muse-spark-1.3',
    META_ALLOCATION_USD: '1',
    META_APP_SPEND_CAP_USD: '0.8',
    SOMA_BUDGET_DB_PATH: join(directory, 'budget.sqlite'),
  }))
    vi.stubEnv(key, value);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});
const now = '2026-10-28T14:00:00Z';
const deadlineQuote = 'The assessment deadline is November fourth at 9 PM Eastern.';
const coverageQuote = 'Coverage includes sampling variability; sampling bias is excluded.';
function fixture() {
  return applySourceImport(
    seedEmptyAccountWorkspace('academic-integration-original', now),
    sourceImportSchema.parse({
      importId: 'source',
      expectedRevision: 0,
      sourceKey: 'assessment',
      title: 'Original synthetic assessment note',
      kind: 'course-text',
      text: `${deadlineQuote}\n${coverageQuote}`,
      course: { id: 'original-statistics', code: 'SYN', title: 'Original synthetic statistics' },
      assessment: { id: 'exam', title: 'Original synthetic assessment' },
      context: {
        role: 'instructor-update',
        applicability: 'assessment',
        assessmentId: 'exam',
        confirmedFacts: {
          deadline: {
            at: '2026-11-04T21:00:00-05:00',
            timezone: 'America/New_York',
            quote: deadlineQuote,
          },
          coverage: {
            includedTopics: ['sampling variability'],
            excludedTopics: ['sampling bias'],
            quote: coverageQuote,
          },
        },
      },
    }),
    now,
  ).workspace;
}

describe('academic finish boundary through the real investigation engine', () => {
  it('reads imported evidence, publishes typed deadline/coverage, serializes account records and reuses without inference', async () => {
    const state = fixture(),
      original = structuredClone(state),
      source = state.sources[0];
    const request = {
      courseId: source.courseId!,
      goal: 'Reconcile the confirmed assessment note while retaining valid teaching content.',
      initialSourceIds: [source.id],
    };
    let step = 0;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(META_ENDPOINT);
      const body = JSON.parse(init!.body as string);
      const finishTool = body.tools.find(
        (tool: { name: string }) => tool.name === 'finish_investigation',
      );
      expect(finishTool.parameters.required).toContain('academicUpdates');
      expect(body.tools).toHaveLength(8);
      if (step++) {
        const read = JSON.parse(
          body.input.filter((item: { type: string }) => item.type === 'function_call_output').at(-1)
            .output,
        );
        expect(read.body).toBe(source.body);
        expect(read.context.confirmedFacts.deadline.at).toBe('2026-11-04T21:00:00-05:00');
      }
      const output =
        step === 1
          ? { name: 'read_source', arguments: { sourceId: source.id, offset: 0 } }
          : {
              name: 'finish_investigation',
              arguments: {
                decision: 'keep-current',
                reason:
                  'The owner-confirmed date and scope can be reconciled without a replacement activity.',
                sourceRefs: [{ sourceId: source.id, version: 1, quote: source.body }],
                assessmentIds: ['exam'],
                applicability: 'assessment',
                conflicts: [],
                selectedLessonIds: [],
                academicUpdates: [
                  {
                    assessmentId: 'exam',
                    kind: 'deadline',
                    sourceRef: { sourceId: source.id, version: 1, quote: deadlineQuote },
                    lessonIds: [],
                    topic: '',
                    eligible: false,
                  },
                  {
                    assessmentId: 'exam',
                    kind: 'coverage',
                    sourceRef: { sourceId: source.id, version: 1, quote: coverageQuote },
                    lessonIds: [],
                    topic: '',
                    eligible: false,
                  },
                ],
              },
            };
      if (step > 2) throw new Error('Unexpected extra provider request.');
      return new Response(
        JSON.stringify({
          status: 'completed',
          usage: { input_tokens: 100, output_tokens: 20 },
          output: [
            {
              type: 'function_call',
              name: output.name,
              arguments: JSON.stringify(output.arguments),
              call_id: `synthetic-${step}`,
            },
          ],
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetcher);
    const result = await investigateWithSpark(state, request);
    expect(state).toEqual(original);
    expect(result.record.toolActivity?.map((item) => item.tool)).toEqual([
      'read_source',
      'finish_investigation',
    ]);
    const published = publishInvestigation(state, result);
    expect(published.courses[0].assessments?.[0]).toMatchObject({
      deadlineAt: '2026-11-04T21:00:00-05:00',
      includedTopics: ['sampling variability'],
      excludedTopics: ['sampling bias'],
    });
    expect(published.lessons).toEqual(original.lessons);
    expect(published.attempts).toEqual(original.attempts);
    expect(published.consequences?.filter((item) => item.id.startsWith('academic-'))).toHaveLength(
      2,
    );
    // Exercise actual record encoding, without claiming a managed Firestore write.
    const reloaded = decodeAccountRecords(encodeAccountRecords(published));
    expect(reloaded).toEqual(JSON.parse(JSON.stringify(published)));
    const reused = await investigateWithSpark(reloaded, request);
    expect(reused.reused).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('revalidates owner confirmation and source status at publication rather than trusting an earlier proposal', async () => {
    const state = fixture(),
      source = state.sources[0];
    let step = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const action =
          step++ === 0
            ? { name: 'read_source', arguments: { sourceId: source.id, offset: 0 } }
            : {
                name: 'finish_investigation',
                arguments: {
                  decision: 'keep-current',
                  reason: 'Apply the confirmed deadline without regenerating learning content.',
                  sourceRefs: [{ sourceId: source.id, version: 1, quote: deadlineQuote }],
                  assessmentIds: ['exam'],
                  applicability: 'assessment',
                  conflicts: [],
                  selectedLessonIds: [],
                  academicUpdates: [
                    {
                      assessmentId: 'exam',
                      kind: 'deadline',
                      sourceRef: { sourceId: source.id, version: 1, quote: deadlineQuote },
                      lessonIds: [],
                      topic: '',
                      eligible: false,
                    },
                  ],
                },
              };
        return new Response(
          JSON.stringify({
            status: 'completed',
            usage: { input_tokens: 100, output_tokens: 20 },
            output: [
              {
                type: 'function_call',
                name: action.name,
                arguments: JSON.stringify(action.arguments),
                call_id: `synthetic-${step}`,
              },
            ],
          }),
        );
      }),
    );
    const result = await investigateWithSpark(state, {
      courseId: source.courseId!,
      goal: 'Reconcile the confirmed deadline.',
    });
    const noConfirmation = structuredClone(state);
    delete noConfirmation.sources[0].context!.confirmedFacts;
    expect(() => publishInvestigation(noConfirmation, result)).toThrow('owner-confirmed');
    const stale = structuredClone(state);
    stale.sources[0].status = 'stale';
    expect(() => publishInvestigation(stale, result)).toThrow('changed');
    expect(state.courses[0].assessments?.[0].deadlineAt).toBeUndefined();
  });
});
