const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { createPointAsk } = require('../point-ask.cjs');
const { sheetRegion } = require('../screen-overlay.cjs');
const { models } = require('./fixtures/hero-lift.json');

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const model = () => structuredClone(models.at(-1));

/** Controller integration only: synthetic pixels and window/shortcut adapters. No OS
 * capture, rendering, microphone, media, network or model calls are exercised here. */
function harness(extraImages = [], options = {}) {
  const images = ['SLIDE', 'SLIDE', ...extraImages];
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.kill = () => {};
  const results = [], draws = [], sent = [], windows = [], regions = [];
  const display = { id: 1, bounds: { x: -1000, y: 0, width: 1000, height: 800 }, workArea: { x: -1000, y: 24, width: 1000, height: 776 } };
  class Window {
    constructor() {
      this.webContents = { send: (_channel, payload) => draws.push(payload), setWindowOpenHandler() {}, on() {} };
      windows.push(this);
    }
    setIgnoreMouseEvents() {}
    setVisibleOnAllWorkspaces() {}
    setBounds() {}
    setContentProtection() {}
    loadFile() {}
    showInactive() {}
    hide() {}
    isDestroyed() { return false; }
    destroy() {}
  }
  let captures = 0;
  const shortcuts = new Map();
  const controller = createPointAsk({
    BrowserWindow: Window,
    screen: { getCursorScreenPoint: () => ({ x: -500, y: 400 }), getDisplayNearestPoint: () => display },
    globalShortcut: { register: (name, handler) => { shortcuts.set(name, handler); return true; }, unregister: (name) => shortcuts.delete(name) },
    locked: { sandbox: true }, helperPath: '/original-synthetic-helper',
    send: (payload) => sent.push(payload), status() {}, hidePanel() {}, showPanel() {}, available: () => true,
    spawnShortcut: () => child, platform: 'darwin',
    captureImage: async () => {
      const image = images[captures++] ?? 'SLIDE';
      return { dataUrl: typeof image === 'function' ? await image() : image };
    },
    compareRegion: (a, b, region) => { regions.push(region); return a === b; },
    cropImage: () => 'data:image/jpeg;base64,SHEET',
    overlayResult: (payload) => results.push(payload),
    ...options,
  });
  const event = (type) => child.stdout.write(JSON.stringify({ type }) + '\n');
  return {
    controller, results, draws, shortcuts, regions,
    get captures() { return captures; },
    async ready() {
      if (!controller.enabled) {
        const enabling = controller.enable();
        child.stdout.write('{"type":"ready","available":true}\n');
        await enabling;
      }
      event('pressed'); event('released');
      await wait(170);
      const id = sent.filter((payload) => payload.type === 'source').at(-1).id;
      controller.feedback({ id, state: 'ready' });
      await controller.screenOverlay({ id, model: model() });
      return id;
    },
  };
}

test('clearing and restoring the source synchronizes the panel with the native flat view', async () => {
  const h = harness();
  try {
    const id = await h.ready();
    assert.equal(h.controller.setView('3d', id), '3d');
    await h.controller.screenOverlay({ id, model: null });
    assert.deepEqual(h.results.at(-1), { id, shown: false, reason: 'cleared' });
    assert.equal(h.controller.view, '2d');
    await h.controller.screenOverlay({ id, model: model() });
    assert.deepEqual(h.results.at(-1), { id, shown: true, view: '2d' });
    assert.equal(h.controller.hasDrawing(), true);
  } finally { h.controller.dispose(); }
});

test('a stale lift remains flat until a fresh source check passes', async () => {
  let release;
  const h = harness([() => new Promise((resolve) => { release = resolve; })]);
  try {
    const id = await h.ready();
    h.controller.markStale();
    assert.equal(h.controller.setView('3d', id), '2d');
    assert.deepEqual(h.results.at(-1), { id, shown: true, view: '2d', reason: 'checking' });
    assert.equal(h.captures, 3);
    assert.ok(h.draws.every((draw) => draw.view !== '3d'));
    release('SLIDE'); await wait();
    assert.equal(h.controller.view, '3d');
    assert.deepEqual(h.regions.at(-1), sheetRegion(model()), 'the full sheet about to cover the source was checked');
    assert.deepEqual(h.results.at(-1), { id, shown: true, view: '3d' });
  } finally { h.controller.dispose(); }
});

test('a lift requested during an existing re-check waits, then checks its complete sheet', async () => {
  let releaseStep, releaseSheet;
  const h = harness([
    () => new Promise((resolve) => { releaseStep = resolve; }),
    () => new Promise((resolve) => { releaseSheet = resolve; }),
  ]);
  try {
    const id = await h.ready();
    h.controller.markStale();
    const next = model(); next.caption = null;
    const updating = h.controller.screenOverlay({ id, model: next });
    assert.equal(h.captures, 3);
    assert.equal(h.controller.setView('3d', id), '2d');
    assert.equal(h.captures, 3, 'the existing capture is not overlapped');
    releaseStep('SLIDE'); await updating; await wait();
    assert.equal(h.captures, 4, 'the requested sheet receives its own complete check');
    assert.equal(h.controller.view, '2d');
    assert.deepEqual(h.results.at(-1), { id, shown: true, view: '2d', reason: 'checking' });
    releaseSheet('SLIDE'); await wait();
    assert.equal(h.controller.view, '3d');
    assert.deepEqual(h.regions.at(-1), sheetRegion(next));
  } finally { releaseStep?.('SLIDE'); releaseSheet?.('SLIDE'); h.controller.dispose(); }
});

test('a changed source fails the fresh lift check and never shows its old sheet', async () => {
  const h = harness(['NEXT SLIDE']);
  try {
    const id = await h.ready();
    h.controller.markStale();
    assert.equal(h.controller.setView('3d', id), '2d');
    await wait();
    assert.equal(h.controller.hasDrawing(), false);
    assert.equal(h.controller.view, '2d');
    assert.deepEqual(h.results.at(-1), { id, shown: false, reason: 'changed' });
    assert.ok(h.draws.every((draw) => draw.view !== '3d'));
  } finally { h.controller.dispose(); }
});

test('an explicit flat request cancels a pending lift even while already flat', async () => {
  let release;
  const h = harness([() => new Promise((resolve) => { release = resolve; })]);
  try {
    const id = await h.ready();
    h.controller.markStale(); h.controller.setView('3d', id);
    h.controller.setView('2d', id);
    assert.deepEqual(h.results.at(-1), { id, shown: true, view: '2d' });
    release('SLIDE'); await wait();
    assert.equal(h.controller.view, '2d');
    assert.ok(h.draws.every((draw) => draw.view !== '3d'));
  } finally { h.controller.dispose(); }
});

test('a model update fences a pending lift and publishes its actual flat view', async () => {
  let release;
  const h = harness([() => new Promise((resolve) => { release = resolve; })]);
  try {
    const id = await h.ready();
    h.controller.markStale(); h.controller.setView('3d', id);
    const next = model(); next.caption = null;
    await h.controller.screenOverlay({ id, model: next });
    release('SLIDE'); await wait();
    assert.equal(h.controller.view, '2d');
    assert.deepEqual(h.results.at(-1), { id, shown: true, view: '2d' });
    assert.equal(h.draws.filter((draw) => draw.type === 'graph').at(-1).model.caption, null);
    assert.ok(h.draws.every((draw) => draw.view !== '3d'));
  } finally { h.controller.dispose(); }
});

test('a newer capture fences a pending lift from the old source', async () => {
  let release;
  const h = harness([() => new Promise((resolve) => { release = resolve; }), 'NEW', 'NEW']);
  try {
    const oldId = await h.ready();
    h.controller.markStale(); h.controller.setView('3d', oldId);
    const nextId = await h.ready();
    assert.notEqual(nextId, oldId);
    release('SLIDE'); await wait(150);
    assert.equal(h.controller.view, '2d');
    assert.equal(h.controller.hasDrawing(), true);
    assert.deepEqual(h.results.at(-1), { id: nextId, shown: true, view: '2d' });
    assert.ok(h.draws.every((draw) => draw.view !== '3d'));
  } finally { h.controller.dispose(); }
});

test('an update without checked lift data forces a lifted drawing back to 2D', async () => {
  const h = harness();
  try {
    const id = await h.ready(); h.controller.setView('3d', id);
    const next = model(); delete next.lift;
    await h.controller.screenOverlay({ id, model: next });
    assert.equal(h.controller.view, '2d');
    assert.equal(h.controller.liftable, false);
    assert.deepEqual(h.results.at(-1), { id, shown: true, view: '2d' });
    assert.equal(h.draws.at(-1).view, '2d');
  } finally { h.controller.dispose(); }
});

test('a changed drawing whose new sheet cannot be cut keeps its fallback notice', async () => {
  let crops = 0;
  const h = harness([], { cropImage: () => {
    if (++crops > 1) throw Error('Synthetic crop failure');
    return 'data:image/jpeg;base64,SHEET';
  } });
  try {
    const id = await h.ready(); h.controller.setView('3d', id);
    const next = model(); next.nodes[0].x = 0.02;
    await h.controller.screenOverlay({ id, model: next });
    assert.equal(h.controller.view, '2d');
    assert.equal(crops, 2);
    assert.deepEqual(h.results.at(-1), { id, shown: true, view: '2d', reason: 'sheet' });
    assert.equal(h.draws.at(-1).view, '2d');
  } finally { h.controller.dispose(); }
});

test('a small region revision gets its own sheet instead of a rounded cache collision', async () => {
  const regions = [];
  const h = harness([], { cropImage: (_data, region) => {
    regions.push(region);
    return 'data:image/jpeg;base64,SHEET';
  } });
  try {
    const id = await h.ready(); h.controller.setView('3d', id);
    const next = model(); next.nodes[0].x -= 1e-6;
    await h.controller.screenOverlay({ id, model: next });
    assert.equal(regions.length, 2);
    assert.notDeepEqual(regions[0], regions[1]);
    assert.deepEqual(regions[1], require('../screen-overlay.cjs').sheetRegion(next));
    assert.equal(h.controller.view, '3d');
  } finally { h.controller.dispose(); }
});
