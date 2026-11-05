import { describe, it, expect, vi } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createExplorationService } from '../../src/lib/server/exploration';
import { analyzeCompanionMemory } from '../../src/lib/server/companion-analysis';
import { applyCompanionMemoryCommand } from '../../src/lib/server/companion-memory';
import { explorationStore } from '../../src/lib/server/exploration-store';
import { getServerFirestore } from '../../src/lib/server/firebase-config';
import { planComputerAction } from '../../src/lib/server/computer-actions';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';
// Opt-in actual Meta requests against original synthetic sources only. Uses the existing
// Firestore ledger, never a new local allowance. No native execution or personal data.
describe.skipIf(process.env.SOMA_COMPANION_LIVE !== 'true')(
  'actual Muse personal companion',
  () => {
    it('connects saved originals, uses memory in a visual and proposes a bounded form action', async () => {
      if (process.env.SOMA_PERSISTENCE !== 'firestore')
        throw Error('Live proof requires existing shared Firestore budget.');
      const db = getServerFirestore(),
        before = await db.doc('somaBudget/global').get();
      const cap = Math.min(
        Number(process.env.META_APP_SPEND_CAP_USD),
        Number(process.env.META_ALLOCATION_USD) * 0.8,
      );
      if (cap - Number(before.data()?.consumed ?? 0) < 1.05)
        throw Error('Insufficient remaining shared allowance for three .35 reservations.');
      const id = randomBytes(32).toString('hex'),
        p: ExplorationPrincipal = {
          kind: 'guest',
          id,
          workspaceId: id,
          generation: id,
          key: `guest-${id}`,
        };
      const service = createExplorationService();
      const evidence: Record<string, unknown> = {
        startedAt: new Date().toISOString(),
        beforeConsumedUsd: before.data()?.consumed,
      };
      const providerFacts: unknown[] = [];
      const originalFetch = globalThis.fetch;
      vi.stubGlobal('fetch', async (...args: Parameters<typeof fetch>) => {
        const response = await originalFetch(...args);
        if (String(args[0]).startsWith('https://api.meta.ai/')) {
          const body = await response.clone().json();
          providerFacts.push({
            status: response.status,
            error: body.error,
            usage: body.usage,
            tools: Array.isArray(body.output)
              ? body.output.filter((item: { type?: string }) => item.type === 'function_call')
              : [],
          });
        }
        return response;
      });
      try {
        await service.initialize(p);
        const first = await service.example(p),
          second = await service.example(p, true);
        await service.save(p, first.artifact.id, 1, first.artifact.state);
        await service.save(p, second.artifact.id, 1, second.artifact.state);
        await explorationStore.mutate(p, (s) => {
          applyCompanionMemoryCommand(s, {
            action: 'upsert-goal',
            revision: 0,
            kind: 'goal',
            text: 'Understand how search and prioritization connect across study and work. Prefer a short visual comparison, and keep uncertain connections tentative.',
          });
        });
        const memory = await analyzeCompanionMemory(p, {
          artifactId: second.artifact.id,
          version: 1,
          revision: 1,
          requestId: randomUUID(),
        });
        evidence.memory = {
          ...memory.audit,
          concepts: memory.memory.concepts,
          relationships: memory.memory.relationships,
          nextActivity: memory.memory.nextActivity,
        };
        expect(memory.memory.concepts.length).toBeGreaterThan(0);
        expect(memory.memory.nextActivity).toBeDefined();
        expect(memory.audit.calls).toBe(2);
        const visual = await service.generate(p, {
          action: 'generate',
          requestId: randomUUID(),
          question:
            'Explain this current graph using one relevant connection from my saved memory. Keep all current parameters.',
          artifactId: second.artifact.id,
          baseVersion: 1,
          intent: 'explain',
          state: second.artifact.state,
        });
        evidence.visual = {
          mode: visual.artifact.spec.mode,
          generation: visual.artifact.generation,
          objective: visual.artifact.spec.objective,
          steps: visual.artifact.spec.mode === 'clarify' ? [] : visual.artifact.spec.steps,
        };
        expect(
          visual.artifact.generation.audit.some((a) =>
            a.detail.includes('Personal context revision'),
          ),
        ).toBe(true);
        expect(visual.artifact.spec.mode).toBe('checked-dijkstra');
        const action = await planComputerAction(p, {
          goal: 'Fill the Display name field with Ada. Do not submit the form.',
          app: 'Original synthetic preferences form',
          controls: [
            { id: 0, role: 'AXTextField', label: 'Display name' },
            { id: 1, role: 'AXButton', label: 'Save profile' },
          ],
        });
        evidence.action = action;
        expect(action.plan.kind).toBe('plan');
        expect(action.plan.steps[0]).toMatchObject({
          kind: 'type',
          target: 0,
          text: 'Ada',
        });
        expect(action.plan.steps.every((step) => step.kind !== 'click' || step.target !== 1)).toBe(
          true,
        );
        expect(action.audit.executed).toBe(false);
      } catch (error) {
        evidence.failure = {
          code: (error as { code?: string }).code ?? 'assertion',
          message: (error as Error).message,
        };
        throw error;
      } finally {
        vi.unstubAllGlobals();
        evidence.providerFacts = providerFacts;
        evidence.afterConsumedUsd = (await db.doc('somaBudget/global').get()).data()?.consumed;
        await db.collection('somaExploreGuests').doc(id).delete();
        mkdirSync('.local/verification', { recursive: true });
        writeFileSync('.local/verification/companion-live.json', JSON.stringify(evidence, null, 2));
      }
    }, 180000);
  },
);
