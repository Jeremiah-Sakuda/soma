import { test, expect } from '@playwright/test';
import { spatialRenderStyles } from '../../src/lib/domain/spatial-schema';
import type { ExplorationArtifact } from '../../src/lib/server/exploration-types';

// Explicit synthetic rendering fixtures. These are neither Muse outputs nor
// persistence evidence; real persistence remains covered by the service tests.
test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
test('expanded part catalog renders with readable callouts, camera feedback and narrow-screen isolation', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Open the 3D example', exact: true }).click();
  const { active: original } = await (await page.request.get('/api/explore')).json() as { active: ExplorationArtifact };
  let fixture = original;
  await page.route(/\/api\/explore(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { active: fixture, artifacts: [fixture], versions: [], liveEnabled: false } });
    return route.fallback();
  });
  for (const width of [1440, 620, 375]) for (let batch = 0; batch < 3; batch++) {
    fixture = structuredClone(original);
    if (fixture.spec.mode !== 'explanation' || fixture.spec.scene.panels[0].kind !== 'spatial') throw new Error('fixture');
    fixture.spec.title = 'Prepared component rendering study';
    const panel = fixture.spec.scene.panels[0];
    panel.title = 'Illustrative component library'; panel.connections = []; panel.poses = [];
    panel.objects = spatialRenderStyles.slice(batch * 6, batch * 6 + 6).map((renderStyle, i) => ({
      id: `part${i}`, label: renderStyle === 'membrane' ? 'Cell membrane cutaway' : renderStyle[0].toUpperCase() + renderStyle.slice(1),
      description: 'Original synthetic component illustration, not a source observation.',
      shape: 'box', renderStyle, color: ['sage', 'clay', 'blue', 'gold', 'violet', 'sage'][i] as 'sage',
      position: { x: (i % 3 - 1) * 1.8, y: 0, z: (Math.floor(i / 3) - 0.5) * 2 }, size: { x: 1.1, y: 1.1, z: 1.1 }, parentId: null,
    }));
    fixture.spec.steps = [{ ...fixture.spec.steps[0], highlightIds: [] }];
    fixture.state.selectedObjectId = null;
    await page.setViewportSize({ width, height: width === 620 ? 704 : 900 });
    await page.goto('/explore'); await page.locator('.exploration-library button').first().click();
    const canvas = page.locator('.spatial-canvas canvas'); await expect(canvas).toHaveAttribute('data-rendered', 'true');
    await expect(page.getByRole('button', { name: 'Perspective', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Illustrative parts · geometry and detail are schematic', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const boxes = await page.locator('.spatial-canvas-label:visible').evaluateAll((elements) => elements.map((e) => {
      const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }));
    expect(boxes.length).toBeGreaterThanOrEqual(3);
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
      expect(boxes[a].right <= boxes[b].left || boxes[b].right <= boxes[a].left || boxes[a].bottom <= boxes[b].top || boxes[b].bottom <= boxes[a].top).toBe(true);
    }
    await page.locator('.spatial-stage').screenshot({ path: `.local/pm106/catalog-${batch}-${width}.png` });
    // Every part is inspectable, with full labels even if a dense view hides a callout.
    for (const part of panel.objects) {
      await page.getByRole('button', { name: part.label, exact: true }).click();
      await expect(page.locator('.spatial-inspector strong')).toHaveText(part.label);
    }
    await page.getByRole('button', { name: 'Isolate selected', exact: true }).click();
    await expect(page.locator('.spatial-canvas-label:visible')).toHaveText(panel.objects.at(-1)!.label);
    await page.getByRole('button', { name: 'Front', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Front', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Perspective', exact: true })).toHaveAttribute('aria-pressed', 'false');
    const membrane = panel.objects.find((p) => p.renderStyle === 'membrane');
    if (membrane) {
      await page.getByRole('button', { name: membrane.label, exact: true }).click();
      await expect(page.locator('.spatial-canvas-label:visible')).toHaveText(membrane.label);
      await page.locator('.spatial-stage').screenshot({ path: `.local/pm106/membrane-${width}.png` });
    }
  }
  expect(errors).toEqual([]);
});
