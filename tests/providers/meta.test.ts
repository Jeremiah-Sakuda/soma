import { describe, expect, it } from 'vitest';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { validateProposal } from '../../src/lib/server/meta';
describe('model proposal publication boundary', () => {
  const plan = {
    lessonId: 'parallel-nodes',
    sourceIds: ['source-d'],
    topology: 'parallel',
    voltage: 12,
    r1: 6,
    r2: 3,
    reason: 'The source describes shared nodes and branch current.',
    evidence: [
      {
        sourceId: 'source-d',
        quote: seedWorkspace('test')
          .sources.find((s) => s.id === 'source-d')!
          .body.slice(0, 60),
      },
    ],
  };
  it('requires actual authorized source reads before a proposal is accepted', () => {
    const state = seedWorkspace('test');
    expect(() => validateProposal(plan, state, 'circuits', new Set())).toThrow();
    expect(validateProposal(plan, state, 'circuits', new Set(['source-d'])).plan.r1).toBe(6);
    expect(() => validateProposal(plan, state, 'probability', new Set(['source-d']))).toThrow();
  });
  it('rejects unauthorized fields, source references, stale evidence and unsupported model parameters', () => {
    const state = seedWorkspace('test');
    const read = new Set(['source-d']);
    expect(() => validateProposal({ ...plan, mastered: true }, state, 'circuits', read)).toThrow();
    expect(() => validateProposal({ ...plan, r1: 0 }, state, 'circuits', read)).toThrow();
    expect(() =>
      validateProposal({ ...plan, topology: 'capacitor' }, state, 'circuits', read),
    ).toThrow();
    expect(() =>
      validateProposal(
        { ...plan, sourceIds: ['source-probability'] },
        state,
        'circuits',
        new Set(['source-probability']),
      ),
    ).toThrow();
    state.sources.find((s) => s.id === 'source-d')!.status = 'stale';
    expect(() => validateProposal(plan, state, 'circuits', read)).toThrow();
  });
});
