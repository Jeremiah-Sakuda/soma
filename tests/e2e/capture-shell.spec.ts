import { test, expect, type Page, type Route } from '@playwright/test';
import { checkExploration, createExampleExploration } from '../../src/lib/domain/exploration';
import { initialExplorationState } from '../../src/lib/domain/exploration-view';

// Synthetic API responses exercise the real capture, rendering and surface state.
// They do not establish model quality or native operating-system window behavior.
function fixture(version = 1) {
  const checked = checkExploration(createExampleExploration());
  checked.spec.title = version === 1 ? 'Captured synthetic graph' : 'Late synthetic revision';
  const time = '2026-10-30T12:00:00Z';
  return { ...checked, id: 'a169ba8a-9dfc-40b1-a9ae-3b1782e2b488', version,
    createdAt: time, updatedAt: time, question: 'Explain this graph.',
    source: { kind: 'screenshot', label: 'Original synthetic capture', capturedAt: time,
      summary: 'Original synthetic BFS diagram.', uncertainty: [] },
    generation: { mode: 'prepared-example', provider: 'none', model: null, calls: 0, costUsd: 0, elapsedMs: 0, audit: [] },
    state: initialExplorationState(checked.spec), saved: false };
}
async function setup(page: Page, native = false) {
  const calls: any[] = [];
  let deferred: Route | undefined;
  let delay = false;
  if (native) await page.addInitScript(() => {
    const observed = ((window as any).__surface = { ready: 0, requests: [] as unknown[] });
    window.addEventListener('soma:surface-ready', () => {
      observed.ready++;
      window.dispatchEvent(new CustomEvent('soma:surface', { detail: { surface: 'companion' } }));
    });
    window.addEventListener('soma:surface-request', event => observed.requests.push((event as CustomEvent).detail));
  });
  await page.route(/\/api\/explore(?:\?.*)?$/, async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { artifacts: [], liveEnabled: true } });
    const body = route.request().postDataJSON(); calls.push(body);
    if (body.action === 'cancel') return route.fulfill({ json: { cancelled: true } });
    if (body.action === 'generate' && delay) { deferred = route; return; }
    return route.fulfill({ json: { artifact: fixture(body.baseVersion ? 2 : 1) } });
  });
  await page.goto(`/explore${native ? '?surface=companion' : ''}`);
  await expect(page.getByRole('heading', { name: 'Understand what’s on your screen.' })).toBeVisible();
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 280;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 480, 280);
    ctx.fillStyle = '#222'; ctx.font = '22px sans-serif'; ctx.fillText('Synthetic graph: S → A → G', 20, 100);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Upload a PNG or JPEG screenshot').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
  await expect(page.getByAltText('Your selected screenshot; captured only when requested')).toBeVisible();
  expect(calls).toEqual([]);
  await page.locator('#exploration-question').fill('Explain this graph.');
  await page.getByRole('button', { name: 'Ask Soma', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Captured synthetic graph', exact: true })).toBeVisible();
  return { calls, delayNext: () => { delay = true; }, finishLate: async () => { await deferred?.fulfill({ json: { artifact: fixture(2) } }).catch(() => undefined); } };
}

test('capture preview stays local and quick/app transitions preserve controls and draft without inference', async ({ page }) => {
  const { calls } = await setup(page);
  await expect(page.locator('.capture-shell')).toHaveAttribute('data-surface', 'quick');
  expect(calls.filter(c => c.action === 'generate')).toHaveLength(1);
  expect(calls[0].source.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  const frontier = page.getByRole('list', { name: 'First in, first out queue' });
  const before = await frontier.textContent();
  await page.locator('#exploration-question').fill('Keep this unsent question.');
  await page.getByRole('button', { name: 'Explore in app', exact: true }).click();
  await expect(page.locator('.capture-shell')).toHaveAttribute('data-surface', 'workspace');
  await expect(page.locator('#exploration-question')).toHaveValue('Keep this unsent question.');
  expect(await frontier.textContent()).toBe(before);
  await page.getByRole('button', { name: 'Quick view', exact: true }).click();
  await expect(page.locator('#exploration-question')).toHaveValue('Keep this unsent question.');
  expect(await frontier.textContent()).toBe(before);
  expect(calls.filter(c => c.action === 'generate')).toHaveLength(1);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('data:image');
});

test('accessible size presets and phone reduced motion retain reachable quick controls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await setup(page);
  const frame = page.locator('.capture-result-frame'); const small = (await frame.boundingBox())!.width;
  const size = page.getByRole('combobox', { name: 'Explanation window size' });
  await size.focus(); await expect(size).toBeFocused(); await size.selectOption('large');
  await expect(size).toHaveValue('large');
  expect((await frame.boundingBox())!.width).toBeGreaterThan(small);
  await page.setViewportSize({ width: 375, height: 704 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Next step', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Next step', exact: true })).toBeFocused();
  await page.locator('#exploration-question').fill('Phone draft');
  await page.getByRole('button', { name: 'Explore in app', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#exploration-question')).toHaveValue('Phone draft');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('native surface handshake and requests preserve the active artifact and draft', async ({ page }) => {
  const { calls } = await setup(page, true);
  expect(await page.evaluate(() => (window as any).__surface.ready)).toBeGreaterThan(0);
  await expect(page.locator('.capture-shell')).toHaveClass(/is-native/);
  await expect(page.getByRole('combobox', { name: 'Explanation window size' })).toHaveCount(0);
  await page.locator('#exploration-question').fill('Native unsent question');
  await page.getByRole('button', { name: 'Explore in app', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__surface.requests.at(-1))).toEqual({ surface: 'workspace' });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('soma:surface', { detail: { surface: 'companion' } })));
  await expect(page.locator('.capture-shell')).toHaveAttribute('data-surface', 'quick');
  await expect(page.locator('#exploration-question')).toHaveValue('Native unsent question');
  await expect(page.getByRole('heading', { name: 'Captured synthetic graph', exact: true })).toBeVisible();
  expect(calls.filter(c => c.action === 'generate')).toHaveLength(1);
});

test('cancelling a delayed compact follow-up keeps the prior visual and draft when its response arrives', async ({ page }) => {
  const session = await setup(page); session.delayNext();
  await page.locator('#exploration-question').fill('Do not discard this question.');
  await page.getByRole('button', { name: 'Ask Soma', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel request', exact: true }).click();
  await expect.poll(() => session.calls.filter(c => c.action === 'cancel').length).toBe(1);
  await session.finishLate();
  await expect(page.getByRole('heading', { name: 'Captured synthetic graph', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Late synthetic revision', exact: true })).toHaveCount(0);
  await expect(page.locator('#exploration-question')).toHaveValue('Do not discard this question.');
  await expect(page.getByRole('button', { name: 'Ask Soma', exact: true })).toBeEnabled();
});
