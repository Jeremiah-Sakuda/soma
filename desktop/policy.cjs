const PROD = 'https://soma-woad-beta.vercel.app';
function appOrigin(value, packaged) {
  if (!value) return PROD;
  const u = new URL(value);
  if (
    packaged ||
    u.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(u.hostname) ||
    u.username ||
    u.password
  )
    throw new Error('Only a local development server is supported.');
  return u.origin;
}
function trustedPage(url, origin) {
  try {
    const u = new URL(url);
    return u.origin === origin && (u.pathname === '/explore' || u.pathname.startsWith('/explore/'));
  } catch {
    return false;
  }
}
function safeExternal(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password;
  } catch {
    return false;
  }
}
function panelBounds(area) {
  const width = Math.min(620, area.width),
    height = Math.min(900, area.height);
  return { x: area.x + area.width - width, y: area.y, width, height };
}
function captureSource(sources, displayId) {
  // Never silently substitute a different display: it could contain private material.
  return sources.find((s) => s.display_id === String(displayId));
}
module.exports = { appOrigin, trustedPage, safeExternal, panelBounds, captureSource };
