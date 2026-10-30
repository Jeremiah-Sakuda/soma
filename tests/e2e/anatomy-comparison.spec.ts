import { test, expect, type Page } from '@playwright/test';
import { spatialRenderStyles } from '../../src/lib/domain/spatial-schema';
import type { ExplorationArtifact } from '../../src/lib/server/exploration-types';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
async function open(page: Page) {
  await page.goto('/explore'); await page.getByRole('button', { name: 'Open the 3D example', exact: true }).click();
  await page.getByRole('button', { name: 'Anatomy illustration', exact: true }).click();
  await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-rendered', 'true');
}
const part = (page: Page, id: string) => page.locator(`.anatomy-details[data-anatomy-object="${id}"]`);

test('same explanation supports renderer comparison, exact saved reopening and immutable source', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await open(page);
  const original = (await (await page.request.get('/api/explore')).json()).active;
  await page.getByRole('button', { name: 'Processor', exact: true }).click();
  await page.getByRole('slider', { name: 'Separate parts', exact: true }).fill('0.55');
  await page.getByRole('slider', { name: 'Cutaway', exact: true }).fill('0.4');
  await page.getByRole('button', { name: 'Next explanation', exact: true }).click();
  await page.getByRole('button', { name: 'Side by side', exact: true }).click();
  await expect(page.locator('.spatial-canvas canvas')).toHaveAttribute('data-rendered', 'true');
  await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-object-count', '5');
  await page.getByRole('button', { name: 'Isolate selected', exact: true }).click();
  await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-object-count', '1');
  await expect(page.locator('.spatial-canvas-label:visible')).toHaveText('Processor');
  await page.getByRole('button', { name: 'Anatomy illustration', exact: true }).click();
  await expect(page.locator('.spatial-canvas canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  await expect(page.getByText('Saved this version and your exact experiment state.', { exact: true })).toBeVisible();
  const { active } = await (await page.request.get('/api/explore')).json();
  expect(active.spec).toEqual(original.spec); expect(active.source).toEqual(original.source);
  expect(active.generation.calls).toBe(0);
  expect(active.state).toMatchObject({ explanationStep: 1, selectedObjectId: 'processor', spatial: { renderer: 'anatomy', spread: .55, slice: .4, isolate: true } });
  await page.reload(); await page.locator('.exploration-library button').first().click();
  await expect(page.getByRole('button', { name: 'Anatomy illustration', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-object-count', '1');
  await expect(page.locator('.anatomy-selected-label')).toContainText('Processor');
  expect(errors).toEqual([]);
});

test('pointer picking and orbit use the same bounded view state as camera buttons', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Processor', exact: true }).click();
  await page.getByRole('button', { name: 'Isolate selected', exact: true }).click();
  await page.getByRole('button', { name: 'Clear selected object', exact: true }).click();
  // The object is now visible among the assembly. Pick an actual projected path.
  await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-object-count', '5');
  await page.locator('.anatomy-canvas').scrollIntoViewIfNeeded();
  const target = await page.locator('g[data-anatomy-object="processor"] .anatomy-fill').evaluateAll(paths => {
    for (const path of [...paths].sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)) {
      const r = path.getBoundingClientRect();
      for (const dx of [.5, .25, .75]) for (const dy of [.5, .25, .75]) {
        const x = r.x + r.width * dx, y = r.y + r.height * dy;
        if (document.elementFromPoint(x, y)?.closest('[data-anatomy-object]')?.getAttribute('data-anatomy-object') === 'processor') return { x, y };
      }
    }
    throw new Error('Processor must expose a real pointer target in the illustration');
  });
  await page.mouse.click(target.x, target.y);
  await expect(page.getByRole('button', { name: 'Processor', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const box = (await page.locator('.anatomy-canvas svg').boundingBox())!;
  await page.mouse.move(box.x + box.width * .8, box.y + box.height * .7); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .8 + 50, box.y + box.height * .7 + 20, { steps: 5 }); await page.mouse.up();
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  await expect(page.getByText('Saved this version and your exact experiment state.', { exact: true })).toBeVisible();
  expect((await (await page.request.get('/api/explore')).json()).active.state.spatial).toMatchObject({ azimuth: 15, elevation: 31, renderer: 'anatomy' });
});

test('reduced motion, keyboard controls, responsive comparison and idle settling', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.requestAnimationFrame; (window as unknown as { framesRequested: number }).framesRequested = 0;
    window.requestAnimationFrame = fn => { (window as unknown as { framesRequested: number }).framesRequested++; return original(fn); };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await open(page);
  await page.getByRole('button', { name: 'Next explanation', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(part(page, 'signal')).toHaveAttribute('data-position', /"x":0,/);
  await page.getByRole('slider', { name: 'Separate parts', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('slider', { name: 'Separate parts', exact: true })).toHaveValue('0.05');
  await page.getByRole('button', { name: 'Side by side', exact: true }).focus(); await page.keyboard.press('Enter');
  for (const width of [1440, 620, 375]) {
    await page.setViewportSize({ width, height: width === 620 ? 704 : 900 });
    await expect(page.locator('.anatomy-canvas')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const button of await page.locator('.spatial-renderer-switch button').all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.locator('.spatial-comparison').screenshot({ path: `.local/pm108/comparison-${width}.png` });
  }
  await page.getByRole('button', { name: 'Anatomy illustration', exact: true }).click();
  // Event-driven renderer has no ongoing frame loop after it has settled.
  const before = await page.evaluate(() => (window as unknown as { framesRequested: number }).framesRequested);
  await page.waitForTimeout(450);
  expect(await page.evaluate(() => (window as unknown as { framesRequested: number }).framesRequested)).toBe(before);
});

test('normal pose motion settles correctly after interruption and renderer unmount', async ({ page }) => {
  await open(page);
  await part(page, 'signal').evaluate(element => {
    const values: string[] = []; const o = new MutationObserver(() => values.push(element.getAttribute('data-position') ?? ''));
    o.observe(element, { attributes: true, attributeFilter: ['data-position'] }); (window as unknown as { poses: string[] }).poses = values;
  });
  await page.getByRole('button', { name: 'Next explanation', exact: true }).click();
  await expect(part(page, 'signal')).toHaveAttribute('data-position', /"x":0,/);
  const poses = await page.evaluate(() => (window as unknown as { poses: string[] }).poses.map(s => JSON.parse(s).x));
  expect(poses.some(x => x > -1.3 && x < 0)).toBe(true);
  await page.getByRole('button', { name: 'Next explanation', exact: true }).click();
  await page.getByRole('button', { name: 'Previous explanation', exact: true }).click();
  await expect(part(page, 'signal')).toHaveAttribute('data-position', /"x":0,/);
  await page.getByRole('button', { name: 'Current 3D', exact: true }).click();
  await page.getByRole('button', { name: 'Anatomy illustration', exact: true }).click();
  await expect(part(page, 'signal')).toHaveAttribute('data-position', /"x":0,/);
});

test('Anatomy continues without WebGL and checked results survive switching renderers', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) { return kind === 'webgl2' ? null : original.call(this, kind as never, ...args as []) as never; } as typeof original;
  });
  await open(page); await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-object-count', '5');
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  await page.reload();
  if (!(await page.getByRole('button', { name: 'Compare weighted paths', exact: true }).isVisible())) await page.getByText('Source & sharing', { exact: true }).click();
  await page.getByRole('button', { name: 'Compare weighted paths', exact: true }).click();
  await page.getByRole('button', { name: '3D workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Anatomy illustration', exact: true }).click();
  for (let i = 0; i < 8; i++) { const next = page.getByRole('button', { name: 'Next step', exact: true }); if (await next.isEnabled()) await next.click(); }
  await expect(page.getByRole('status').filter({ hasText: 'total cost 3' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'total cost 10' })).toBeVisible();
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  await expect(page.getByText('Saved this version and your exact experiment state.', { exact: true })).toBeVisible();
  const { active } = await (await page.request.get('/api/explore')).json();
  expect(active.validation.assurance).toBe('checked-dijkstra'); expect(active.state.spatial.renderer).toBe('anatomy');
});

test('all approved styles render with full source labels at desktop and phone widths', async ({ page }) => {
  test.setTimeout(90_000); await open(page);
  const { active: original } = await (await page.request.get('/api/explore')).json() as { active: ExplorationArtifact };
  let fixture = original;
  await page.route(/\/api\/explore(?:\?.*)?$/, async route => route.request().method() === 'GET' ? route.fulfill({ json: { active: fixture, artifacts: [fixture], versions: [], liveEnabled: false } }) : route.fallback());
  for (const width of [1440, 620, 375]) for (let batch = 0; batch < 3; batch++) {
    fixture = structuredClone(original);
    if (fixture.spec.mode !== 'explanation' || fixture.spec.scene.panels[0].kind !== 'spatial') throw new Error('fixture');
    const p = fixture.spec.scene.panels[0]; p.connections = []; p.poses = [];
    p.objects = spatialRenderStyles.slice(batch * 6, batch * 6 + 6).map((renderStyle, i) => ({ id: `part${i}`, label: renderStyle, description: 'Original synthetic rendering study; not a Muse output.', shape: 'box', renderStyle, color: 'sage', position: { x: (i % 3 - 1) * 1.8, y: 0, z: (Math.floor(i / 3) - .5) * 2 }, size: { x: 1.1, y: 1.1, z: 1.1 }, parentId: null }));
    fixture.spec.steps = [{ ...fixture.spec.steps[0], highlightIds: [] }];
    fixture.state.spatial = { ...fixture.state.spatial!, renderer: 'anatomy' }; fixture.state.selectedObjectId = null;
    await page.setViewportSize({ width, height: 900 }); await page.goto('/explore'); await page.locator('.exploration-library button').first().click();
    await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-object-count', String(p.objects.length));
    expect(await page.locator('.anatomy-canvas path').evaluateAll(paths => paths.every(p => !/NaN|Infinity|undefined/.test(p.getAttribute('d') ?? '')))).toBe(true);
    for (const o of p.objects) { await page.getByRole('button', { name: o.label, exact: true }).click(); await expect(page.locator('.anatomy-selected-label')).toContainText(o.label); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.spatial-stage').screenshot({ path: `.local/pm108/anatomy-catalog-${batch}-${width}.png` });
  }
});
