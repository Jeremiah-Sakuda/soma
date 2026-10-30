const svg = document.querySelector('svg'),
  pointer = document.getElementById('pointer'),
  trail = document.getElementById('trail'),
  selection = document.getElementById('selection'),
  hint = document.getElementById('hint');
window.somaPointOverlay.onDraw((event) => {
  hint.textContent = event.text;
  if (event.type === 'tracking') {
    pointer.style.display = '';
    selection.style.display = 'none';
    pointer.setAttribute('cx', event.x);
    pointer.setAttribute('cy', event.y);
    trail.setAttribute(
      'd',
      event.path.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '),
    );
    hint.style.left = Math.min(innerWidth - 270, Math.max(8, event.x + 22)) + 'px';
    hint.style.top = Math.min(innerHeight - 60, Math.max(8, event.y + 22)) + 'px';
  } else if (event.type === 'focus') {
    pointer.style.display = 'none';
    trail.setAttribute('d', '');
    selection.style.display = '';
    const r = event.region;
    selection.setAttribute('x', r.x * innerWidth);
    selection.setAttribute('y', r.y * innerHeight);
    selection.setAttribute('width', r.width * innerWidth);
    selection.setAttribute('height', r.height * innerHeight);
    hint.style.left = Math.min(innerWidth - 270, Math.max(8, r.x * innerWidth)) + 'px';
    hint.style.top = Math.max(8, r.y * innerHeight - 48) + 'px';
  }
});
