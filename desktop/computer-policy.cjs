const crypto = require('node:crypto');
const sensitive = /password|passcode|secret|token|credit.?card|card.?number|security.?code|verification.?code|one.?time|otp|ssn|social.?security/i;
function validateObservation(value) {
  if (!value || !Number.isInteger(value.pid) || value.pid < 1 || !/^[a-f0-9]{64}$/.test(value.fingerprint) || typeof value.app !== 'string' || value.app.length > 160 || !Array.isArray(value.controls) || value.controls.length > 80) throw Error('Invalid app observation.');
  if (value.controls.some((c, i) => c.id !== i || !['AXButton','AXCheckBox','AXRadioButton','AXTextField'].includes(c.role) || typeof c.label !== 'string' || !c.label || c.label.length > 120 || sensitive.test(c.label))) throw Error('Unsupported or sensitive controls.');
  return value;
}
function validateAction(plan, observation) {
  if (!plan || !['click','type','clarify'].includes(plan.kind) || typeof plan.reason !== 'string' || plan.reason.length > 400) throw Error('Invalid Muse action.');
  if (plan.kind === 'clarify') return plan;
  const target = observation.controls.find(c => c.id === plan.target);
  if (!target || sensitive.test(target.label)) throw Error('Unknown or sensitive target.');
  if (plan.kind === 'type' && (target.role !== 'AXTextField' || typeof plan.text !== 'string' || plan.text.length < 1 || plan.text.length > 500 || /[\x00-\x1f\x7f]/.test(plan.text))) throw Error('Unsupported typing action.');
  if (plan.kind === 'click' && target.role === 'AXTextField') throw Error('Unsupported click.');
  return {kind:plan.kind,target:plan.target,text:plan.kind === 'type' ? plan.text : '',reason:plan.reason};
}
function createTask(observation, now=Date.now()) { return {id:crypto.randomUUID(),observation:validateObservation(observation),expiresAt:now+120000,steps:0,plan:null}; }
function assertLive(task, now=Date.now()) { if (!task || now > task.expiresAt || task.steps >= 5) throw Error('Task expired. Select the app again.'); }
module.exports={validateObservation,validateAction,createTask,assertLive};
