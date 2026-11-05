import { describe, expect, it } from 'vitest';
import { chromium } from 'playwright-core';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createExplorationService } from '../../src/lib/server/exploration';
import { requestMetaVisionResponse } from '../../src/lib/server/meta-vision';
const explorationService = createExplorationService({
  request: async (args) => {
    const r = await requestMetaVisionResponse(args);
    mkdirSync('.local/p084', { recursive: true });
    writeFileSync(
      '.local/p084/mode-candidate.json',
      JSON.stringify(
        r.tools.map((t) => t.parsedArguments),
        null,
        2,
      ),
    );
    return r;
  },
});
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';
describe.skipIf(process.env.SOMA_EXPLORATION_MODES_LIVE !== 'true')(
  'actual Spark assurance modes',
  () => {
    it('composes an explanatory process and asks about essential missing context', async () => {
      const browser = await chromium.launch({ headless: true }),
        page = await browser.newPage({ viewport: { width: 900, height: 650 } });
      const id = randomBytes(32).toString('hex'),
        principal: ExplorationPrincipal = {
          kind: 'guest',
          id,
          workspaceId: id,
          generation: id,
          key: `guest-${id}`,
        };
      await explorationService.initialize(principal);
      const results: unknown[] = [];
      const cases = [
        {
          id: 'request-process',
          html: '<h1>A request for notes</h1><h2>Browser → App server → Database</h2><p>Browser sends GET /notes. App server queries saved notes. Database returns rows. Server returns JSON. Browser renders a page.</p><p>These arrows describe information flow, not graph-search edges.</p>',
          question:
            'Explain this request lifecycle using a visual process diagram. This is not a BFS problem.',
          expected: 'explanation',
        },
        {
          id: 'cropped-graph',
          html: '<h1>Cropped graph worksheet</h1><p>The graph and all edges are outside this screenshot.</p><h2>Start S. Goal G.</h2><p>No connectivity or direction is visible. The diagram was cut off.</p>',
          question: 'Show the BFS path from S to G in the missing graph.',
          expected: 'clarify',
        },
      ] as const;
      try {
        for (const c of cases) {
          await page.setContent(
            `<body style="padding:45px;font:26px system-ui;background:white;color:#172431">${c.html}</body>`,
          );
          const png = await page.screenshot();
          const started = Date.now();
          try {
            const { artifact } = await explorationService.generate(principal, {
              action: 'generate',
              requestId: randomUUID(),
              question: c.question,
              source: {
                kind: 'screenshot',
                dataUrl: 'data:image/png;base64,' + png.toString('base64'),
                label: `Original assurance fixture ${c.id}`,
                capturedAt: new Date().toISOString(),
              },
            });
            results.push({
              case: c.id,
              mode: artifact.spec.mode,
              assurance: artifact.validation.assurance,
              calls: artifact.generation.calls,
              costUsd: artifact.generation.costUsd,
              elapsedMs: Date.now() - started,
            });
            expect(artifact.spec.mode).toBe(c.expected);
            expect(artifact.executions).toBeNull();
          } catch (e) {
            results.push({ case: c.id, error: (e as { code?: string }).code ?? 'assertion' });
            throw e;
          }
        }
      } finally {
        await browser.close();
        mkdirSync('.local/p084', { recursive: true });
        writeFileSync(
          '.local/p084/modes-live-results.json',
          JSON.stringify(results, null, 2) + '\n',
        );
      }
    }, 200_000);
  },
);
