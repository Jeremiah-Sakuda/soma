const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { createPointAsk } = require('../point-ask.cjs');
const { validOverlayModel, overlayRegion, regionMatches } = require('../screen-overlay.cjs');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
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

function harness(images) {
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
