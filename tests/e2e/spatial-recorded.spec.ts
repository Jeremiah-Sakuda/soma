import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExplorationArtifact } from '../../src/lib/server/exploration-types';

// Rendering replay of private, actual provider output. This is not live inference
// or persistence evidence; the opt-in provider test establishes those separately.
test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
test.skip(!process.env.SOMA_SPATIAL_REPLAY, 'Requires a private live-test artifact directory.');
for (const version of ['first', 'next']) for (const renderer of ['three', 'anatomy']) test(`renders recorded Muse ${version} spatial output with ${renderer}`, async ({ page }) => {
  const directory = process.env.SOMA_SPATIAL_REPLAY!;
  const artifact = JSON.parse(readFileSync(join(directory, `${version}-artifact.json`), 'utf8')) as ExplorationArtifact;
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.route(/\/api\/explore(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { active: artifact, artifacts: [artifact], versions: [], liveEnabled: false } });
    return route.fallback();
  });
  await page.goto('/explore');
  await page.locator('.exploration-library button').first().click();
  if (renderer === 'anatomy') {
    await page.getByRole('button', { name: 'Anatomy illustration', exact: true }).click();
    await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-rendered', 'true');
    await page.getByRole('button', { name: 'Processor', exact: true }).click();
    await expect(page.locator('.anatomy-selected-label')).toContainText('Processor');
  } else await expect(page.locator('.spatial-canvas canvas')).toHaveAttribute('data-rendered', 'true');
  await expect(page.getByRole('button', { name: 'Processor', exact: true })).toBeVisible();
  if (version === 'next') {
    await expect(page.getByRole('slider', { name: 'Separate parts', exact: true })).toHaveValue('0.55');
    await expect(page.getByRole('slider', { name: 'Cutaway', exact: true })).toHaveValue('0.2');
  }
  await page.locator('.spatial-workspace').screenshot({ path: join(directory, `${version}-${renderer}-render.png`) });
  expect(errors).toEqual([]);
});
