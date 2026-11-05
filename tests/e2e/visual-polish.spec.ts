import { openMoreExamples } from './example-navigation';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixtures = JSON.parse(readFileSync('tests/fixtures/visual-polish-scenes.json', 'utf8'));
import { checkExploration } from '../../src/lib/domain/exploration';
import { initialExplorationState } from '../../src/lib/domain/exploration-view';
// Original synthetic-source Muse scenes, replayed as prepared UI fixtures. No
// provider call or claim of a live review is made by these layout journeys.
async function fixture(page: import('@playwright/test').Page, key: 'gradient' | 'weighted') {
  const checked = checkExploration(fixtures[key]);
  const artifact = {
    ...checked,
    id: '9d17342c-ae1b-4c9a-b9e2-5ecc12bcd1ed',
    version: 1,
    createdAt: '2026-10-30T12:00:00Z',
    updatedAt: '2026-10-30T12:00:00Z',
    question: 'Original synthetic visual audit',
    source: {
      kind: 'example',
      label: 'Original synthetic visual audit',
      capturedAt: '2026-10-30T12:00:00Z',
      summary:
        'Original synthetic source and previously generated scene used for presentation checks.',
      uncertainty: [],
    },
    generation: {
      mode: 'prepared-example',
      provider: 'none',
      model: null,
      calls: 0,
      costUsd: 0,
      elapsedMs: 0,
      audit: [],
    },
    state: initialExplorationState(checked.spec),
    saved: false,
  };
  await page.route('**/api/explore', (r) =>
    r.request().method() === 'GET'
      ? r.fulfill({ json: { artifacts: [], liveEnabled: true } })
      : r.fulfill({ json: { artifact } }),
  );
  await page.goto('/explore');
  await openMoreExamples(page);
  await page.getByRole('button', { name: 'Try the original example', exact: true }).first().click();
  await page.getByRole('heading', { name: artifact.spec.title, exact: true }).waitFor();
  return artifact;
}
test('explanatory mechanism remains visible while real voice preparation is pending', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await fixture(page, 'gradient');
  let finish: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route('**/api/explore/speech', async (r) => {
    await gate;
    await r
      .fulfill({
        status: 503,
        json: { error: 'Original synthetic voice failure' },
      })
      .catch(() => {});
  });
  await page.getByRole('button', { name: 'Play explanation', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Preparing Gemini audio' }),
  ).toBeVisible();
  const nodes = page.locator('.exploration-panel-diagram .exploration-node');
  for (const node of await nodes.all()) await expect(node).toHaveAttribute('opacity', '1');
  await page.getByRole('button', { name: 'Pause explanation', exact: true }).click();
  finish();
});
test('general explanations can be stepped without waiting for voice and keep the active step visible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 620, height: 704 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fixture(page, 'gradient');
  await expect(page.getByRole('button', { name: 'Next explanation', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next explanation', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Explanation 2 of 3' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Previous explanation', exact: true }),
  ).toBeEnabled();
});
for (const key of ['gradient', 'weighted'] as const) {
  test(`the ${key} mechanism fits the first desktop view without expanded inspector clutter`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fixture(page, key);
    await page.evaluate(() => scrollTo(0, 0));
    const svg = page
      .locator(
        key === 'gradient' ? '.exploration-panel-diagram svg' : '.exploration-panel-graph > svg',
      )
      .first();
    await page.screenshot({ path: `/tmp/soma-pm075-${key}-desktop.png` });
    const box = await svg.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(880);
    const inspector = page.locator(
      '.exploration-object-buttons[aria-label="Select a diagram object"]',
    );
    if (await inspector.count()) await expect(inspector).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

for (const width of [620, 375])
  test(`generated explanation is readable and selectable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 620 ? 704 : 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fixture(page, 'gradient');
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `/tmp/soma-pm075-gradient-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const label of await page.locator('.exploration-diagram-label').all()) {
      expect(await label.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      expect((await label.boundingBox())!.height).toBeGreaterThan(20);
      expect(
        await label.evaluate(
          (el) => parseFloat(getComputedStyle(el).fontSize) * el.closest('svg')!.getScreenCTM()!.a,
        ),
      ).toBeGreaterThanOrEqual(12);
    }
    await page.getByText('Inspect diagram', { exact: true }).click();
    const button = page.locator('.exploration-object-buttons button').first();
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/^Asking about:/)).toBeVisible();
  });
