'use strict';
(async () => {
  const status = document.querySelector('#status');
  const canvas = document.querySelector('#screen');
  const tabs = document.querySelector('#tabs');
  const expiry = document.querySelector('#expiry');
  const retry = document.querySelector('#retry');
  let token = location.hash.slice(1);
  history.replaceState(null, '', location.pathname);
  let socket, generation = 0, busy = false, ready = false, ended = false;
  let deadline, retries = 0, retryTimer, connectTimer;
  const live = () => ready && socket?.readyState === WebSocket.OPEN;
  const send = data => { if (live()) socket.send(JSON.stringify(data)); };
  function disableInput() {
    ready = false;
    canvas.contentEditable = 'false';
    canvas.setAttribute('aria-disabled', 'true');
    canvas.blur();
  }
  function end(message) {
    ended = true; generation++; busy = false;
    clearTimeout(retryTimer); clearTimeout(connectTimer);
    disableInput(); socket?.close(); socket = undefined;
    canvas.getContext('2d').clearRect(0, 0, 1280, 800);
    retry.hidden = true; status.textContent = message;
  }
  const left = () => deadline === undefined ? undefined : Math.max(0, deadline - performance.now());
  function updateCountdown() {
    const remaining = left();
    if (remaining === undefined) return;
    const seconds = Math.ceil(remaining / 1000);
    expiry.textContent = `Sign-in time remaining: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    expiry.dataset.warning = String(seconds <= 120);
    if (!seconds && !ended) end('This sign-in session expired. Return to Soma and reconnect for a new session.');
  }

  // Intercept input before authentication starts. Login text must never enter the local DOM.
  const point = event => {
    const rect = canvas.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1280, (event.clientX - rect.left) * 1280 / rect.width)), y: Math.max(0, Math.min(800, (event.clientY - rect.top) * 800 / rect.height)) };
  };
  canvas.onmousedown = event => { event.preventDefault(); if (live()) { canvas.focus(); send({ type: 'mouse', event: 'mousePressed', ...point(event) }); } };
  canvas.onmouseup = event => send({ type: 'mouse', event: 'mouseReleased', ...point(event) });
  canvas.onmousemove = event => { if (event.buttons) send({ type: 'mouse', event: 'mouseMoved', ...point(event) }); };
  canvas.addEventListener('wheel', event => { event.preventDefault(); send({ type: 'wheel', deltaY: Math.max(-5000, Math.min(5000, event.deltaY)) }); }, { passive: false });
  const modifiers = event => (event.altKey ? 1 : 0) + (event.ctrlKey ? 2 : 0) + (event.metaKey ? 4 : 0) + (event.shiftKey ? 8 : 0);
  canvas.onkeydown = event => {
    if (event.key === 'Escape') { canvas.blur(); return; }
    if (!live()) { event.preventDefault(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') return;
    if (event.isComposing) return;
    event.preventDefault();
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) send({ type: 'text', text: event.key });
    else send({ type: 'key', event: 'keyDown', key: event.key, code: event.code, keyCode: event.keyCode, modifiers: modifiers(event) });
  };
  canvas.onkeyup = event => {
    if (event.key !== 'Escape') { event.preventDefault(); if (!event.isComposing) send({ type: 'key', event: 'keyUp', key: event.key, code: event.code, keyCode: event.keyCode, modifiers: modifiers(event) }); }
  };
  canvas.onpaste = event => {
    event.preventDefault();
    if (!live()) return;
    const text = event.clipboardData?.getData('text') ?? '';
    if (text.length <= 4096) send({ type: 'text', text });
  };
  canvas.onbeforeinput = event => event.preventDefault();
  canvas.oncompositionend = event => { if (typeof event.data === 'string' && event.data.length <= 4096) send({ type: 'text', text: event.data }); };
  disableInput();

  function recover() {
    if (ended) return;
    disableInput(); updateCountdown();
    if (ended) return;
    if (retries >= 5) {
      retry.hidden = false;
      status.textContent = 'The viewer connection was interrupted. Retry connection to resume the same browser, or return to Soma.';
      return;
    }
    retries++;
    status.textContent = `Connection interrupted. Reconnecting (${retries} of 5)…`;
    retryTimer = setTimeout(() => void connect(), Math.min(8000, 1000 * 2 ** (retries - 1)));
  }
  async function connect(entryToken) {
    if (ended || busy) return;
    busy = true; const current = ++generation;
    clearTimeout(retryTimer); disableInput(); retry.hidden = true;
    const began = performance.now();
    try {
      const response = await fetch(location.pathname + (entryToken ? '/bootstrap' : '/resume'), {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entryToken ? { token: entryToken } : {}), signal: AbortSignal.timeout(10000),
      });
      if (current !== generation || ended) return;
      if ([401, 403, 404].includes(response.status)) {
        end(entryToken ? 'This sign-in link expired or was already opened. Return to Soma and reconnect.' : 'This browser is no longer available here. Return to Soma to reconnect.'); return;
      }
      if (!response.ok) throw new Error('Viewer unavailable.');
      const data = await response.json();
      if (current !== generation || ended) return;
      if (!Number.isFinite(data.remainingMs) || data.remainingMs < 0 || data.remainingMs > 1800000) throw new Error('Invalid viewer timing.');
      // Subtract the whole request duration; resuming can never extend the local deadline.
      const next = performance.now() + Math.max(0, data.remainingMs - (performance.now() - began));
      deadline = deadline === undefined ? next : Math.min(deadline, next);
      updateCountdown(); if (ended) return;
      const candidate = new WebSocket(location.origin.replace(/^http/, 'ws') + location.pathname + '/socket');
      socket = candidate;
      connectTimer = setTimeout(() => { if (current === generation && candidate.readyState !== WebSocket.OPEN) candidate.close(); }, 10000);
      candidate.onopen = () => {
        if (current !== generation || ended) { candidate.close(); return; }
        clearTimeout(connectTimer); busy = false; ready = true;
        canvas.contentEditable = 'true'; canvas.setAttribute('aria-disabled', 'false');
        status.textContent = 'Connected. Complete sign-in below, then return to Soma.';
      };
      candidate.onclose = () => {
        if (current !== generation || ended) return;
        clearTimeout(connectTimer); busy = false; socket = undefined; recover();
      };
      candidate.onerror = () => {}; // Close handles one bounded recovery, never a second retry loop.
      candidate.onmessage = event => {
        if (current !== generation || !live()) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'frame') {
            const image = new Image();
            image.onload = () => { if (current === generation && live()) canvas.getContext('2d').drawImage(image, 0, 0, 1280, 800); };
            image.src = 'data:image/jpeg;base64,' + data.data;
          }
          if (data.type === 'tabs') {
            const selected = tabs.value, next = data.pages.map(p => p.id + ':' + p.origin).join('|');
            if (tabs.dataset.content !== next) {
              tabs.replaceChildren(...data.pages.map(page => { const option = document.createElement('option'); option.value = page.id; option.textContent = page.origin; return option; }));
              if (data.pages.some(p => p.id === selected)) tabs.value = selected;
              tabs.dataset.content = next;
            }
          }
        } catch { candidate.close(1008); }
      };
    } catch {
      if (current !== generation || ended) return;
      busy = false; recover();
    }
  }
  tabs.onchange = () => send({ type: 'select', id: tabs.value });
  retry.onclick = () => { if (!ended && !busy) { retries = 0; void connect(); } };
  setInterval(updateCountdown, 1000);
  document.addEventListener('visibilitychange', updateCountdown);
  const firstToken = token; token = '';
  await connect(firstToken);
})();
