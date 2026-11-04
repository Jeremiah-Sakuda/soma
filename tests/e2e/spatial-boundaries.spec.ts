import { openMoreExamples } from './example-navigation';
import { test, expect } from '@playwright/test';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });

test('spatial HTTP state rejects cross-session reads/writes, forged IDs and hostile origins atomically', async ({ page, browser, baseURL }) => {
  await page.goto('/explore');
  await openMoreExamples(page);
  await page.getByRole('button', { name: 'Open the 3D example', exact: true }).click();
  await expect(page.locator('.spatial-canvas canvas')).toHaveAttribute('data-rendered', 'true');
  const { active } = await (await page.request.get('/api/explore')).json();
  const payload = { action: 'save', artifactId: active.id, version: 1, state: { ...active.state, selectedObjectId: 'processor', spatial: { ...active.state.spatial, spread: 0.7 } } };
  const headers = { Origin: baseURL! };
  expect((await page.request.patch('/api/explore', { data: payload, headers })).status()).toBe(200);
  const other = await browser.newContext({ baseURL });
  try {
    await other.request.get('/api/explore');
    expect((await other.request.get(`/api/explore?artifactId=${active.id}&version=1`)).status()).toBe(404);
    expect((await other.request.patch('/api/explore', { data: payload, headers })).status()).toBe(404);
    // Delete is intentionally idempotent inside the caller's session. The owner
    // must still be able to read the unchanged artifact after this no-op.
    expect((await other.request.delete('/api/explore', { data: { artifactId: active.id }, headers })).status()).toBe(200);
    expect((await page.request.patch('/api/explore', { data: payload, headers: { Origin: 'https://untrusted.invalid' } })).status()).toBe(403);
    for (const state of [
      { ...payload.state, selectedObjectId: 'outside' },
      { ...payload.state, spatial: { ...payload.state.spatial, azimuth: 1000 } },
      { ...payload.state, spatial: { ...payload.state.spatial, remoteMesh: 'https://untrusted.invalid/mesh' } },
    ]) expect((await page.request.patch('/api/explore', { data: { ...payload, state }, headers })).status()).toBe(400);
    const saved = await (await page.request.get(`/api/explore?artifactId=${active.id}&version=1`)).json();
    expect(saved.active.state).toEqual(payload.state);
    expect((await (await other.request.get('/api/explore')).json()).artifacts).toEqual([]);
  } finally { await other.close(); }
});

test('repeated 2D/3D transitions release every previous WebGL context without accumulating canvases', async ({ page }) => {
  await page.addInitScript(() => {
    const contexts: WebGL2RenderingContext[] = [];
    (window as unknown as { spatialContexts: WebGL2RenderingContext[] }).spatialContexts = contexts;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      const result = original.call(this, kind as never, ...args as []);
      if (kind === 'webgl2' && result && !contexts.includes(result as WebGL2RenderingContext)) contexts.push(result as WebGL2RenderingContext);
      return result;
    } as typeof original;
  });
  await page.goto('/explore'); await openMoreExamples(page);
  await page.getByRole('button', { name: 'Compare weighted paths', exact: true }).click();
  const count = () => page.evaluate(() => (window as unknown as { spatialContexts: WebGL2RenderingContext[] }).spatialContexts.filter((c) => !c.isContextLost()).length);
  expect(await count()).toBe(0);
  for (let cycle = 0; cycle < 6; cycle++) {
    await page.getByRole('button', { name: '3D workspace', exact: true }).click();
    await expect(page.locator('.spatial-canvas canvas')).toHaveAttribute('data-rendered', 'true');
    expect(await count()).toBe(1);
    await page.getByRole('button', { name: '2D view', exact: true }).click();
    await expect(page.locator('.spatial-canvas canvas')).toHaveCount(0);
    await expect.poll(count).toBe(0);
  }
  await expect(page.getByRole('button', { name: /^Dijkstra · 3/ })).toBeVisible();
});

test('a click-sized pointer wobble leaves both the displayed camera and saved view unchanged', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/explore'); await openMoreExamples(page);
  await page.getByRole('button', { name: 'Open the 3D example', exact: true }).click();
  const canvas = page.locator('.spatial-canvas canvas');
  await expect(canvas).toHaveAttribute('data-rendered', 'true'); await canvas.scrollIntoViewIfNeeded();
  const before = await canvas.screenshot();
  const rect = (await canvas.boundingBox())!;
  await page.mouse.move(rect.x + 40, rect.y + 40); await page.mouse.down();
  await page.mouse.move(rect.x + 42, rect.y + 41); await page.mouse.up();
  expect((await canvas.screenshot()).equals(before)).toBe(true);
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  await expect(page.getByText('Saved this version and your exact experiment state.', { exact: true })).toBeVisible();
  expect((await (await page.request.get('/api/explore')).json()).active.state.spatial).toMatchObject({ azimuth: 35, elevation: 25 });
});
