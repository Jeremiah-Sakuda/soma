import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { automaticModelContext } from '../../src/lib/server/automatic-context';
import { investigateWithSpark } from '../../src/lib/server/investigator';

const PRIVATE = 'PRIVATE ADMINISTRATIVE PREVIEW MUST NOT BE RESENT';
function fixture() {
  const state = seedWorkspace('automatic-consent-boundary', '2026-10-28T12:00:00Z');
  const sample = state.sources[0];
  state.sources = [
    { ...sample, id: 'selected', courseId: 'circuits', version: 1, status: 'current' as const, title: 'Selected material', body: 'This selected synthetic teaching material describes a useful relationship.', context: { role: 'teaching-material' as const, applicability: 'course' as const }, provenance: { automaticPreparation: true, origin: 'manual-course' as const, sourceKey: 'selected', contentHash: 'selected', importedAt: state.createdAt } },
    { ...sample, id: 'legacy', courseId: 'circuits', version: 1, status: 'current' as const, title: PRIVATE, body: PRIVATE, provenance: undefined },
  ];
  state.lessons = state.lessons.slice(0, 2).map((lesson, index) => ({ ...lesson, courseId: 'circuits', sourceIds: [index ? 'legacy' : 'selected'], sourceVersions: { [index ? 'legacy' : 'selected']: 1 }, supportingPassages: undefined, ...(index ? { objective: PRIVATE, title: PRIVATE } : {}) }));
  return state;
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('unattended model source consent', () => {
  it('excludes legacy sources and derived lessons while preserving the original workspace', () => {
    const state = fixture(), before = structuredClone(state), filtered = automaticModelContext(state);
    expect(filtered.sources.map(source => source.id)).toEqual(['selected']);
    expect(filtered.lessons).toHaveLength(1);
    expect(JSON.stringify({ sources: filtered.sources, lessons: filtered.lessons })).not.toContain(PRIVATE);
    expect(state).toEqual(before);
    state.sources.push({ ...state.sources[0], version: 2, provenance: undefined });
    expect(automaticModelContext(state).sources).toHaveLength(0);
    expect(automaticModelContext(state).lessons).toHaveLength(0);
  });
  it('cannot disclose an unconsented source through a model-selected read after a selected source triggers work', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'soma-automatic-consent-'));
    for (const [name, value] of Object.entries({ SOMA_PERSISTENCE: 'local-synthetic', SOMA_LIVE_INFERENCE: 'true', MODEL_API_KEY: 'synthetic-key', META_ALLOCATION_USD: '1', META_APP_SPEND_CAP_USD: '.8', SOMA_BUDGET_DB_PATH: join(directory, 'budget.sqlite') })) vi.stubEnv(name, value);
    const state = fixture(); let calls = 0; const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init: RequestInit) => {
      requests.push(String(init.body)); calls++;
      const name = calls < 3 ? 'read_source' : 'finish_investigation';
      const args = calls < 3 ? { sourceId: calls === 1 ? 'legacy' : 'selected', offset: 0 } : { decision: 'keep-current', reason: 'The selected material preserves the current activity.', sourceRefs: [{ sourceId: 'selected', version: 1, quote: state.sources[0].body }], applicability: 'course', assessmentIds: [], selectedLessonIds: [], conflicts: [], academicUpdates: [] };
      return new Response(JSON.stringify({ status: 'completed', usage: { input_tokens: 20, output_tokens: 2 }, output: [{ type: 'function_call', name, arguments: JSON.stringify(args), call_id: `call-${calls}` }] }));
    }));
    try {
      const result = await investigateWithSpark(state, { courseId: 'circuits', initialSourceIds: ['selected'], goal: 'Investigate selected material.' }, { automatic: true });
      expect(result.record.toolActivity?.[0].outcome).toContain('Rejected');
      expect(result.reads.has('legacy')).toBe(false);
      expect(result.reads.has('selected')).toBe(true);
      expect(requests.join('\n')).not.toContain(PRIVATE);
      expect(requests[0]).not.toContain('"sourceId":"legacy"');
      expect(calls).toBe(3);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
