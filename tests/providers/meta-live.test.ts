import { describe, it, expect } from 'vitest';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { prepareWithSpark } from '../../src/lib/server/meta';
import { applyAction } from '../../src/lib/domain/learning';

describe.skipIf(process.env.SOMA_LIVE_META_TEST !== 'true')(
  'explicit bounded live Spark preparation',
  () => {
    it('reads authorized sources and returns a validated immutable preview without altering learner evidence', async () => {
      const state = seedWorkspace(`live-probe-${crypto.randomUUID()}`);
      const original = structuredClone(state);
      const result = await prepareWithSpark(
        state,
        'circuits',
        'Explain parallel resistor branch currents using shared node voltage and Ohm’s law.',
      ).catch((error) => {
        console.log(error.run);
        throw error;
      });
      expect(result.lesson.mode).toBe('live');
      expect(result.lesson.sourceIds.length).toBeGreaterThan(0);
      expect(result.run.status).toBe('completed');
      expect(result.run.steps.some((step) => step.startsWith('Read '))).toBe(true);
      expect(result.lesson.validation?.status).toBe('development-preview');
      expect(state).toEqual(original);
    }, 100_000);
    it('prepares source-grounded ordinary practice with recorded assistance context', async () => {
      let state = seedWorkspace(`live-practice-${crypto.randomUUID()}`);
      state = applyAction(state, {
        type: 'assistance',
        lessonId: 'independent-events',
        kind: 'hint',
      });
      state = applyAction(state, {
        type: 'attempt',
        lessonId: 'independent-events',
        optionIndex: 0,
      });
      const original = structuredClone(state);
      const result = await prepareWithSpark(
        state,
        'probability',
        'Prepare a different original question distinguishing independence from equal probabilities. Use the recorded response only as a revisable observation.',
      );
      expect(result.lesson).toMatchObject({
        kind: 'practice',
        mode: 'live',
        examEligible: false,
        validation: { status: 'development-preview' },
      });
      expect(result.lesson.supportingPassages?.length).toBeGreaterThan(0);
      expect(state.attempts.some((attempt) => attempt.question === result.lesson.question)).toBe(
        false,
      );
      expect(state).toEqual(original);
      const persisted = { ...state, lessons: [result.lesson, ...state.lessons] };
      const reopened = await prepareWithSpark(
        persisted,
        'probability',
        'Prepare a different original question distinguishing independence from equal probabilities. Use the recorded response only as a revisable observation.',
      );
      expect(reopened.run).toMatchObject({ status: 'unchanged', mode: 'prepared' });
      expect(reopened.lesson.id).toBe(result.lesson.id);
    }, 100_000);
  },
);
