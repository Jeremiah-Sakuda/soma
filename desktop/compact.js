const form = document.getElementById('bar'),
  input = document.getElementById('question'),
  status = document.getElementById('status'),
  fresh = document.getElementById('fresh'),
  test = document.getElementById('test'),
  steps = document.getElementById('steps'),
  step = document.getElementById('step'),
  play = document.getElementById('play'),
  previous = document.getElementById('previous'),
  next = document.getElementById('next');
let state = { visual: false, busy: false, investigable: false, step: null, steps: null, playing: false };
const say = (message) => {
  if (message) status.textContent = message;
};
function render() {
  document.body.classList.toggle('busy', state.busy);
  const hasSteps = state.visual && Number.isInteger(state.steps) && state.steps > 0;
  steps.hidden = !hasSteps;
  if (hasSteps) step.textContent = `${state.step} / ${state.steps}`;
  previous.disabled = !hasSteps || state.busy || state.step <= 0;
  next.disabled = !hasSteps || state.busy || state.step >= state.steps;
  play.textContent = state.playing ? '❚❚' : '▶';
  play.setAttribute('aria-label', state.playing ? 'Pause the explanation' : 'Play the explanation');
  test.hidden = !state.investigable;
  test.disabled = state.busy;
  // With nothing drawn yet, every question needs a snapshot.
  fresh.hidden = !state.visual;
  input.placeholder = state.visual && fresh.getAttribute('aria-pressed') !== 'true'
    ? 'Ask a follow-up, or “What if…”'
    : 'Ask about your screen…';
}
async function send(mode) {
  const text = input.value.trim();
  if (!text && mode !== 'investigate') return;
  const snapshot = !state.visual || fresh.getAttribute('aria-pressed') === 'true';
  try {
    const result = await window.somaCompact.ask(text, mode === 'investigate' ? 'investigate' : snapshot ? 'snapshot' : 'followup');
    if (result?.ok !== false) {
      input.value = '';
      fresh.setAttribute('aria-pressed', 'false');
    }
    say(result?.message);
  } catch (error) {
    say(error.message || 'Soma could not take that question.');
  }
  render();
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  void send('ask');
});
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.metaKey) {
    event.preventDefault();
    void send('investigate');
  } else if (event.key === 'Escape') {
    event.preventDefault();
    void window.somaCompact.control('hide');
  } else if (event.key.toLowerCase() === 'n' && event.metaKey) {
    event.preventDefault();
    fresh.setAttribute('aria-pressed', String(fresh.getAttribute('aria-pressed') !== 'true'));
    render();
  }
});
test.addEventListener('click', () => void send('investigate'));
fresh.addEventListener('click', () => {
  fresh.setAttribute('aria-pressed', String(fresh.getAttribute('aria-pressed') !== 'true'));
  render();
  input.focus();
});
for (const [id, action] of [['previous', 'previous'], ['next', 'next'], ['play', 'play'], ['expand', 'expand']])
  document.getElementById(id).addEventListener('click', () => void window.somaCompact.control(action));
window.somaCompact.onStatus(say);
window.somaCompact.onState((next) => {
  state = { ...state, ...next };
  if (next.message) say(next.message);
  render();
});
window.somaCompact.onFocus(() => {
  input.focus();
  input.select();
});
render();
input.focus();
