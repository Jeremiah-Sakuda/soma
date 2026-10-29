const {ipcRenderer} = require('electron');
function isExploration() {return location.pathname === '/explore' || location.pathname.startsWith('/explore/');}
ipcRenderer.on('desktop:pause', () => {
  if (!isExploration()) return;
  for (const button of document.querySelectorAll('button')) {
    if (button.textContent.trim() === 'Pause explanation' || button.textContent.trim() === 'Cancel request' || button.textContent.trim() === 'Cancel voice') button.click();
  }
});
ipcRenderer.on('desktop:snapshot', async (_event, snapshot) => {
  if (!isExploration()) return;
  try {
    const input = document.querySelector('input[type="file"][aria-label="Upload a PNG or JPEG screenshot"]');
    if (!input || input.disabled || typeof snapshot?.dataUrl !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(snapshot.dataUrl) || snapshot.dataUrl.length > 680000) throw new Error('Not ready');
    // Reuse the existing upload/change handler, including cancellation, preview and payload validation.
    const bytes = Uint8Array.from(atob(snapshot.dataUrl.split(',')[1]), c => c.charCodeAt(0));
    const transfer = new DataTransfer(); transfer.items.add(new File([bytes], 'Current display.jpg', {type:'image/jpeg'}));
    input.files = transfer.files; input.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelector('#exploration-question')?.focus();
    ipcRenderer.send('desktop:received',true);
  } catch {ipcRenderer.send('desktop:received',false);}
});
