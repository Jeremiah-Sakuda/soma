import { test, expect, type Locator, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });

// Independent local browser-workspace audit. Real application HTTP/storage,
// Three.js software WebGL and Anatomy SVG; no native Lift or model calls.
const evidence = '.local/overnight-review/three-d-browser';
async function guard(page: Page) {
  const forbidden: string[] = [], media: string[] = [], errors: string[] = [], warnings: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) warnings.push(message.text()); });
  await page.exposeFunction('__spatialAuditMedia', (name: string) => media.push(name));
  await page.addInitScript(() => {
    const refuse = (name: string) => {
      void (window as any).__spatialAuditMedia(name);
      throw new Error(`Silent spatial audit refused ${name}`);
    };
    HTMLMediaElement.prototype.play = function () { return Promise.reject(refuse('media')); };
    window.speechSynthesis.speak = () => refuse('speech');
    navigator.mediaDevices.getUserMedia = async () => refuse('microphone');
    for (const name of ['AudioContext', 'OfflineAudioContext'] as const) {
      const Context = window[name];
      if (Context) Object.defineProperty(window, name, {
        configurable: true,
        value: new Proxy(Context, { construct: () => refuse(name) }),
      });
    }
    (window as any).__spatialAuditDraws = 0;
    (window as any).__spatialAuditContexts = [];
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      const result = Reflect.apply(getContext, this, [kind, ...args]);
      if (kind === 'webgl2' && result && !(window as any).__spatialAuditContexts.includes(result))
        (window as any).__spatialAuditContexts.push(result);
      return result;
    } as typeof getContext;
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const) {
      const draw = WebGL2RenderingContext.prototype[name];
      Object.defineProperty(WebGL2RenderingContext.prototype, name, {
        configurable: true, writable: true,
        value: function (this: WebGL2RenderingContext, ...args: unknown[]) {
          (window as any).__spatialAuditDraws++;
          return Reflect.apply(draw, this, args);
        },
      });
    }
  });
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    const nonlocal = !['127.0.0.1', 'localhost'].includes(url.hostname);
    const generate = url.pathname === '/api/explore' && request.method() === 'POST' && request.postDataJSON().action === 'generate';
    if (nonlocal || generate || /speech|transcri|narrat|audio/i.test(url.pathname)) {
      forbidden.push(`${request.method()} ${url.origin}${url.pathname}`);
      return route.abort();
    }
    return route.continue();
  });
  const facts: Record<string, unknown> = {};
  return {
    facts,
    async finish(name: string) {
      const contexts = await page.evaluate(() => ({
        drawCalls: (window as any).__spatialAuditDraws,
        contextsCreated: (window as any).__spatialAuditContexts.length,
        contextsAlive: (window as any).__spatialAuditContexts.filter((context: WebGL2RenderingContext) => !context.isContextLost()).length,
      }));
      mkdirSync(evidence, { recursive: true });
      writeFileSync(`${evidence}/${name}.json`, JSON.stringify({
        context: 'Isolated localhost browser workspace; real renderers; no native/hosted/provider/audio acceptance.',
        forbidden, media, errors, warnings, contexts, facts,
      }, null, 2));
      expect(forbidden).toEqual([]);
      expect(media).toEqual([]);
      expect(errors).toEqual([]);
    },
  };
}
const canvas = (page: Page) => page.locator('.spatial-canvas canvas');
const anatomy = (page: Page) => page.locator('.anatomy-canvas');
const position = (page: Page, id: string) => anatomy(page).locator(`.anatomy-details[data-anatomy-object="${id}"]`);
async function rendered(page: Page) { await expect(canvas(page)).toHaveAttribute('data-rendered', 'true'); }
async function reveal(locator: Locator) {
  await locator.evaluate(element => {
    element.scrollIntoView({ block: 'start', behavior: 'instant' });
    window.scrollBy({ top: -70, behavior: 'instant' });
  });
}
async function capture(page: Page, name: string) {
  mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/${name}-viewport.png` });
  await page.locator('.spatial-workspace').screenshot({ path: `${evidence}/${name}-workspace.png` });
}
async function finishSteps(page: Page) {
  const next = page.getByRole('button', { name: 'Next step', exact: true });
  for (let index = 0; index < 12 && await next.isEnabled(); index++) await next.click();
  await expect(next).toBeDisabled();
}
async function saved(page: Page) {
  const save = page.getByRole('button', { name: 'Save exploration', exact: true });
  const [response] = await Promise.all([
    page.waitForResponse(response => {
      const request = response.request();
      return new URL(response.url()).pathname === '/api/explore' &&
        request.method() === 'PATCH' && request.postDataJSON().action === 'save';
    }),
    save.click(),
  ]);
  expect(response.ok()).toBe(true);
  await expect(save).toBeEnabled();
  await expect(page.getByRole('status').filter({ hasText: 'Saved this version' })).toBeVisible();
  return (await (await page.request.get('/api/explore')).json()).active;
}
async function drag(page: Page, target: Locator, dx: number, dy: number) {
  await reveal(target);
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width * .65, box.y + box.height * .55);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .65 + dx, box.y + box.height * .55 + dy, { steps: 8 });
  await page.mouse.up();
}
async function measurements(page: Page) {
  return page.locator('.spatial-workspace').evaluate(workspace => {
    const stage = workspace.querySelector('.spatial-stage')!, box = stage.getBoundingClientRect();
    const labels = [...workspace.querySelectorAll<HTMLElement>('.spatial-canvas-label')]
      .filter(label => getComputedStyle(label).display !== 'none')
      .map(label => { const r = label.getBoundingClientRect(); return { text: label.textContent, x: r.x - box.x, y: r.y - box.y, width: r.width, height: r.height, font: getComputedStyle(label).fontSize }; });
    const controls = [...workspace.querySelectorAll<HTMLElement>('button,input')]
      .filter(control => control.getClientRects().length)
      .map(control => { const r = control.getBoundingClientRect(); return { name: control.getAttribute('aria-label') ?? control.textContent?.trim(), width: r.width, height: r.height }; });
    return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, stage: { width: box.width, height: box.height }, labels, controls };
  });
}

test('real mechanism renderers support picking, orbit, steps, cutaway, responsive geometry and exact reopening', async ({ page }) => {
  const audit = await guard(page);
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Open the 3D example', exact: true }).click();
  await rendered(page);
  await expect(page.getByText('3D schematic · explanation only', { exact: true })).toBeVisible();
  const original = (await (await page.request.get('/api/explore')).json()).active;
  await page.getByRole('button', { name: 'Front', exact: true }).click();
  await reveal(canvas(page));
  const box = (await canvas(page).boundingBox())!;
  await canvas(page).click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.getByRole('button', { name: 'Processor', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const front = await canvas(page).screenshot();
  await drag(page, canvas(page), 60, 20);
  expect((await canvas(page).screenshot()).equals(front)).toBe(false);
  const orbited = await saved(page);
  // Browser pointer coordinates can quantize fractional CSS pixels. Check the
  // intended angle within 0.001 degree; saved/reopened state is checked exactly.
  expect(orbited.state.spatial.azimuth).toBeCloseTo(-24, 3);
  expect(orbited.state.spatial.elevation).toBeCloseTo(6, 3);
  audit.facts.threePointerOrbit = orbited.state.spatial;
  await canvas(page).evaluate(element => {
    (window as any).__spatialAuditTransitions = [];
    new MutationObserver(records => {
      for (const record of records) (window as any).__spatialAuditTransitions.push(record.oldValue, element.getAttribute('data-transitioning'));
    }).observe(element, { attributes: true, attributeOldValue: true, attributeFilter: ['data-transitioning'] });
  });
  await page.getByRole('button', { name: 'Next explanation', exact: true }).click();
  await page.getByRole('button', { name: 'Next explanation', exact: true }).click();
  await page.getByRole('button', { name: 'Previous explanation', exact: true }).click();
  await expect(canvas(page)).toHaveAttribute('data-transitioning', 'false');
  await expect.poll(() => page.evaluate(() => (window as any).__spatialAuditTransitions)).toContain('true');
  await page.getByRole('slider', { name: 'Separate parts', exact: true }).fill('0.6');
  await page.getByRole('slider', { name: 'Cutaway', exact: true }).fill('0.35');
  await reveal(canvas(page));
  await capture(page, 'mechanism-three-cutaway-1440');

  await page.getByRole('button', { name: 'Anatomy illustration', exact: true }).click();
  await expect(anatomy(page)).toHaveAttribute('data-object-count', '5');
  await expect(position(page, 'signal')).toHaveAttribute('data-position', /"x":0,/);
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await page.getByRole('button', { name: 'Anatomy illustration', exact: true }).click();
  await page.getByRole('button', { name: 'Clear selected object', exact: true }).click();
  await reveal(anatomy(page));
  const target = await anatomy(page).locator('g[data-anatomy-object="processor"] .anatomy-fill').evaluateAll(paths => {
    for (const path of paths) {
      const r = path.getBoundingClientRect();
      for (const dx of [.5, .25, .75]) for (const dy of [.5, .25, .75]) {
        const x = r.x + r.width * dx, y = r.y + r.height * dy;
        if (document.elementFromPoint(x, y)?.closest('[data-anatomy-object]')?.getAttribute('data-anatomy-object') === 'processor') return { x, y };
      }
    }
    throw new Error('No exposed Processor pointer target');
  });
  await page.mouse.click(target.x, target.y);
  await expect(page.getByRole('button', { name: 'Processor', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await drag(page, anatomy(page).locator('svg'), 50, 20);
  const anatomyOrbit = await saved(page);
  expect(anatomyOrbit.state.spatial.renderer).toBe('anatomy');
  expect(anatomyOrbit.state.spatial.azimuth).toBeCloseTo(15, 3);
  expect(anatomyOrbit.state.spatial.elevation).toBeCloseTo(31, 3);
  audit.facts.anatomyPointerOrbit = anatomyOrbit.state.spatial;
  const closed = await anatomy(page).screenshot();
  await page.getByRole('slider', { name: 'Cutaway', exact: true }).fill('0.4');
  expect((await anatomy(page).screenshot()).equals(closed)).toBe(false);
  await page.getByRole('button', { name: 'Side by side', exact: true }).click();
  await rendered(page);
  await expect(anatomy(page)).toHaveAttribute('data-rendered', 'true');
  const responsive = [];
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 620, height: 704 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    await reveal(page.locator('.spatial-comparison'));
    const measured = await measurements(page);
    expect(measured.scrollWidth).toBeLessThanOrEqual(viewport.width);
    for (const control of measured.controls) { expect(control.width).toBeGreaterThanOrEqual(44); expect(control.height).toBeGreaterThanOrEqual(44); }
    expect(await anatomy(page).locator('path').evaluateAll(paths => paths.every(path => !/NaN|Infinity|undefined/.test(path.getAttribute('d') ?? '')))).toBe(true);
    responsive.push(measured);
    await capture(page, `mechanism-comparison-${viewport.width}`);
  }
  audit.facts.responsive = responsive;
  await page.getByRole('button', { name: 'Anatomy illustration', exact: true }).click();
  await page.getByRole('button', { name: 'Isolate selected', exact: true }).click();
  await expect(anatomy(page)).toHaveAttribute('data-object-count', '1');
  await page.getByRole('button', { name: 'Show all parts', exact: true }).click();
  const current = await saved(page);
  expect(current.spec).toEqual(original.spec);
  expect(current.source).toEqual(original.source);
  const gpuBeforeReload = await page.evaluate(() => ({
    drawCalls: (window as any).__spatialAuditDraws,
    contextsCreated: (window as any).__spatialAuditContexts.length,
  }));
  expect(gpuBeforeReload.drawCalls).toBeGreaterThan(0);
  audit.facts.gpuBeforeReload = gpuBeforeReload;
  await page.reload();
  await page.locator('.exploration-library button').first().click();
  await expect(anatomy(page)).toHaveAttribute('data-rendered', 'true');
  await expect(page.getByRole('slider', { name: 'Cutaway', exact: true })).toHaveValue('0.4');
  const restored = (await (await page.request.get('/api/explore')).json()).active;
  expect(restored.state).toEqual(current.state);
  audit.facts.savedView = current.state;
  await audit.finish('mechanism');
});

test('recorded graph renderers retain checked heights, routes, cut edges and current headings', async ({ page }) => {
  const audit = await guard(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Watch a recorded Muse run', exact: true }).click();
  await page.getByRole('button', { name: '3D workspace', exact: true }).click();
  await rendered(page);
  await finishSteps(page);
  await reveal(canvas(page));
  await capture(page, 'graph-three-final-1440');
  await page.getByRole('button', { name: 'Anatomy illustration', exact: true }).click();
  await expect(anatomy(page)).toHaveAttribute('data-object-count', '6');
  const originalF = JSON.parse((await position(page, 'F').getAttribute('data-position'))!);
  expect(originalF.y).toBeCloseTo(21 / 11, 10);
  const probe = page.getByRole('region', { name: 'Checked cost experiment', exact: true });
  await probe.getByRole('button', { name: 'Try the tie at 5', exact: true }).click();
  await probe.getByRole('slider').focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(probe.getByRole('status')).toContainText('Dijkstra route cost: 9');
  await expect(page.locator('.spatial-heading')).toContainText('Current graph: start A, goal F');
  await expect.poll(async () => JSON.parse((await position(page, 'F').getAttribute('data-position'))!).y).toBeCloseTo(27 / 11, 10);
  await expect(anatomy(page).locator('[data-anatomy-edge="e_CE"]')).toHaveAttribute('data-highlighted', 'true');
  await page.getByText('Change a connection', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'D — F', exact: true }).uncheck();
  await finishSteps(page);
  await expect(anatomy(page).locator('[data-anatomy-edge="e_DF"]')).toHaveAttribute('data-active', 'false');
  await page.setViewportSize({ width: 620, height: 704 });
  await reveal(anatomy(page));
  audit.facts.companion = await measurements(page);
  await capture(page, 'graph-anatomy-changed-620');
  await page.getByRole('button', { name: '2D view', exact: true }).click();
  await expect(page.locator('.spatial-workspace')).toHaveCount(0);
  await expect(page.locator('figure.source-overlay figcaption')).toContainText('A → C → E → F');
  await page.getByRole('button', { name: '3D workspace', exact: true }).click();
  await expect(anatomy(page)).toHaveAttribute('data-rendered', 'true');
  const active = await saved(page);
  expect(active.state.edgeWeights.e_DF).toBe(6);
  expect(active.state.disabledEdgeIds).toContain('e_DF');
  expect(active.state.spatial).toMatchObject({ mode: '3d', renderer: 'anatomy' });
  audit.facts.originalF = originalF;
  audit.facts.changedF = JSON.parse((await position(page, 'F').getAttribute('data-position'))!);
  audit.facts.savedState = active.state;
  await audit.finish('graph');
});

test('recorded circuit 3D and Anatomy show voltage steps, balanced level and current reversal at both widths', async ({ page }) => {
  const audit = await guard(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Watch a recorded Muse run', exact: true }).click();
  await page.getByRole('button', { name: 'Recorded circuit', exact: true }).click();
  await page.getByRole('button', { name: 'Voltage as height', exact: true }).click();
  await rendered(page);
  await expect(page.getByText('Checked circuit · spatial view', { exact: true })).toBeVisible();
  await reveal(canvas(page));
  await capture(page, 'circuit-three-first-step-1440');
  await finishSteps(page);
  await page.getByRole('button', { name: 'Anatomy illustration', exact: true }).click();
  await expect(anatomy(page)).toHaveAttribute('data-object-count', '4');
  await expect(anatomy(page).locator('.anatomy-plate-head')).toContainText('CHECKED STATE');
  for (const id of ['B', 'C']) expect(JSON.parse((await position(page, id).getAttribute('data-position'))!).y).toBe(2);
  await expect(page.getByRole('slider', { name: 'Cutaway', exact: true })).toBeDisabled();
  const probe = page.getByRole('region', { name: 'Checked circuit experiment', exact: true });
  await probe.getByRole('slider').focus();
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(probe.getByRole('status')).toContainText('from B to C');
  let b = JSON.parse((await position(page, 'B').getAttribute('data-position'))!).y;
  let c = JSON.parse((await position(page, 'C').getAttribute('data-position'))!).y;
  expect(b).toBeGreaterThan(c);
  audit.facts.below = { b, c };
  await probe.getByRole('button', { name: 'Try the tipping point at 8 Ω', exact: true }).click();
  await probe.getByRole('slider').focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(probe.getByRole('status')).toContainText('from C to B');
  b = JSON.parse((await position(page, 'B').getAttribute('data-position'))!).y;
  c = JSON.parse((await position(page, 'C').getAttribute('data-position'))!).y;
  expect(c).toBeGreaterThan(b);
  audit.facts.above = { b, c };
  await page.getByRole('button', { name: 'Side by side', exact: true }).click();
  await rendered(page);
  const responsive = [];
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 620, height: 704 }]) {
    await page.setViewportSize(viewport);
    await reveal(page.locator('.spatial-comparison'));
    const measured = await measurements(page);
    expect(measured.scrollWidth).toBeLessThanOrEqual(viewport.width);
    responsive.push(measured);
    await capture(page, `circuit-comparison-reversed-${viewport.width}`);
  }
  audit.facts.responsive = responsive;
  await page.getByRole('button', { name: '2D view', exact: true }).click();
  await expect(page.locator('figure.source-overlay figcaption')).toContainText('from C to B');
  await page.getByRole('button', { name: 'Voltage as height', exact: true }).click();
  await expect(anatomy(page)).toHaveAttribute('data-rendered', 'true');
  await audit.finish('circuit');
});

test('actual WebGL context loss, retry and repeated 2D switches retain step state and release old contexts', async ({ page }) => {
  const audit = await guard(page);
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Open the 3D example', exact: true }).click();
  await rendered(page);
  await page.getByRole('button', { name: 'Next explanation', exact: true }).click();
  await expect(canvas(page)).toHaveAttribute('data-transitioning', 'false');
  await canvas(page).evaluate(element => (element as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());
  await expect(page.getByText('3D is unavailable on this device.', { exact: false })).toBeVisible();
  await expect(page.locator('[data-spatial-object="signal"]')).toHaveAttribute('data-position', /"x":0,/);
  await reveal(page.locator('.spatial-stage'));
  await capture(page, 'context-loss-fallback');
  await page.getByRole('button', { name: 'Retry 3D', exact: true }).click();
  await rendered(page);
  for (let index = 0; index < 3; index++) {
    await page.getByRole('button', { name: '2D view', exact: true }).click();
    await expect(canvas(page)).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (window as any).__spatialAuditContexts.filter((context: WebGL2RenderingContext) => !context.isContextLost()).length)).toBe(0);
    await page.getByRole('button', { name: '3D workspace', exact: true }).click();
    await rendered(page);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Previous explanation', exact: true }).click();
  await expect(canvas(page)).toHaveAttribute('data-transitioning', 'false');
  const alive = await page.evaluate(() => (window as any).__spatialAuditContexts.filter((context: WebGL2RenderingContext) => !context.isContextLost()).length);
  expect(alive).toBe(1);
  audit.facts.aliveAfterThreeSwitchesAndRetry = alive;
  await audit.finish('fallback');
});
