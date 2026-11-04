import { openMoreExamples } from './example-navigation';
import { test as base, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// Real local application, checked retained inputs, and real renderers. No new inference or sound.
const test = base.extend<{ silentReadout: boolean }>({
  silentReadout: [async ({ page }, use, info) => {
    const forbidden: string[] = [], media: string[] = [], errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('__readoutMedia', (name: string) => media.push(name));
    await page.addInitScript(() => {
      const refuse = (name: string): never => {
        void (window as any).__readoutMedia(name);
        throw new Error(`Silent height readout test refused ${name}`);
      };
      HTMLMediaElement.prototype.play = () => refuse('media');
      window.speechSynthesis.speak = () => refuse('speech');
      navigator.mediaDevices.getUserMedia = async () => refuse('microphone');
      for (const name of ['AudioContext', 'OfflineAudioContext'] as const) {
        const Context = window[name];
        if (Context) Object.defineProperty(window, name, {
          configurable: true, value: new Proxy(Context, { construct: () => refuse(name) }),
        });
      }
    });
    await page.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname) ||
        /voice|speech|transcri|narrat|audio/i.test(url.pathname) ||
        (url.pathname === '/api/explore' && request.method() === 'POST' && request.postDataJSON().action === 'generate')) {
        forbidden.push(`${request.method()} ${url.origin}${url.pathname}`);
        return route.abort();
      }
      return route.continue();
    });
    await use(true);
    await info.attach('silent-local-readout', {
      body: JSON.stringify({ forbidden, media, errors }, null, 2), contentType: 'application/json',
    });
    expect(forbidden).toEqual([]);
    expect(media).toEqual([]);
    expect(errors).toEqual([]);
  }, { auto: true }],
});
test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] }, reducedMotion: 'reduce' });
const values = (page: Page) => page.locator('.spatial-height-readout');
const node = (page: Page, id: string) => values(page).locator(`[data-height-node="${id}"] dd`);

async function finishSteps(page: Page) {
  const next = page.getByRole('button', { name: 'Next step', exact: true });
  for (let i = 0; i < 12 && await next.isEnabled(); i++) await next.click();
  await expect(next).toBeDisabled();
}
async function save(page: Page) {
  const button = page.getByRole('button', { name: 'Save exploration', exact: true });
  const [response] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/explore' &&
      response.request().method() === 'PATCH' && response.request().postDataJSON().action === 'save'),
    button.click(),
  ]);
  expect(response.ok()).toBe(true);
  await expect(button).toBeEnabled();
  return (await (await page.request.get('/api/explore')).json()).active;
}
async function rendered(page: Page, renderer: 'three' | 'anatomy') {
  await page.getByRole('button', { name: renderer === 'three' ? 'Current 3D' : 'Anatomy illustration', exact: true }).click();
  await expect(page.locator(renderer === 'three' ? '.spatial-canvas canvas' : '.anatomy-canvas')).toHaveAttribute('data-rendered', 'true');
  await expect(values(page)).toHaveCount(1);
}
async function captureReadable(page: Page, name: string, width: number) {
  await page.setViewportSize({ width, height: width === 620 ? 704 : 1000 });
  await page.locator('.spatial-stage').evaluate(element => {
    element.scrollIntoView({ block: 'start', behavior: 'instant' });
    window.scrollBy({ top: -70, behavior: 'instant' });
  });
  const readout = values(page), composer = page.getByRole('region', { name: 'Ask about your context', exact: true });
  await expect(readout).toBeInViewport({ ratio: 1 });
  const bounds = (await readout.boundingBox())!, question = (await composer.boundingBox())!;
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(question.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const text = await readout.locator('dt,dd').evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect();
    return { font: parseFloat(getComputedStyle(element).fontSize), left: box.left, right: box.right };
  }));
  for (const item of text) {
    expect(item.font).toBeGreaterThanOrEqual(16);
    expect(item.left).toBeGreaterThanOrEqual(bounds.x);
    expect(item.right).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
  }
  const directory = '.local/overnight-review/height-readout';
  mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: `${directory}/${name}-${width}.png` });
}

test('recorded graph keeps checked step values beside both renderers and preserves the edited saved state', async ({ page }) => {
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Watch a recorded Muse run', exact: true }).click();
  await page.getByRole('button', { name: '3D workspace', exact: true }).click();
  await expect(node(page, 'A')).toHaveText('0');
  await expect(node(page, 'F')).toHaveText('Unreached');
  const original = (await (await page.request.get('/api/explore')).json()).active;
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(node(page, 'F')).toHaveText('≤ 11');
  await finishSteps(page);
  await expect(node(page, 'F')).toHaveText('7');
  const probe = page.getByRole('region', { name: 'Checked cost experiment', exact: true });
  await probe.getByRole('button', { name: 'Try the tie at 5', exact: true }).click();
  await probe.getByRole('slider').focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(node(page, 'F')).toHaveText('9');
  await page.getByRole('button', { name: 'F', exact: true }).click();
  for (const renderer of ['three', 'anatomy'] as const) {
    await rendered(page, renderer);
    await expect(node(page, 'F')).toHaveText('9');
    await expect(page.getByRole('button', { name: 'F', exact: true })).toHaveAttribute('aria-pressed', 'true');
    for (const width of [1440, 620]) await captureReadable(page, `graph-${renderer}`, width);
  }
  const saved = await save(page);
  expect(saved.spec).toEqual(original.spec);
  expect(saved.source).toEqual(original.source);
  expect(saved.generation).toEqual(original.generation);
  expect(saved.state).toMatchObject({ selectedObjectId: 'F', edgeWeights: { e_DF: 6 }, spatial: { renderer: 'anatomy', mode: '3d' } });
  await page.reload();
  await page.locator('.exploration-library button').first().click();
  await expect(node(page, 'F')).toHaveText('9');
  await expect(page.getByRole('button', { name: 'F', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('switching inspected searches changes distance identity and values without changing the scene controls', async ({ page }) => {
  await page.goto('/explore');
  await openMoreExamples(page);
  await page.getByRole('button', { name: 'Compare weighted paths', exact: true }).click();
  await page.getByRole('button', { name: '3D workspace', exact: true }).click();
  await finishSteps(page);
  await expect(page.getByRole('group', { name: 'Current Dijkstra distances', exact: true })).toBeVisible();
  await expect(node(page, 'g')).toHaveText('3');
  await page.getByRole('button', { name: /^BFS · 10/ }).click();
  await expect(page.getByRole('group', { name: 'Current BFS hop distances', exact: true })).toBeVisible();
  await expect(node(page, 'g')).toHaveText('1');
  await rendered(page, 'anatomy');
  await expect(node(page, 'g')).toHaveText('1');
  await page.getByRole('button', { name: /^Dijkstra · 3/ }).click();
  await expect(node(page, 'g')).toHaveText('3');
  await expect(page.getByRole('button', { name: 'Anatomy illustration', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('recorded circuit values distinguish unrevealed, balanced and reversed voltages beside both renderers', async ({ page }) => {
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Watch a recorded Muse run', exact: true }).click();
  await page.getByRole('button', { name: 'Recorded circuit', exact: true }).click();
  await page.getByRole('button', { name: 'Voltage as height', exact: true }).click();
  await expect(node(page, 'D')).toHaveText('0 V');
  await expect(node(page, 'B')).toHaveText('Not revealed');
  await finishSteps(page);
  await expect(node(page, 'B')).toHaveText('8 V');
  await expect(node(page, 'C')).toHaveText('8 V');
  const probe = page.getByRole('region', { name: 'Checked circuit experiment', exact: true });
  await probe.getByRole('slider').focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(probe.getByRole('status')).toContainText('from C to B');
  await expect(node(page, 'B')).toHaveText('≈ 8.037 V');
  await expect(node(page, 'C')).toHaveText('≈ 8.174 V');
  for (const renderer of ['three', 'anatomy'] as const) {
    await rendered(page, renderer);
    for (const width of [1440, 620]) await captureReadable(page, `circuit-${renderer}`, width);
  }
});
