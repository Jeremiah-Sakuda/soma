import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { checkExploration } from '../../src/lib/domain/exploration';

const circuitRecording = JSON.parse(readFileSync('src/lib/fixtures/recorded-circuit.json', 'utf8'));
const circuitPresentation = JSON.parse(readFileSync('src/lib/fixtures/recorded-circuit-presentation.json', 'utf8'));

// Real application HTTP routes and retained actual runs. Inference is disabled by the
// repository browser harness; this test uses manual controls only, never audio playback.
test('recorded graph and circuit retain receipts, manipulate silently and reopen saved source overlays', async ({ page }) => {
  const actions: string[] = [];
  const forbidden: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/api/explore' && ['POST', 'PATCH'].includes(request.method())) {
      const action = request.postDataJSON().action;
      actions.push(action);
      if (action === 'generate') forbidden.push(action);
    }
    if (/speech|transcri|narrat|audio/i.test(url.pathname)) forbidden.push(url.pathname);
  });
  // Fail closed if a regression accidentally tries generation or speech while replaying.
  await page.route('**/api/**', route => {
    const request = route.request(), url = new URL(request.url());
    if (/speech|transcri|narrat|audio/i.test(url.pathname) ||
      (url.pathname === '/api/explore' && request.method() === 'POST' && request.postDataJSON().action === 'generate'))
      return route.abort();
    return route.continue();
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Watch a recorded Muse run', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What sends the shortest route through E?', exact: true })).toBeVisible();
  const uncertainty = page.locator('.journal-source-uncertainty');
  await expect(uncertainty.locator('summary')).toHaveText('Source reading: 2 uncertainties');
  await uncertainty.locator('summary').click();
  await expect(uncertainty).toContainText('Node/edge coordinates are estimated from full image, not measured.');
  await uncertainty.locator('summary').click();
  const overlay = page.locator('figure.source-overlay');
  await expect(overlay.locator('img')).toHaveAttribute('src', '/synthetic/recorded-lecture-14.png');
  await expect(page.getByRole('button', { name: 'Recorded graph', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const graph = page.getByRole('region', { name: 'Checked cost experiment' });
  await expect(graph).toContainText('This shortcut keeps the cheapest route away from E');
  await graph.getByRole('button', { name: 'Try the tie at 5', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your graph experiment', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to the graph as read', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What sends the shortest route through E?', exact: true })).toBeVisible();
  await graph.getByRole('button', { name: 'Try the tie at 5', exact: true }).click();
  await expect(graph.getByRole('status')).toContainText('Dijkstra route cost: 9');
  await graph.getByRole('slider').focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(graph.getByRole('status')).toContainText('Dijkstra route cost: 9');
  await expect(graph.getByRole('status')).toContainText('BFS route cost: 11');
  await expect(overlay.locator('figcaption')).toContainText('A → C → E → F');
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved this version' })).toBeVisible();
  expect(await overlay.evaluate(figure => {
    const caption = figure.querySelector('figcaption')!.getBoundingClientRect();
    return caption.bottom <= figure.getBoundingClientRect().bottom;
  })).toBe(true);
  await page.screenshot({ path: '.local/overnight-review/round4-recorded-graph.png', fullPage: true });
  for (const width of [620, 375]) {
    await page.setViewportSize({ width, height: width === 620 ? 704 : 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect.poll(async () => {
      const image = await overlay.locator('img').boundingBox(), marks = await overlay.locator('svg.source-overlay-layer').boundingBox();
      return Math.abs(image!.height - marks!.height);
    }).toBeLessThan(1);
    await page.screenshot({ path: `.local/overnight-review/round4-recorded-graph-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.getByRole('button', { name: 'Recorded circuit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Balanced now, current in R5 if R4 changes', exact: true })).toBeVisible();
  await expect(overlay.locator('img')).toHaveAttribute('src', '/synthetic/recorded-lecture-9.png');
  await page.locator('.journal-recording-details summary').click();
  await expect(page.getByText('Replay drawing aligned to source · original recording unchanged.', { exact: true })).toBeVisible();
  await expect(page.locator('.journal-recording-details')).toContainText('no new visual generation');
  await page.locator('.journal-recording-details summary').click();
  const circuit = page.getByRole('region', { name: 'Checked circuit experiment' });
  await expect(circuit.getByRole('status')).toContainText('Current in R5: exactly 0 A');
  await expect(circuit.locator('.exploration-cost-probe-why')).toContainText('Varying R4 unbalances the bridge');
  await circuit.getByRole('slider').focus();
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(circuit.getByRole('status')).toContainText('from B to C');
  await expect(page.getByRole('heading', { name: 'Your circuit experiment', exact: true })).toBeVisible();
  await expect(page.locator('.exploration-objective')).toHaveText('The drawing and numbers reflect your changes. Ask Soma to explain this experiment.');
  await expect(page.getByRole('heading', { name: 'Balanced now, current in R5 if R4 changes', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to the circuit as read', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Balanced now, current in R5 if R4 changes', exact: true })).toBeVisible();
  await expect(circuit.getByRole('status')).toContainText('Current in R5: exactly 0 A');
  await circuit.getByRole('slider').focus();
  await page.keyboard.press('Shift+ArrowLeft');
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved this version' })).toBeVisible();
  expect(await overlay.evaluate(figure => {
    const caption = figure.querySelector('figcaption')!.getBoundingClientRect();
    return caption.bottom <= figure.getBoundingClientRect().bottom;
  })).toBe(true);
  await page.screenshot({ path: '.local/overnight-review/round4-recorded-circuit.png', fullPage: true });
  await overlay.screenshot({ path: '.local/overnight-review/round4-recorded-circuit-overlay.png' });

  await page.reload();
  await page.locator('.exploration-library button').filter({ hasText: 'Balanced now, current in R5' }).click();
  await expect(overlay.locator('img')).toHaveAttribute('src', '/synthetic/recorded-lecture-9.png');
  await expect(circuit.getByRole('status')).toContainText('from B to C');
  await expect(circuit.getByRole('slider')).toHaveValue('7.2');
  await expect(page.getByRole('heading', { name: 'Your circuit experiment', exact: true })).toBeVisible();
  for (const width of [620, 375]) {
    await page.setViewportSize({ width, height: width === 620 ? 704 : 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect.poll(async () => {
      const image = await overlay.locator('img').boundingBox(), marks = await overlay.locator('svg.source-overlay-layer').boundingBox();
      return Math.abs(image!.height - marks!.height);
    }).toBeLessThan(1);
    await page.screenshot({ path: `.local/overnight-review/round4-recorded-circuit-${width}.png`, fullPage: true });
  }
  expect(actions).toEqual(['recording', 'save', 'recording', 'save']);
  expect(forbidden).toEqual([]);
});

// Scripted HTTP surface for the server's separately tested replay-to-live transition.
// Reuses actual source/model content; no new model receipt or inference is created here.
test('a live follow-up retains its approved source image without a recorded-run badge', async ({ page }) => {
  const active = {
    ...circuitRecording,
    ...checkExploration(circuitRecording.spec),
    id: '50d55e4d-93e8-4b20-bda5-499ea8e9ed4d',
    version: circuitRecording.spec.version,
    saved: true,
    source: {
      ...circuitRecording.source,
      publicDemo: { image: '/synthetic/recorded-lecture-9.png', presentation: circuitPresentation },
    },
  };
  await page.route('**/api/explore**', route => route.request().method() === 'GET'
    ? route.fulfill({ json: { active, artifacts: [active], versions: [], liveEnabled: false } })
    : route.abort());
  await page.goto('/explore');
  await page.locator('.exploration-library button').filter({ hasText: 'Balanced now, current in R5' }).click();
  await expect(page.getByText('Muse Spark generated', { exact: true })).toBeVisible();
  await expect(page.getByText('Recorded Muse Spark run', { exact: true })).toHaveCount(0);
  await expect(page.locator('figure.source-overlay img')).toHaveAttribute('src', '/synthetic/recorded-lecture-9.png');
  await expect(page.getByText('Source drawing aligned to its original demo image.', { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Recorded example' })).toHaveCount(0);
  await page.getByText('Source & sharing', { exact: true }).click();
  await expect(page.getByRole('img', { name: 'Original synthetic demo screenshot', exact: true })).toBeVisible();
});
