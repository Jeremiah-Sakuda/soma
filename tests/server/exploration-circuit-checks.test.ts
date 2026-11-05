import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createExplorationService } from '../../src/lib/server/exploration';
import { closeExplorationStore } from '../../src/lib/server/exploration-store';
import type { MetaResult } from '../../src/lib/server/meta-client';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';
import { heroCircuit, heroCircuitLayout } from '../fixtures/hero-circuit';

// The exact solver cannot fail its own checks on a real circuit, so this file breaks one to
// prove the checks gate publication rather than only decorate it.
vi.mock('../../src/lib/domain/dc-circuit', async (original) => {
  const actual = await original<typeof import('../../src/lib/domain/dc-circuit')>();
  return {
    ...actual,
    solveDc: (...args: Parameters<typeof actual.solveDc>) => {
      const solved = actual.solveDc(...args);
      return { ...solved, checks: { ...solved.checks, kcl: false } };
    },
  };
});

const owner: ExplorationPrincipal = {
  kind: 'guest',
  id: 'e'.repeat(64),
  workspaceId: 'e'.repeat(64),
  generation: 'e'.repeat(64),
  key: `guest-${'e'.repeat(64)}`,
};
const result = (name: string, value: unknown, index: number): MetaResult => ({
  status: 'completed',
  tools: [
    {
      type: 'function_call',
      name,
      arguments: JSON.stringify(value),
      call_id: `call-${index}`,
      parsedArguments: value as Record<string, unknown>,
    },
  ],
  usage: { input_tokens: 100, output_tokens: 200 },
});
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'soma-circuit-checks-'));
  vi.stubEnv('SOMA_PERSISTENCE', 'local-synthetic');
  vi.stubEnv('SOMA_EXPLORATION_DB_PATH', join(directory, 'explore.sqlite'));
  vi.stubEnv('VERCEL', '');
});
afterEach(() => {
  closeExplorationStore();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

it('a circuit solution that fails Kirchhoff’s current law is never published as checked', async () => {
  let index = 0;
  const request = vi.fn(async (call: { instructions: string; input: readonly unknown[] }) => {
    index++;
    if (call.instructions.includes('source reader'))
      return result(
        'inspect_source',
        {
          summary: 'A Wheatstone bridge.',
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
    expect(call.instructions).not.toContain('compose_circuit');
    const context = JSON.parse((call.input[0] as { content: string }).content);
    expect(context.checkedCircuit).toBeUndefined();
    const id = /Required spec id=([^ ]+) and version=(\d+)/.exec(call.instructions)!;
    return result(
      'compose_exploration',
      {
        spec: {
          schemaVersion: 'exploration-v1',
          id: id[1],
          version: Number(id[2]),
          title: 'A bridge circuit',
          objective: 'Describe the slide.',
          sources: [{ observationId: context.source.observationId, version: 1, region: null }],
          assumptions: [],
          uncertainty: [],
          unsupportedClaims: [],
          mode: 'explanation',
          scene: {
            layout: 'stack',
            panels: [
              {
                id: 'about',
                kind: 'text',
                title: 'The slide',
                text: 'A bridge of five resistors.',
                placement: { column: 1, row: 1, columnSpan: 2 },
              },
            ],
          },
          steps: [
            {
              id: 'read',
              caption: 'Read the bridge.',
              narration: null,
              highlightIds: ['about'],
              execution: null,
              executionStep: null,
            },
          ],
          followups: [],
        },
      },
      index,
    );
  });
  const soma = createExplorationService({
    request: request as never,
    upperBound: () => 0.03,
    reserve: async () => randomUUID(),
    settle: async () => {},
    enabled: () => true,
    validateImage: vi.fn() as never,
    revalidate: async () => {},
  });
  await soma.initialize(owner);
  const { artifact } = await soma.generate(owner, {
    action: 'generate',
    requestId: randomUUID(),
    question: 'Why is there no current through R5?',
    source: {
      kind: 'screenshot',
      dataUrl: 'data:image/png;base64,AAAA',
      label: 'Lecture 9 slide',
      capturedAt: new Date().toISOString(),
    },
  } as never);
  expect(artifact.spec.mode).toBe('explanation');
  expect(artifact.circuit ?? null).toBeNull();
  const audit = artifact.generation.audit.map((a) => a.detail).join(' ');
  expect(audit).toContain("failed its own checks (Kirchhoff's current law)");
  expect(audit).not.toContain('Checked dc-nodal solution');
});
