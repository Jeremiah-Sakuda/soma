const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { sheetRegion: nativeSheetRegion, validOverlayModel } = require('../screen-overlay.cjs');
const { models, cut } = require('./fixtures/hero-lift.json');
const geometry = () => import(pathToFileURL(path.join(__dirname, '../lift-geometry.mjs')).href);
const frame = { width: 1600, height: 900 };

test('the hero fixture is a valid overlay model with lift data', () => {
  for (const m of [...models, cut]) assert.equal(validOverlayModel(m), true);
  assert.equal(
    validOverlayModel({ ...models[0], lift: { ...models[0].lift, maxDistance: -1 } }),
    false,
  );
  assert.equal(
    validOverlayModel({ ...models[0], edges: [{ ...models[0].edges[0], weight: Infinity }] }),
    false,
  );
  assert.equal(
    validOverlayModel({ ...models[0], edges: [{ ...models[0].edges[0], fromId: 'bad id!' }] }),
    false,
  );
  const e = models[0].edges[0];
  assert.equal(
    validOverlayModel({ ...models[0], edges: [e, { ...e }] }),
    false,
    'edge ids are distinct',
  );
  assert.equal(
    validOverlayModel({ ...models[0], nodes: [...models[0].nodes, { ...models[0].nodes[0] }] }),
    false,
    'node ids are distinct',
  );
  assert.equal(
    validOverlayModel({ ...models[0], edges: [{ ...e, toId: e.fromId }] }),
    false,
    'no loops',
  );
  assert.equal(
    validOverlayModel({ ...models[0], lift: { ...models[0].lift, source: 'nowhere' } }),
    false,
    'the start is a drawn node',
  );
  assert.equal(
    validOverlayModel({ ...models[0], lift: null }),
    false,
    'a null lift is refused, not thrown on',
  );
  for (const aspect of [0, -1, Infinity, 1 / 1601, 1601])
    assert.equal(validOverlayModel({ ...models[0], aspect }), false, `invalid aspect ${aspect}`);
  for (const aspect of [undefined, 1 / 1600, 9 / 16, 1600])
    assert.equal(validOverlayModel({ ...models[0], aspect }), true, `valid aspect ${aspect}`);
  assert.equal(
    validOverlayModel({ ...models[0], lift: { ...models[0].lift, maxDistance: 1e-310 } }),
    false,
    'unrepresentable pixel scale stays flat',
  );
});

test('heights are checked distances and strings are taut exactly on shortest routes', async () => {
  const { liftLayout, slackOf } = await geometry();
  const layout = liftLayout(models.at(-1), frame);
  const node = (id) => layout.nodes.find((n) => n.id === id);
  const edge = (id) => layout.edges.find((e) => e.id === id);
  // Height grows linearly with distance from the start.
  assert.ok(Math.abs(node('F').height - node('A').height - 7 * layout.scale) < 1e-9);
  assert.ok(node('B').height < node('D').height && node('D').height < node('E').height);
  // A–F costs 11 but F is 7 away: slack 4. The route's strings are taut.
  assert.deepEqual(
    [edge('AF').kind, edge('AF').slack, edge('AF').label],
    ['slack', 4, '11 · slack 4'],
  );
  for (const id of ['AC', 'BC', 'BD', 'DF']) assert.equal(edge(id).kind, 'taut', id);
  assert.equal(edge('CE').kind, 'taut', 'C–E is the shortest way to E');
  assert.deepEqual([edge('AB').slack, edge('DE').slack, edge('EF').slack], [1, 1, 2]);
  assert.equal(
    slackOf(3, 0, 5, true),
    -2,
    'next to an estimate, a shorter way shows as negative slack',
  );
  assert.ok(
    Math.abs(slackOf(0.333, 0.34, 0.67, false) - 0.003) < 1e-15,
    'a real small difference remains slack',
  );
  assert.equal(slackOf(5, null, 2, false), null);
});

test('microcosts and decimal roundoff keep the checked taut/slack distinction', async () => {
  const { slackOf, fmt, liftLayout } = await geometry();
  assert.equal(slackOf(0.2, 0.1, 0.1 + 0.2, false), 0, 'same addition as the checked trace');
  assert.equal(slackOf(4e-10, 0, 1e-10, false), 3e-10);
  assert.equal(slackOf(1e-300, 0, 0, false), 1e-300);
  assert.ok(slackOf(0.004, 0, 0.003, false) > 0);
  assert.ok(slackOf(0.003, 0, 0.004, true) < 0);
  assert.notEqual(fmt(3e-10), '0');
  assert.equal(fmt(0.0051), '0.0051');
  assert.equal(fmt(0.300001), '0.300001');
  assert.equal(fmt(11e6), '11000000');
  assert.equal(slackOf(1, undefined, 0, false), null);
  const m = structuredClone(models.at(-1));
  m.nodes.forEach((n) => {
    if (n.distance !== null) n.distance *= 1e-7;
  });
  m.edges.forEach((e) => {
    e.weight *= 1e-7;
  });
  m.lift.maxDistance *= 1e-7;
  const lifted = liftLayout(m, frame);
  const source = lifted.nodes.find((n) => n.id === 'A'),
    goal = lifted.nodes.find((n) => n.id === 'F');
  assert.ok(Math.abs((goal.height - source.height) / lifted.scale - 7e-7) < 1e-18);
  assert.ok(lifted.edges.find((e) => e.id === 'AF').slack > 0);
  assert.equal(lifted.edges.find((e) => e.id === 'AF').kind, 'slack');
  assert.equal(lifted.edges.find((e) => e.id === 'DF').kind, 'taut');
  assert.throws(
    () => liftLayout({ ...m, lift: { ...m.lift, maxDistance: Number.MIN_VALUE } }, frame),
    RangeError,
  );
});

test('flat capture points project back to their pixels across wide, tall and compact displays', async () => {
  const { cameraDistance, toWorld } = await geometry();
  const { PerspectiveCamera, Vector3 } = await import('three');
  for (const frame of [
    { width: 1600, height: 900 },
    { width: 620, height: 704 },
    { width: 900, height: 1600 },
    { width: 3440, height: 1440 },
  ]) {
    const camera = new PerspectiveCamera(28, frame.width / frame.height, 0.1, 20000);
    camera.position.z = cameraDistance(frame.height, 28);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    for (const point of [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 0.2, y: 0.7 },
      { x: 0.5, y: 0.5 },
    ]) {
      const world = toWorld(point, frame);
      const projected = new Vector3(world.x, world.y, 0).project(camera);
      assert.ok(Math.abs(((projected.x + 1) * frame.width) / 2 - point.x * frame.width) < 1e-9);
      assert.ok(Math.abs(((1 - projected.y) * frame.height) / 2 - point.y * frame.height) < 1e-9);
    }
  }
});

test('tentative estimates, unreached nodes and cut connections are drawn as such', async () => {
  const { liftLayout } = await geometry();
  const early = liftLayout(models[1], frame);
  const f = early.nodes.find((n) => n.id === 'F');
  assert.equal(f.tentative, true);
  assert.equal(f.distance, 11, 'F ≤ 11 before it settles at 7');
  assert.equal(early.edges.find((e) => e.id === 'AF').kind, 'tentative');
  assert.ok(
    early.nodes.some((n) => n.distance === null && n.height === 0),
    'unreached nodes stay on the sheet',
  );
  assert.equal(early.edges.find((e) => e.id === 'DE').kind, 'flat');
  const afterCut = liftLayout(cut, frame);
  assert.equal(afterCut.edges.find((e) => e.id === 'DF').kind, 'cut');
  assert.equal(afterCut.nodes.find((n) => n.id === 'F').distance, 9);
  assert.equal(afterCut.edges.find((e) => e.id === 'AF').slack, 2);
});

test('the sheet region matches natively and in the renderer, and covers every node', async () => {
  const { sheetRegion } = await geometry();
  for (const m of [models[0], models.at(-1), cut]) {
    const a = sheetRegion(m),
      b = nativeSheetRegion(m);
    for (const k of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(a[k] - b[k]) < 1e-12, k);
    for (const n of m.nodes)
      assert.ok(n.x > a.x && n.x < a.x + a.width && n.y > a.y && n.y < a.y + a.height);
    // The A–F arc's control point is far above the slide's graph; the sheet must not reach it.
    assert.ok(a.y > 0.1, 'the sheet stops at the drawn arc, below the slide title');
  }
});

test('the lifted capture covers the graph and arc costs without erasing the slide title rule', async () => {
  const { sheetRegion } = await geometry();
  const m = models.at(-1),
    region = sheetRegion(m);
  // The original synthetic Lecture 14 slide has its rule at y=183/900 and its
  // upper curved A–F cost around y=.277. Neither curve nor nodes touch that rule.
  assert.ok(region.y > 183 / 900, 'the paper cover must leave the title rule visible');
  for (const node of m.nodes) {
    assert.ok(node.y - m.radius / m.aspect >= region.y);
    assert.ok(node.y + m.radius / m.aspect <= region.y + region.height);
  }
  const arc = m.edges.find((e) => e.id === 'AF');
  assert.ok(arc.center.y - m.font / m.aspect > region.y, 'the printed arc cost fits on the sheet');
  assert.deepEqual(region, nativeSheetRegion(m));
});

test('sheet padding uses equal capture pixels on both axes and preserves legacy models', async () => {
  const { sheetRegion } = await geometry();
  const legacy = structuredClone(models[0]);
  delete legacy.aspect;
  assert.deepEqual(sheetRegion(legacy), nativeSheetRegion(legacy));
  const centers = [...legacy.nodes, ...legacy.edges.map((e) => e.center)];
  const minX = Math.min(...centers.map((p) => p.x)),
    minY = Math.min(...centers.map((p) => p.y));
  const legacyRegion = sheetRegion(legacy);
  assert.ok(Math.abs(minY - legacyRegion.y - legacy.radius * 1.8) < 1e-12);
  for (const aspect of [9 / 16, 16 / 9, 1]) {
    // Isolate circle padding; high arc costs have their own smaller text margin.
    const m = { ...legacy, aspect, edges: [] },
      capture = { width: 1600, height: 1600 * aspect };
    const nodeMinX = Math.min(...m.nodes.map((p) => p.x)),
      nodeMinY = Math.min(...m.nodes.map((p) => p.y));
    const region = sheetRegion(m);
    assert.deepEqual(region, nativeSheetRegion(m));
    assert.ok(
      Math.abs((nodeMinX - region.x) * capture.width - legacy.radius * capture.width * 1.8) < 1e-9,
    );
    assert.ok(
      Math.abs((nodeMinY - region.y) * capture.height - legacy.radius * capture.width * 1.8) < 1e-9,
    );
    const lifted = (await geometry()).liftLayout(m, capture);
    assert.ok(Math.abs(lifted.sheet.width - region.width * capture.width) < 1e-9);
    assert.ok(Math.abs(lifted.sheet.height - region.height * capture.height) < 1e-9);
  }
});

test('a flat scene lands on the slide pixel for pixel, and labels never overlap', async () => {
  const { cameraDistance, separateLabels, stringPoints, sagDepth } = await geometry();
  const d = cameraDistance(900, 28);
  // At distance d the visible height of the z = 0 plane is exactly the display height.
  assert.ok(Math.abs(2 * d * Math.tan((14 * Math.PI) / 180) - 900) < 1e-9);
  const items = [
    { x: 100, y: 100, w: 60, h: 20, priority: 3 },
    { x: 110, y: 104, w: 60, h: 20, priority: 1 },
    { x: 95, y: 98, w: 60, h: 20, priority: 2 },
  ];
  const ys = separateLabels(items);
  assert.equal(ys[0], 100, 'the most important label stays put');
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 3; j++)
      assert.ok(
        Math.abs(items[i].x - items[j].x) >= (items[i].w + items[j].w) / 2 ||
          Math.abs(ys[i] - ys[j]) >= 20,
        `${i} and ${j}`,
      );
  const pts = stringPoints({ x: 0, y: 0, z: 10 }, { x: 10, y: 0, z: 10 }, 4, 4);
  assert.deepEqual(
    pts.map((p) => p.z),
    [10, 7, 6, 7, 10],
  );
  // A string sagging through the sheet rests on it, but never above its lower end.
  assert.deepEqual(
    stringPoints({ x: 0, y: 0, z: 10 }, { x: 10, y: 0, z: 10 }, 20, 4, 2).map((p) => p.z),
    [10, 2, 2, 2, 10],
  );
  assert.deepEqual(
    stringPoints({ x: 0, y: 0, z: 1 }, { x: 10, y: 0, z: 10 }, 20, 2, 2).map((p) => p.z),
    [1, 1, 10],
  );
  assert.equal(sagDepth(0, 30, 300), 0);
  assert.equal(sagDepth(1, 30, 300), 27, 'sag is proportional to slack');
  assert.equal(sagDepth(0.1, 30, 300, 12), 12, 'a small slack still shows');
  assert.equal(sagDepth(100, 30, 300), 210, 'a very long string is bounded');
});
