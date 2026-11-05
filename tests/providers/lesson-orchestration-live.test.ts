import { describe, expect, it } from 'vitest';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { prepareWithSpark } from '../../src/lib/server/meta';
import { InferenceBudgetError } from '../../src/lib/server/budget';

// Explicit opt-in only; uses the actual shared Firestore allowance, never a test budget.
// Synthetic sources only. No publication, account records, connected sources or private material.
describe.skipIf(process.env.SOMA_LIVE_ORCHESTRATION_TEST !== 'true')(
  'bounded real Spark/Wonder handoff',
  () => {
    it('prepares a synthetic activity through both provider models within the existing allowance', async (context) => {
      expect(process.env.SOMA_PERSISTENCE).toBe('firestore');
      const state = seedWorkspace(`orchestration-live-${crypto.randomUUID()}`),
        original = structuredClone(state);
      let result;
      try {
        result = await prepareWithSpark(
          state,
          'probability',
          'Prepare original practice distinguishing independence from equality of probabilities.',
          { review: true },
        );
      } catch (error) {
        if (error instanceof InferenceBudgetError) {
          process.stdout.write(
            JSON.stringify({ liveOrchestration: 'deferred', reason: error.reason }) + '\n',
          );
          context.skip();
          return;
        }
        const failure = error as { failure?: unknown; run?: { steps?: string[] } };
        console.log(
          JSON.stringify({
            liveOrchestration: 'failed',
            failure: failure.failure,
            steps: failure.run?.steps,
          }),
        );
        throw new Error('Real orchestration failed; see the bounded failure record above.');
      }
      expect(state).toEqual(original);
      expect(
        result.run.orchestration?.handoffs.some(
          (h) => h.model === 'muse-spark-1.3' && h.outcome === 'proposed',
        ),
      ).toBe(true);
      expect(result.run.orchestration?.handoffs.at(-1)).toMatchObject({
        model: 'muse-wonder-1.0',
        outcome: 'approve',
      });
      expect(result.lesson.validation?.status).toBe('development-preview');
      console.log(
        JSON.stringify({
          liveOrchestration: 'completed',
          handoffs: result.run.orchestration?.handoffs,
          summary: result.run.steps.filter((step) => step.includes('Meta calls')),
        }),
      );
    }, 100_000);
  },
);
