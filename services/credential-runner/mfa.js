'use strict';
(() => {
  let socket;
  const canvas = document.querySelector('#screen'),
    context = canvas.getContext('2d');
  window.stopSomaMfa = () => {
    socket?.close();
    socket = null;
  };
  window.startSomaMfa = (base) => {
    if (socket) return;
    socket = new WebSocket(location.origin.replace(/^http/, 'ws') + base + '/socket');
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'frame') {
        const image = new Image();
        image.onload = () => context.drawImage(image, 0, 0, 1280, 800);
        image.src = 'data:image/jpeg;base64,' + data.data;
      }
    };
    socket.onclose = () => {
      document.querySelector('#status').textContent =
        'Remote window disconnected. Return to Soma if sign-in is incomplete.';
      socket = null;
    };
  };
  const send = (data) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data));
  };
  for (const [name, type] of [
    ['pointerdown', 'mousePressed'],
    ['pointerup', 'mouseReleased'],
    ['pointermove', 'mouseMoved'],
  ])
    canvas.addEventListener(name, (event) => {
      const box = canvas.getBoundingClientRect();
      if (name === 'pointerdown') canvas.focus();
      send({
        type: 'mouse',
        event: type,
        x: ((event.clientX - box.left) * 1280) / box.width,
        y: ((event.clientY - box.top) * 800) / box.height,
      });
    });
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      send({ type: 'wheel', deltaY: Math.max(-5000, Math.min(5000, event.deltaY)) });
    },
    { passive: false },
  );
  for (const name of ['keydown', 'keyup'])
    canvas.addEventListener(name, (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (name === 'keydown') document.querySelector('#release').focus();
        return;
      }
      if (event.key === 'Tab' && event.shiftKey) return;
      event.preventDefault();
      if (name === 'keydown' && event.key.length === 1 && !event.ctrlKey && !event.metaKey)
        send({ type: 'text', text: event.key });
      else
        send({
          type: 'key',
          event: name === 'keydown' ? 'keyDown' : 'keyUp',
          key: event.key,
          code: event.code,
          keyCode: event.keyCode,
          modifiers:
            (event.altKey ? 1 : 0) |
            (event.ctrlKey ? 2 : 0) |
            (event.metaKey ? 4 : 0) |
            (event.shiftKey ? 8 : 0),
        });
    });
  canvas.addEventListener('paste', (event) => {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain');
    if (text && text.length <= 4096) send({ type: 'text', text });
  });
})();
