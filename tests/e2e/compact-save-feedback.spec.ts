import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// Real local application/storage with a retained original recording. Only the
// timing or failure of a save response is intercepted; no generation or media.
async function silent(page: Page) {
  const forbidden: string[] = [];
  await page.exposeFunction('__compactSaveMedia', (name: string) => forbidden.push(name));
  await page.addInitScript(() => {
    const refuse = (name: string) => {
      void (window as any).__compactSaveMedia(name);
      throw new Error(`Compact save check refused ${name}`);
    };
    HTMLMediaElement.prototype.play = function () { return Promise.reject(refuse('media')); };
    window.speechSynthesis.speak = () => refuse('speech');
    navigator.mediaDevices.getUserMedia = async () => refuse('microphone');
  });
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    const generation = url.pathname === '/api/explore' && request.method() === 'POST' &&
      request.postDataJSON().action === 'generate';
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || generation ||
      /speech|transcri|narrat|audio/i.test(url.pathname)) {
      forbidden.push(`${request.method()} ${url.pathname}`);
      return route.abort();
    }
    return route.continue();
  });
  await page.setViewportSize({ width: 620, height: 704 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  return forbidden;
}

async function changedGraph(page: Page) {
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Watch a recorded Muse run', exact: true }).click();
  await expect(page.getByText('Recorded Muse Spark run', { exact: true })).toBeVisible();
  const probe = page.getByRole('region', { name: 'Checked cost experiment', exact: true });
  await probe.getByRole('button', { name: 'Try the tie at 5', exact: true }).click();
  const slider = probe.getByRole('slider');
  await slider.focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(slider).toHaveValue('6');
  await expect(probe.getByRole('status')).toContainText('Dijkstra route cost: 9');
  return slider;
}

async function visibleSaveState(page: Page, text: string) {
  const status = page.getByRole('status', { name: 'Exploration save status', exact: true });
  const save = page.getByRole('button', { name: 'Save exploration', exact: true });
  await expect(status).toHaveText(text);
  await expect(status).toBeInViewport({ ratio: 1 });
  expect(await status.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(12);
  expect(await status.evaluate(element => parseFloat(getComputedStyle(element).lineHeight))).toBeGreaterThanOrEqual(14);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const statusBox = (await status.boundingBox())!, saveBox = (await save.boundingBox())!;
  const dock = (await page.getByRole('region', { name: 'Ask about your context' }).boundingBox())!;
  expect(statusBox.x).toBeGreaterThanOrEqual(saveBox.x);
  expect(statusBox.x + statusBox.width).toBeLessThanOrEqual(saveBox.x + saveBox.width);
  expect(statusBox.y).toBeGreaterThanOrEqual(saveBox.y);
  expect(statusBox.y + statusBox.height).toBeLessThanOrEqual(saveBox.y + saveBox.height);
  expect(statusBox.y + statusBox.height).toBeLessThanOrEqual(dock.y);
  expect(saveBox.height).toBeGreaterThanOrEqual(44);
  expect(await status.evaluate(element => {
    const box = element.getBoundingClientRect();
    return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      ?.closest('.journal-save') === element.closest('.journal-save');
  })).toBe(true);
}

test('compact keyboard save acknowledges pending and saved state in place, then reopens exact controls', async ({ page }) => {
  const forbidden = await silent(page);
  const slider = await changedGraph(page);
  const save = page.getByRole('button', { name: 'Save exploration', exact: true });
  const screenshots = '.local/overnight-review/compact-save';
  mkdirSync(screenshots, { recursive: true });
  const viewports = [{ width: 620, height: 704 }, { width: 375, height: 812 }];
  const headerHeights = new Map<number, number>();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await save.focus();
    await expect(save).toBeFocused();
    await visibleSaveState(page, 'Unsaved');
    headerHeights.set(viewport.width, (await page.locator('.journal-page-meta').boundingBox())!.height);
    if (viewport.width === 620) await page.screenshot({ path: `${screenshots}/620-unsaved.png` });
  }
  await page.setViewportSize(viewports[0]);
  await save.focus();
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let intercepted = false;
  await page.route('**/api/explore', async route => {
    if (!intercepted && route.request().method() === 'PATCH' && route.request().postDataJSON().action === 'save') {
      intercepted = true;
      await held;
    }
    return route.continue();
  });
  try {
    await page.keyboard.press('Enter');
    await expect(save).toBeDisabled();
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await visibleSaveState(page, 'Saving…');
      expect((await page.locator('.journal-page-meta').boundingBox())!.height).toBe(headerHeights.get(viewport.width));
      if (viewport.width === 620) await page.screenshot({ path: `${screenshots}/620-saving.png` });
    }
  } finally {
    release();
  }
  await expect(save).toBeEnabled();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await visibleSaveState(page, 'Saved');
    expect((await page.locator('.journal-page-meta').boundingBox())!.height).toBe(headerHeights.get(viewport.width));
    await page.screenshot({ path: `${screenshots}/${viewport.width}-saved.png` });
  }
  await page.setViewportSize(viewports[0]);
  const saved = (await (await page.request.get('/api/explore')).json()).active;
  expect(saved.saved).toBe(true);
  expect(saved.state.edgeWeights).toEqual({ e_DF: 6 });
  await page.reload();
  await page.locator('.exploration-library button').filter({ hasText: 'What sends the shortest route through E?' }).click();
  await visibleSaveState(page, 'Saved');
  await expect(slider).toHaveValue('6');
  const reopened = (await (await page.request.get('/api/explore')).json()).active;
  expect(reopened.id).toBe(saved.id);
  expect(reopened.state).toEqual(saved.state);
  expect(reopened.source).toEqual(saved.source);
  await slider.focus();
  await page.keyboard.press('Shift+ArrowLeft');
  await save.focus();
  await visibleSaveState(page, 'Unsaved');
  expect(forbidden).toEqual([]);
});

test('a failed compact save retains visible unsaved state, current controls and the question draft until retry', async ({ page }) => {
  const forbidden = await silent(page);
  const slider = await changedGraph(page);
  const save = page.getByRole('button', { name: 'Save exploration', exact: true });
  await save.focus();
  await page.keyboard.press('Enter');
  await visibleSaveState(page, 'Saved');
  const earlier = (await (await page.request.get('/api/explore')).json()).active;
  await slider.focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(slider).toHaveValue('7');
  const draft = page.getByRole('textbox', { name: 'Where would you like to go next?', exact: true });
  await draft.fill('Why does this route still win?');
  await save.focus();
  await visibleSaveState(page, 'Unsaved');
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let failed = false;
  await page.route('**/api/explore', async route => {
    if (!failed && route.request().method() === 'PATCH' && route.request().postDataJSON().action === 'save') {
      failed = true;
      await held;
      return route.fulfill({ status: 503, json: { code: 'unavailable', error: 'Untrusted upstream detail must not appear in the interface.' } });
    }
    return route.continue();
  });
  try {
    await page.keyboard.press('Space');
    await visibleSaveState(page, 'Saving…');
  } finally {
    release();
  }
  await expect(page.locator('.exploration-error')).toHaveText(
    'Soma could not save this exploration. Your changes are still here. Try again.',
  );
  await expect(page.getByText('Untrusted upstream detail must not appear in the interface.', { exact: true })).toHaveCount(0);
  await visibleSaveState(page, 'Unsaved');
  await expect(slider).toHaveValue('7');
  await expect(draft).toHaveValue('Why does this route still win?');
  const unchanged = (await (await page.request.get('/api/explore')).json()).active;
  expect(unchanged.state).toEqual(earlier.state);
  await save.focus();
  await page.keyboard.press('Enter');
  await visibleSaveState(page, 'Saved');
  const saved = (await (await page.request.get('/api/explore')).json()).active;
  expect(saved.state.edgeWeights).toEqual({ e_DF: 7 });
  await page.reload();
  await page.locator('.exploration-library button').filter({ hasText: 'What sends the shortest route through E?' }).click();
  await visibleSaveState(page, 'Saved');
  await expect(slider).toHaveValue('7');
  const reopened = (await (await page.request.get('/api/explore')).json()).active;
  expect(reopened.state).toEqual(saved.state);
  expect(forbidden).toEqual([]);
});
