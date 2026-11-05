import { WorkspaceStoreError } from '../store';
import { browserHostingSettings, configuredBrowserBackend } from './browser-hosting';
const fail = () =>
  new WorkspaceStoreError(
    'Secure autofill is unavailable. You can still use manual sign-in.',
    503,
    'credential_service',
  );

/** Optional deployment gate for bounded rollout. Missing means normal
 * multi-account behavior; a present but malformed list permits nobody. */
function rolloutUids(): Set<string> | null {
  const raw = process.env.SOMA_CREDENTIAL_AUTOFILL_ALLOWED_UIDS;
  if (raw === undefined) return null;
  if (raw.length < 1 || raw.length > 16384) throw fail();
  const values = raw.split(',').map((value) => value.trim());
  if (
    values.length > 128 ||
    values.some((value) => !/^[A-Za-z0-9_-]{1,128}$/.test(value)) ||
    new Set(values).size !== values.length
  )
    throw fail();
  return new Set(values);
}
export function credentialAutofillUidAllowed(uid: string): boolean {
  try {
    const allowed = rolloutUids();
    return (
      typeof uid === 'string' &&
      uid.length > 0 &&
      uid.length <= 128 &&
      (allowed === null || allowed.has(uid))
    );
  } catch {
    return false;
  }
}
function browserConfigured() {
  try {
    if (!process.env.SOMA_CONNECTOR_ENCRYPTION_KEY) return false;
    browserHostingSettings(configuredBrowserBackend());
    return true;
  } catch {
    return false;
  }
}
export function credentialServiceSettings(requireEnabled = true) {
  if (requireEnabled) rolloutUids();
  let url: URL;
  try {
    url = new URL(process.env.SOMA_CREDENTIAL_RUNNER_URL ?? '');
  } catch {
    throw fail();
  }
  const key = process.env.SOMA_CREDENTIAL_RUNNER_CONTROL_KEY,
    authorizationKey = process.env.SOMA_CREDENTIAL_AUTHORIZATION_KEY;
  if (
    (requireEnabled && process.env.SOMA_CREDENTIAL_AUTOFILL_ENABLED !== 'true') ||
    configuredBrowserBackend() !== 'gcp' ||
    !browserConfigured() ||
    url.protocol !== 'https:' ||
    url.origin !== process.env.SOMA_CREDENTIAL_RUNNER_URL ||
    !url.hostname.endsWith('.run.app') ||
    url.username ||
    url.password ||
    url.port ||
    url.origin === process.env.SOMA_GCP_BROWSER_URL ||
    !key ||
    !/^[A-Za-z0-9_-]{40,256}$/.test(key) ||
    !authorizationKey ||
    !/^[A-Za-z0-9_-]{40,256}$/.test(authorizationKey) ||
    key === authorizationKey ||
    key === process.env.SOMA_GCP_BROWSER_CONTROL_KEY ||
    authorizationKey === process.env.SOMA_GCP_BROWSER_CONTROL_KEY
  )
    throw fail();
  return { origin: url.origin, key, authorizationKey };
}
export function credentialAutofillConfigured(uid?: string) {
  try {
    credentialServiceSettings();
    const allowed = rolloutUids();
    return allowed === null || (uid !== undefined && allowed.has(uid));
  } catch {
    return false;
  }
}
export function validateCredentialLoginUrl(raw: string, sessionId: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw fail();
  }
  if (
    url.origin !== credentialServiceSettings().origin ||
    url.pathname !== `/login/${sessionId}` ||
    url.username ||
    url.password ||
    url.search ||
    !/^#[A-Za-z0-9_-]{43}$/.test(url.hash)
  )
    throw fail();
  return url.href;
}
