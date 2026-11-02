const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { createPointAsk } = require('../point-ask.cjs');
const { validOverlayModel, overlayRegion, regionMatches } = require('../screen-overlay.cjs');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const LIFT = { lift: { directed: false, source: 'A', goal: 'F', maxDistance: 7, unit: 'cost' } };
const model = (extra = {}) => ({
  final: false,
  radius: 0.02,
  font: 0.017,
  tags: [{ id: 'settled-A', text: '1 · A = 0', tone: 'settled', x: 0.08, y: 0.4, anchor: { x: 0.1, y: 0.5 }, curved: false }],
  nodes: [
    { id: 'A', label: 'A', x: 0.1, y: 0.5, status: 'settled', distance: 0 },
    { id: 'F', label: 'F', x: 0.6, y: 0.5, status: 'current', distance: 7 },
  ],
  edges: [
    { id: 'AF', label: 'Cut connection A–F, cost 11', from: { x: 0.12, y: 0.5 }, control: { x: 0.35, y: 0.3 }, to: { x: 0.58, y: 0.5 }, center: { x: 0.35, y: 0.4 }, tone: 'path' },
  ],
  weights: [],
  callouts: [],
  caption: { text: 'Checked route: A → F, cost 7.', stepLabel: 'Step 1 of 4', x: 0.1, y: 0.7, anchor: 'top', font: 0.015 },
  ...extra,
});

function harness(images, options = {}) {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.kill = () => {};
  const sent = [], windows = [], results = [], actions = [], draws = [];
  class Window {
    constructor() {
      this.webContents = { send: (_c, p) => draws.push(p), setWindowOpenHandler() {}, on() {} };
      windows.push(this);
    }
    setIgnoreMouseEvents(v, o) { this.clickThrough = v; this.forward = o?.forward === true; }
    setVisibleOnAllWorkspaces() {}
    loadFile() {}
    setBounds(b) { this.bounds = b; }
    showInactive() { this.visible = true; }
    hide() { this.visible = false; }
    setContentProtection(v) { this.protectedDuring = this.protectedDuring || v; }
    isDestroyed() { return false; }
    destroy() {}
  }
  const shortcuts = new Map(),
    display = { id: 1, bounds: { x: 0, y: 0, width: 1000, height: 800 }, workArea: { x: 0, y: 24, width: 1000, height: 776 } };
  let capture = 0;
  const controller = createPointAsk({
    BrowserWindow: Window,
    screen: { getCursorScreenPoint: () => ({ x: 500, y: 250 }), getDisplayNearestPoint: () => display },
    globalShortcut: { register: (k, v) => { shortcuts.set(k, v); return true; }, unregister: (k) => shortcuts.delete(k) },
    locked: { sandbox: true },
    helperPath: '/original-synthetic-helper',
    send: (e) => sent.push(e),
    status() {},
    hidePanel() {},
    showPanel() {},
    captureImage: async () => ({ dataUrl: images[Math.min(capture++, images.length - 1)], capturedAt: new Date().toISOString() }),
    available: () => true,
    spawnShortcut: () => child,
    platform: 'darwin',
    overlayResult: (p) => results.push(p),
    overlayAction: (p) => actions.push(p),
    compareRegion: (a, b) => a === b,
    ...options,
  });
  const event = (type) => child.stdout.write(JSON.stringify({ type }) + '\n');
  return {
    controller, sent, windows, results, actions, draws, shortcuts,
    async ready() {
      const on = controller.enable();
      child.stdout.write('{"type":"ready","available":true}\n');
      await on;
      event('pressed');
      event('released');
      await wait(170);
      const id = sent.find((e) => e.type === 'source').id;
      controller.feedback({ id, state: 'ready' });
      return id;
    },
  };
}

test('overlay models are bounded to normalized shapes and known statuses', () => {
  assert.equal(validOverlayModel(model()), true);
  assert.equal(validOverlayModel(model({ nodes: [] })), false);
  assert.equal(validOverlayModel(model({ radius: 2 })), false);
  assert.equal(validOverlayModel(model({ tags: [{ ...model().tags[0], tone: 'script' }] })), false);
  assert.equal(validOverlayModel(model({ edges: [{ ...model().edges[0], control: { x: 0.5, y: -0.4 } }] })), true);
  assert.equal(validOverlayModel(model({ caption: { ...model().caption, x: 4 } })), false);
  assert.equal(validOverlayModel({ ...model(), edges: [{ ...model().edges[0], tone: 'script' }] }), false);
  assert.equal(validOverlayModel(model({ callouts: [{ id: 'graph', label: 'Graph', x: 0.1, y: 0.2, width: 0.5, height: 0.4 }] })), true);
  assert.equal(validOverlayModel(model({ callouts: [{ id: 'graph', label: 'Graph', x: 0.9, y: 0.2, width: 0.5, height: 0.4 }] })), false);
  const r = overlayRegion(model());
  assert.ok(r.x < 0.1 && r.x + r.width > 0.6 && r.width <= 1);
});

test('region comparison ignores changes outside the graph and rejects changes inside it', () => {
  const pixels = (changeInside, changeOutside) => {
    const w = 10, h = 10, data = Buffer.alloc(w * h * 4, 200);
    if (changeInside) data.fill(0, (5 * w + 5) * 4, (5 * w + 6) * 4 - 1);
    if (changeOutside) data.fill(0, 0, 4 * w);
    return { getSize: () => ({ width: w, height: h }), crop: (rect) => ({ toBitmap: () => {
      const out = [];
      for (let y = rect.y; y < rect.y + rect.height; y++) out.push(data.subarray((y * w + rect.x) * 4, (y * w + rect.x + rect.width) * 4));
      return Buffer.concat(out);
    } }) };
  };
  const images = { original: pixels(false, false), clock: pixels(false, true), slide: pixels(true, false) };
  const fake = { createFromDataURL: (k) => images[k] };
  const region = { x: 0.4, y: 0.4, width: 0.3, height: 0.3 };
  assert.equal(regionMatches(fake, 'original', 'clock', region), true);
  assert.equal(regionMatches(fake, 'original', 'slide', region, 6), false);
});

test('the overlay is drawn only for the latest capture and only after its region still matches', async () => {
  const h = harness(['data:image/jpeg;base64,SLIDE', 'data:image/jpeg;base64,SLIDE']);
  try {
    const id = await h.ready();
    await h.controller.screenOverlay({ id: 'other', model: model() });
    assert.equal(h.draws.filter((d) => d.type === 'graph').length, 0);
    await h.controller.screenOverlay({ id, model: model() });
    assert.deepEqual(h.results.at(-1), { id, shown: true });
    assert.equal(h.draws.filter((d) => d.type === 'graph').length, 1);
    assert.equal(h.windows[0].forward, true);
    assert.ok(h.shortcuts.has('Escape'));
    await h.controller.screenOverlay({ id, model: model({ caption: null }) });
    assert.equal(h.draws.filter((d) => d.type === 'graph').length, 2);
    h.shortcuts.get('Escape')();
    assert.equal(h.draws.at(-1).type, 'graph-clear');
    assert.deepEqual(h.results.at(-1), { id, shown: false, dismissed: true });
    const drawn = h.draws.filter((d) => d.type === 'graph').length;
    await h.controller.screenOverlay({ id, model: model() });
    assert.equal(h.draws.filter((d) => d.type === 'graph').length, drawn, 'a dismissed capture stays down');
  } finally {
    h.controller.dispose();
  }
});

test('a changed screen gets no overlay, and clicks are accepted only from the overlay window', async () => {
  const changed = harness(['data:image/jpeg;base64,SLIDE', 'data:image/jpeg;base64,SCROLLED']);
  try {
    const id = await changed.ready();
    await changed.controller.screenOverlay({ id, model: model() });
    assert.deepEqual(changed.results.at(-1), { id, shown: false });
    assert.equal(changed.draws.filter((d) => d.type === 'graph').length, 0);
    const results = changed.results.length;
    await changed.controller.screenOverlay({ id, model: model() });
    assert.equal(changed.results.length, results, 'no repeated capture after a refusal');
  } finally {
    changed.controller.dispose();
  }
  const h = harness(['data:image/jpeg;base64,SLIDE', 'data:image/jpeg;base64,SLIDE']);
  try {
    const id = await h.ready();
    await h.controller.screenOverlay({ id, model: model() });
    const overlay = h.windows[0];
    h.controller.overlayToggle({ sender: {} }, 'AF');
    h.controller.overlayToggle({ sender: overlay.webContents }, 'ZZ');
    assert.equal(h.actions.length, 0);
    h.controller.overlayToggle({ sender: overlay.webContents }, 'AF');
    assert.deepEqual(h.actions, [{ id, type: 'toggle-edge', edgeId: 'AF' }]);
    h.controller.overlayHover({ sender: overlay.webContents }, true);
    assert.equal(overlay.clickThrough, false);
    h.controller.overlayHover({ sender: overlay.webContents }, false);
    assert.equal(overlay.clickThrough, true);
  } finally {
    h.controller.dispose();
  }
});

test('turning Point & ask off clears a drawn overlay', async () => {
  const h = harness(['data:image/jpeg;base64,SLIDE', 'data:image/jpeg;base64,SLIDE']);
  try {
    const id = await h.ready();
    await h.controller.screenOverlay({ id, model: model() });
    assert.equal(h.draws.filter((d) => d.type === 'graph').length, 1);
    h.controller.disable();
    assert.equal(h.draws.at(-1).type, 'graph-clear');
    await h.controller.screenOverlay({ id, model: model() });
    assert.equal(h.draws.filter((d) => d.type === 'graph').length, 1);
  } finally {
    h.controller.dispose();
  }
});

test('a new snapshot clears the drawing first, so Soma never photographs its own marks', async () => {
  const h = harness(['data:image/jpeg;base64,SLIDE', 'data:image/jpeg;base64,SLIDE']);
  try {
    const id = await h.ready();
    await h.controller.screenOverlay({ id, model: model() });
    assert.equal(h.windows[0].visible, true);
    h.controller.clearScreenOverlay();
    assert.equal(h.windows[0].visible, false);
    assert.equal(h.draws.at(-1).type, 'graph-clear');
    assert.deepEqual(h.results.at(-1), { id, shown: false, dismissed: true });
    const drawn = h.draws.filter((d) => d.type === 'graph').length;
    await h.controller.screenOverlay({ id, model: model() });
    assert.equal(h.draws.filter((d) => d.type === 'graph').length, drawn, 'the old capture cannot redraw');
  } finally {
    h.controller.dispose();
  }
});

test('after the learner uses another app, the next step re-checks the slide without hiding the drawing', async () => {
  const same = harness(['data:image/jpeg;base64,SLIDE', 'data:image/jpeg;base64,SLIDE', 'data:image/jpeg;base64,SLIDE']);
  try {
    const id = await same.ready();
    await same.controller.screenOverlay({ id, model: model() });
    same.controller.markStale();
    await same.controller.screenOverlay({ id, model: model({ caption: null }) });
    assert.equal(same.windows[0].protectedDuring, true, 'the overlay is left out of the check, not hidden');
    assert.equal(same.draws.filter((d) => d.type === 'graph').length, 2);
  } finally {
    same.controller.dispose();
  }
  const paged = harness(['data:image/jpeg;base64,SLIDE', 'data:image/jpeg;base64,SLIDE', 'data:image/jpeg;base64,NEXT']);
  try {
    const id = await paged.ready();
    await paged.controller.screenOverlay({ id, model: model() });
    paged.controller.markStale();
    await paged.controller.screenOverlay({ id, model: model({ caption: null }) });
    assert.deepEqual(paged.results.at(-1), { id, shown: false, reason: 'changed' });
    assert.equal(paged.draws.at(-1).type, 'graph-clear');
    assert.equal(paged.draws.filter((d) => d.type === 'graph').length, 1);
  } finally {
    paged.controller.dispose();
  }
});


test('a typed compact question sends one clean full-screen snapshot without opening the panel', async () => {
  const panel = [], excluded = [];
  const h = harness(['data:image/jpeg;base64,SLIDE', 'data:image/jpeg;base64,SLIDE'], {
    hidePanel: () => panel.push('hide'),
    showPanel: () => panel.push('show'),
    hideForHighlight: () => panel.push('hide-for-highlight'),
    excludePanel: async (fn) => {
      excluded.push('capture');
      return fn();
    },
  });
  try {
    const asking = h.controller.askTyped('  Why not the direct edge?  ');
    assert.equal(h.controller.compactActive(), true);
    assert.deepEqual(await h.controller.askTyped('A second question'), { ok: false, message: 'Muse is still working on your last question.' });
    const result = await asking;
    assert.deepEqual(result, { ok: true, message: 'Muse is reading your screen…' });
    const begin = h.sent.find((e) => e.type === 'begin');
    assert.equal(begin.text, 'Why not the direct edge?');
    const source = h.sent.find((e) => e.type === 'source');
    assert.deepEqual(source.focus, { kind: 'circle', region: { x: 0, y: 0, width: 1, height: 1 } });
    assert.equal(h.sent.at(-1).type, 'end');
    h.controller.feedback({ id: source.id, state: 'ready' });
    assert.equal(h.controller.compactActive(), false);
    assert.equal(h.controller.hasDrawing(), false);
    await h.controller.screenOverlay({ id: source.id, model: model() });
    assert.equal(h.controller.hasDrawing(), true);
    assert.deepEqual(h.results.at(-1), { id: source.id, shown: true });
    assert.deepEqual(panel, [], 'the panel is never hidden or reopened in compact mode');
    assert.equal(excluded.length, 2, 'the snapshot and its check both leave Soma out');
  } finally {
    h.controller.dispose();
  }
});

test('a typed question the page refuses leaves the reason to the page, and a hung capture times out', async () => {
  let release;
  const h = harness([], {
    captureImage: () => new Promise((resolve) => (release = resolve)),
  });
  try {
    const asking = h.controller.askTyped('What changes if A–F costs 6?');
    await wait(100);
    const begin = h.sent.find((e) => e.type === 'begin');
    // The page reports only the state; its error text reaches the bar through its own state.
    h.controller.feedback({ id: begin.id, state: 'error' });
    release({ dataUrl: 'data:image/jpeg;base64,SLIDE', capturedAt: new Date().toISOString() });
    assert.deepEqual(await asking, { ok: false, message: null });
    assert.equal(h.sent.some((e) => e.type === 'source'), false);
    assert.deepEqual(await h.controller.askTyped('   '), { ok: false, message: 'Type a question first.' });
  } finally {
    h.controller.dispose();
  }
});

test('a model that cannot be drawn is reported as such, not as a changed screen', async () => {
  const h = harness(['data:image/jpeg;base64,SLIDE', 'data:image/jpeg;base64,SLIDE']);
  try {
    const id = await h.ready();
    await h.controller.screenOverlay({ id, model: model({ nodes: [] }) });
    assert.deepEqual(h.results.at(-1), { id, shown: false, reason: 'invalid' });
    assert.equal(h.controller.hasDrawing(), false);
  } finally {
    h.controller.dispose();
  }
});

test('a verified drawing lifts into 3D with its own slide region as the sheet, once', async () => {
  const crops = [];
  const h = harness(['data:image/jpeg;base64,SLIDE', 'data:image/jpeg;base64,SLIDE'], {
    cropImage: (dataUrl, region) => {
      crops.push({ dataUrl, region });
      return 'data:image/jpeg;base64,SHEET';
    },
  });
  try {
    assert.equal(h.controller.setView('3d'), '2d', 'nothing drawn yet');
    const id = await h.ready();
    await h.controller.screenOverlay({ id, model: model() });
    assert.equal(h.controller.setView('3d'), '2d', 'a drawing without lift data stays flat');
    await h.controller.screenOverlay({ id, model: model(LIFT) });
    assert.equal(h.controller.setView('3d', 'another-capture'), '2d', 'only for the capture on screen');
    assert.equal(h.controller.setView('3d', id), '3d');
    const lifted = h.draws.at(-1);
    assert.equal(lifted.view, '3d');
    assert.equal(lifted.sheet.dataUrl, 'data:image/jpeg;base64,SHEET');
    assert.equal(crops[0].dataUrl, 'data:image/jpeg;base64,SLIDE', 'the sheet is cut from the learner’s own capture');
    assert.deepEqual(h.results.at(-1), { id, shown: true, view: '3d' });
    assert.equal(h.windows[0].clickThrough, true);
    assert.equal(h.windows[0].forward, false, 'a lifted drawing is not clickable');
    // The next step redraws in 3D with the same sheet (not cropped again), so a scene the
    // overlay had to rebuild still covers the slide.
    await h.controller.screenOverlay({ id, model: model({ ...LIFT, caption: null }) });
    assert.equal(h.draws.at(-1).view, '3d');
    assert.equal(h.draws.at(-1).sheet.dataUrl, 'data:image/jpeg;base64,SHEET');
    h.controller.overlayHover({ sender: h.windows[0].webContents }, true);
    assert.equal(h.windows[0].clickThrough, true, 'hovering cannot make the 3D drawing clickable');
    assert.equal(h.controller.setView('2d'), '3d', 'toggles in quick succession are ignored');
    await wait(360);
    assert.equal(h.controller.setView('2d'), '2d');
    assert.equal(h.draws.at(-1).view, '2d');
    assert.equal(h.windows[0].forward, true);
    await wait(360);
    assert.equal(h.controller.setView('3d'), '3d');
    assert.equal(crops.length, 1, 'the same capture is cropped once');
    // Escape clears the drawing and the next one starts flat.
    h.shortcuts.get('Escape')();
    assert.equal(h.controller.view, '2d');
  } finally {
    h.controller.dispose();
  }
});

test('without WebGL the drawing stays flat and says why', async () => {
  const h = harness(['data:image/jpeg;base64,SLIDE', 'data:image/jpeg;base64,SLIDE'], { cropImage: () => { throw Error('no image'); } });
  try {
    const id = await h.ready();
    await h.controller.screenOverlay({ id, model: model(LIFT) });
    // Without its own slide region nothing could honestly cover the original: stay flat.
    assert.equal(h.controller.setView('3d'), '2d', 'a failed crop does not lift');
    assert.deepEqual(h.results.at(-1), { id, shown: true, view: '2d', reason: 'sheet' });
    assert.ok(h.draws.every((d) => d.view !== '3d'));
  } finally {
    h.controller.dispose();
  }
});

test('a lift the overlay cannot draw falls back flat on both sides', async () => {
  const h = harness(['data:image/jpeg;base64,SLIDE', 'data:image/jpeg;base64,SLIDE'], { cropImage: () => 'data:image/jpeg;base64,SHEET' });
  try {
    const id = await h.ready();
    await h.controller.screenOverlay({ id, model: model(LIFT) });
    assert.equal(h.controller.setView('3d'), '3d');
    h.controller.liftFailed({ sender: {} });
    assert.equal(h.controller.view, '3d', 'only the overlay window can report a failure');
    h.controller.liftFailed({ sender: h.windows[0].webContents });
    assert.equal(h.controller.view, '2d');
    assert.equal(h.draws.at(-1).view, '2d', 'redrawn flat, so the overlay agrees');
    assert.deepEqual(h.results.at(-1), { id, shown: true, view: '2d', reason: 'webgl' });
  } finally {
    h.controller.dispose();
  }
});

test('while lifted, a slide changed underneath takes the drawing down within seconds', async () => {
  const regions = [];
  const h = harness(['data:image/jpeg;base64,SLIDE', 'data:image/jpeg;base64,SLIDE', 'data:image/jpeg;base64,SLIDE', 'data:image/jpeg;base64,BANNER', 'data:image/jpeg;base64,SLIDE', 'data:image/jpeg;base64,NEXT', 'data:image/jpeg;base64,NEXT'], {
    cropImage: () => 'data:image/jpeg;base64,SHEET',
    compareRegion: (a, b, region) => {
      regions.push(region);
      return a === b;
    },
  });
  try {
    const id = await h.ready();
    await h.controller.screenOverlay({ id, model: model(LIFT) });
    h.controller.setView('3d');
    regions.length = 0;
    // Checked even though no Soma window lost focus: scrolling a slide need not move it.
    await wait(5300);
    assert.equal(h.controller.view, '3d', 'the slide is unchanged, so the drawing stays');
    const { sheetRegion } = require('../screen-overlay.cjs');
    assert.deepEqual(regions[0], sheetRegion(model(LIFT)), 'the whole covered region is compared');
    // One differing check (a passing banner) is not enough to take it down.
    await wait(5300);
    assert.equal(h.controller.view, '3d', 'a single mismatch is tolerated');
    await wait(5300);
    assert.equal(h.controller.view, '3d');
    // A changed slide differs on two checks in a row.
    await wait(10600);
    assert.equal(h.controller.hasDrawing(), false);
    assert.equal(h.controller.view, '2d');
    assert.deepEqual(h.results.at(-1), { id, shown: false, reason: 'changed' });
  } finally {
    h.controller.dispose();
  }
});
