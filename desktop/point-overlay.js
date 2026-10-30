const svg = document.querySelector('svg'),
  pointer = document.getElementById('pointer'),
  trail = document.getElementById('trail'),
  selection = document.getElementById('selection'),
  hint = document.getElementById('hint');
window.somaPointOverlay.onDraw((event) => {
  hint.textContent = event.text;
  document.getElementById('source-annotations')?.remove();
  if (event.type === 'annotations') {
    pointer.style.display = 'none';
    selection.style.display = 'none';
    trail.setAttribute('d', '');
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.id = 'source-annotations';
    for (const a of event.anchors) {
      const r = a.region,
        rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', r.x * innerWidth);
      rect.setAttribute('y', r.y * innerHeight);
      rect.setAttribute('width', r.width * innerWidth);
      rect.setAttribute('height', r.height * innerHeight);
      rect.setAttribute('class', 'source-reference');
      group.appendChild(rect);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', Math.max(8, r.x * innerWidth));
      label.setAttribute('y', Math.max(22, r.y * innerHeight - 8));
      label.textContent = a.label;
      group.appendChild(label);
    }
    svg.appendChild(group);
    hint.style.left = '12px';
    hint.style.top = '12px';
  } else if (event.type === 'tracking') {
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
