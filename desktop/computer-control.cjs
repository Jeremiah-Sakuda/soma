const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFile } = require('node:child_process');
const {
  createTask,
  assertLive,
  validateObservation,
  validatePlan,
  checkStep,
  MAX_STEPS,
} = require('./computer-policy.cjs');
function createComputerControl({
  BrowserWindow,
  ipcMain,
  globalShortcut,
  session,
  origin,
  helperPath,
  stopPoint,
  status,
  accessibility = () => true,
  native,
  capture,
  settleMs = 500,
}) {
  const url = pathToFileURL(path.join(__dirname, 'computer-control.html')).href;
  let window,
    task,
    controller,
    child,
    busy = false,
    epoch = 0;
  function state(extra = {}) {
    if (window && !window.isDestroyed())
      window.webContents.send('computer:state', {
        app: task?.observation.app || '',
        controls: task?.observation.controls || [],
        plan: task?.plan || null,
        run: task?.run
          ? {
              total: task.run.plan.steps.length,
              index: task.run.index,
              results: task.run.results,
              awaiting: task.run.awaiting,
              stopped: task.run.stopped,
              done: task.run.done,
              steps: task.run.plan.steps,
            }
          : null,
        canCapture: Boolean(capture && task?.completed && task.run?.done),
        steps: task?.steps || 0,
        history: task?.history || [],
        ...extra,
      });
  }
  let ownsEscape = false;
  function stop(message = 'Computer task stopped.') {
    const run = task?.run;
    if (message && run && !run.done)
      message +=
        run.awaiting !== null
          ? ` ${run.index} of ${run.plan.steps.length} plan steps had run; the step waiting for approval was not run.`
          : ` ${run.index} of ${run.plan.steps.length} plan steps had run; a step in progress may already have been accepted by macOS.`;
    epoch++;
    controller?.abort();
    child?.kill();
    task = null;
    busy = false;
    // Only release Escape if this task took it; a drawn overlay may own it otherwise.
    if (ownsEscape) globalShortcut.unregister('Escape');
    ownsEscape = false;
    state({ message });
    status(message);
  }
  function helper(input) {
    if (native) return native(input);
    return new Promise((resolve, reject) => {
      const process = execFile(
        helperPath,
        [],
        { timeout: 5000, maxBuffer: 40000, encoding: 'utf8' },
        (error, out) => {
          if (child === process) child = null;
          try {
            const value = JSON.parse(out);
            if (error || value.error) reject(Error(value.error || 'Native action failed.'));
            else resolve(value);
          } catch {
            reject(
              Error('Native helper unavailable. Build Soma and grant Accessibility permission.'),
            );
          }
        },
      );
      child = process;
      child.stdin.end(JSON.stringify(input));
    });
  }
  function trusted(event) {
    return (
      window &&
      !window.isDestroyed() &&
      event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame &&
      event.senderFrame.url === url
    );
  }
  async function start() {
    if (busy) return;
    stop('');
    stopPoint();
    busy = true;
    const ticket = epoch;
    try {
      if (!accessibility())
        throw Error(
          'Allow Soma in System Settings → Privacy & Security → Accessibility, then try again.',
        );
      const observed = await helper({ command: 'observe' });
      if (ticket !== epoch) return;
      task = createTask(observed);
      if (!globalShortcut.register('Escape', () => stop()))
        throw Error('Escape unavailable; task control cannot start.');
      ownsEscape = true;
      if (!window || window.isDestroyed()) {
        window = new BrowserWindow({
          width: 600,
          height: 700,
          minWidth: 440,
          minHeight: 500,
          title: 'Soma · Apply to selected app',
          alwaysOnTop: true,
          webPreferences: {
            preload: path.join(__dirname, 'computer-preload.cjs'),
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
          },
        });
        // Stay reachable above a full-screen app (for example a Preview slideshow).
        window.setVisibleOnAllWorkspaces?.(true, { visibleOnFullScreen: true });
        window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        window.webContents.on('will-navigate', (e) => e.preventDefault());
        window.webContents.on('will-attach-webview', (e) => e.preventDefault());
        window.on('closed', () => stop());
        await window.loadURL(url);
      }
      if (ticket !== epoch) return;
      window.show();
      window.focus();
      state({
        message:
          'Review the selected app and controls. Nothing has been sent to Muse. Each task lasts two minutes and allows at most five executed steps.',
      });
    } catch (error) {
      stop(error.message);
    } finally {
      if (ticket === epoch) busy = false;
    }
  }
  const helperMessages = {
    screen_changed: 'the app changed just before the step',
    focus_changed: 'a different app came to the front',
    app_closed: 'the app closed',
    ambiguous_target: 'the target control became ambiguous',
    target_changed: 'the target control changed',
    field_not_editable: 'the field is not editable',
    value_not_confirmed: 'the field did not read back the exact value',
    modifier_keys_held: 'a modifier key (Command, Shift, Option or Control) was held down',
    invalid_key: 'the key is not an allowed navigation key',
    action_failed: 'macOS did not accept the action',
  };
  const outcomeOf = (step, result) =>
    step.kind === 'type'
      ? result.valueConfirmed === true
        ? 'value-confirmed'
        : null
      : step.kind === 'key'
        ? result.keyPosted === true
          ? 'key-accepted'
          : null
        : result.executed === true
          ? 'press-accepted'
          : null;
  function finish(active, message) {
    active.run.done = true;
    active.plan = null;
    window?.show();
    window?.focus();
    state({ message });
  }
  // Executes the approved plan from run.index. Returns early (busy released) when a
  // consequential step needs its own approval. Every await rechecks the epoch so
  // Escape, window close or capture revoke pending work.
  async function runPlan(active, ticket) {
    const run = active.run;
    const total = run.plan.steps.length;
    while (run.index < total) {
      const i = run.index,
        step = run.plan.steps[i];
      if (step.consequential && run.confirmed !== i) {
        run.awaiting = i;
        window?.show();
        window?.focus();
        state({
          message: `Paused before step ${i + 1} of ${total}. It may send, submit, delete or purchase, so it needs its own approval.`,
        });
        return;
      }
      run.awaiting = null;
      assertLive(active);
      state({
        message: `Running step ${i + 1} of ${total}. Escape stops pending work.`,
      });
      window?.hide();
      const current = validateObservation(
        await helper({
          command: 'observe',
          pid: active.observation.pid,
          activate: active.observation.pid,
        }),
      );
      if (ticket !== epoch) return;
      assertLive(active);
      const check = checkStep(step, active.observation, current);
      if (!check.ok) {
        run.stopped = { step: i, reason: check.reason };
        return finish(
          active,
          `Stopped before step ${i + 1} of ${total}: ${check.reason}. ${i ? `Steps 1–${i} ran; ` : ''}nothing else was attempted. Review the app and ask for a new plan if needed.`,
        );
      }
      let result;
      try {
        result = await helper({
          command: 'execute',
          pid: current.pid,
          fingerprint: current.fingerprint,
          kind: step.kind,
          target: check.target,
          role: step.role,
          label: step.kind === 'key' ? '' : step.label,
          text: step.text,
          key: step.key,
        });
      } catch (error) {
        if (ticket !== epoch) return;
        const reason = helperMessages[error.message] || error.message;
        // An attempted step counts against the task bound even if it failed.
        active.steps++;
        run.stopped = { step: i, reason };
        // A failure can follow a partly accepted step; never claim nothing happened.
        run.results[i] = 'failed';
        try {
          active.observation = validateObservation(
            await helper({ command: 'observe', pid: current.pid }),
          );
        } catch {
          /* keep the last observation; the next plan step is not attempted */
        }
        if (ticket !== epoch) return;
        return finish(
          active,
          `Step ${i + 1} of ${total} stopped: ${reason}. Check the app; remaining steps were not attempted.`,
        );
      }
      if (ticket !== epoch) return;
      const outcome = outcomeOf(step, result);
      active.steps++;
      run.results[i] = outcome || 'failed';
      if (outcome)
        active.history.push({
          kind: step.kind,
          label: step.label,
          text: step.text,
          outcome,
        });
      run.index++;
      // Let the app settle so the next comparison is against its resulting state.
      if (settleMs) await new Promise((r) => setTimeout(r, settleMs));
      if (ticket !== epoch) return;
      const after = validateObservation(await helper({ command: 'observe', pid: current.pid }));
      if (ticket !== epoch) return;
      active.observation = after;
      if (!outcome) {
        run.stopped = {
          step: i,
          reason: 'the native result was not confirmed',
        };
        return finish(
          active,
          `Step ${i + 1} of ${total}: the native result was not confirmed. Remaining steps were not attempted.`,
        );
      }
    }
    active.completed = true;
    finish(
      active,
      'All approved steps ran. Typed values were read back; presses and keys were only accepted by macOS, which does not prove the app finished. Verify the result in the app.',
    );
  }
  ipcMain.handle('computer:command', async (event, command, value) => {
    if (!trusted(event)) throw Error('Untrusted computer control.');
    if (command === 'stop') {
      stop();
      return;
    }
    if (command === 'ready') {
      state();
      return;
    }
    if (busy) throw Error('Wait for the current step or stop.');
    if (command === 'capture') {
      // Offered only after a completed plan. Reuses the existing single-snapshot
      // capture path, which ends computer-control authority before capturing.
      if (!capture || !task?.completed || !task.run?.done)
        throw Error('Capture is offered after a completed plan.');
      window?.hide();
      stop('Computer task ended. Capturing this display in Soma for review.');
      await capture();
      return;
    }
    assertLive(task);
    busy = true;
    const ticket = epoch;
    const active = task;
    try {
      if (command === 'plan') {
        if (typeof value !== 'string' || !value.trim() || value.length > 1000)
          throw Error('Enter a task of at most 1,000 characters.');
        if (active.run && !active.run.done)
          throw Error('Finish or decline the pending step first.');
        active.plan = null;
        active.run = null;
        active.completed = false;
        state({
          message: 'Muse is proposing a short plan. No control is active.',
        });
        controller = new AbortController();
        const response = await session.fetch(`${origin}/api/explore/computer`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Origin: origin },
          body: JSON.stringify({
            goal: value.trim(),
            app: active.observation.app,
            controls: active.observation.controls,
            history: active.history,
            maxSteps: MAX_STEPS - active.steps,
          }),
          signal: controller.signal,
          redirect: 'error',
        });
        const text = await response.text();
        if (text.length > 20000) throw Error('Plan response too large.');
        const body = JSON.parse(text);
        if (ticket !== epoch) return;
        if (!response.ok) throw Error(body.error || 'Open Soma first to initialize your session.');
        assertLive(active);
        active.plan = validatePlan(body.plan, active.observation, MAX_STEPS - active.steps);
        state({
          message:
            active.plan.kind === 'plan'
              ? 'Review every step of Muse’s plan before approving it.'
              : 'Muse did not propose steps.',
          audit: body.audit,
        });
      } else if (command === 'approve') {
        if (value !== true) throw Error('Explicit approval is required.');
        if (!active.plan || active.plan.kind !== 'plan' || active.run)
          throw Error('Request a plan first.');
        // The stored, reviewed plan is the only executable plan; the renderer
        // supplies only a boolean. Revalidate against the reviewed observation.
        const plan = validatePlan(active.plan, active.observation, MAX_STEPS - active.steps);
        active.run = {
          plan,
          index: 0,
          results: [],
          awaiting: null,
          confirmed: null,
          stopped: null,
          done: false,
        };
        await runPlan(active, ticket);
      } else if (command === 'confirm-step' || command === 'decline-step') {
        const run = active.run;
        if (!run || run.done || run.awaiting === null)
          throw Error('No step is waiting for approval.');
        if (command === 'decline-step') {
          run.stopped = { step: run.awaiting, reason: 'you declined it' };
          finish(
            active,
            `Step ${run.awaiting + 1} was not run. The rest of the plan was discarded.`,
          );
        } else {
          if (value !== run.awaiting) throw Error('Approve the exact step that is waiting.');
          run.confirmed = run.awaiting;
          await runPlan(active, ticket);
        }
      } else throw Error('Unknown action.');
    } catch (error) {
      if (ticket === epoch) {
        let message = helperMessages[error.message] || error.message;
        const run = active.run;
        if (run && !run.done) {
          run.stopped = { step: run.index, reason: message };
          run.done = true;
          message = `Stopped at step ${run.index + 1} of ${run.plan.steps.length}: ${message} Remaining steps were not attempted.`;
        }
        active.plan = null;
        window?.show();
        window?.focus();
        state({ message });
      }
    } finally {
      if (ticket === epoch) busy = false;
    }
  });
  globalShortcut.register('CommandOrControl+Shift+A', () => void start());
  return {
    start,
    stop,
    dispose() {
      stop();
      window?.destroy();
      globalShortcut.unregister('CommandOrControl+Shift+A');
      ipcMain.removeHandler('computer:command');
    },
  };
}
module.exports = { createComputerControl };
