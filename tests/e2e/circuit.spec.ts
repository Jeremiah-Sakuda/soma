import { openMoreExamples } from './example-navigation';
import { test, expect } from '@playwright/test';
import { checkExploration } from '../../src/lib/domain/exploration';
import { initialExplorationState } from '../../src/lib/domain/exploration-view';
import { circuitSpec } from '../../src/lib/server/circuit-authoring';
import { probeDcValue } from '../../src/lib/domain/dc-circuit';
import { heroCircuit, heroCircuitLayout } from '../fixtures/hero-circuit';

// Scripted provider/API fixture over the original Lecture 9 slide. The actual solver, overlay
// and React controls run in Chromium; this does not establish live inference.
test('a checked circuit draws on the uploaded slide and re-solves every experiment in the page', async ({
  page,
}) => {
  let active: Record<string, unknown> | null = null;
  const requests: any[] = [];
  await page.route('**/api/explore**', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({
        json: { active, artifacts: active ? [active] : [], versions: [], liveEnabled: true },
      });
    const body = route.request().postDataJSON();
    requests.push(body);
    if (body.action === 'generate' && body.intent === 'investigate')
      active = {
        ...active!,
        version: 2,
        state: body.state,
        circuitExperiment: probeDcValue(
          heroCircuit,
          undefined,
          'R4',
          { kind: 'current', componentId: 'R5' },
          'zero',
          'R₄ sets the voltage at C, the far end of R₅.',
        ),
      };
    else if (body.action === 'generate') {
      const spec = circuitSpec({
        id: 'explore_6a1b2c3d4e5f40718293a4b5c6d7e8f9',
        version: 1,
        observationId: 'capture_circuit',
        sourceVersion: 1,
        input: heroCircuit,
        layout: heroCircuitLayout,
        copy: {
          title: 'Why no current crosses R₅',
          objective: 'See that B and C sit at the same voltage.',
          assumptions: [],
          steps: [
            {
              traceIndex: 0,
              caption: 'D is ground, at 0 V.',
              narration: 'Start from ground.',
              highlightIds: ['D'],
            },
            {
              traceIndex: 3,
              caption: 'B and C both sit at 8 V, so R₅ carries no current.',
              narration: 'Equal voltages, no current.',
              highlightIds: ['B', 'C', 'R5'],
            },
          ],
          followups: ['What if R₂ burns out?'],
        },
        uncertainty: [],
      });
      const checked = checkExploration(spec);
      active = {
        ...checked,
        id: '6a1b2c3d-4e5f-4071-8293-a4b5c6d7e8f9',
        version: 1,
        createdAt: '2026-11-02T05:00:00Z',
        updatedAt: '2026-11-02T05:00:00Z',
        question: body.question,
        source: {
          observationId: 'capture_circuit',
          version: 1,
          kind: 'screenshot',
          label: body.source.label,
          capturedAt: body.source.capturedAt,
          summary: 'A Wheatstone bridge.',
          uncertainty: [],
          layout: {
            nodes: heroCircuitLayout.nodes,
            edgeLabels: [],
            components: heroCircuitLayout.components,
          },
        },
        generation: {
          mode: 'live',
          provider: 'meta',
          model: 'muse-spark-1.3',
          calls: 2,
          costUsd: 0,
          elapsedMs: 1000,
          checks: checked.validation.checks,
          audit: [],
        },
        state: { ...initialExplorationState(checked.spec), step: 3, explanationStep: 1 },
        saved: false,
      };
    } else if (body.action === 'save') active = { ...active!, state: body.state, saved: true };
    else return route.fulfill({ status: 400, json: { code: 'invalid_request' } });
    return route.fulfill({ json: { artifact: active } });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Screenshots show finished drawings, not ink mid-stroke.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/explore');
  // The one-click demo slide loads the same original Lecture 9 image and its question.
  await openMoreExamples(page);
  await page.getByRole('button', { name: 'Try the Lecture 9 circuit slide (live)' }).click();
  await expect(page.locator('.exploration-ask-card textarea')).toHaveValue(
    'Why is there no current through R5?',
  );
  await page.getByRole('button', { name: 'Ask Soma', exact: true }).click();
  const overlay = page.locator('figure.source-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('.source-overlay-tag', { hasText: 'B = 8 V' })).toBeVisible();
  await expect(overlay.locator('.source-overlay-tag', { hasText: 'R₅: 0 A' })).toBeVisible();
  await expect(page.locator('.exploration-caption')).toContainText(
    'Soma’s explanation: B and C both sit at 8 V',
  );
  await expect(page.getByText('Step 4 of 4').first()).toBeVisible();
  await expect(page.locator('.journal-log')).toContainText('Circuit log');
  await expect(page.locator('#exploration-question')).toHaveAttribute(
    'placeholder',
    'What if we open a part or change its resistance?',
  );
  await page.screenshot({ path: '.local/circuit/page-final.png', fullPage: false });
  await overlay.screenshot({ path: '.local/circuit/overlay-final.png' });

  await page.getByRole('button', { name: 'Previous step' }).click();
  await expect(page.locator('.exploration-caption')).toContainText('B sits at 8 V.');
  await overlay.screenshot({ path: '.local/circuit/overlay-step2.png' });

  await page.getByRole('checkbox', { name: 'R₂' }).uncheck();
  await expect(page.locator('.exploration-caption')).toContainText('You opened R₂.');
  await expect(
    overlay.locator('.source-overlay-tag', { hasText: /R₅ ≈ 0\.4138 A →/ }),
  ).toBeVisible();
  // The table gives the solver's exact fraction beside the rounded value.
  await page.getByText('Checked values in a table').click();
  const readings = page.locator('table.circuit-readings');
  await expect(readings.getByRole('row', { name: /^R₅ / })).toContainText(
    '12/29 A ≈ 0.4138 A, B → C',
  );
  await expect(readings.getByRole('row', { name: /^Node C / })).toContainText('264/29 V ≈ 9.103 V');
  await page.getByText('Checked values in a table').click();
  await overlay.screenshot({ path: '.local/circuit/overlay-open-r2.png' });

  await page.getByRole('button', { name: 'Back to the circuit as read' }).click();
  await page.getByLabel('R₄ value in Ω').fill('10');
  await expect(page.locator('.exploration-caption')).toContainText('R₄ is now 10 Ω (was 8).');
  await expect(overlay.locator('.source-overlay-tag', { hasText: /^R₅[: ].*←$/ })).toBeVisible();
  await overlay.screenshot({ path: '.local/circuit/overlay-r4-10.png' });

  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  expect(requests.find((r) => r.action === 'save').state.edgeWeights).toEqual({ R4: 10 });

  // Muse chooses the part; Soma computes where R₅'s current reverses and the slider proves it.
  await page.getByRole('button', { name: 'Find the tipping point', exact: true }).click();
  const probe = page.getByRole('region', { name: 'Checked circuit experiment' });
  await expect(probe).toBeVisible();
  expect(requests.find((r) => r.intent === 'investigate')).toMatchObject({ baseVersion: 1 });
  await expect(probe).toContainText('Why R₄: R₄ sets the voltage at C');
  await expect(probe).toContainText('exactly zero when R₄ is 8 Ω');
  await expect(probe.getByRole('status')).toContainText('from C to B');
  await probe.getByRole('button', { name: 'Try the tipping point at 8 Ω' }).click();
  await expect(probe.getByRole('status')).toContainText('Current in R₅: exactly 0 A');
  const slider = probe.getByRole('slider');
  await slider.focus();
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(probe.getByRole('status')).toContainText('from B to C');
  await expect(overlay.locator('.source-overlay-tag', { hasText: /^R₅[: ].*→$/ })).toBeVisible();
  await probe.screenshot({ path: '.local/circuit/probe.png' });

  await page.getByRole('button', { name: 'Voltage as height' }).click();
  await expect(page.getByText('Checked circuit · spatial view')).toBeVisible();
  await page.waitForTimeout(800);
  await page.locator('.spatial-workspace').screenshot({ path: '.local/circuit/spatial.png' });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: '2D view' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
