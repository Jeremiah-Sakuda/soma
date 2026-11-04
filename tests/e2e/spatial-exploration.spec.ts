import { openMoreExamples } from './example-navigation';
import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';

// Real local HTTP/storage and WebGL. No provider or source success is simulated here.
test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
async function openSpatial(page: Page) {
  await page.goto('/explore');
  await openMoreExamples(page);
  await page.getByRole('button', { name: 'Open the 3D example', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Spatial workspace' })).toBeVisible();
}
async function rendered(page: Page) {
  await expect(page.locator('.spatial-canvas canvas')).toHaveAttribute('data-rendered', 'true');
}
async function slide(page: Page, name: string, value: string) {
  await page.getByRole('slider', { name, exact: true }).fill(value);
}

test('actual WebGL scene supports reversible steps, cutaway, isolation, camera and persistent reopening', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await openSpatial(page); await rendered(page);
  await expect(page.getByText('3D schematic · explanation only', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Processor', exact: true }).click();
  await page.getByRole('button', { name: 'Side', exact: true }).click();
  await slide(page, 'Separate parts', '0.65'); await slide(page, 'Cutaway', '0.3');
  await page.getByRole('button', { name: 'Next explanation', exact: true }).click();
  await page.getByRole('button', { name: 'Isolate selected', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show all parts', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  await expect(page.getByText('Saved this version and your exact experiment state.', { exact: true })).toBeVisible();
  const result = await (await page.request.get('/api/explore')).json();
  expect(result.active.state.spatial).toMatchObject({ mode: '3d', azimuth: 90, spread: 0.65, slice: 0.3, isolate: true });
  expect(result.active.state.selectedObjectId).toBe('processor'); expect(result.active.state.explanationStep).toBe(1);
  await page.reload(); await page.locator('.exploration-library button').first().click(); await rendered(page);
  await expect(page.getByRole('slider', { name: 'Separate parts', exact: true })).toHaveValue('0.65');
  await expect(page.getByRole('slider', { name: 'Cutaway', exact: true })).toHaveValue('0.3');
  await expect(page.getByRole('button', { name: 'Processor', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Show all parts', exact: true }).click();
  await slide(page, 'Separate parts', '0');
  await page.getByRole('button', { name: '2D view', exact: true }).click();
  await expect(page.locator('[data-spatial-object="signal"]')).toHaveAttribute('data-position', /"x":0,/);
  await page.getByRole('button', { name: 'Previous explanation', exact: true }).click();
  await expect(page.locator('[data-spatial-object="signal"]')).toHaveAttribute('data-position', /"x":-1.3,/);
  await page.getByRole('button', { name: '3D workspace', exact: true }).click(); await rendered(page);
  expect(errors).toEqual([]);
});

test('checked spatial graphs use the actual solver and preserve the chosen representation after a graph change', async ({ page }) => {
  await page.goto('/explore'); await openMoreExamples(page);
  await page.getByRole('button', { name: 'Compare weighted paths', exact: true }).click();
  await page.getByRole('button', { name: '3D workspace', exact: true }).click(); await rendered(page);
  for (let i = 0; i < 8; i++) {
    const next = page.getByRole('button', { name: 'Next step', exact: true }); if (await next.isEnabled()) await next.click();
  }
  await expect(page.getByRole('status').filter({ hasText: 'total cost 3' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'total cost 10' })).toBeVisible();
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  const { active } = await (await page.request.get('/api/explore')).json();
  expect(active.validation.assurance).toBe('checked-dijkstra');
  expect(active.state.spatial.mode).toBe('3d');
  await page.getByRole('button', { name: '2D view', exact: true }).click();
  await expect(page.locator('.spatial-canvas')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'total cost 3' })).toBeVisible();
});

test('pointer picking reaches a contained part and dragging persists bounded orbit', async ({ page }) => {
  await openSpatial(page); await rendered(page);
  await page.getByRole('button', { name: 'Front', exact: true }).click();
  const canvas = page.locator('.spatial-canvas canvas');
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.getByRole('button', { name: 'Processor', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const rect = (await canvas.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down(); await page.mouse.move(rect.x + rect.width / 2 + 60, rect.y + rect.height / 2 + 20, { steps: 8 }); await page.mouse.up();
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  await expect(page.getByText('Saved this version and your exact experiment state.', { exact: true })).toBeVisible();
  expect((await (await page.request.get('/api/explore')).json()).active.state.spatial).toMatchObject({ azimuth: -24, elevation: 6 });
});

test('context loss and unavailable WebGL retain a readable scene, step state and working recovery', async ({ page }) => {
  await openSpatial(page); await rendered(page);
  await page.getByRole('button', { name: 'Next explanation', exact: true }).click();
  await page.locator('.spatial-canvas canvas').evaluate((canvas) => (canvas as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());
  await expect(page.getByText('3D is unavailable on this device.', { exact: false })).toBeVisible();
  await expect(page.locator('[data-spatial-object="signal"]')).toHaveAttribute('data-position', /"x":0,/);
  await page.getByRole('button', { name: 'Retry 3D', exact: true }).click(); await rendered(page);
  await page.getByRole('button', { name: 'Next explanation', exact: true }).click();
  await expect(page.getByText('Explanation 3 of 3', { exact: true })).toBeVisible();
});

test('initial GPU denial falls back without losing access to objects or saving', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) { return kind === 'webgl2' ? null : original.call(this, kind as never, ...args as []) as never; } as typeof original;
  });
  await openSpatial(page);
  await expect(page.getByText('3D is unavailable on this device.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Input sensor', exact: true }).click();
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  const { active } = await (await page.request.get('/api/explore')).json();
  expect(active.state.selectedObjectId).toBe('sensor'); expect(active.saved).toBe(true);
});

test('keyboard and reduced-motion controls work at desktop, companion and phone widths', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await openSpatial(page); await rendered(page);
  await page.getByRole('button', { name: 'Processor', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Processor', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('slider', { name: 'Separate parts', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('slider', { name: 'Separate parts', exact: true })).toHaveValue('0.05');
  await page.getByRole('button', { name: 'Rotate right', exact: true }).focus(); await page.keyboard.press('Enter');
  for (const width of [1440, 620, 375]) {
    await page.setViewportSize({ width, height: width === 620 ? 704 : 900 });
    await expect(page.getByRole('region', { name: 'Spatial workspace' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const control of await page.locator('.spatial-workspace button, .spatial-workspace input').all()) {
      if (!(await control.isVisible())) continue;
      const target = (await control.boundingBox())!;
      expect(target.height).toBeGreaterThanOrEqual(44); expect(target.width).toBeGreaterThanOrEqual(44);
    }
    await page.locator('.spatial-workspace').screenshot({ path: `.local/pm096/spatial-${width}.png` });
  }
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  expect((await (await page.request.get('/api/explore')).json()).active.state.spatial.azimuth).toBe(55);
});


test('step transitions settle, handle interruption and honor reduced motion without idle animation', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { spatialDrawCalls: number }).spatialDrawCalls = 0;
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const) {
      const original = WebGL2RenderingContext.prototype[name];
      Object.defineProperty(WebGL2RenderingContext.prototype, name, { configurable: true, writable: true, value: function (this: WebGL2RenderingContext, ...args: unknown[]) {
        (window as unknown as { spatialDrawCalls: number }).spatialDrawCalls++;
        return Reflect.apply(original, this, args);
      } });
    }
  });
  await openSpatial(page); await rendered(page);
  const canvas = page.locator('.spatial-canvas canvas');
  // Observe the whole transition; software WebGL may finish before the click
  // round-trip returns, so sampling only its transient state is unreliable.
  await canvas.evaluate((element) => {
    const seen: string[] = [];
    (window as unknown as { spatialTransitions: string[] }).spatialTransitions = seen;
    new MutationObserver((records) => {
      for (const record of records) if (record.attributeName === 'data-transitioning') seen.push(record.oldValue ?? '');
      seen.push(element.getAttribute('data-transitioning') ?? '');
    }).observe(element, { attributes: true, attributeOldValue: true, attributeFilter: ['data-transitioning'] });
  });
  await page.getByRole('button', { name: 'Next explanation', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { spatialTransitions: string[] }).spatialTransitions)).toContain('true');
  await page.getByRole('button', { name: 'Next explanation', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-transitioning', 'false');
  await expect(page.getByText('Explanation 3 of 3', { exact: true })).toBeVisible();
  // Let the compositor present the final submitted WebGL frame.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const settled = await sharp(await canvas.screenshot()).raw().toBuffer();
  const draws = await page.evaluate(() => (window as unknown as { spatialDrawCalls: number }).spatialDrawCalls);
  expect(draws).toBeGreaterThan(0);
  await page.waitForTimeout(450);
  const next = await sharp(await canvas.screenshot()).raw().toBuffer();
  expect(await page.evaluate(() => (window as unknown as { spatialDrawCalls: number }).spatialDrawCalls)).toBe(draws);
  expect(next.length).toBe(settled.length);
  // Parallel software GPU runs can differ by a handful of edge-rounding channels.
  // Permit at most4/255 in <0.01% of channels; any ongoing draw work fails above.
  let changed = 0, largest = 0;
  for (let i = 0; i < next.length; i++) { const delta = Math.abs(next[i] - settled[i]); if (delta) changed++; largest = Math.max(largest, delta); }
  expect(largest).toBeLessThanOrEqual(4); expect(changed / next.length).toBeLessThan(.0001);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Previous explanation', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-transitioning', 'false');
  await page.getByRole('button', { name: '2D view', exact: true }).click();
  await expect(page.locator('[data-spatial-object="signal"]')).toHaveAttribute('data-position', /"x":0,/);
});
