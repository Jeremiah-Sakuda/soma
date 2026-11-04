import { test, expect } from '@playwright/test';

// The actual local app opens prepared/recorded artifacts. These journeys never start
// generation, narration or microphone capture, and do not establish live model quality.
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 620, height: 704 },
  { width: 375, height: 812 },
]) {
  test(`first-use examples are visible above the question dock at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const requests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/') && request.method() !== 'GET') requests.push(request.url());
    });
    await page.goto('/explore');
    await expect(page.getByRole('button', { name: 'Compare weighted paths', exact: true })).toBeEnabled();
    await expect(page.locator('.journal-example-grid button').first()).toHaveAccessibleName('Watch a recorded Muse run');
    await expect(page.getByRole('heading', { name: 'Point Soma at something you’re studying.' })).toBeVisible();
    const dock = await page.getByRole('region', { name: 'Ask about your context' }).boundingBox();
    for (const name of [
      'Compare weighted paths',
      'Watch a recorded Muse run',
      'Try the Lecture 14 slide (live)',
      'Try the Lecture 9 circuit slide (live)',
    ]) {
      const button = page.getByRole('button', { name, exact: true });
      await expect(button).toBeInViewport({ ratio: 1 });
      const box = await button.boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(dock!.y);
      expect(await button.evaluate(element => {
        const box = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      })).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(requests).toEqual([]);
    await page.screenshot({ path: `.local/overnight-review/round2-cover-${viewport.width}.png`, fullPage: true });
  });
}

test('a live demo choice previews its source and question without starting generation', async ({ page }) => {
  await page.setViewportSize({ width: 620, height: 704 });
  const requests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/') && request.method() !== 'GET') requests.push(request.url());
  });
  await page.goto('/explore');
  const circuit = page.getByRole('button', { name: 'Try the Lecture 9 circuit slide (live)', exact: true });
  await expect(circuit).toBeEnabled();
  await circuit.focus();
  await page.keyboard.press('Enter');
  const preview = page.getByRole('img', { name: 'Your selected screenshot; captured only when requested' });
  await expect(preview).toBeInViewport();
  await expect(page.locator('#exploration-question')).toHaveValue('Why is there no current through R5?');
  await expect(page.locator('#exploration-question')).toBeFocused();
  // Live inference is deliberately disabled by the local test server.
  await expect(page.getByRole('button', { name: 'Ask Soma', exact: true })).toBeDisabled();
  expect(requests).toEqual([]);
  await page.screenshot({ path: '.local/overnight-review/round2-circuit-source-preview.png', fullPage: true });
});
