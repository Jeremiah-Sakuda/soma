import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createExplorationService, validateExplorationViewState } from '../../src/lib/server/exploration';
import { explorationInputsChanged } from '../../src/lib/domain/exploration-view';
import { circuitSpec } from '../../src/lib/server/circuit-authoring';
import { closeExplorationStore } from '../../src/lib/server/exploration-store';
import { MetaClientError, type MetaResult } from '../../src/lib/server/meta-client';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';
import { heroCircuit, heroCircuitLayout } from '../fixtures/hero-circuit';
import recordedCircuit from '../../src/lib/fixtures/recorded-circuit.json';

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
    if (request.instructions.includes('choose_circuit_investigation'))
      return result(
        'choose_circuit_investigation',
        { componentId: 'R4', watch: 'current', targetId: 'R5', condition: 'zero', reason: 'R₄ sets the voltage at C, the far end of R₅.' },
        index,
      );
    if (request.instructions.includes('Return only check_circuit_reading.'))
      return result('check_circuit_reading', { verdict: 'confirmed', issues: [] }, index);
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
const service = (request = script(), review?: ReturnType<typeof vi.fn>, imageSha256?: string) =>
  createExplorationService({
    request: request as never,
    upperBound: () => 0.03,
    reserve: async () => randomUUID(),
    settle: async () => {},
    enabled: () => true,
    validateImage: vi.fn(() => imageSha256 ? { sha256: imageSha256 } : undefined) as never,
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
  it('keeps an approved public source and alignment across live follow-ups, then resets them on a fresh capture', async () => {
    const request = script();
    const review = vi.fn(async () => result('review_exploration', { verdict: 'approve', findings: [] }, 99));
    // Even a new capture with the same pixels must not inherit public-demo provenance.
    const soma = service(request, review, recordedCircuit.source.imageSha256);
    await soma.initialize(owner);
    const first = (await soma.recording(owner, false, 'circuit')).artifact;
    expect(first.source.publicDemo?.image).toBe('/synthetic/recorded-lecture-9.png');
    expect(first.source.publicDemo?.presentation?.kind).toBe('circuit-drawing-alignment-v1');
    expect(request).not.toHaveBeenCalled();
    expect(review).not.toHaveBeenCalled();
    const original = structuredClone(first);
    const second = (await soma.generate(owner, {
      action: 'generate', requestId: randomUUID(), question: 'Why is R5 current zero?',
      artifactId: first.id, baseVersion: first.version,
    })).artifact;
    expect(second.recording).toBeUndefined();
    expect(second.generation).toMatchObject({ mode: 'live', provider: 'meta', calls: 2 });
    expect(second.generation).not.toEqual(first.generation);
    expect(second.source.publicDemo).toEqual(first.source.publicDemo);
    expect(second.source.layout).toEqual(first.source.layout);
    expect(second.source.observationId).toBe(first.source.observationId);
    expect(first).toEqual(original);
    await soma.save(owner, second.id, second.version, second.state);
    closeExplorationStore();
    expect((await soma.read(owner, second.id)).active?.source.publicDemo).toEqual(first.source.publicDemo);
    const third = (await soma.generate(owner, {
      ...screenshot(), artifactId: second.id, baseVersion: second.version,
    })).artifact;
    expect(third.source.imageSha256).toBe(first.source.imageSha256);
    expect(third.source.observationId).not.toBe(first.source.observationId);
    expect(third.source.publicDemo).toBeUndefined();
    expect(third.recording).toBeUndefined();
    expect((await soma.read(owner, first.id, 1)).active?.source).toEqual(original.source);
  });

  it('rejects caller-supplied public-demo metadata before any provider call', async () => {
    const request = script();
    const soma = service(request);
    await soma.initialize(owner);
    const capture = screenshot();
    await expect(soma.generate(owner, {
      ...capture, source: { ...capture.source, publicDemo: { image: '/synthetic/recorded-lecture-9.png' } },
    })).rejects.toMatchObject({ code: 'invalid_request' });
    expect(request).not.toHaveBeenCalled();
  });

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
    // The words were written for R₂ open, so they show with it open and pause once it closes.
    if (second.spec.mode !== 'checked-circuit') throw new Error('mode');
    expect(second.spec.writtenFor).toEqual({ open: ['R2'], values: {} });
    expect(explorationInputsChanged(second.spec, second.state)).toBe(false);
    expect(explorationInputsChanged(second.spec, { ...second.state, disabledEdgeIds: [] })).toBe(true);
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
    expect(artifact.source.circuitReadingCheck?.status).toBe('confirmed');
  });

  it('repairs a misread resistance only after Wonder sees the pixels and Spark independently agrees', async () => {
    const base = script((context) => {
      expect(context.source.circuitReadingCheck).toMatchObject({
        status: 'corrected', corrections: [{ componentId: 'R4', from: 8, to: 10 }],
      });
      expect(context.source.summary).toContain('Source value corrections supersede any earlier values');
      expect(context.source.summary).toContain('R₄: 8 → 10 ohms');
      return {
      title: 'A changed bridge balance', objective: 'Inspect the corrected resistance.', assumptions: [],
      steps: [{ traceIndex: 0, caption: 'D is ground, at 0 V.', narration: 'Start at ground.', highlightIds: ['D'] }],
      followups: [],
      };
    });
    const request = vi.fn(async (args: any) => {
      const name = args.tools?.[0]?.name;
      if (name === 'check_circuit_reading') {
        expect(args.model).toBe('muse-wonder-1.0');
        expect(args.input[0].content).toContainEqual({ type: 'input_image', image_url: 'data:image/png;base64,AAAA' });
        return result(name, { verdict: 'disagree', issues: [{ componentId: 'R4', kind: 'value', value: 10, note: 'The printed value is ten ohms.' }] }, 2);
      }
      if (name === 'recheck_circuit_values') {
        const text = JSON.parse(args.input[0].content[0].text);
        expect(text.components).toEqual([{ id: 'R4', label: 'R₄', kind: 'resistor', from: 'C', to: 'D' }]);
        expect(JSON.stringify(text)).not.toContain('value');
        return result(name, { values: [{ componentId: 'R4', value: 10 }] }, 3);
      }
      return base(args);
    });
    const review = vi.fn(async (args: { input: readonly unknown[] }) => {
      const context = JSON.parse((args.input[0] as { content: string }).content);
      expect(context.source).toContain('R₄: 8 → 10 ohms');
      expect(context.checked.circuitReadingCheck).toMatchObject({
        status: 'corrected', corrections: [{ componentId: 'R4', from: 8, to: 10 }],
      });
      expect(context.checked.checkedCircuit.input.components.find((part: { id: string }) => part.id === 'R4').value).toBe(10);
      return result('review_exploration', { verdict: 'approve', findings: [] }, 9);
    });
    const soma = service(request as never, review);
    await soma.initialize(owner);
    const artifact = (await soma.generate(owner, screenshot() as never)).artifact;
    expect(artifact.spec.mode).toBe('checked-circuit');
    expect(artifact.circuit?.input.components.find((p) => p.id === 'R4')?.value).toBe(10);
    expect(artifact.circuit?.currents.R5).not.toBe(0);
    expect(artifact.source.circuitReadingCheck).toMatchObject({ status: 'corrected', corrections: [{ componentId: 'R4', from: 8, to: 10 }] });
    expect(artifact.generation.calls).toBeLessThanOrEqual(8);
  });

  it.each([
    ['composition', 0.25, 0.11, 2],
    ['factual review', 0.33, 0.005, 3],
  ] as const)('reserves unknown reading cost before admitting %s within the same $0.35 turn', async (_stage, unknownBound, compositionBound, expectedRequests) => {
    const base = script();
    const request = vi.fn(async (args: any) => {
      if (args.tools?.[0]?.name === 'check_circuit_reading')
        throw new MetaClientError('timeout', null, true);
      return base(args);
    });
    const review = vi.fn(async () => result('review_exploration', { verdict: 'approve', findings: [] }, 9));
    const settle = vi.fn(async (_reservation: string, _knownCost: number, _certain: boolean) => {});
    const soma = createExplorationService({
      request: request as never,
      upperBound: (args) => args.tools.some((tool: any) => tool.name === 'check_circuit_reading')
        ? unknownBound : args.instructions.includes('source reader') ? 0.01 : compositionBound,
      reserve: async () => 'unknown-reading-reservation', settle,
      enabled: () => true, validateImage: vi.fn() as never, revalidate: async () => {},
      review: review as never, reviewEnabled: () => true,
    });
    await soma.initialize(owner);
    await expect(soma.generate(owner, screenshot() as never)).rejects.toMatchObject({ code: 'capacity' });
    // The first source read completes. Wonder's response is lost after sending; its
    // upper bound must still reduce what composition and factual review may spend.
    expect(request).toHaveBeenCalledTimes(expectedRequests);
    expect(review).not.toHaveBeenCalled();
    expect(settle).toHaveBeenCalledWith('unknown-reading-reservation', expect.any(Number), false);
  });

  it('never publishes a checked circuit after unresolved source polarity disagreement, even if composition tries', async () => {
    const base = script();
    let compositions = 0;
    const request = vi.fn(async (args: any) => {
      if (args.tools?.[0]?.name === 'check_circuit_reading')
        return result('check_circuit_reading', {
          verdict: 'disagree',
          issues: [{ componentId: 'V1', kind: 'polarity', value: null, note: 'The positive terminal is at the other end.' }],
        }, 2);
      if (args.instructions.includes('source reader')) return base(args);
      expect(args.instructions).not.toContain('Use compose_circuit');
      const context = JSON.parse(args.input[0].content);
      expect(context.checkedCircuit).toBeUndefined();
      expect(context.source.uncertainty.join(' ')).toContain('polarity');
      const binding = /Required spec id=([^ ]+) and version=(\d+)/.exec(args.instructions)!;
      compositions++;
      if (compositions === 1) {
        // A model can ignore the instructed fallback. The actual application binding
        // must reject this otherwise valid checked spec before accepting a clarification.
        return result('compose_exploration', { spec: circuitSpec({
          id: binding[1], version: Number(binding[2]),
          observationId: context.source.observationId, sourceVersion: 1,
          input: heroCircuit, layout: heroCircuitLayout, uncertainty: [],
          copy: { title: 'A bridge', objective: 'Read the bridge.', assumptions: [],
            steps: [{ traceIndex: 0, caption: 'D is ground.', narration: 'D is ground.', highlightIds: ['D'] }], followups: [] },
        }) }, 3);
      }
      return result('compose_exploration', { spec: {
        schemaVersion: 'exploration-v1', id: binding[1], version: Number(binding[2]),
        mode: 'clarify', title: 'Check the battery polarity', objective: 'Resolve the source reading.',
        sources: [{ observationId: context.source.observationId, version: 1, region: null }],
        assumptions: [], uncertainty: context.source.uncertainty, unsupportedClaims: [],
        question: 'Which terminal of V1 is positive? Please share a clearer image.',
      } }, 4);
    });
    const review = vi.fn(async () => result('review_exploration', { verdict: 'approve', findings: [] }, 5));
    const soma = service(request as never, review);
    await soma.initialize(owner);
    const artifact = (await soma.generate(owner, screenshot() as never)).artifact;
    expect(compositions).toBe(2);
    expect(artifact.spec.mode).toBe('clarify');
    expect(artifact.validation.assurance).toBe('needs-clarification');
    expect(artifact.circuit ?? null).toBeNull();
    expect(artifact.source.circuitReadingCheck?.status).toBe('disputed');
    expect(artifact.generation.audit.map((event) => event.event)).toContain('reading-disputed');
    expect(artifact.generation.calls).toBeLessThanOrEqual(8);
  });

  it('lets Muse choose the part a question is about and computes exactly where it tips', async () => {
    const request = script();
    const soma = service(request);
    await soma.initialize(owner);
    const first = (await soma.generate(owner, screenshot() as never)).artifact;
    const second = (
      await soma.generate(owner, {
        action: 'generate',
        requestId: randomUUID(),
        question: 'When would current flow through R5?',
        intent: 'investigate',
        artifactId: first.id,
        baseVersion: first.version,
        state: first.state,
      } as never)
    ).artifact;
    expect(second.circuitExperiment).toMatchObject({
      componentId: 'R4',
      observe: { kind: 'current', componentId: 'R5' },
      criticalValue: 8,
      criticalExact: '8',
      verified: true,
      rationale: 'R₄ sets the voltage at C, the far end of R₅.',
    });
    expect(second.generation.audit.map((a) => a.event)).toContain('cost-probed');
    const composer = JSON.parse((request.mock.calls.at(-1)![0].input[0] as { content: string }).content);
    expect(composer.circuitExperiment.criticalValue).toBe(8);
    // A later follow-up keeps the experiment, recomputed under the learner's current changes.
    const third = (
      await soma.generate(owner, {
        action: 'generate',
        requestId: randomUUID(),
        question: 'Why does it reverse there?',
        intent: 'auto',
        artifactId: first.id,
        baseVersion: second.version,
        state: { ...second.state, edgeWeights: { R4: 10 } },
      } as never)
    ).artifact;
    expect(third.circuitExperiment?.criticalValue).toBe(8);
  });

  it('starts a new capture from its circuit as read, not the earlier experiment', async () => {
    const soma = service();
    await soma.initialize(owner);
    const first = (await soma.generate(owner, screenshot() as never)).artifact;
    const next = (
      await soma.generate(owner, {
        ...screenshot('What about this slide?'),
        artifactId: first.id,
        baseVersion: first.version,
        state: { ...first.state, disabledEdgeIds: ['R2'], edgeWeights: { R4: 10 } },
      } as never)
    ).artifact;
    expect(next.state.disabledEdgeIds).toEqual([]);
    expect(next.state.edgeWeights ?? {}).toEqual({});
    if (next.spec.mode !== 'checked-circuit') throw new Error('mode');
    expect(next.spec.writtenFor ?? null).toBeNull();
  });

  it.each([
    ['R4 sets the voltage at C.', 'R4 sets the voltage at C.'],
    // A label that ends the sentence is still a label, not a decimal.
    ['R4 sets the voltage at C, the far end of R5.', 'R4 sets the voltage at C, the far end of R5.'],
    ['R4 at 8.5 sets the voltage at C.', null],
  ])('keeps a reason that names a part by its label: %s', async (reason, kept) => {
    const request = script();
    const base = request.getMockImplementation()!;
    request.mockImplementation(async (r: { instructions: string; input: readonly unknown[] }) =>
      r.instructions.includes('choose_circuit_investigation')
        ? result('choose_circuit_investigation', { componentId: 'R4', watch: 'current', targetId: 'R5', condition: 'zero', reason }, 7)
        : base(r),
    );
    const soma = service(request);
    await soma.initialize(owner);
    const first = (await soma.generate(owner, screenshot() as never)).artifact;
    const probed = (
      await soma.generate(owner, {
        action: 'generate',
        requestId: randomUUID(),
        question: 'When would current flow through R5?',
        intent: 'investigate',
        artifactId: first.id,
        baseVersion: first.version,
        state: first.state,
      } as never)
    ).artifact;
    expect(probed.circuitExperiment?.rationale ?? null).toBe(kept);
  });

  it('answers an experiment with no single solution on the circuit as read, words visible', async () => {
    const fed = {
      nodes: [
        { id: 'G', label: 'G' },
        { id: 'A', label: 'A' },
      ],
      ground: 'G',
      components: [
        { id: 'I1', label: 'I₁', kind: 'current-source', from: 'G', to: 'A', value: 2 },
        { id: 'R1', label: 'R₁', kind: 'resistor', from: 'A', to: 'G', value: 3 },
        { id: 'R2', label: 'R₂', kind: 'resistor', from: 'A', to: 'G', value: 6 },
      ],
    };
    const request = script((context) => ({
      title: 'One source, two paths',
      objective: 'See where the source current goes.',
      assumptions: [],
      steps: [{ traceIndex: context.checkedCircuit.steps.length - 1, caption: 'A sits at 4 V.', narration: 'A sits at 4 V.', highlightIds: ['A'] }],
      followups: [],
    }));
    const base = request.getMockImplementation()!;
    request.mockImplementation(async (r: { instructions: string; input: readonly unknown[] }) => {
      if (!r.instructions.includes('source reader')) return base(r);
      const read = await base(r);
      const args = { ...read.tools[0].parsedArguments, circuit: fed, circuitLayout: null };
      return result('inspect_source', args, 1);
    });
    const soma = service(request);
    await soma.initialize(owner);
    const first = (await soma.generate(owner, screenshot('Why is A at 4 V?') as never)).artifact;
    const reply = (
      await soma.generate(owner, {
        action: 'generate',
        requestId: randomUUID(),
        question: 'Why is there no answer now?',
        intent: 'auto',
        artifactId: first.id,
        baseVersion: first.version,
        state: { ...first.state, disabledEdgeIds: ['R1', 'R2'], step: 0 },
      } as never)
    ).artifact;
    const context = JSON.parse((request.mock.calls.at(-1)![0].input[0] as { content: string }).content);
    expect(context.experimentNote).toContain('R₁ open, R₂ open');
    if (reply.spec.mode !== 'checked-circuit') throw new Error('mode');
    expect(reply.spec.writtenFor ?? null).toBeNull();
    expect(reply.state.disabledEdgeIds).toEqual([]);
    expect(explorationInputsChanged(reply.spec, reply.state)).toBe(false);
  });
});

describe('printed numbers used as circuit IDs', () => {
  it('are renamed wherever the reading refers to them; labels stay as printed', async () => {
    const { letterSourceIds } = await import('../../src/lib/server/exploration');
    const { args, renamed } = letterSourceIds({
      circuit: {
        nodes: [{ id: '1', label: '1' }, { id: '2', label: '2' }],
        ground: '2',
        components: [
          { id: '1', label: 'R1', kind: 'resistor', from: '1', to: '2', value: 4 },
          { id: 'V1', label: 'V1', kind: 'voltage-source', from: '2', to: '1', value: 12 },
        ],
      },
      circuitLayout: { nodes: [{ nodeId: '1', x: 0.1, y: 0.1 }], components: [{ componentId: '1', x1: 0, y1: 0, x2: 1, y2: 1 }] },
    }) as { args: any; renamed: string[] };
    expect(renamed).toEqual(['1 → n1', '2 → n2', '1 → p1']);
    expect(args.circuit.ground).toBe('n2');
    expect(args.circuit.nodes.map((n: any) => n.label)).toEqual(['1', '2']);
    expect(args.circuit.components[0]).toMatchObject({ id: 'p1', from: 'n1', to: 'n2' });
    expect(args.circuit.components[1]).toMatchObject({ id: 'V1', from: 'n2', to: 'n1' });
    expect(args.circuitLayout.nodes[0].nodeId).toBe('n1');
    expect(args.circuitLayout.components[0].componentId).toBe('p1');
  });
});
