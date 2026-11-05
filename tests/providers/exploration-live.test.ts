import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium } from 'playwright-core';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { heldOutCases } from '../fixtures/exploration/held-out';
import { createExplorationService } from '../../src/lib/server/exploration';
import { requestMetaVisionResponse } from '../../src/lib/server/meta-vision';
import {
  type ExplorationPrincipal,
  type ExplorationArtifact,
} from '../../src/lib/server/exploration-types';
const enabled = process.env.SOMA_EXPLORATION_LIVE === 'true';
const records: unknown[] = [];
const explorationService = createExplorationService({
  request: async (args) => {
    try {
      const result = await requestMetaVisionResponse(args);
      records.push({
        diagnostic: 'provider-result',
        status: result.status,
        tools: result.tools.map((t) => ({ name: t.name, keys: Object.keys(t.parsedArguments) })),
        usage: result.usage,
      });
      mkdirSync('.local/p084', { recursive: true });
      writeFileSync(
        '.local/p084/last-candidate.json',
        JSON.stringify(
          result.tools.map((t) => t.parsedArguments),
          null,
          2,
        ),
      );
      return result;
    } catch (error) {
      records.push({
        diagnostic: 'client-rejection',
        code: (error as any).code,
        usage: (error as any).usage,
      });
      throw error;
    }
  },
});
const fetchOriginal = globalThis.fetch;
beforeAll(() => {
  if (enabled)
    globalThis.fetch = async (...args) => {
      const response = await fetchOriginal(...args);
      if (!response.ok && String(args[0]).startsWith('https://api.meta.ai/')) {
        const value = await response
          .clone()
          .json()
          .catch(() => null);
        const message = String(value?.error?.message ?? '')
          .replaceAll(process.env.MODEL_API_KEY ?? '__NO_KEY__', '[redacted]')
          .slice(0, 1200);
        records.push({
          diagnostic: 'provider-rejection',
          status: response.status,
          code: value?.error?.code,
          type: value?.error?.type,
          message,
        });
      }
      return response;
    };
});
let primary: ExplorationArtifact | undefined;
let principal: ExplorationPrincipal;
function newPrincipal(): ExplorationPrincipal {
  const id = randomBytes(32).toString('hex');
  return { kind: 'guest', id, workspaceId: id, generation: id, key: `guest-${id}` };
}
function compare(a: ExplorationArtifact, c: (typeof heldOutCases)[number]) {
  if (a.spec.mode !== 'checked-bfs') return false;
  const input = a.spec.input,
    labels = new Map(input.nodes.map((n) => [n.id, n.label.toUpperCase().trim()]));
  const label = (id: string) => labels.get(id);
  const edge = (from: string, to: string) =>
    c.directed ? [from, to].join('>') : [from, to].sort().join('-');
  const actualEdges = input.edges.map((e) => edge(label(e.from)!, label(e.to)!)).sort();
  const expectedEdges = c.edges.map(([a, b]) => edge(a, b)).sort();
  return (
    JSON.stringify(input.nodes.map((n) => n.label.toUpperCase().trim()).sort()) ===
      JSON.stringify([...c.nodes].sort()) &&
    input.directed === c.directed &&
    label(input.start) === c.start &&
    (input.goal === null ? null : label(input.goal)) === c.goal &&
    JSON.stringify(input.neighborOrder.map(label)) === JSON.stringify(c.order) &&
    JSON.stringify(actualEdges) === JSON.stringify(expectedEdges) &&
    JSON.stringify(a.executions!.primary.path?.map(label) ?? null) === JSON.stringify(c.path)
  );
}
afterAll(() => {
  globalThis.fetch = fetchOriginal;
  if (enabled) {
    mkdirSync('.local/p084', { recursive: true });
    writeFileSync('.local/p084/live-results.json', JSON.stringify(records, null, 2) + '\n');
  }
});
describe.skipIf(!enabled)('actual Spark original held-out screenshot evaluation', () => {
  it('reads fixed screenshots, computes independently and produces source-specific visual scenes', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1000, height: 820 } });
    principal = newPrincipal();
    await explorationService.initialize(principal);
    const selected = heldOutCases.slice(0, Number(process.env.SOMA_EXPLORATION_CASES ?? 10));
    try {
      for (const c of selected) {
        const positions = c.nodes.map((n, i) => ({
          n,
          x: 475 + 330 * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / c.nodes.length),
          y: 325 + 170 * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / c.nodes.length),
        }));
        const svg = `<svg width="950" height="450" viewBox="0 0 950 450"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="28" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#34445c"/></marker></defs>${c.edges
          .map(([a, b]) => {
            const p = positions.find((p) => p.n === a)!,
              q = positions.find((p) => p.n === b)!;
            return `<line x1="${p.x}" y1="${p.y - 100}" x2="${q.x}" y2="${q.y - 100}" stroke="#34445c" stroke-width="3" ${c.directed ? 'marker-end="url(#arrow)"' : ''}/>`;
          })
          .join(
            '',
          )}${positions.map((p) => `<circle cx="${p.x}" cy="${p.y - 100}" r="29" fill="#e9f0fb" stroke="#34445c" stroke-width="2"/><text x="${p.x}" y="${p.y - 92}" text-anchor="middle" font-size="24" fill="#172431">${p.n}</text>`).join('')}</svg>`;
        await page.setContent(
          `<body style="font:22px system-ui;padding:25px;color:#172431;background:#fff"><h1 style="font-size:30px">Original graph-search worksheet</h1><p>Unweighted ${c.directed ? 'directed' : 'undirected'} graph. Start: ${c.start}. Goal: ${c.goal ?? 'none — traverse reachable nodes'}.</p>${svg}<p>Nodes: ${c.nodes.join(', ')}. Edges: ${c.edges.map(([a, b]) => `${a}${c.directed ? ' → ' : ' — '}${b}`).join('; ') || 'none'}.</p><p>Neighbor order: ${c.order.join(', ')}. Discover on enqueue; stop on goal dequeue.</p></body>`,
        );
        const png = await page.screenshot({ type: 'png' });
        const started = Date.now();
        try {
          const { artifact } = await explorationService.generate(principal, {
            action: 'generate',
            requestId: randomUUID(),
            question:
              'Explain how breadth-first search proceeds on this graph. Make the frontier visible and let me change the start or remove an edge.',
            source: {
              kind: 'screenshot',
              dataUrl: `data:image/png;base64,${png.toString('base64')}`,
              label: `Original held-out worksheet ${c.id}`,
              capturedAt: new Date().toISOString(),
            },
          });
          const correct = compare(artifact, c);
          records.push({
            case: c.id,
            status: 'published',
            correctSourceAndPath: correct,
            mode: artifact.spec.mode,
            layout: artifact.spec.mode === 'clarify' ? null : artifact.spec.scene.layout,
            panels:
              artifact.spec.mode === 'clarify' ? [] : artifact.spec.scene.panels.map((p) => p.kind),
            calls: artifact.generation.calls,
            costUsd: artifact.generation.costUsd,
            elapsedMs: Date.now() - started,
            repairs: artifact.generation.audit.filter((x) => x.event === 'repair-requested').length,
          });
          if (!primary && correct) primary = artifact;
        } catch (e) {
          records.push({
            case: c.id,
            status: 'failed',
            code: (e as { code?: string }).code ?? 'unknown',
            elapsedMs: Date.now() - started,
          });
        }
        writeFileSync('.local/p084/live-results.json', JSON.stringify(records, null, 2) + '\n');
      }
    } finally {
      await browser.close();
    }
    const successful = records.filter((r: any) => r.correctSourceAndPath === true).length;
    expect(successful).toBeGreaterThanOrEqual(Math.ceil(selected.length * 0.8));
  }, 1_000_000);
  it('revises the selected object and changed experiment without sending the original screenshot again', async () => {
    if (!primary) {
      expect.fail('No source-correct primary artifact for contextual follow-up.');
      return;
    }
    const a = primary;
    if (a.spec.mode !== 'checked-bfs') throw new Error('Expected checked BFS');
    const input = a.spec.input;
    const selected = input.nodes.find((n) => n.id !== input.start && n.id !== input.goal)!.id;
    const started = Date.now();
    try {
      const { artifact } = await explorationService.generate(principal, {
        action: 'generate',
        requestId: randomUUID(),
        artifactId: a.id,
        baseVersion: a.version,
        selectedObjectId: selected,
        state: a.state,
        question:
          'Compare the original search with a new search starting at the node I selected. Show both graphs and explain why the frontier changes. Preserve the original graph as the primary execution. Change only the comparison start; keep its goal, edges, direction and neighbor order unchanged.',
      });
      records.push({
        case: 'contextual-followup',
        status: 'published',
        mode: artifact.spec.mode,
        layout: artifact.spec.mode === 'clarify' ? null : artifact.spec.scene.layout,
        hasComparison: artifact.spec.mode === 'checked-bfs' && Boolean(artifact.spec.comparison),
        costUsd: artifact.generation.costUsd,
        calls: artifact.generation.calls,
        elapsedMs: Date.now() - started,
      });
      expect(artifact.version).toBe(a.version + 1);
      expect(artifact.spec.mode === 'checked-bfs' && artifact.spec.comparison?.input.start).toBe(
        selected,
      );
      if (artifact.spec.mode === 'checked-bfs') {
        expect(artifact.spec.comparison?.input.goal).toBe(a.spec.input.goal);
        expect(artifact.spec.comparison?.input.edges).toEqual(a.spec.input.edges);
        expect(artifact.spec.comparison?.input.directed).toBe(a.spec.input.directed);
        expect(artifact.spec.comparison?.input.neighborOrder).toEqual(a.spec.input.neighborOrder);
      }
    } catch (e) {
      records.push({
        case: 'contextual-followup',
        status: 'failed',
        code: (e as { code?: string }).code ?? 'unknown',
        elapsedMs: Date.now() - started,
      });
      throw e;
    }
  }, 100_000);
});
