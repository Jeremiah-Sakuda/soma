const $ = (id) => document.getElementById(id);
let current = null;
const outcomeText = {
  'value-confirmed': 'value read back and confirmed',
  'press-accepted': 'press accepted; verify the app result',
  'key-accepted': 'key accepted; verify the app result',
  failed: 'not confirmed; check the app',
};
function describe(step) {
  if (step.kind === 'type') return `Replace field “${step.label}”`;
  if (step.kind === 'key') return `Send key ${step.label} to the app`;
  return `Press “${step.label}”`;
}
function stepItem(step, index, run) {
  const item = document.createElement('li');
  const title = document.createElement('strong');
  title.textContent = describe(step);
  item.append(title);
  if (step.kind === 'type') {
    const text = document.createElement('div');
    text.textContent = `Exact replacement: ${step.text}`;
    item.append(text);
  }
  const effect = document.createElement('div');
  effect.textContent = `Effect: ${step.effect}`;
  item.append(effect);
  if (step.consequential) {
    const flag = document.createElement('div');
    flag.className = 'flag';
    flag.textContent = 'Needs its own approval when reached';
    item.append(flag);
  }
  let status = '';
  if (run) {
    if (run.results[index]) status = outcomeText[run.results[index]];
    else if (run.stopped?.step === index) status = `Stopped: ${run.stopped.reason}`;
    else if (run.awaiting === index) status = 'Waiting for your approval';
    else if (!run.done && run.index === index) status = 'Running…';
    else if (run.done) status = 'Not run';
  }
  if (status) {
    const s = document.createElement('div');
    s.className = 'step-status';
    s.textContent = status;
    item.append(s);
  }
  return item;
}
window.somaComputer.onState((state) => {
  current = state;
  $('history').replaceChildren(
    ...(state.history || []).map((action) => {
      const item = document.createElement('li');
      item.textContent = `${describe(action)}${action.kind === 'type' ? ` with ${action.text}` : ''} · ${outcomeText[action.outcome]}`;
      return item;
    }),
  );
  $('app').textContent = state.app
    ? `Selected app: ${state.app} · ${state.steps}/5 steps used`
    : 'No active task. Focus the target app, then press ⌘⇧A.';
  $('controls').replaceChildren(
    ...state.controls.map((c) => {
      const item = document.createElement('li');
      item.textContent = `${c.id}: ${c.label} (${c.role})`;
      return item;
    }),
  );
  const run = state.run;
  const plan = run ? { reason: '', steps: run.steps } : state.plan;
  $('plan-section').hidden = !plan;
  if (state.plan && state.plan.kind !== 'plan')
    $('summary').textContent =
      state.plan.kind === 'done'
        ? `${state.plan.reason}\nMuse thinks this task is complete. Verify the result in the app.`
        : `${state.plan.reason}\nClarification needed. Rephrase the task.`;
  else if (state.plan) $('summary').textContent = state.plan.reason;
  $('steps').replaceChildren(...(plan?.steps || []).map((step, i) => stepItem(step, i, run)));
  $('approve-block').hidden = Boolean(run) || !state.plan || state.plan.kind !== 'plan';
  $('consent').checked = false;
  $('approve').disabled = true;
  const awaiting = run && !run.done && run.awaiting !== null;
  $('confirm-block').hidden = !awaiting;
  $('step-consent').checked = false;
  $('confirm-step').disabled = true;
  if (awaiting) {
    const step = run.steps[run.awaiting];
    $('confirm-text').textContent =
      `Step ${run.awaiting + 1} of ${run.total}: ${describe(step)}. ${step.effect}`;
  }
  $('capture').hidden = !state.canCapture;
  if (state.message) $('status').textContent = state.message;
  if (!state.app || (!state.steps && !state.plan && !state.run)) $('audit').textContent = '';
  if (state.audit)
    $('audit').textContent =
      `${state.audit.model} · ${state.audit.calls} call · $${state.audit.costUsd.toFixed(5)} · proposal only`;
});
$('consent').addEventListener('change', () => {
  $('approve').disabled = !$('consent').checked || !current?.plan || current.plan.kind !== 'plan';
});
$('step-consent').addEventListener('change', () => {
  $('confirm-step').disabled = !$('step-consent').checked;
});
const values = {
  plan: () => $('goal').value,
  approve: () => $('consent').checked,
  'confirm-step': () => ($('step-consent').checked ? current?.run?.awaiting : undefined),
};
for (const command of ['plan', 'approve', 'confirm-step', 'decline-step', 'capture', 'stop'])
  $(command).addEventListener('click', async () => {
    const button = $(command);
    button.disabled = true;
    try {
      await window.somaComputer.command(command, values[command]?.());
    } catch (error) {
      $('status').textContent = error.message;
    } finally {
      button.disabled = command === 'approve' || command === 'confirm-step';
    }
  });
window.somaComputer.command('ready');
