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
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  },
});
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const found: string[] = [];
  errors.set(page, found);
  page.on('pageerror', (error) => found.push(error.message));
});
test.afterEach(({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

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
    w.__hovers = [];
    w.__toggles = [];
    w.__selections = [];
    HTMLMediaElement.prototype.play = function () {
      w.__media.push('play');
      return Promise.reject(Error('Silent graphics test'));
    };
    window.speechSynthesis.speak = () => {
      w.__media.push('speech');
      throw Error('Silent graphics test');
    };
    navigator.mediaDevices.getUserMedia = async () => {
      w.__media.push('microphone');
      throw Error('Silent graphics test');
    };
    for (const name of ['AudioContext', 'OfflineAudioContext']) {
      if (w[name])
        w[name] = new Proxy(w[name], {
          construct() {
            w.__media.push(name);
            throw Error('Silent graphics test');
          },
        });
    }
    w.somaPointOverlay = {
      onDraw: (callback: unknown) => {
        w.__draw = callback;
      },
      hover: (active: boolean) => w.__hovers.push(active),
      toggleEdge: (id: string) => w.__toggles.push(id),
      select: (id: string) => w.__selections.push(id),
      liftFailed: (reason: string) => w.__failed.push(reason),
    };
    w.__advance = async (ms: number) => {
      for (let elapsed = 0; elapsed < ms;) {
        const delta = Math.min(50, ms - elapsed);
        elapsed += delta;
        w.__virtual += delta;
        await new Promise(requestAnimationFrame);
      }
      await new Promise(requestAnimationFrame);
    };
  });
  await page.goto(overlay);
}

async function draw(page: Page, model = final, view = '3d', options: Record<string, unknown> = {}) {
  await page.evaluate(
    ({ model, view, options }) =>
      (window as any).__draw({
        type: 'graph',
        captureId: 'synthetic-capture',
        model,
        view,
        display: { x: window.screenX, y: window.screenY, width: 1600, height: 900 },
        ...options,
      }),
    { model, view, options },
  );
}
async function advance(page: Page, ms = 100) {
  await page.evaluate((ms) => (window as any).__advance(ms), ms);
}
async function clean(page: Page) {
  expect(await page.evaluate(() => (window as any).__media)).toEqual([]);
  await page.evaluate(() => (window as any).__draw({ type: 'graph-clear' }));
  await expect(page.locator('#lift-canvas, #lift-labels, #lift-caption')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).SomaLift.active)).toBe(false);
}

// Locate a point on the real rendered tube, not the old flat SVG hit path. Using a
// mesh's projected surface also exercises the display offset and current rotation.
async function edgePoint(page: Page, id = 'DF') {
  return page.evaluate((id) => {
    const lift = (window as any).SomaLift;
    const s = lift.debug;
    s.scene.updateMatrixWorld(true);
    const edge = s.edges.get(id);
    for (const mesh of edge.meshes) {
      const position = mesh.geometry.attributes.position;
      for (const fraction of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        const i = Math.min(position.count - 1, Math.floor(position.count * fraction));
        const p = mesh.position.clone().set(position.getX(i), position.getY(i), position.getZ(i));
        mesh.localToWorld(p);
        p.project(s.camera);
        const x = ((p.x + 1) * s.frame.width) / 2 + s.frame.dx;
        const y = ((1 - p.y) * s.frame.height) / 2 + s.frame.dy;
        if (
          x >= 0 &&
          x < innerWidth &&
          y >= 0 &&
          y < innerHeight &&
          lift.hit(x, y) === `edge:${id}`
        )
          return { x, y };
      }
    }
    throw Error(`No visible pickable point on rendered edge ${id}`);
  }, id);
}

async function orientation(page: Page) {
  return page.evaluate(() => {
    const s = (window as any).SomaLift.debug;
    return [
      s.hinge.rotation.x,
      s.hinge.rotation.y,
      s.hinge.rotation.z,
      s.yaw.rotation.x,
      s.yaw.rotation.y,
      s.yaw.rotation.z,
    ];
  });
}

async function checkedGeometry(page: Page) {
  return page.evaluate(() => {
    const s = (window as any).SomaLift.debug;
    return {
      model: JSON.stringify(s.model),
      nodes: [...s.nodes.values()].map((node: any) => ({
        id: node.data.id,
        distance: node.data.distance,
        height: node.sphere.position.z,
        position: node.sphere.position.toArray(),
      })),
      edges: [...s.edges.entries()].map(([id, edge]: any) => ({
        id,
        meshes: edge.meshes.map((mesh: any) => Array.from(mesh.geometry.attributes.position.array)),
      })),
    };
  });
}

test('double-clicking a model part restores its lifted view after dragging', async ({ page }) => {
  await open(page);
  const model = {
    ...final,
    lift: undefined,
    nodes: [],
    edges: [],
    tags: [],
    weights: [],
    caption: null,
    scene: {
      kind: 'model',
      title: 'Original synthetic block',
      note: 'Pointer reset fixture.',
      region: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
      connections: [],
      objects: [
        {
          id: 'synthetic-block',
          label: 'Block',
          detail: 'Original synthetic part',
          shape: 'box',
          color: 'blue',
          renderStyle: null,
          position: { x: 0, y: 1, z: 0 },
          size: { x: 2, y: 2, z: 2 },
          parentId: null,
          visible: true,
          highlighted: false,
        },
      ],
    },
  };
  await draw(page, model);
  await advance(page);
  expect(await page.evaluate(() => (window as any).__failed)).toEqual([]);
  const view = () =>
    page.evaluate(() => {
      const s = (window as any).SomaModel.debug;
      return {
        turn: s.turn,
        tip: s.tip,
        rotation: [s.hinge.rotation.x, s.hinge.rotation.z, s.table.rotation.z],
        data: JSON.stringify(s.data),
      };
    });
  const point = () =>
    page.evaluate(() => {
      const renderer = (window as any).SomaModel;
      renderer.debug.scene.updateMatrixWorld(true);
      for (let y = 80; y < innerHeight - 80; y += 20)
        for (let x = 80; x < innerWidth - 80; x += 20)
          if (renderer.hit(x, y) === 'synthetic-block') return { x, y };
      throw Error('No pickable surface on the real synthetic model');
    });
  const initial = await view();
  let at = await point();
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 65, at.y + 25, { steps: 8 });
  await page.mouse.up();
  await advance(page);
  const turned = await view();
  expect(Math.abs(turned.turn)).toBeGreaterThan(0.1);
  expect(turned.rotation).not.toEqual(initial.rotation);
  // Empty desktop space must not reset the model.
  expect(await page.evaluate(() => (window as any).SomaModel.hit(2, 2))).toBeNull();
  await page.mouse.dblclick(2, 2);
  await advance(page);
  expect(await view()).toEqual(turned);
  at = await point();
  await page.mouse.dblclick(at.x, at.y);
  await advance(page);
  expect(await view()).toEqual(initial);
  expect(await page.evaluate(() => (window as any).__selections)).toEqual(['synthetic-block']);
  expect(await page.evaluate(() => (window as any).__toggles)).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('model-double-click-reset.png') });
  await clean(page);
  expect(await page.evaluate(() => (window as any).SomaModel.active)).toBe(false);
});

test('double-clicking a lifted graph edge toggles once and preserves its rotated view', async ({
  page,
}) => {
  await open(page);
  await draw(page);
  await advance(page);
  let at = await edgePoint(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 55, at.y + 20, { steps: 8 });
  await page.mouse.up();
  await advance(page);
  const turned = await orientation(page),
    geometry = await checkedGeometry(page);
  at = await edgePoint(page);
  await page.mouse.dblclick(at.x, at.y);
  await advance(page);
  expect(await page.evaluate(() => (window as any).__toggles)).toEqual(['DF']);
  expect(await page.evaluate(() => (window as any).__selections)).toEqual([]);
  expect(await orientation(page)).toEqual(turned);
  expect(await checkedGeometry(page)).toEqual(geometry);
  await clean(page);
});

test('clicking a lifted string cuts and restores the checked route without landing', async ({
  page,
}) => {
  await open(page);
  await draw(page);
  await advance(page);
  const before = await orientation(page);
  let at = await edgePoint(page);
  await page.mouse.move(at.x, at.y);
  expect(await page.evaluate(() => (window as any).__hovers.at(-1))).toBe(true);
  await page.mouse.click(at.x, at.y);
  expect(await page.evaluate(() => (window as any).__toggles)).toEqual(['DF']);
  // The renderer asks the application to recompute. It cannot invent a cut/result.
  await expect(page.locator('#lift-labels')).toContainText('F = 7');
  await draw(page, fixture.cut);
  await advance(page);
  await expect(page.locator('#lift-labels')).toContainText('F = 9');
  await expect(page.locator('#lift-labels')).toContainText('D–F removed');
  expect(await orientation(page)).toEqual(before);
  expect(await page.evaluate(() => (window as any).SomaLift.active)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('lift-click-cut-cost-nine.png') });
  at = await edgePoint(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.click(at.x, at.y);
  expect(await page.evaluate(() => (window as any).__toggles)).toEqual(['DF', 'DF']);
  await draw(page);
  await advance(page);
  await expect(page.locator('#lift-labels')).toContainText('F = 7');
  expect(await orientation(page)).toEqual(before);
  expect(await page.evaluate(() => (window as any).__selections)).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('lift-click-restored-cost-seven.png') });
  await clean(page);
});

test('dragging a lifted edge rotates the view without cutting it and survives recomputation', async ({
  page,
}) => {
  await open(page);
  await draw(page);
  await advance(page);
  const before = await orientation(page),
    at = await edgePoint(page);
  const source = await checkedGeometry(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 70, at.y + 25, { steps: 8 });
  await page.mouse.up();
  await advance(page);
  const turned = await orientation(page);
  expect(turned.some((angle, i) => Math.abs(angle - before[i]) > 0.01)).toBe(true);
  expect(await page.evaluate(() => (window as any).__toggles)).toEqual([]);
  expect(await checkedGeometry(page)).toEqual(source);
  await draw(page, fixture.cut);
  await advance(page);
  expect(await orientation(page)).toEqual(turned);
  await expect(page.locator('#lift-labels')).toContainText('F = 9');
  await page.screenshot({ path: test.info().outputPath('lift-dragged-cost-nine.png') });
  await clean(page);
});

test('a stationary cursor regains hover after a same-capture redraw without needing a sacrificial click', async ({
  page,
}) => {
  await open(page);
  await draw(page);
  await advance(page);
  const at = await edgePoint(page);
  await page.mouse.move(at.x, at.y);
  await page.evaluate(() => {
    (window as any).__hovers = [];
  });
  await draw(page);
  await advance(page);
  expect(await page.evaluate(() => (window as any).__hovers)).toEqual([false, true]);
  expect(await page.evaluate(() => (window as any).__toggles)).toEqual([]);
  // Deliberately no mouse.move/click helper: the down arrives at the still cursor.
  await page.mouse.down();
  await page.mouse.up();
  expect(await page.evaluate(() => (window as any).__toggles)).toEqual(['DF']);
  await clean(page);
});

for (const viewport of [
  { width: 1512, height: 982, dx: 0, dy: 0 },
  { width: 900, height: 600, dx: 117, dy: 43 },
  { width: 640, height: 480, dx: -40, dy: -25 },
  { width: 320, height: 400, dx: 0, dy: 0 },
])
  test(`flat caption stays above compact controls at ${viewport.width}x${viewport.height} with display offset`, async ({
    page,
  }) => {
    await open(page);
    await page.setViewportSize(viewport);
    const model = structuredClone(final);
    // Retain the checked fixture's values; put its drawing on the left to exercise
    // the side placement, without adding any claims or changing its calculation.
    for (const node of model.nodes) node.x *= 0.5;
    for (const edge of model.edges)
      for (const key of ['from', 'to', 'control', 'center']) edge[key].x *= 0.5;
    for (const tag of model.tags) {
      tag.x *= 0.5;
      tag.anchor.x *= 0.5;
    }
    for (const weight of model.weights) weight.x *= 0.5;
    const text =
      'The checked values remain tied to the current experiment. The explanation must remain readable above the question bar, even when it wraps across several lines. '.repeat(
        2,
      );
    model.caption = { ...model.caption, x: 0.27, y: 0.86, anchor: 'top', text };
    const display = await page.evaluate(
      ({ width, height, dx, dy }) => ({
        x: window.screenX + dx,
        y: window.screenY + dy,
        width,
        height,
      }),
      viewport,
    );
    await draw(page, model, '2d', { display });
    await advance(page);
    const caption = page.locator('#graph-caption');
    await expect(caption.locator('span')).toHaveText(text);
    const box = (await caption.boundingBox())!;
    const safeLeft = Math.max(0, viewport.dx) + 12;
    const safeRight = Math.min(viewport.width, viewport.dx + viewport.width) - 12;
    const safeTop = Math.max(0, viewport.dy) + 12;
    const safeBottom = Math.min(viewport.height, viewport.dy + viewport.height) - 144;
    expect(box.x).toBeGreaterThanOrEqual(safeLeft - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(safeRight + 1);
    expect(box.y).toBeGreaterThanOrEqual(safeTop - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(safeBottom + 1);
    if (viewport.width === 1512) {
      const drawing = (await page.locator('#graph-layer').boundingBox())!;
      expect(box.x).toBeGreaterThan(drawing.x + drawing.width);
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    expect(await page.evaluate(() => (window as any).__hovers.at(-1))).toBe(true);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    expect(await page.evaluate(() => (window as any).__toggles)).toEqual([]);
    if (viewport.width === 320) {
      expect(await caption.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(100);
      expect(await caption.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
    }
    await page.screenshot({ path: test.info().outputPath('flat-caption-fit.png') });
    await clean(page);
  });

test('flat caption keeps an already-fitting bottom-anchor position', async ({ page }) => {
  await open(page);
  const model = structuredClone(final);
  model.caption = { ...model.caption, x: 0.7, y: 0.5, anchor: 'bottom', text: 'Checked result.' };
  await draw(page, model, '2d');
  await advance(page);
  const box = (await page.locator('#graph-caption').boundingBox())!;
  expect(box.x).toBeCloseTo(1120, 0);
  expect(box.y + box.height).toBeCloseTo(450, 0);
  await page.screenshot({ path: test.info().outputPath('flat-caption-preserved-anchor.png') });
  await clean(page);
});

test('stationary caption hover stays neutral across a redraw', async ({ page }) => {
  await open(page);
  await draw(page);
  await advance(page);
  const card = (await page.locator('#lift-caption').boundingBox())!;
  const at = { x: card.x + 10, y: card.y + 10 };
  expect(await page.evaluate(({ x, y }) => (window as any).SomaLift.hit(x, y), at)).toBe(
    'control:caption',
  );
  await page.mouse.move(at.x, at.y);
  const before = await orientation(page);
  await page.evaluate(() => {
    (window as any).__hovers = [];
  });
  await draw(page);
  await advance(page);
  expect(await page.evaluate(() => (window as any).__hovers)).toEqual([false, true]);
  expect(await page.evaluate(() => document.body.style.cursor)).toBe('default');
  await page.mouse.down();
  await page.mouse.up();
  expect(await page.evaluate(() => (window as any).__toggles)).toEqual([]);
  expect(await orientation(page)).toEqual(before);
  await clean(page);
});

test('redraw cancels a held edge and zero-button movement still cancels a lost release', async ({
  page,
}) => {
  await open(page);
  await draw(page);
  await advance(page);
  const at = await edgePoint(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.evaluate(() => {
    (window as any).__hovers = [];
  });
  await draw(page);
  await advance(page);
  expect(await page.evaluate(() => (window as any).__hovers)).toEqual([false]);
  await page.mouse.up();
  expect(await page.evaluate(() => (window as any).__toggles)).toEqual([]);
  await page.mouse.move(at.x + 1, at.y);
  await page.mouse.down();
  await page.evaluate(
    ({ x, y }) =>
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, buttons: 0 })),
    at,
  );
  await page.mouse.up();
  expect(await page.evaluate(() => (window as any).__toggles)).toEqual([]);
  await clean(page);
});

test('queued stationary hover cannot survive graph clear, source replacement, exit or blur', async ({
  page,
}) => {
  await open(page);
  await draw(page);
  await advance(page);
  for (const cancel of ['clear', 'replace', 'exit', 'blur', 'mouseleave']) {
    await draw(page);
    await advance(page);
    const at = await edgePoint(page);
    await page.mouse.move(at.x, at.y);
    await page.evaluate(
      ({ model, cancel }) => {
        const w = window as any;
        w.__hovers = [];
        const event = {
          type: 'graph',
          captureId: 'synthetic-capture',
          model,
          view: '3d',
          display: { x: window.screenX, y: window.screenY, width: 1600, height: 900 },
        };
        w.__draw(event);
        if (cancel === 'clear') w.__draw({ type: 'graph-clear' });
        else if (cancel === 'replace') w.__draw({ ...event, captureId: 'replacement-capture' });
        else if (cancel === 'exit') w.__draw({ ...event, view: '2d' });
        else if (cancel === 'blur') window.dispatchEvent(new Event('blur'));
        else document.dispatchEvent(new MouseEvent('mouseleave'));
      },
      { model: final, cancel },
    );
    await advance(page);
    expect(await page.evaluate(() => (window as any).__hovers)).toEqual([false]);
    expect(await page.evaluate(() => (window as any).__toggles)).toEqual([]);
  }
  await clean(page);
});

test('lifted view buttons turn and reset without changing checked geometry or sending graph actions', async ({
  page,
}) => {
  await open(page);
  await draw(page);
  await advance(page);
  const before = await orientation(page),
    geometry = await checkedGeometry(page);
  const controls = page.locator('#lift-caption button[data-lift-view]');
  await expect(controls).toHaveCount(3);
  for (const action of ['left', 'reset', 'right', 'reset']) {
    const button = page.locator(`#lift-caption button[data-lift-view="${action}"]`);
    const bounds = (await button.boundingBox())!;
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(1600);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
    const x = bounds.x + bounds.width / 2,
      y = bounds.y + bounds.height / 2;
    expect(await page.evaluate(({ x, y }) => (window as any).SomaLift.hit(x, y), { x, y })).toBe(
      `control:${action}`,
    );
    await page.mouse.move(x, y);
    await page.mouse.click(x, y);
    await advance(page);
    const current = await orientation(page);
    if (action === 'reset') expect(current).toEqual(before);
    else expect(current.some((angle, i) => Math.abs(angle - before[i]) > 0.01)).toBe(true);
    expect(await checkedGeometry(page)).toEqual(geometry);
  }
  expect(await page.evaluate(() => (window as any).__toggles)).toEqual([]);
  expect(await page.evaluate(() => (window as any).__selections)).toEqual([]);
  const caption = (await page.locator('#lift-caption').boundingBox())!;
  expect(caption.x).toBeGreaterThanOrEqual(0);
  expect(caption.y).toBeGreaterThanOrEqual(0);
  expect(caption.x + caption.width).toBeLessThanOrEqual(1600);
  expect(caption.y + caption.height).toBeLessThanOrEqual(900);
  await page.screenshot({ path: test.info().outputPath('lift-reset-view-controls.png') });
  const obscured = await page.evaluate(() => {
    const s = (window as any).SomaLift.debug;
    const card = document.getElementById('lift-caption')!.getBoundingClientRect();
    s.scene.updateMatrixWorld(true);
    return [...s.nodes.values()]
      .filter((node: any) => {
        if (
          !node.sphere.visible ||
          node.data.distance === null ||
          node.sphere.material.opacity < 0.1
        )
          return false;
        const point = node.sphere.getWorldPosition(node.sphere.position.clone()).project(s.camera);
        const x = ((point.x + 1) * s.frame.width) / 2 + s.frame.dx;
        const y = ((1 - point.y) * s.frame.height) / 2 + s.frame.dy;
        return x >= card.left && x <= card.right && y >= card.top && y <= card.bottom;
      })
      .map((node: any) => node.data.id);
  });
  expect(obscured, 'The interaction caption must not cover a visible graph node').toEqual([]);
  await clean(page);
});

test('lifted edge picking uses the captured display offset and ignores empty space', async ({
  page,
}) => {
  await open(page);
  await draw(page, final, '3d', {
    display: {
      x: await page.evaluate(() => window.screenX + 117),
      y: await page.evaluate(() => window.screenY + 43),
      width: 1200,
      height: 800,
    },
  });
  await advance(page);
  const at = await edgePoint(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.click(at.x, at.y);
  expect(await page.evaluate(() => (window as any).__toggles)).toEqual(['DF']);
  await page.mouse.move(2, 2);
  await page.mouse.click(2, 2);
  expect(await page.evaluate(() => (window as any).__hovers.at(-1))).toBe(false);
  expect(await page.evaluate(() => (window as any).__toggles)).toEqual(['DF']);
  await clean(page);
});

test('caption text cannot click through to a hidden edge or rotate the lifted graph', async ({
  page,
}) => {
  await open(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await draw(page, final, '3d', {
    display: {
      x: await page.evaluate(() => window.screenX),
      y: await page.evaluate(() => window.screenY),
      width: 1280,
      height: 720,
    },
  });
  await advance(page);
  const edge = await edgePoint(page);
  await page.mouse.move(edge.x, edge.y);
  await page.mouse.down();
  await page.mouse.move(edge.x, edge.y + 60, { steps: 6 });
  await page.mouse.up();
  await advance(page);
  const before = await orientation(page),
    geometry = await checkedGeometry(page);
  const caption = (await page.locator('#lift-caption').boundingBox())!;
  expect(caption.x).toBeGreaterThanOrEqual(0);
  expect(caption.y).toBeGreaterThanOrEqual(0);
  expect(caption.x + caption.width).toBeLessThanOrEqual(1280);
  expect(caption.y + caption.height).toBeLessThanOrEqual(720);
  // Text area rather than the three explicit view buttons. The native transparent
  // window must consume these pointer gestures without acting on graph geometry.
  const x = caption.x + caption.width / 2,
    y = caption.y + 22;
  expect(await page.evaluate(({ x, y }) => (window as any).SomaLift.hit(x, y), { x, y })).toBe(
    'control:caption',
  );
  await page.mouse.move(x, y);
  await page.mouse.click(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 35, y + 16, { steps: 5 });
  await page.mouse.up();
  await advance(page);
  expect(await page.evaluate(() => (window as any).__toggles)).toEqual([]);
  expect(await page.evaluate(() => (window as any).__selections)).toEqual([]);
  expect(await orientation(page)).toEqual(before);
  expect(await checkedGeometry(page)).toEqual(geometry);
  await page.screenshot({ path: test.info().outputPath('lift-caption-protected-1280.png') });
  await clean(page);
});

test('clearing or replacing a graph during a press cancels its eventual click', async ({
  page,
}) => {
  await open(page);
  await draw(page);
  await advance(page);
  let at = await edgePoint(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.evaluate(() => (window as any).__draw({ type: 'graph-clear' }));
  await page.mouse.up();
  expect(await page.evaluate(() => (window as any).__toggles)).toEqual([]);
  expect(await page.evaluate(() => (window as any).__hovers.at(-1))).toBe(false);
  await draw(page);
  await advance(page);
  at = await edgePoint(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await draw(page, fixture.cut);
  await advance(page);
  await page.mouse.up();
  expect(await page.evaluate(() => (window as any).__toggles)).toEqual([]);
  await expect(page.locator('#lift-labels')).toContainText('F = 9');
  await clean(page);
});

test('native lift follows checked search steps, cuts and reset without inventing a route', async ({
  page,
}) => {
  await open(page);
  await draw(page, fixture.models[1]);
  await advance(page);
  await expect(page.locator('#lift-labels')).toContainText('F ≤ 11');
  for (const model of fixture.models.slice(2)) {
    await draw(page, model);
    await advance(page);
  }
  await expect(page.locator('#lift-labels')).toContainText('F = 7');
  await expect(page.locator('#lift-labels')).toContainText('11 · slack 4');
  const geometry = await page.evaluate(() => {
    const s = (window as any).SomaLift.debug;
    return {
      heights: [...s.nodes.values()].map((n: any) => ({
        id: n.data.id,
        distance: n.data.distance,
        z: n.sphere.position.z,
      })),
      base: s.layout.base,
      scale: s.layout.scale,
      directed: [...s.edges.values()].filter((e: any) => e.meshes.length > 1 && e.shape !== 'cut')
        .length,
    };
  });
  for (const n of geometry.heights)
    expect(n.z).toBeCloseTo(geometry.base + n.distance * geometry.scale, 7);
  expect(geometry.directed).toBe(0);
  await draw(page, fixture.cut);
  await advance(page);
  await expect(page.locator('#lift-labels')).toContainText('F = 9');
  await expect(page.locator('#lift-labels')).toContainText('D–F removed');
  await draw(page, fixture.models[0]);
  await advance(page);
  const reset = await page.evaluate(() =>
    [...(window as any).SomaLift.debug.nodes.values()]
      .filter((n: any) => n.data.id !== 'A')
      .map((n: any) => ({ distance: n.data.distance, visible: n.sphere.visible })),
  );
  expect(reset.every((n: any) => n.distance === null && !n.visible)).toBe(true);
  expect(await page.evaluate(() => (window as any).__failed)).toEqual([]);
  await clean(page);
});

test('a repositioned graph keeps its 3D strings attached to the current node centres', async ({
  page,
}) => {
  await open(page);
  await draw(page);
  await advance(page);
  const shifted = structuredClone(final);
  for (const node of shifted.nodes) node.x += 0.04;
  for (const edge of shifted.edges)
    for (const key of ['from', 'to', 'center', 'control']) edge[key].x += 0.04;
  await draw(page, shifted);
  await advance(page);
  const joins = await page.evaluate(() => {
    const s = (window as any).SomaLift.debug;
    return s.layout.edges
      .filter((e: any) => e.kind === 'taut')
      .map((e: any) => {
        const pos = s.edges.get(e.id).meshes[0].geometry.attributes.position;
        const centre = { x: 0, y: 0, z: 0 };
        // First ring of a real TubeGeometry: average its ten unique radial vertices.
        for (let i = 0; i < 10; i++) {
          centre.x += pos.getX(i) / 10;
          centre.y += pos.getY(i) / 10;
          centre.z += pos.getZ(i) / 10;
        }
        const node = s.nodes.get(e.from).sphere.position;
        return {
          edge: e.id,
          error: Math.hypot(centre.x - node.x, centre.y - node.y, centre.z - node.z),
        };
      });
  });
  for (const join of joins) expect(join.error, join.edge).toBeLessThan(0.001);
  await clean(page);
});

test('display rescaling updates real node meshes and sheet coordinates together', async ({
  page,
}) => {
  await open(page);
  await draw(page);
  await advance(page);
  await draw(page, final, '3d', {
    display: {
      x: await page.evaluate(() => window.screenX + 17),
      y: await page.evaluate(() => window.screenY + 23),
      width: 1200,
      height: 900,
    },
  });
  await advance(page);
  const shapes = await page.evaluate(() => {
    const s = (window as any).SomaLift.debug;
    return {
      radius: s.layout.radius,
      frame: s.frame,
      spheres: [...s.nodes.values()].map((n: any) => n.sphere.geometry.parameters.radius),
    };
  });
  expect(shapes.frame).toMatchObject({ dx: 17, dy: 23, width: 1200, height: 900 });
  for (const radius of shapes.spheres) expect(radius).toBeCloseTo(shapes.radius * 0.78, 7);
  await expect(page.locator('#lift-canvas')).toHaveCSS('left', '17px');
  await expect(page.locator('#lift-canvas')).toHaveCSS('top', '23px');
  await clean(page);
});

test('sheet identity includes the capture region and the full image', async ({ page }) => {
  await open(page);
  const image = (fill: string) =>
    `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${fill}"/>${' '.repeat(120)}</svg>`).toString('base64')}`;
  const first = image('#ff0000'),
    second = image('#0000ff');
  expect(first.length).toBe(second.length);
  expect(first.slice(-48)).toBe(second.slice(-48));
  const region = { x: 0.05, y: 0.2, width: 0.55, height: 0.55 };
  await draw(page, final, '3d', { sheet: { dataUrl: first, region } });
  await advance(page);
  await expect
    .poll(() => page.evaluate(() => (window as any).SomaLift.debug.sheetReady))
    .toBe(true);
  await draw(page, final, '3d', { sheet: { dataUrl: first, region: { ...region, x: 0.15 } } });
  await advance(page);
  const x = await page.evaluate(() => (window as any).SomaLift.debug.sheet.paper.position.x);
  expect(x).toBeCloseTo((0.15 + 0.55 / 2) * 1600 - 800, 7);
  await draw(page, final, '3d', { sheet: { dataUrl: second, region } });
  await advance(page);
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).SomaLift.debug.sheet.paper.material.map?.image.src),
    )
    .toBe(second);
  await clean(page);
});

test('reduced motion immediately settles a changed height without a moving ghost', async ({
  page,
}) => {
  await open(page);
  await draw(page);
  await advance(page);
  await draw(page, fixture.cut);
  await advance(page);
  await expect(page.locator('#lift-labels')).toContainText('F = 9');
  await expect(page.locator('#lift-labels')).not.toContainText('→');
  const changing = await page.evaluate(() =>
    [...(window as any).SomaLift.debug.nodes.values()].some(
      (n: any) => n.change || n.ghost.material.opacity || n.trail.material.opacity,
    ),
  );
  expect(changing).toBe(false);
  await clean(page);
});

test('microcosts retain nonzero proportional heights and a readable bounded ruler', async ({
  page,
}) => {
  await open(page);
  const model = structuredClone(final);
  const factor = 1e-8;
  for (const node of model.nodes) if (node.distance !== null) node.distance *= factor;
  for (const edge of model.edges) edge.weight *= factor;
  model.lift.maxDistance *= factor;
  model.caption = null;
  await draw(page, model);
  await advance(page);
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

test('repeated and interrupted lifts release their canvases and recover from GPU loss', async ({
  page,
}) => {
  // Keep every real RAF in both interruption cycles. Software WebGL in clean
  // Linux CI takes longer than the default 30 seconds for this whole sequence.
  test.setTimeout(90_000);
  await open(page, false);
  for (let i = 0; i < 2; i++) {
    await draw(page);
    await advance(page, 900);
    await draw(page, final, '2d');
    await advance(page, 250);
    await draw(page);
    await advance(page, 2700);
    await expect(page.locator('#lift-canvas')).toHaveCount(1);
    await expect(page.locator('body')).toHaveClass('lifted');
    await draw(page, final, '2d');
    await advance(page, 1100);
    await expect(page.locator('#lift-canvas, #lift-labels')).toHaveCount(0);
    await expect(page.locator('#graph-layer')).toHaveCount(1);
  }
  await draw(page);
  await advance(page, 2700);
  await page.evaluate(() =>
    (window as any).SomaLift.debug.renderer
      .getContext()
      .getExtension('WEBGL_lose_context')
      .loseContext(),
  );
  await expect.poll(() => page.evaluate(() => (window as any).__failed)).toEqual(['webgl']);
  await expect(page.locator('body')).not.toHaveClass('lifted');
  await expect(page.locator('#graph-layer')).toHaveCount(1);
  await clean(page);
});

test('switching from a lifted graph to pointing removes the stale 3D scene', async ({ page }) => {
  await open(page);
  await draw(page);
  await advance(page);
  await page.evaluate(() =>
    (window as any).__draw({
      type: 'focus',
      text: 'Selected new context',
      region: { x: 0.6, y: 0.2, width: 0.1, height: 0.1 },
    }),
  );
  await expect(page.locator('#lift-canvas, #lift-labels, #lift-caption')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass('lifted');
  await expect(page.locator('#hint')).toHaveText('Selected new context');
  await clean(page);
});
