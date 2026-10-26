import { describe, it, expect } from 'vitest';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { prepareWithSpark } from '../../src/lib/server/meta';

describe.skipIf(process.env.SOMA_LIVE_META_TEST !== 'true')('explicit bounded live Spark preparation', () => {
  it('reads authorized sources and returns a validated immutable preview without altering learner evidence', async () => {
    const state = seedWorkspace(`live-probe-${crypto.randomUUID()}`);
    const original = structuredClone(state);
    const result = await prepareWithSpark(state, 'circuits', 'Explain parallel resistor branch currents using shared node voltage and Ohm’s law.').catch(error => { console.log(error.run); throw error; });
    expect(result.lesson.mode).toBe('live');
    expect(result.lesson.sourceIds.length).toBeGreaterThan(0);
    expect(result.run.status).toBe('completed');
    expect(result.run.steps.some(step => step.startsWith('Read '))).toBe(true);
    expect(result.lesson.validation?.status).toBe('development-preview');
    expect(state).toEqual(original);
  }, 100_000);
});
