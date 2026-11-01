const form = document.getElementById('bar'),
  input = document.getElementById('question'),
  status = document.getElementById('status'),
  fresh = document.getElementById('fresh'),
  test = document.getElementById('test'),
  steps = document.getElementById('steps'),
  step = document.getElementById('step'),
  play = document.getElementById('play'),
  previous = document.getElementById('previous'),
  next = document.getElementById('next'),
  lift = document.getElementById('lift');
const IDLE = 'Return sends one snapshot of this screen with your question. Esc hides the bar.';
// `step` is the zero-based index of the shown step; `steps` is how many there are.
let state = { visual: false, busy: false, investigable: false, step: null, steps: null, playing: false, message: '', view: '2d' };
let sending = false,
  // A follow-up's text stays in the box until the page takes it, in case it is refused.
  handedOver = null;
const WORKING = /^Muse is (answering|choosing what to test)/;
const say = (message) => {
  status.textContent = message || '';
};
const freshPressed = () => fresh.getAttribute('aria-pressed') === 'true';
const busy = () => sending || state.busy;
function render() {
  document.body.classList.toggle('busy', busy());
  form.setAttribute('aria-busy', String(busy()));
  const hasSteps = state.visual && Number.isInteger(state.steps) && state.steps > 1 && Number.isInteger(state.step);
  steps.hidden = !hasSteps;
  if (hasSteps) {
    step.textContent = `${state.step + 1} / ${state.steps}`;
    step.setAttribute('aria-label', `Step ${state.step + 1} of ${state.steps}`);
  }
  // Like the panel, stepping waits for playback to pause.
  previous.disabled = !hasSteps || busy() || state.playing || state.step <= 0;
  next.disabled = !hasSteps || busy() || state.playing || state.step >= state.steps - 1;
  play.disabled = !hasSteps || busy();
  play.textContent = state.playing ? '❚❚' : '▶';
  play.setAttribute('aria-label', state.playing ? 'Pause the explanation' : 'Play the explanation');
  lift.hidden = !state.visual;
  lift.setAttribute('aria-pressed', String(state.view === '3d'));
  lift.textContent = state.view === '3d' ? 'Flat' : '3D';
  test.hidden = !(state.visual && state.investigable);
  test.disabled = busy();
  // With nothing drawn, every question needs a snapshot.
  fresh.hidden = !state.visual;
  if (!state.visual) fresh.setAttribute('aria-pressed', 'false');
  input.placeholder = state.visual && !freshPressed() ? 'Ask a follow-up, or “What if…”' : 'Ask about your screen…';
}
async function send(mode) {
  const text = input.value.trim();
  if (mode === 'investigate' && (!state.visual || !state.investigable)) return;
  if (!text && mode !== 'investigate') {
    say('Type a question first.');
    return;
  }
  if (busy()) {
    say('Muse is still working on your last question.');
    return;
  }
  const kind = mode === 'investigate' ? 'investigate' : !state.visual || freshPressed() ? 'snapshot' : 'followup';
  sending = true;
  render();
  say(kind === 'snapshot' ? 'Taking one snapshot of this screen…' : kind === 'investigate' ? 'Muse is choosing what to test…' : 'Muse is answering…');
  try {
    const result = await window.somaCompact.ask(text, kind);
    if (result?.ok) {
      if (kind === 'snapshot') input.value = '';
      else handedOver = text;
      fresh.setAttribute('aria-pressed', 'false');
    }
    say(result?.message);
  } catch {
    say('Soma could not take that question. Try again.');
  } finally {
    sending = false;
    render();
  }
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  void send('ask');
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.metaKey) {
    event.preventDefault();
    void send('investigate');
  } else if (event.key === 'Escape') {
    // While a drawing is up, the first Escape clears it (handled natively); this one hides.
    event.preventDefault();
    void window.somaCompact.control('hide');
  } else if (event.key.toLowerCase() === 'l' && event.metaKey && state.visual) {
    event.preventDefault();
    void window.somaCompact.control('lift');
  } else if (event.key.toLowerCase() === 'n' && event.metaKey && state.visual) {
    event.preventDefault();
    fresh.setAttribute('aria-pressed', String(!freshPressed()));
    render();
  }
});
test.addEventListener('click', () => void send('investigate'));
fresh.addEventListener('click', () => {
  fresh.setAttribute('aria-pressed', String(!freshPressed()));
  render();
  input.focus();
});
for (const [id, action] of [['previous', 'previous'], ['next', 'next'], ['play', 'play'], ['expand', 'expand'], ['lift', 'lift']])
  document.getElementById(id).addEventListener('click', () => void window.somaCompact.control(action));
window.somaCompact.onStatus((message) => {
  if (message) say(message);
});
window.somaCompact.onState((incoming) => {
  const was = state;
  state = { ...state, ...incoming };
  if (state.pageBusy && handedOver !== null) {
    if (input.value.trim() === handedOver) input.value = '';
    handedOver = null;
  }
  // Report the page's error once, when it appears. When work ends cleanly, replace a
  // "working" line with what to do next.
  if (state.message && state.message !== was.message) {
    handedOver = null;
    say(state.message);
  } else if (was.busy && !state.busy && !state.message && !sending) {
    if (state.visual) say(`On your screen. Ask a follow-up${state.investigable ? ', ⌘↩ tests it' : ''}, Esc clears.`);
    else if (WORKING.test(status.textContent) || !status.textContent) say(IDLE);
  }
  render();
});
window.somaCompact.onFocus(() => {
  input.focus();
  input.select();
  if (!busy() && !state.visual && !status.textContent) say(IDLE);
});
say(IDLE);
render();
input.focus();
