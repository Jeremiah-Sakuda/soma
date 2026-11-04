import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// The real sandboxed overlay document and bundled renderer, with synthetic checked
// models. This exercises graphics and the renderer's IPC boundary, not macOS capture,
// window placement or permissions. No hosted service, model call or media is used.
const fixture = JSON.parse(readFileSync(resolve('desktop/test/fixtures/hero-lift.json'), 'utf8'));
const final = fixture.models.at(-1);
const overlay = pathToFileURL(resolve('desktop/point-overlay.html')).href;
test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } });
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const found: string[] = [];
  errors.set(page, found);
  page.on('pageerror', (error) => found.push(error.message));
});
test.afterEach(({ page }) => { expect(errors.get(page)).toEqual([]); });

async function open(page: Page, reduced = true) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.route('**/*', (route) => {
    const protocol = new URL(route.request().url()).protocol;
    if (['file:', 'data:', 'about:'].includes(protocol)) return route.continue();
    throw new Error(`Native lift fixture attempted an external request: ${route.request().url()}`);
  });
  await page.addInitScript(() => {
    const w = window as any;
    w.__virtual = 0;
    w.__liftNow = () => w.__virtual;
    w.__failed = [];
    w.__media = [];
    HTMLMediaElement.prototype.play = function () { w.__media.push('play'); return Promise.reject(Error('Silent graphics test')); };
    window.speechSynthesis.speak = () => { w.__media.push('speech'); throw Error('Silent graphics test'); };
    navigator.mediaDevices.getUserMedia = async () => { w.__media.push('microphone'); throw Error('Silent graphics test'); };
    for (const name of ['AudioContext', 'OfflineAudioContext']) {
      if (w[name]) w[name] = new Proxy(w[name], { construct() { w.__media.push(name); throw Error('Silent graphics test'); } });
    }
    w.somaPointOverlay = {
      onDraw: (callback: unknown) => { w.__draw = callback; },
      hover() {}, toggleEdge() {}, liftFailed: (reason: string) => w.__failed.push(reason),
    };
    w.__advance = async (ms: number) => {
      for (let elapsed = 0; elapsed < ms;) {
        const delta = Math.min(50, ms - elapsed);
        elapsed += delta; w.__virtual += delta;
        await new Promise(requestAnimationFrame);
      }
      await new Promise(requestAnimationFrame);
    };
  });
  await page.goto(overlay);
}

async function draw(page: Page, model = final, view = '3d', options: Record<string, unknown> = {}) {
  await page.evaluate(({ model, view, options }) => (window as any).__draw({
    type: 'graph', model, view,
    display: { x: window.screenX, y: window.screenY, width: 1600, height: 900 },
    ...options,
  }), { model, view, options });
}
async function advance(page: Page, ms = 100) { await page.evaluate((ms) => (window as any).__advance(ms), ms); }
async function clean(page: Page) {
  expect(await page.evaluate(() => (window as any).__media)).toEqual([]);
  await page.evaluate(() => (window as any).__draw({ type: 'graph-clear' }));
  await expect(page.locator('#lift-canvas, #lift-labels, #lift-caption')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).SomaLift.active)).toBe(false);
}

test('native lift follows checked search steps, cuts and reset without inventing a route', async ({ page }) => {
  await open(page);
  await draw(page, fixture.models[1]); await advance(page);
  await expect(page.locator('#lift-labels')).toContainText('F ≤ 11');
  for (const model of fixture.models.slice(2)) { await draw(page, model); await advance(page); }
  await expect(page.locator('#lift-labels')).toContainText('F = 7');
  await expect(page.locator('#lift-labels')).toContainText('11 · slack 4');
  const geometry = await page.evaluate(() => {
    const s = (window as any).SomaLift.debug;
    return {
      heights: [...s.nodes.values()].map((n: any) => ({ id: n.data.id, distance: n.data.distance, z: n.sphere.position.z })),
      base: s.layout.base, scale: s.layout.scale,
      directed: [...s.edges.values()].filter((e: any) => e.meshes.length > 1 && e.shape !== 'cut').length,
    };
  });
  for (const n of geometry.heights) expect(n.z).toBeCloseTo(geometry.base + n.distance * geometry.scale, 7);
  expect(geometry.directed).toBe(0);
  await draw(page, fixture.cut); await advance(page);
  await expect(page.locator('#lift-labels')).toContainText('F = 9');
  await expect(page.locator('#lift-labels')).toContainText('D–F removed');
  await draw(page, fixture.models[0]); await advance(page);
  const reset = await page.evaluate(() => [...(window as any).SomaLift.debug.nodes.values()]
    .filter((n: any) => n.data.id !== 'A').map((n: any) => ({ distance: n.data.distance, visible: n.sphere.visible })));
  expect(reset.every((n: any) => n.distance === null && !n.visible)).toBe(true);
  expect(await page.evaluate(() => (window as any).__failed)).toEqual([]);
  await clean(page);
});

test('a repositioned graph keeps its 3D strings attached to the current node centres', async ({ page }) => {
  await open(page); await draw(page); await advance(page);
  const shifted = structuredClone(final);
  for (const node of shifted.nodes) node.x += 0.04;
  for (const edge of shifted.edges) for (const key of ['from', 'to', 'center', 'control']) edge[key].x += 0.04;
  await draw(page, shifted); await advance(page);
  const joins = await page.evaluate(() => {
    const s = (window as any).SomaLift.debug;
    return s.layout.edges.filter((e: any) => e.kind === 'taut').map((e: any) => {
      const pos = s.edges.get(e.id).meshes[0].geometry.attributes.position;
      const centre = { x: 0, y: 0, z: 0 };
      // First ring of a real TubeGeometry: average its ten unique radial vertices.
      for (let i = 0; i < 10; i++) { centre.x += pos.getX(i) / 10; centre.y += pos.getY(i) / 10; centre.z += pos.getZ(i) / 10; }
      const node = s.nodes.get(e.from).sphere.position;
      return { edge: e.id, error: Math.hypot(centre.x - node.x, centre.y - node.y, centre.z - node.z) };
    });
  });
  for (const join of joins) expect(join.error, join.edge).toBeLessThan(0.001);
  await clean(page);
});

test('display rescaling updates real node meshes and sheet coordinates together', async ({ page }) => {
  await open(page); await draw(page); await advance(page);
  await draw(page, final, '3d', { display: { x: await page.evaluate(() => window.screenX + 17), y: await page.evaluate(() => window.screenY + 23), width: 1200, height: 900 } });
  await advance(page);
  const shapes = await page.evaluate(() => {
    const s = (window as any).SomaLift.debug;
    return { radius: s.layout.radius, frame: s.frame, spheres: [...s.nodes.values()].map((n: any) => n.sphere.geometry.parameters.radius) };
  });
  expect(shapes.frame).toMatchObject({ dx: 17, dy: 23, width: 1200, height: 900 });
  for (const radius of shapes.spheres) expect(radius).toBeCloseTo(shapes.radius * 0.78, 7);
  await expect(page.locator('#lift-canvas')).toHaveCSS('left', '17px');
  await expect(page.locator('#lift-canvas')).toHaveCSS('top', '23px');
  await clean(page);
});

test('sheet identity includes the capture region and the full image', async ({ page }) => {
  await open(page);
  const image = (fill: string) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${fill}"/>${' '.repeat(120)}</svg>`).toString('base64')}`;
  const first = image('#ff0000'), second = image('#0000ff');
  expect(first.length).toBe(second.length); expect(first.slice(-48)).toBe(second.slice(-48));
  const region = { x: 0.05, y: 0.2, width: 0.55, height: 0.55 };
  await draw(page, final, '3d', { sheet: { dataUrl: first, region } }); await advance(page);
  await expect.poll(() => page.evaluate(() => (window as any).SomaLift.debug.sheetReady)).toBe(true);
  await draw(page, final, '3d', { sheet: { dataUrl: first, region: { ...region, x: 0.15 } } }); await advance(page);
  const x = await page.evaluate(() => (window as any).SomaLift.debug.sheet.paper.position.x);
  expect(x).toBeCloseTo((0.15 + 0.55 / 2) * 1600 - 800, 7);
  await draw(page, final, '3d', { sheet: { dataUrl: second, region } }); await advance(page);
  await expect.poll(() => page.evaluate(() => (window as any).SomaLift.debug.sheet.paper.material.map?.image.src)).toBe(second);
  await clean(page);
});

test('reduced motion immediately settles a changed height without a moving ghost', async ({ page }) => {
  await open(page); await draw(page); await advance(page);
  await draw(page, fixture.cut); await advance(page);
  await expect(page.locator('#lift-labels')).toContainText('F = 9');
  await expect(page.locator('#lift-labels')).not.toContainText('→');
  const changing = await page.evaluate(() => [...(window as any).SomaLift.debug.nodes.values()]
    .some((n: any) => n.change || n.ghost.material.opacity || n.trail.material.opacity));
  expect(changing).toBe(false);
  await clean(page);
});

test('microcosts retain nonzero proportional heights and a readable bounded ruler', async ({ page }) => {
  await open(page);
  const model = structuredClone(final);
  const factor = 1e-8;
  for (const node of model.nodes) if (node.distance !== null) node.distance *= factor;
  for (const edge of model.edges) edge.weight *= factor;
  model.lift.maxDistance *= factor;
  model.caption = null;
  await draw(page, model); await advance(page);
  const result = await page.evaluate(() => {
    const s = (window as any).SomaLift.debug;
    return {
      ticks: s.ticks.map((t: any) => ({ value: t.value, label: t.label.textContent })),
      max: s.layout.maxDistance,
      a: s.nodes.get('A').sphere.position.z,
      f: s.nodes.get('F').sphere.position.z,
      scale: s.layout.scale,
      fLabel: s.nodes.get('F').label.textContent,
    };
  });
  expect(result.f - result.a).toBeCloseTo(7e-8 * result.scale, 6);
  expect(result.f - result.a).toBeGreaterThan(100);
  expect(result.ticks.length).toBeGreaterThan(5);
  expect(result.ticks.length).toBeLessThanOrEqual(13);
  for (const tick of result.ticks.slice(1)) {
    expect(tick.value).toBeGreaterThan(0);
    expect(tick.value).toBeLessThanOrEqual(result.max);
    expect(Number(tick.label)).toBeGreaterThan(0);
  }
  expect(Number(result.fLabel.split(' = ')[1])).toBeCloseTo(7e-8, 14);
  await clean(page);
});

test('repeated and interrupted lifts release their canvases and recover from GPU loss', async ({ page }) => {
  // Keep every real RAF in both interruption cycles. Software WebGL in clean
  // Linux CI takes longer than the default 30 seconds for this whole sequence.
  test.setTimeout(90_000);
  await open(page, false);
  for (let i = 0; i < 2; i++) {
    await draw(page); await advance(page, 900);
    await draw(page, final, '2d'); await advance(page, 250);
    await draw(page); await advance(page, 2700);
    await expect(page.locator('#lift-canvas')).toHaveCount(1);
    await expect(page.locator('body')).toHaveClass('lifted');
    await draw(page, final, '2d'); await advance(page, 1100);
    await expect(page.locator('#lift-canvas, #lift-labels')).toHaveCount(0);
    await expect(page.locator('#graph-layer')).toHaveCount(1);
  }
  await draw(page); await advance(page, 2700);
  await page.evaluate(() => (window as any).SomaLift.debug.renderer.getContext().getExtension('WEBGL_lose_context').loseContext());
  await expect.poll(() => page.evaluate(() => (window as any).__failed)).toEqual(['webgl']);
  await expect(page.locator('body')).not.toHaveClass('lifted');
  await expect(page.locator('#graph-layer')).toHaveCount(1);
  await clean(page);
});

test('switching from a lifted graph to pointing removes the stale 3D scene', async ({ page }) => {
  await open(page); await draw(page); await advance(page);
  await page.evaluate(() => (window as any).__draw({ type: 'focus', text: 'Selected new context', region: { x: 0.6, y: 0.2, width: 0.1, height: 0.1 } }));
  await expect(page.locator('#lift-canvas, #lift-labels, #lift-caption')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass('lifted');
  await expect(page.locator('#hint')).toHaveText('Selected new context');
  await clean(page);
});
