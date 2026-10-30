const status = document.getElementById('status');
const surfaceButton = document.getElementById('surface');
function showSurface({ surface }) {
  const label = surface === 'workspace' ? 'Return to compact window' : 'Explore further in app';
  surfaceButton.setAttribute('aria-label', label); surfaceButton.title = label;
  surfaceButton.dataset.surface = surface;
}
window.somaControls.onStatus((message) => { status.textContent = message; });
window.somaControls.onSurface(showSurface);
async function action(name) {
  try { return await window.somaControls.action(name); }
  catch (error) { status.textContent = error.message || 'That action failed. Try again.'; }
}
for (const name of ['capture', 'surface', 'menu', 'hide']) {
  const button = document.getElementById(name);
  button.addEventListener('click', async () => {
    button.disabled = true;
    try { await action(name); } finally { button.disabled = false; }
  });
}
window.somaControls.onMenuAction((name) => { void action(name); });
window.somaControls.action('ready').then((state) => {
  showSurface(state);
  if (!state.shortcutOK) status.textContent = 'Shortcut unavailable. Use Capture above.';
}).catch(() => { status.textContent = 'Reopen Soma to restore native controls.'; });
