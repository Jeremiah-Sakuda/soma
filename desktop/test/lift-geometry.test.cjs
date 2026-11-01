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
  assert.equal(validOverlayModel({ ...models[0], lift: { ...models[0].lift, maxDistance: -1 } }), false);
  assert.equal(validOverlayModel({ ...models[0], edges: [{ ...models[0].edges[0], weight: Infinity }] }), false);
  assert.equal(validOverlayModel({ ...models[0], edges: [{ ...models[0].edges[0], fromId: 'bad id!' }] }), false);
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
  assert.deepEqual([edge('AF').kind, edge('AF').slack, edge('AF').label], ['slack', 4, '11 · slack 4']);
  for (const id of ['AC', 'BC', 'BD', 'DF']) assert.equal(edge(id).kind, 'taut', id);
  assert.equal(edge('CE').kind, 'taut', 'C–E is the shortest way to E');
  assert.deepEqual([edge('AB').slack, edge('DE').slack, edge('EF').slack], [1, 1, 2]);
  assert.equal(slackOf(3, 0, 5, true), 0, 'a directed string can never be shorter than its climb');
  assert.equal(slackOf(5, null, 2, false), null);
});

test('tentative estimates, unreached nodes and cut connections are drawn as such', async () => {
  const { liftLayout } = await geometry();
  const early = liftLayout(models[1], frame);
  const f = early.nodes.find((n) => n.id === 'F');
  assert.equal(f.tentative, true);
  assert.equal(f.distance, 11, 'F ≤ 11 before it settles at 7');
  assert.equal(early.edges.find((e) => e.id === 'AF').kind, 'tentative');
  assert.ok(early.nodes.some((n) => n.distance === null && n.height === 0), 'unreached nodes stay on the sheet');
  assert.equal(early.edges.find((e) => e.id === 'DE').kind, 'flat');
  const afterCut = liftLayout(cut, frame);
  assert.equal(afterCut.edges.find((e) => e.id === 'DF').kind, 'cut');
  assert.equal(afterCut.nodes.find((n) => n.id === 'F').distance, 9);
  assert.equal(afterCut.edges.find((e) => e.id === 'AF').slack, 2);
});

test('the sheet region matches natively and in the renderer, and covers every node', async () => {
  const { sheetRegion } = await geometry();
  for (const m of [models[0], models.at(-1), cut]) {
    const a = sheetRegion(m), b = nativeSheetRegion(m);
    for (const k of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(a[k] - b[k]) < 1e-12, k);
    for (const n of m.nodes) assert.ok(n.x > a.x && n.x < a.x + a.width && n.y > a.y && n.y < a.y + a.height);
    // The A–F arc's control point is far above the slide's graph; the sheet must not reach it.
    assert.ok(a.y > 0.1, 'the sheet stops at the drawn arc, below the slide title');
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
      assert.ok(Math.abs(items[i].x - items[j].x) >= (items[i].w + items[j].w) / 2 || Math.abs(ys[i] - ys[j]) >= 20, `${i} and ${j}`);
  const pts = stringPoints({ x: 0, y: 0, z: 10 }, { x: 10, y: 0, z: 10 }, 4, 4);
  assert.deepEqual(pts.map((p) => p.z), [10, 7, 6, 7, 10]);
  assert.equal(sagDepth(0, 30, 300), 0);
  assert.equal(sagDepth(100, 30, 300), 165, 'a very long string is bounded');
});
