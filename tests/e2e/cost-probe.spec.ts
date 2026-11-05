import { openMoreExamples } from './example-navigation';
import { test, expect } from '@playwright/test';
import { checkExploration, createWeightedExample } from '../../src/lib/domain/exploration';
import { probeEdgeCost } from '../../src/lib/domain/cost-probe';
import { initialExplorationState } from '../../src/lib/domain/exploration-view';

// Scripted provider/API fixture. Actual solver, React controls and keyboard run
// in Chromium; this does not establish live inference or database persistence.
test('chosen cost experiment updates both routes, survives UI resume and follows changed controls', async ({
  page,
}) => {
  const checked = checkExploration(
    createWeightedExample({ observationId: 'original', version: 1, region: null }),
  );
  if (checked.spec.mode !== 'checked-dijkstra') throw Error();
  const original = {
    ...checked,
    id: '629cdb47-2131-4c92-9e22-6900e87cba15',
    version: 1,
    createdAt: '2026-10-29T15:00:00Z',
    updatedAt: '2026-10-29T15:00:00Z',
    question: 'Compare costs',
    source: {
      observationId: checked.spec.sources[0].observationId,
      version: 1,
      kind: 'example',
      label: 'Original synthetic weighted graph',
      capturedAt: '2026-10-29T15:00:00Z',
      summary: 'Original synthetic fixture.',
      uncertainty: [],
    },
    generation: { mode: 'prepared-example', model: null, calls: 0, costUsd: 0, elapsedMs: 0 },
    state: initialExplorationState(checked.spec),
    saved: false,
    experiment: undefined as ReturnType<typeof probeEdgeCost> | undefined,
  };
  let active: typeof original | null = null;
  const requests: any[] = [];
  await page.route('**/api/explore**', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({
        json: { active, artifacts: active ? [active] : [], versions: [], liveEnabled: true },
      });
    const body = route.request().postDataJSON();
    requests.push(body);
    if (body.action === 'example') active = structuredClone(original);
    else if (body.action === 'generate')
      active = {
        ...original,
        version: 2,
        experiment: probeEdgeCost(
          checked.spec.mode === 'checked-dijkstra' ? checked.spec.input : null,
          'sg',
        ),
      };
    else if (body.action === 'save') active = { ...active!, state: body.state, saved: true };
    else return route.fulfill({ status: 400, json: { code: 'invalid_request' } });
    return route.fulfill({ json: { artifact: active } });
  });
  await page.goto('/explore');
  await openMoreExamples(page);
  await page.getByRole('button', { name: 'Compare weighted paths', exact: true }).click();
  await page.getByRole('button', { name: 'Find the tipping point', exact: true }).click();
  const probe = page.getByRole('region', { name: 'Checked cost experiment' });
  await expect(probe).toBeVisible();
  expect(requests.find((r) => r.action === 'generate')).toMatchObject({
    intent: 'investigate',
    baseVersion: 1,
  });
  const slider = probe.getByRole('slider', { name: 'Connection cost:' });
  await slider.focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('2');
  await expect(probe.getByRole('status')).toContainText('BFS route cost: 2');
  await expect(probe.getByRole('status')).toContainText('Dijkstra route cost: 2');
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  expect(requests.find((r) => r.action === 'save').state.edgeWeights).toEqual({ sg: 2 });
  await expect(page.getByRole('status').filter({ hasText: 'Saved this version' })).toBeVisible();
  await page.reload();
  await page.locator('.exploration-library button').first().click();
  await expect(probe.getByRole('slider')).toHaveValue('2');
  await page.getByRole('combobox', { name: 'Goal node', exact: true }).selectOption('a');
  await expect(probe.getByRole('button', { name: 'Try the tie', exact: false })).toHaveCount(0);
  await expect(probe).toContainText(/never (changes )?the route/);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await probe.screenshot({ path: '.local/pm061/probe-phone.png' });
});
