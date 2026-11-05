const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createComputerControl } = require('../computer-control.cjs');
const controls = () => [
  { id: 0, role: 'AXTextField', label: 'Font size' },
  { id: 1, role: 'AXButton', label: 'Apply' },
  { id: 2, role: 'AXButton', label: 'Send to class' },
];
const type = {
  kind: 'type',
  target: 0,
  text: '18',
  key: '',
  effect: 'Set the font size to 18',
  consequential: false,
};
const apply = {
  kind: 'click',
  target: 1,
  text: '',
  key: '',
  effect: 'Apply the size',
  consequential: false,
};
const send = {
  kind: 'click',
  target: 2,
  text: '',
  key: '',
  effect: 'Send the document to the class',
  consequential: false,
};
const next = {
  kind: 'key',
  target: -1,
  text: '',
  key: 'right',
  effect: 'Show the next slide',
  consequential: false,
};
const tick = () => new Promise((r) => setImmediate(r));
// Synthetic app: every executed step changes the app state (fingerprint), as a real app would.
function harness({ steps = [type, apply], app = {} } = {}) {
  let win,
    handler,
    fetches = 0,
    version = 0,
    window = 'c'.repeat(64),
    list = controls(),
    gate = null,
    resolveRequest,
    captures = 0,
    hidden = false;
  const calls = [],
    shortcuts = new Map();
  const fp = () => String(version).padStart(64, '0');
  class Window extends EventEmitter {
    constructor() {
      super();
      win = this;
      this.webContents = new EventEmitter();
      this.webContents.mainFrame = { url: '' };
      this.webContents.setWindowOpenHandler = () => {};
      this.webContents.send = (_name, state) => {
        this.state = state;
      };
    }
    isDestroyed() {
      return false;
    }
    async loadURL(url) {
      this.webContents.mainFrame.url = url;
    }
    show() {
      hidden = false;
    }
    focus() {}
    hide() {
      hidden = true;
    }
    destroy() {
      this.emit('closed');
    }
  }
  const native = async (input) => {
    calls.push(input);
    if (input.command === 'execute') {
      if (gate) await gate;
      version++;
      app.onExecute?.(input, { setControls: (c) => (list = c) });
      if (app.fail) throw Error(app.fail);
      return input.kind === 'type'
        ? { executed: true, valueConfirmed: true }
        : input.kind === 'key'
          ? { executed: true, keyPosted: true }
          : { executed: true, valueConfirmed: false };
    }
    app.onObserve?.({
      bump: () => version++,
      setWindow: (w) => (window = w),
      count: calls.filter((c) => c.command === 'observe').length,
    });
    return {
      pid: 42,
      app: 'Original settings',
      window,
      fingerprint: fp(),
      controls: list.map((c, id) => ({ ...c, id })),
    };
  };
  const controller = createComputerControl({
    BrowserWindow: Window,
    ipcMain: { handle: (_name, fn) => (handler = fn), removeHandler() {} },
    globalShortcut: {
      register: (key, fn) => {
        shortcuts.set(key, fn);
        return true;
      },
      unregister: (key) => shortcuts.delete(key),
    },
    session: {
      fetch: async (_url, init) => {
        fetches++;
        h.lastBody = JSON.parse(init.body);
        if (resolveRequest === null)
          await new Promise((resolve) => {
            resolveRequest = resolve;
          });
        return Response.json({
          plan: { kind: 'plan', reason: 'Synthetic plan', steps },
          audit: { calls: 1 },
        });
      },
    },
    origin: 'https://soma.example',
    helperPath: 'unused',
    native,
    stopPoint() {},
    status() {},
    capture: async () => {
      captures++;
    },
    settleMs: 0,
  });
  const command = (name, value) =>
    handler({ sender: win.webContents, senderFrame: win.webContents.mainFrame }, name, value);
  const h = {
    controller,
    command,
    calls,
    shortcuts,
    executes: () => calls.filter((c) => c.command === 'execute'),
    get state() {
      return win.state;
    },
    get fetches() {
      return fetches;
    },
    get captures() {
      return captures;
    },
    get hidden() {
      return hidden;
    },
    pause() {
      resolveRequest = null;
    },
    resolve() {
      resolveRequest?.();
    },
    hold() {
      let open;
      gate = new Promise((r) => (open = r));
      return () => {
        gate = null;
        open();
      };
    },
    untrusted: (name = 'approve', value = true) =>
      handler({ sender: {}, senderFrame: {} }, name, value),
  };
  return h;
}
test('remote content cannot invoke local control; the stored reviewed plan is the only executable plan', async () => {
  const h = harness();
  await h.controller.start();
  await assert.rejects(h.untrusted(), /Untrusted/);
  await assert.rejects(h.untrusted('capture'), /Untrusted/);
  await h.command('plan', 'Set size to 18 and apply');
  assert.equal(h.lastBody.maxSteps, 5);
  assert.equal(h.state.plan.steps.length, 2);
  await h.command('approve', { kind: 'plan', steps: [send] });
  assert.equal(h.executes().length, 0);
  await h.command('plan', 'Set size to 18 and apply');
  await h.command('approve', true);
  assert.deepEqual(
    h.executes().map(({ command, kind, target, role, label, text, key }) => ({
      command,
      kind,
      target,
      role,
      label,
      text,
      key,
    })),
    [
      {
        command: 'execute',
        kind: 'type',
        target: 0,
        role: 'AXTextField',
        label: 'Font size',
        text: '18',
        key: '',
      },
      {
        command: 'execute',
        kind: 'click',
        target: 1,
        role: 'AXButton',
        label: 'Apply',
        text: '',
        key: '',
      },
    ],
  );
  assert.deepEqual(h.state.run.results, ['value-confirmed', 'press-accepted']);
  assert.equal(h.state.run.done, true);
  assert.equal(h.state.plan, null);
  assert.equal(h.state.steps, 2);
  assert.match(h.state.message, /does not prove/);
  await h.command('approve', true);
  assert.equal(h.executes().length, 2);
  h.controller.dispose();
});
test('every step re-observes the selected app with activation before acting', async () => {
  const h = harness();
  await h.controller.start();
  await h.command('plan', 'x');
  await h.command('approve', true);
  const seq = h.calls.slice(1).map((c) => c.command + (c.activate ? '+activate' : ''));
  assert.deepEqual(seq, [
    'observe+activate',
    'execute',
    'observe',
    'observe+activate',
    'execute',
    'observe',
  ]);
  for (const e of h.executes()) assert.equal(e.pid, 42);
  h.controller.dispose();
});
test('a change before the first step fences the whole plan before any side effect', async () => {
  const h = harness({
    app: {
      onObserve: ({ bump, count }) => {
        if (count === 2) bump();
      },
    },
  });
  await h.controller.start();
  await h.command('plan', 'x');
  await h.command('approve', true);
  assert.equal(h.executes().length, 0);
  assert.equal(h.state.run.stopped.step, 0);
  assert.match(h.state.message, /Stopped before step 1 of 2.*changed/);
  h.controller.dispose();
});
test('an outside change between steps stops the plan and names the step', async () => {
  let observes = 0;
  const h = harness({
    app: {
      onObserve: ({ bump }) => {
        observes++;
        if (observes === 4) bump();
      },
    },
  });
  await h.controller.start();
  await h.command('plan', 'x');
  await h.command('approve', true);
  assert.equal(h.executes().length, 1);
  assert.deepEqual(h.state.run.stopped.step, 1);
  assert.match(h.state.message, /Stopped before step 2 of 2.*Steps 1–1 ran/);
  assert.equal(h.state.steps, 1);
  assert.equal(h.state.canCapture, false);
  h.controller.dispose();
});
test('a different focused window stops the plan', async () => {
  let observes = 0;
  const h = harness({
    app: {
      onObserve: ({ setWindow }) => {
        observes++;
        if (observes === 4) setWindow('d'.repeat(64));
      },
    },
  });
  await h.controller.start();
  await h.command('plan', 'x');
  await h.command('approve', true);
  assert.equal(h.executes().length, 1);
  assert.match(h.state.message, /target window changed/);
  h.controller.dispose();
});
test('later steps re-resolve their reviewed control and stop if it disappeared', async () => {
  const shifted = harness({
    app: {
      onExecute: (_i, { setControls }) =>
        setControls([{ role: 'AXButton', label: 'Undo' }, ...controls()]),
    },
  });
  await shifted.controller.start();
  await shifted.command('plan', 'x');
  await shifted.command('approve', true);
  assert.deepEqual(
    shifted.executes().map((e) => e.target),
    [0, 2],
  );
  assert.equal(shifted.executes()[1].label, 'Apply');
  shifted.controller.dispose();
  const gone = harness({
    app: { onExecute: (_i, { setControls }) => setControls([controls()[0]]) },
  });
  await gone.controller.start();
  await gone.command('plan', 'x');
  await gone.command('approve', true);
  assert.equal(gone.executes().length, 1);
  assert.match(gone.state.message, /“Apply” is no longer present/);
  gone.controller.dispose();
});
test('a send step pauses for its own exact approval even inside an approved plan', async () => {
  const h = harness({ steps: [type, send] });
  await h.controller.start();
  await h.command('plan', 'x');
  assert.equal(h.state.plan.steps[1].consequential, true);
  await h.command('approve', true);
  assert.equal(h.executes().length, 1);
  assert.equal(h.state.run.awaiting, 1);
  assert.equal(h.hidden, false);
  await h.command('confirm-step', true);
  assert.equal(h.executes().length, 1);
  assert.equal(h.state.run.done, true);
  assert.match(h.state.message, /exact step/);
  await h.command('confirm-step', 1);
  assert.equal(h.executes().length, 1);
  const ok = harness({ steps: [type, send] });
  await ok.controller.start();
  await ok.command('plan', 'x');
  await ok.command('approve', true);
  await ok.command('confirm-step', 1);
  assert.equal(ok.executes().length, 2);
  assert.equal(ok.state.run.done, true);
  ok.controller.dispose();
  const no = harness({ steps: [type, send] });
  await no.controller.start();
  await no.command('plan', 'x');
  await no.command('approve', true);
  await no.command('decline-step');
  assert.equal(no.executes().length, 1);
  assert.match(no.state.message, /not run/);
  assert.equal(no.state.canCapture, false);
  no.controller.dispose();
  h.controller.dispose();
});
test('navigation key steps go to the selected app only and report acceptance, not completion', async () => {
  const h = harness({ steps: [next] });
  await h.controller.start();
  await h.command('plan', 'Go to the next slide');
  await h.command('approve', true);
  const [e] = h.executes();
  assert.deepEqual(
    { kind: e.kind, key: e.key, target: e.target, pid: e.pid, text: e.text },
    { kind: 'key', key: 'right', target: -1, pid: 42, text: '' },
  );
  assert.deepEqual(h.state.history, [
    { kind: 'key', label: 'Right Arrow', text: '', outcome: 'key-accepted' },
  ]);
  await h.command('plan', 'again');
  assert.deepEqual(h.lastBody.history, [
    { kind: 'key', label: 'Right Arrow', text: '', outcome: 'key-accepted' },
  ]);
  assert.equal(h.lastBody.maxSteps, 4);
  h.controller.dispose();
});
test('Escape during a step stops all pending work and later steps never run', async () => {
  const h = harness();
  await h.controller.start();
  await h.command('plan', 'x');
  const release = h.hold();
  const running = h.command('approve', true);
  for (let i = 0; i < 5; i++) await tick();
  h.shortcuts.get('Escape')();
  release();
  await running;
  assert.equal(h.executes().length, 1);
  assert.match(h.state.message, /0 of 2 plan steps had run; a step in progress may already/);
  await assert.rejects(h.command('approve', true), /expired/);
  h.controller.dispose();
});
test('a native failure stops the plan honestly', async () => {
  const h = harness({ app: { fail: 'value_not_confirmed' } });
  await h.controller.start();
  await h.command('plan', 'x');
  await h.command('approve', true);
  assert.equal(h.executes().length, 1);
  assert.match(h.state.message, /Step 1 of 2 stopped: the field did not read back the exact value/);
  assert.deepEqual(h.state.run.results, ['failed']);
  assert.deepEqual(h.state.history, []);
  h.controller.dispose();
});
test('capture is offered only after a completed plan and ends computer authority first', async () => {
  const h = harness();
  await h.controller.start();
  await assert.rejects(h.command('capture'), /completed plan/);
  await h.command('plan', 'x');
  await assert.rejects(h.command('capture'), /completed plan/);
  await h.command('approve', true);
  assert.equal(h.state.canCapture, true);
  await h.command('capture');
  assert.equal(h.captures, 1);
  assert.equal(h.hidden, true);
  assert.equal(h.state.app, '');
  assert.equal(h.shortcuts.has('Escape'), false);
  await assert.rejects(h.command('capture'), /completed plan/);
  h.controller.dispose();
});
test('plans larger than the remaining task actions are rejected before approval', async () => {
  const h = harness({ steps: [next, next, next, next, next, next] });
  await h.controller.start();
  await h.command('plan', 'x');
  assert.equal(h.state.plan, null);
  assert.match(h.state.message, /allows 5/);
  h.controller.dispose();
});
test('Escape revokes pending proposals even if provider ignores abort', async () => {
  const h = harness();
  await h.controller.start();
  h.pause();
  const pending = h.command('plan', 'Set size');
  await tick();
  h.shortcuts.get('Escape')();
  h.resolve();
  await pending;
  assert.equal(h.state.plan, null);
  assert.equal(h.executes().length, 0);
  await assert.rejects(h.command('approve', true), /expired/);
  h.controller.dispose();
});
test('Escape while a send step awaits approval ends the task without running it', async () => {
  const h = harness({ steps: [type, send] });
  await h.controller.start();
  await h.command('plan', 'x');
  await h.command('approve', true);
  assert.equal(h.state.run.awaiting, 1);
  h.shortcuts.get('Escape')();
  assert.match(
    h.state.message,
    /1 of 2 plan steps had run; the step waiting for approval was not run/,
  );
  await assert.rejects(h.command('confirm-step', 1), /expired/);
  assert.equal(h.executes().length, 1);
  h.controller.dispose();
});
test('stopping with no task leaves an Escape another feature registered', async () => {
  const h = harness();
  const drawn = () => {};
  h.shortcuts.set('Escape', drawn);
  h.controller.stop('Computer task ended.');
  assert.equal(h.shortcuts.get('Escape'), drawn);
  h.shortcuts.delete('Escape');
  await h.controller.start();
  assert.equal(typeof h.shortcuts.get('Escape'), 'function');
  h.controller.stop();
  assert.equal(h.shortcuts.has('Escape'), false);
  h.controller.dispose();
});
