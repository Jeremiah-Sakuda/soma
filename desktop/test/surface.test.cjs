const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSurfaceController, fitBounds } = require('../surface.cjs');
test('expand preserves compact position, dimensions and pin; repeated requests are idempotent', () => {
  let bounds = { x: 860, y: 45, width: 500, height: 610 }, pinned = false, writes = 0;
  const original = { ...bounds }, events = [];
  const win = { getBounds: () => ({ ...bounds }), isAlwaysOnTop: () => pinned,
    setBounds: value => { bounds = value; writes++; }, setAlwaysOnTop: value => { pinned = value; } };
  const c = createSurfaceController(win, () => ({ x: 0, y: 25, width: 1440, height: 900 }), s => events.push(s));
  assert.deepEqual(c.set('workspace'), { surface: 'workspace', pinned: false });
  assert.equal(bounds.width, 1180);
  c.set('workspace'); assert.equal(writes, 1);
  c.togglePin(); assert.equal(pinned, true);
  c.set('companion'); assert.deepEqual(bounds, original); assert.equal(pinned, false);
  assert.equal(events.length, 3);
  assert.throws(() => c.set('https://evil.test'), /Unknown/);
  assert.deepEqual(bounds, original);
});
test('return fits saved bounds after a display is removed or resized, including negative origins', () => {
  assert.deepEqual(fitBounds({ x: 1900, y: 900, width: 540, height: 650 },
    { x: -1280, y: 30, width: 1280, height: 720 }), { x: -540, y: 100, width: 540, height: 650 });
  assert.deepEqual(fitBounds({ x: -1000, y: -500, width: 540, height: 650 },
    { x: 0, y: 0, width: 400, height: 500 }), { x: 0, y: 0, width: 400, height: 500 });
});
