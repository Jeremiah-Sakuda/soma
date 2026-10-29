const status = document.getElementById('status');
window.somaControls.onStatus(message => {status.textContent = message;});
for (const action of ['capture','pin','hide','reload','permission']) {
  const button = document.getElementById(action);
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const result = await window.somaControls.action(action === 'permission' ? 'settings' : action);
      if (action === 'pin') {button.setAttribute('aria-pressed',String(result));button.textContent = result ? 'Pinned' : 'Pin';}
    } catch {status.textContent = 'That action failed. Try again or reopen Soma.';}
    finally {button.disabled = false;}
  });
}
window.somaControls.action('ready').then(({shortcutOK}) => {
  if (!shortcutOK) status.textContent = 'Shortcut unavailable. Use Capture display, or close the app using that shortcut and reopen Soma.';
});
