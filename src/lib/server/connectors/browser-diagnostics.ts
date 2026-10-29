const phases = [
  'request', 'workspace-read', 'session-read', 'session-allocation', 'playwright-import', 'cdp-connect',
  'policy-install', 'page-init', 'source-read', 'source-publication', 'browser-close',
  'session-release', 'lease-persist', 'source-collection', 'preparation-handoff',
] as const;
export type BrowserReadPhase = typeof phases[number];
const errorTypes = new Set(['Error', 'TypeError', 'ReferenceError', 'TimeoutError']);

/** Fixed operational facts only. Provider exceptions can contain credentials and private text. */
export function logBrowserReadFailure(phase: BrowserReadPhase, error: unknown): void {
  let errorType = 'unknown';
  try {
    if (error instanceof Error) {
      const name = error.name;
      if (errorTypes.has(name)) errorType = name;
    }
  } catch { /* An exception's name can itself be an unsafe getter. */ }
  const safePhase = phases.includes(phase) ? phase : 'request';
  try { console.warn(JSON.stringify({ event: 'browser_read_failed', phase: safePhase, errorType })); }
  catch { /* Diagnostics must never replace the original operational failure. */ }
}
