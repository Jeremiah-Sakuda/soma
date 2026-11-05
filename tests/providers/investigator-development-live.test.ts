import { describe, expect, it } from 'vitest';
import { seedWorkspace } from '../../src/lib/domain/seed';
import {
  investigateWithSpark,
  publishInvestigation,
  InvestigationError,
} from '../../src/lib/server/investigator';
import { applyAction } from '../../src/lib/domain/learning';

// Original development case. Never counted as held-out evaluation or real-class evidence.
describe.skipIf(process.env.SOMA_INVESTIGATION_DEVELOPMENT_TEST !== 'true')(
  'Spark diagnostic development probe',
  () => {
    it('prepares a source-grounded diagnostic and reconsiders its recorded response', async () => {
      let state = seedWorkspace(`investigation-dev-${crypto.randomUUID()}`);
      const invoke = async (request: Parameters<typeof investigateWithSpark>[1]) => {
        try {
          const result = await investigateWithSpark(state, request);
          console.log(
            JSON.stringify({
              stage: request.attemptId ? 'reconsideration' : 'initial',
              decision: result.decision.decision,
              usage: result.record.usage,
              tools: result.record.toolActivity?.map((item) => item.tool),
            }),
          );
          return result;
        } catch (error) {
          if (error instanceof InvestigationError)
            console.log(
              JSON.stringify({
                status: 'failed',
                effect: error.run.effect,
                steps: error.run.steps,
              }),
            );
          throw error;
        }
      };
      const first = await invoke({
        courseId: 'programming',
        initialSourceIds: ['source-programming'],
        goal: 'A prior answer used i <= n for a zero-indexed array. This could reflect confusion about the last valid index, or a misread comparison symbol. Read the course note and prepare an optional diagnostic that distinguishes these explanations.',
      });
      expect(first.lesson?.kind).toBe('practice');
      expect(first.record.diagnosticPlan).toBeDefined();
      state = publishInvestigation(state, first);
      const plan = first.record.diagnosticPlan!,
        lesson = first.lesson!;
      state = applyAction(state, {
        type: 'attempt',
        lessonId: lesson.id,
        optionIndex: plan.predictions[1].predictedOptionIndex,
      });
      expect(state.attempts[0].correct).toBeNull();
      const observation = structuredClone(state.attempts[0]);
      const next = await invoke({
        courseId: 'programming',
        previousInvestigationId: first.record.id,
        attemptId: observation.id,
        goal: 'Reconsider both explanations using the saved response. Weaken the explanation it contradicts, preserve uncertainty, and choose the next useful interaction without inferring mastery.',
      });
      state = publishInvestigation(state, next);
      expect(next.record.hypothesisRevisions?.some((item) => item.status === 'weakened')).toBe(
        true,
      );
      expect(state.attempts[0]).toEqual(observation);
      expect(state.investigations).toHaveLength(2);
    }, 200_000);
  },
);
