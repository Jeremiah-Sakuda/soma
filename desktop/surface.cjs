// Pure window transitions: never navigate or replace the remote WebContents.
function validSurface(value) { return value === 'companion' || value === 'workspace'; }
function fitBounds(bounds, area) {
  const width = Math.min(bounds.width, area.width), height = Math.min(bounds.height, area.height);
  return { width, height, x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)) };
}
function createSurfaceController(win, workArea, notify) {
  let surface = 'companion', compactBounds = win.getBounds(), compactPinned = win.isAlwaysOnTop();
  const state = () => ({ surface, pinned: win.isAlwaysOnTop() });
  return {
    state,
    set(next) {
      if (!validSurface(next)) throw new Error('Unknown Soma surface.');
      if (next === surface) return state();
      const area = workArea();
      if (next === 'workspace') {
        compactBounds = win.getBounds(); compactPinned = win.isAlwaysOnTop();
        const width = Math.min(1180, area.width), height = Math.min(860, area.height);
        win.setAlwaysOnTop(false);
        win.setBounds({ x: area.x + Math.round((area.width - width) / 2),
          y: area.y + Math.round((area.height - height) / 2), width, height });
      } else {
        win.setBounds(fitBounds(compactBounds, area));
        win.setAlwaysOnTop(compactPinned);
      }
      surface = next; notify(state()); return state();
    },
    togglePin() { win.setAlwaysOnTop(!win.isAlwaysOnTop()); notify(state()); return state(); },
  };
}
module.exports = { validSurface, fitBounds, createSurfaceController };
