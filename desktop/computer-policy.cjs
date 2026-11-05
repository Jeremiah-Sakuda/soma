const crypto = require('node:crypto');
const sensitive =
  /password|passcode|secret|token|credit.?card|card.?number|security.?code|verification.?code|one.?time|otp|ssn|social.?security|terminal|console|command|script|code|execute|compile|debug|(?:^|\s)run(?:$|\s)/i;
const forbiddenApp =
  /terminal|iterm|warp|script.?editor|automator|xcode|visual studio code|code runner/i;
// Mirrors src/lib/server/computer-actions.ts. A press matching this always pauses
// for its own approval at execution time, whatever the model reported.
const consequentialLabel =
  /send|submit|delete|remove|erase|trash|discard|don.?t.?save|replace|overwrite|clear|reset|empty|allow|accept|approve|install|quit|restart|shut.?down|revert|reply|forward|authori[sz]e|grant|agree|subscribe|sign.?in|log.?in|join|move.?to.?bin|comment|purchase|buy|pay|order|checkout|check.?out|place|transfer|post|publish|share|upload|confirm|sign.?out|log.?out|unsubscribe|cancel.?(?:subscription|account|order)|\b(?:save|ok|okay|yes|archive|block|leave|report|continue)\b/i;
const courseworkSubmit =
  /turn.?in|hand.?in|submit.?(?:assignment|homework|quiz|test|exam|attempt|answers?|work|essay|lab|project)|(?:assignment|homework|quiz|exam|attempt)\s+submi|^\s*submit\s*$/i;
// Navigation keys only; no modifiers, characters, Return, Tab, Escape or Space.
const KEYS = {
  right: 'Right Arrow',
  left: 'Left Arrow',
  up: 'Up Arrow',
  down: 'Down Arrow',
  page_down: 'Page Down',
  page_up: 'Page Up',
};
const MAX_STEPS = 5;
const TASK_MS = 120000;
function validateObservation(value) {
  if (
    !value ||
    !Number.isInteger(value.pid) ||
    value.pid < 1 ||
    !/^[a-f0-9]{64}$/.test(value.fingerprint) ||
    !/^[a-f0-9]{64}$/.test(value.window) ||
    typeof value.app !== 'string' ||
    value.app.length > 160 ||
    !Array.isArray(value.controls) ||
    value.controls.length > 80
  )
    throw Error('Invalid app observation.');
  if (forbiddenApp.test(`${value.app} ${value.bundle || ''}`))
    throw Error('Command and scripting apps are outside computer control.');
  if (
    value.controls.some(
      (c, i) =>
        c.id !== i ||
        !['AXButton', 'AXCheckBox', 'AXRadioButton', 'AXTextField'].includes(c.role) ||
        typeof c.label !== 'string' ||
        !c.label ||
        c.label.length > 120 ||
        sensitive.test(c.label),
    )
  )
    throw Error('Unsupported or sensitive controls.');
  return value;
}
function uniqueControl(observation, role, label) {
  const matches = observation.controls.filter((c) => c.role === role && c.label === label);
  return matches.length === 1 ? matches[0] : null;
}
function validateStep(step, observation) {
  if (
    !step ||
    !['click', 'type', 'key'].includes(step.kind) ||
    typeof step.effect !== 'string' ||
    !step.effect ||
    step.effect.length > 240 ||
    typeof step.consequential !== 'boolean'
  )
    throw Error('Invalid plan step.');
  if (step.kind === 'key') {
    if (step.target !== -1 || (step.text ?? '') !== '' || !Object.hasOwn(KEYS, step.key))
      throw Error('Only an allowlisted navigation key can be sent.');
    return {
      kind: 'key',
      target: -1,
      text: '',
      key: step.key,
      role: '',
      label: KEYS[step.key],
      effect: step.effect,
      consequential: step.consequential,
    };
  }
  if ((step.key ?? '') !== '') throw Error('Invalid plan step.');
  const target = observation.controls.find((c) => c.id === step.target);
  if (
    target &&
    observation.controls.filter((c) => c.role === target.role && c.label === target.label)
      .length !== 1
  )
    throw Error('Ambiguous duplicate control label. Use the app manually.');
  if (!target || sensitive.test(target.label)) throw Error('Unknown or sensitive target.');
  if (courseworkSubmit.test(target.label))
    throw Error('Soma never submits coursework. Do that yourself.');
  if (
    step.kind === 'type' &&
    (target.role !== 'AXTextField' ||
      typeof step.text !== 'string' ||
      step.text.length < 1 ||
      step.text.length > 500 ||
      /[\x00-\x1f\x7f]/.test(step.text) ||
      /(?:javascript|vbscript|data|file):/i.test(step.text))
  )
    throw Error('Unsupported typing action.');
  if (step.kind === 'click' && (target.role === 'AXTextField' || (step.text ?? '') !== ''))
    throw Error('Unsupported click.');
  return {
    kind: step.kind,
    target: step.target,
    text: step.kind === 'type' ? step.text : '',
    key: '',
    // The step is bound to the reviewed role and label, not to a numeric ID,
    // because IDs can shift after earlier steps change the window.
    role: target.role,
    label: target.label,
    effect: step.effect,
    consequential:
      step.consequential || (step.kind === 'click' && consequentialLabel.test(target.label)),
  };
}
/** Validates a Muse proposal against the observation the user is reviewing. */
function validatePlan(plan, observation, remaining = MAX_STEPS) {
  if (
    !plan ||
    !['plan', 'clarify', 'done'].includes(plan.kind) ||
    typeof plan.reason !== 'string' ||
    plan.reason.length > 400 ||
    !Array.isArray(plan.steps)
  )
    throw Error('Invalid Muse plan.');
  if (plan.kind !== 'plan') {
    if (plan.steps.length) throw Error('Invalid Muse plan.');
    return { kind: plan.kind, reason: plan.reason, steps: [] };
  }
  if (!plan.steps.length || plan.steps.length > Math.min(MAX_STEPS, remaining))
    throw Error(
      `Muse proposed ${plan.steps.length} steps; this task allows ${Math.min(MAX_STEPS, remaining)} more.`,
    );
  const steps = plan.steps.map((step) => validateStep(step, observation));
  const consequential = steps.flatMap((s, i) => (s.consequential ? [i] : []));
  if (consequential.length > 1 || (consequential.length && consequential[0] !== steps.length - 1))
    throw Error('A send, submit, delete or purchase step may only be the single final step.');
  return { kind: 'plan', reason: plan.reason, steps };
}
/**
 * Before each step: same process, same window identity, an unchanged state since
 * the last observation Soma made (approval-time for step 1, Soma's own post-step
 * observation afterwards) and a still-present, still-unique target control.
 * Returns the current control ID or a reason to stop the plan.
 */
function checkStep(step, previous, current) {
  if (current.pid !== previous.pid) return { ok: false, reason: 'a different app is now in front' };
  if (current.window !== previous.window) return { ok: false, reason: 'the target window changed' };
  if (current.fingerprint !== previous.fingerprint)
    return {
      ok: false,
      reason: "the app's controls, positions, field values or focus changed since Soma last looked",
    };
  if (step.kind === 'key') return { ok: true, target: -1 };
  const control = uniqueControl(current, step.role, step.label);
  if (!control)
    return {
      ok: false,
      reason: `the control “${step.label}” is no longer present or no longer unique`,
    };
  return { ok: true, target: control.id };
}
function createTask(observation, now = Date.now()) {
  return {
    id: crypto.randomUUID(),
    observation: validateObservation(observation),
    expiresAt: now + TASK_MS,
    steps: 0,
    plan: null,
    run: null,
    completed: false,
    history: [],
  };
}
function assertLive(task, now = Date.now()) {
  if (!task || now > task.expiresAt || task.steps >= MAX_STEPS)
    throw Error('Task expired. Select the app again.');
}
module.exports = {
  KEYS,
  consequentialLabel,
  MAX_STEPS,
  validateObservation,
  validatePlan,
  checkStep,
  createTask,
  assertLive,
};
