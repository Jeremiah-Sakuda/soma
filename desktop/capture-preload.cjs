const { ipcRenderer } = require('electron');
function isExploration() {
  return location.pathname === '/explore' || location.pathname.startsWith('/explore/');
}
ipcRenderer.on('desktop:pause', () => {
  if (!isExploration()) return;
  for (const button of document.querySelectorAll('button')) {
    if (
      button.textContent.trim() === 'Pause explanation' ||
      button.textContent.trim() === 'Cancel request' ||
      button.textContent.trim() === 'Cancel voice'
    )
      button.click();
  }
});
ipcRenderer.on('desktop:snapshot', async (_event, snapshot) => {
  if (!isExploration()) return;
  try {
    const input = document.querySelector(
      'input[type="file"][aria-label="Upload a PNG or JPEG screenshot"]',
    );
    if (
      !input ||
      input.disabled ||
      typeof snapshot?.dataUrl !== 'string' ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(snapshot.dataUrl) ||
      snapshot.dataUrl.length > 680000
    )
      throw new Error('Not ready');
    // Reuse the existing upload/change handler, including cancellation, preview and payload validation.
    const bytes = Uint8Array.from(atob(snapshot.dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], 'Current display.jpg', { type: 'image/jpeg' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#exploration-question')?.focus();
    ipcRenderer.send('desktop:received', true);
  } catch {
    ipcRenderer.send('desktop:received', false);
  }
});
// One-way native context delivery; outbound acknowledgements are bound to the
// current native interaction. No screen-capture API is exposed to remote code.
let pointInteraction = null;
ipcRenderer.on('desktop:point-ask', (_event, payload) => {
  if (
    !isExploration() ||
    !payload ||
    typeof payload.id !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(payload.id)
  )
    return;
  if (payload.type === 'begin') pointInteraction = payload.id;
  if (
    payload.id !== pointInteraction ||
    !['begin', 'end', 'source', 'cancel'].includes(payload.type)
  )
    return;
  if (
    payload.type === 'source' &&
    (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(payload.dataUrl) ||
      payload.dataUrl.length > 680000)
  )
    return;
  window.dispatchEvent(new CustomEvent('soma:point-ask', { detail: payload }));
  if (payload.type === 'cancel') pointInteraction = null;
});
window.addEventListener('soma:point-feedback', (event) => {
  const payload = event.detail;
  if (
    !isExploration() ||
    !payload ||
    payload.id !== pointInteraction ||
    ![
      'recording',
      'transcribing',
      'generating',
      'ready',
      'error',
      'cancelled',
      'partial',
    ].includes(payload.state)
  )
    return;
  ipcRenderer.send('desktop:point-feedback', {
    id: pointInteraction,
    state: payload.state,
    ...(payload.state === 'partial' && typeof payload.text === 'string'
      ? { text: payload.text.slice(0, 240) }
      : {}),
  });
  if (['ready', 'error', 'cancelled'].includes(payload.state)) pointInteraction = null;
});

let sourceInteraction = null;
ipcRenderer.on('desktop:point-ask', (_event, payload) => {
  if (isExploration() && payload?.type === 'source' && payload.id === pointInteraction)
    sourceInteraction = payload.id;
});
window.addEventListener('soma:source-highlight', (event) => {
  const d = event.detail;
  if (
    isExploration() &&
    d?.id === sourceInteraction &&
    Array.isArray(d.anchors) &&
    d.anchors.length <= 6
  )
    ipcRenderer.send('desktop:source-highlight', { id: d.id, anchors: d.anchors });
});
ipcRenderer.on('desktop:source-highlight-result', (_event, d) => {
  if (isExploration() && d?.id === sourceInteraction)
    window.dispatchEvent(
      new CustomEvent('soma:source-highlight-result', {
        detail: { id: d.id, shown: d.shown === true },
      }),
    );
});

// Layout-only bridge. The main process rechecks origin, top frame and sender.
// It cannot capture, navigate, run code or create another privileged window.
function publishSurface(state) {
  if (isExploration() && ['companion', 'workspace'].includes(state?.surface))
    window.dispatchEvent(new CustomEvent('soma:surface', { detail: { surface: state.surface } }));
}
ipcRenderer.on('desktop:surface', (_event, state) => publishSurface(state));
function syncSurface() {
  if (isExploration()) ipcRenderer.invoke('desktop:surface').then(publishSurface).catch(() => {});
}
window.addEventListener('DOMContentLoaded', syncSurface);
// React installs its listener after DOMContentLoaded; request current state on mount.
window.addEventListener('soma:surface-ready', syncSurface);
window.addEventListener('soma:surface-request', (event) => {
  const next = event.detail?.surface;
  if (isExploration() && ['companion', 'workspace'].includes(next))
    ipcRenderer.invoke('desktop:surface', next).then(publishSurface).catch(() => {});
});
