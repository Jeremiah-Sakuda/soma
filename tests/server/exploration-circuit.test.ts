import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createExplorationService, validateExplorationViewState } from '../../src/lib/server/exploration';
import { closeExplorationStore } from '../../src/lib/server/exploration-store';
import type { MetaResult } from '../../src/lib/server/meta-client';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';
import { heroCircuit, heroCircuitLayout } from '../fixtures/hero-circuit';

const owner: ExplorationPrincipal = {
  kind: 'guest',
  id: 'c'.repeat(64),
  workspaceId: 'c'.repeat(64),
  generation: 'c'.repeat(64),
  key: `guest-${'c'.repeat(64)}`,
};
function result(name: string, value: unknown, index: number): MetaResult {
  return {
    status: 'completed',
    tools: [{ type: 'function_call', name, arguments: JSON.stringify(value), call_id: `call-${index}`, parsedArguments: value as Record<string, unknown> }],
    usage: { input_tokens: 100, output_tokens: 200 },
  };
}
/** Spark reads the bridge slide as a circuit; the composer writes only the words. */
function script(copy?: (context: any) => unknown) {
  let index = 0;
  return vi.fn(async (request: { instructions: string; input: readonly unknown[] }) => {
    index++;
    if (request.instructions.includes('source reader'))
      return result(
        'inspect_source',
        {
          summary: 'A Wheatstone bridge: a 12 V battery across R1–R2 and R3–R4, with R5 between B and C.',
          uncertainty: [],
          graph: null,
          nodePositions: null,
          edgeLabels: null,
          circuit: heroCircuit,
          circuitLayout: {
            nodes: heroCircuitLayout.nodes,
            components: heroCircuitLayout.components,
          },
          anchors: [],
          change: null,
        },
        index,
      );
    expect(request.instructions).toContain('compose_circuit');
    const context = JSON.parse((request.input[0] as { content: string }).content);
    return result(
      'compose_circuit',
      copy?.(context) ?? {
        title: 'Why no current crosses R₅',
        objective: 'See that B and C sit at the same voltage.',
        assumptions: [],
        steps: [
          { traceIndex: 0, caption: 'D is ground, at 0 V.', narration: 'Start from ground.', highlightIds: ['D'] },
          {
            traceIndex: 3,
            caption: 'B and C both sit at 8 V, so R₅ carries no current.',
            narration: 'Equal voltages at both ends mean no current through R₅.',
            highlightIds: ['B', 'C', 'R5'],
          },
        ],
        followups: ['What if R₂ burns out?'],
      },
      index,
    );
  });
}
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'soma-circuit-test-'));
  vi.stubEnv('SOMA_PERSISTENCE', 'local-synthetic');
  vi.stubEnv('SOMA_EXPLORATION_DB_PATH', join(directory, 'explore.sqlite'));
  vi.stubEnv('VERCEL', '');
});
afterEach(() => {
  closeExplorationStore();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(directory, { recursive: true, force: true });
});
const service = (request = script(), review?: ReturnType<typeof vi.fn>) =>
  createExplorationService({
    request: request as never,
    upperBound: () => 0.03,
    reserve: async () => randomUUID(),
    settle: async () => {},
    enabled: () => true,
    validateImage: vi.fn() as never,
    revalidate: async () => {},
    ...(review ? { review: review as never, reviewEnabled: () => true } : {}),
  });
const screenshot = (question = 'Why is there no current through R5?') => ({
  action: 'generate' as const,
  requestId: randomUUID(),
  question,
  source: {
    kind: 'screenshot' as const,
    dataUrl: 'data:image/png;base64,AAAA',
    label: 'Lecture 9 slide',
    capturedAt: new Date().toISOString(),
  },
});

describe('a circuit read from a slide becomes a checked circuit', () => {
  it('solves the reading, binds the words to the solution and keeps where the source drew it', async () => {
    const request = script();
    const soma = service(request);
    await soma.initialize(owner);
    const artifact = (await soma.generate(owner, screenshot() as never)).artifact;
    expect(artifact.validation.assurance).toBe('checked-circuit');
    expect(artifact.validation.checks).toContain('kirchhoff');
    expect(artifact.circuit?.voltages).toMatchObject({ A: 12, B: 8, C: 8, D: 0 });
    expect(artifact.circuit?.exact.currents.R5).toBe('0');
    if (artifact.spec.mode !== 'checked-circuit') throw new Error('mode');
    expect(artifact.spec.input).toEqual(heroCircuit);
    expect(artifact.spec.controls).toEqual(['step', 'replay', 'open-component', 'set-value']);
    expect(artifact.spec.steps.map((s) => s.executionStep)).toEqual([0, 3]);
    expect(artifact.source.layout?.components).toHaveLength(6);
    expect(artifact.generation.calls).toBe(2);
    expect(artifact.generation.audit.map((a) => a.detail).join(' ')).toContain('Checked dc-nodal solution');
    const composerContext = JSON.parse((request.mock.calls[1][0].input[0] as { content: string }).content);
    expect(composerContext.checkedCircuit.currents.R1).toBe(2);
    expect(request.mock.calls[0][0].instructions).toContain('electrically distinct junctions');
  });

  it('accepts the circuit experiment as view state and rejects anything else', async () => {
    const soma = service();
    await soma.initialize(owner);
    const { spec } = (await soma.generate(owner, screenshot() as never)).artifact;
    const base = { step: 3, explanationStep: 0, start: null, goal: null, disabledEdgeIds: [], reversed: false, selectedObjectId: null };
    expect(validateExplorationViewState(spec, { ...base, disabledEdgeIds: ['R2'], edgeWeights: { R4: 10 } })).toMatchObject({
      disabledEdgeIds: ['R2'],
    });
    for (const bad of [
      { ...base, disabledEdgeIds: ['Z'] },
      { ...base, edgeWeights: { R4: 0 } },
      { ...base, edgeWeights: { V1: 1e6 } },
      { ...base, start: 'A' },
      { ...base, step: 4 },
    ])
      expect(() => validateExplorationViewState(spec, bad)).toThrow();
  });

  it('explains a follow-up under the learner’s open part and carries the experiment forward', async () => {
    const request = script((context) => ({
      title: 'With R₂ open',
      objective: 'Current now crosses R₅.',
      assumptions: [],
      steps: [
        {
          traceIndex: context.checkedCircuit.steps.length - 1,
          caption: 'With R₂ open, current crosses R₅ from B to C.',
          narration: 'Opening R₂ sends current through R₅.',
          highlightIds: ['R2', 'R5'],
        },
      ],
      followups: [],
    }));
    const soma = service(request);
    await soma.initialize(owner);
    const first = (await soma.generate(owner, screenshot() as never)).artifact;
    const second = (
      await soma.generate(owner, {
        action: 'generate',
        requestId: randomUUID(),
        question: 'Why does R5 carry current now?',
        intent: 'auto',
        artifactId: first.id,
        baseVersion: first.version,
        state: { ...first.state, disabledEdgeIds: ['R2'], step: 3 },
      } as never)
    ).artifact;
    expect(second.version).toBe(2);
    expect(second.state.disabledEdgeIds).toEqual(['R2']);
    const context = JSON.parse((request.mock.calls[2][0].input[0] as { content: string }).content);
    expect(context.checkedCircuit.currents.R2).toBe(0);
    expect(context.checkedCircuit.currents.R5).toBeGreaterThan(0);
    // The follow-up reuses the reading: no second look at the image.
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('sends the solved circuit to Muse Wonder for review', async () => {
    const review = vi.fn(async () => result('review_exploration', { verdict: 'approve', findings: [] }, 9));
    const soma = service(script(), review);
    await soma.initialize(owner);
    const artifact = (await soma.generate(owner, screenshot() as never)).artifact;
    expect(review).toHaveBeenCalledTimes(1);
    const sent = JSON.stringify((review.mock.calls[0] as unknown as [{ input: unknown }])[0].input);
    expect(sent).toContain('checkedCircuit');
    expect(artifact.generation.audit.map((a) => a.event)).toContain('review-approved');
  });
});
