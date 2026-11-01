const status = document.getElementById('status');
window.somaControls.onStatus((message) => {
  status.textContent = message;
});
for (const action of ['point', 'capture', 'compact', 'pin', 'hide', 'reload', 'permission']) {
  const button = document.getElementById(action);
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const result = await window.somaControls.action(
        action === 'permission' ? 'settings' : action,
      );
      if (action === 'point') {
        button.setAttribute('aria-pressed', String(result.enabled));
        button.textContent = result.enabled ? 'Point & ask on' : 'Point & ask';
      }
      if (action === 'pin') {
        button.setAttribute('aria-pressed', String(result));
        button.textContent = result ? 'Pinned' : 'Pin';
      }
    } catch (error) {
      status.textContent = error.message || 'That action failed. Try again or reopen Soma.';
    } finally {
      button.disabled = false;
    }
  });
}
window.somaControls.action('ready').then(({ shortcutOK }) => {
  if (!shortcutOK)
    status.textContent =
      'Shortcut unavailable. Use Capture display, or close the app using that shortcut and reopen Soma.';
});

window.somaControls.onPointEnabled?.((enabled) => {
  const b = document.getElementById('point');
  b.setAttribute('aria-pressed', String(enabled));
  b.textContent = enabled ? 'Point & ask on' : 'Point & ask';
});
