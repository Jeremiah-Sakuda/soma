import { test, expect } from '@playwright/test';
import { checkExploration, createWeightedExample } from '../../src/lib/domain/exploration';
import { initialExplorationState } from '../../src/lib/domain/exploration-view';

// Scripted API responses exercise compact revised-card layout only. Actual
// state-preserving model follow-ups are separately verified on production.
test('a revised weighted card keeps its complete graph above the native composer', async ({
  page,
}) => {
  const checked = checkExploration(
    createWeightedExample({ observationId: 'synthetic-layout', version: 1, region: null }),
  );
  const original = {
    ...checked,
    id: '629cdb47-2131-4c92-9e22-6900e87cba15',
    version: 1,
    createdAt: '2026-10-29T15:00:00Z',
    updatedAt: '2026-10-29T15:00:00Z',
    question: 'Compare paths',
    source: {
      kind: 'example',
      label: 'Original synthetic fixture',
      summary: 'A weighted graph.',
      uncertainty: [],
      capturedAt: '2026-10-29T15:00:00Z',
    },
    generation: {
      mode: 'prepared-example',
      provider: 'none',
      model: null as string | null,
      calls: 0,
      costUsd: 0,
      elapsedMs: 0,
      audit: [] as { event: string; call: number; detail: string }[],
    },
    state: initialExplorationState(checked.spec),
    saved: false,
  };
  let active: typeof original | null = null;
  await page.route('**/api/explore', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({
        json: { active, artifacts: active ? [active] : [], versions: [], liveEnabled: true },
      });
    if (route.request().postDataJSON().action === 'example') active = structuredClone(original);
    else {
      active = {
        ...original,
        version: 2,
        spec: { ...original.spec, version: 2 },
        generation: {
          ...original.generation,
          mode: 'live',
          model: 'muse-spark-1.3',
          calls: 2,
          audit: [
            { event: 'source-reused', call: 0, detail: 'Original synthetic context.' },
            { event: 'review-approved', call: 2, detail: 'Original scripted review.' },
          ],
        },
      } as typeof original;
    }
    return route.fulfill({ json: { artifact: active } });
  });
  await page.setViewportSize({ width: 620, height: 704 });
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Compare weighted paths', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Where would you like to go next?' })
    .fill('Explain this experiment.');
  await page.getByRole('button', { name: 'Ask Soma', exact: true }).click();
  await expect(page.getByText('Muse Spark generated', { exact: true })).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  const graph = await page.locator('.exploration-panel-graph').boundingBox(),
    composer = await page.getByRole('region', { name: 'Ask about your context' }).boundingBox();
  expect(graph!.y + graph!.height).toBeLessThanOrEqual(composer!.y);
  const history = page.getByRole('combobox', { name: 'Version history' });
  await expect(history).toHaveValue('2');
  expect((await history.boundingBox())!.y).toBeGreaterThanOrEqual(graph!.y + graph!.height);
});

test('a recorded real Muse run is inspectable, manipulable and saved without live generation', async ({
  page,
}) => {
  const actions: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/api/explore') && r.method() === 'POST')
      actions.push(r.postDataJSON().action);
  });
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Watch a recorded Muse run', exact: true }).click();
  await expect(page.getByText('Recorded Muse Spark run', { exact: true })).toBeVisible();
  const pipeline = page.locator('.exploration-pipeline');
  await expect(pipeline).toContainText('Wonder reviewed');
  await pipeline.locator('summary').click();
  await expect(pipeline).toContainText('Spark read the source');
  await pipeline.getByRole('link', { name: 'Inspect recorded calls and timing' }).click();
  await expect(page.locator('#exploration-audit')).toContainText(
    'Muse Wonder advisory review: approve',
  );
  await expect(page.getByText('no inference on replay.', { exact: false })).toBeVisible();
  expect(actions).toEqual(['recording']);
  await pipeline.locator('summary').click();
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved this version' })).toBeVisible();
  await page.reload();
  await page.locator('.exploration-library button').first().click();
  await expect(page.getByText('Recorded Muse Spark run', { exact: true })).toBeVisible();
  await page.getByText('Source & sharing', { exact: true }).click();
  await expect(page.getByRole('img', { name: /Original synthetic screenshot used/ })).toBeVisible();
  expect(actions).toEqual(['recording']);
});

test('weighted graph costs and full node names remain separate on desktop, companion and phone', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Compare weighted paths', exact: true }).click();
  for (const width of [1280, 620, 375]) {
    await page.setViewportSize({ width, height: width === 620 ? 704 : 900 });
    const graph = page.locator('.exploration-weighted-stage').first();
    await expect(graph).toBeVisible();
    await expect(graph.locator('[data-cost-label]')).toHaveCount(6);
    await expect(graph.locator('[data-weighted-node="x"] strong')).toHaveText('Unconnected X');
    const issues = await graph.evaluate((svg) => {
      const bad: string[] = [];
      const overlaps = (a: DOMRect, b: DOMRect) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const labels = [...svg.querySelectorAll('[data-cost-label] rect')],
        nodes = [...svg.querySelectorAll('[data-weighted-node] rect')];
      labels.forEach((label, i) => {
        const box = label.getBoundingClientRect();
        if (nodes.some((n) => overlaps(box, n.getBoundingClientRect())))
          bad.push('cost overlaps node');
        if (labels.slice(i + 1).some((n) => overlaps(box, n.getBoundingClientRect())))
          bad.push('cost overlaps cost');
      });
      for (const label of svg.querySelectorAll('.exploration-weighted-node-label'))
        if (
          label.scrollHeight > label.clientHeight + 1 ||
          label.scrollWidth > label.clientWidth + 1
        )
          bad.push('clipped node label');
      return bad;
    });
    expect(issues).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await graph.screenshot({ path: `.local/pm069/weighted-${width}.png` });
  }
});
