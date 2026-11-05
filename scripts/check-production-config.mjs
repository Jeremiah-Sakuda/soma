// Configuration-only preflight. Does not contact providers, authenticate a source, or print values.
import { existsSync } from 'node:fs';
import { CredentialCipher } from '../src/lib/server/credential-crypto.ts';
const env = process.env;
const checks = [];
const check = (name, valid) => checks.push({ name, status: valid ? 'pass' : 'fail' });
check('managed persistence', env.SOMA_PERSISTENCE === 'firestore');
check(
  'Firebase project and public app match',
  Boolean(env.FIREBASE_PROJECT_ID) &&
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === env.FIREBASE_PROJECT_ID,
);
check(
  'Firebase sign-in configuration',
  Boolean(env.NEXT_PUBLIC_FIREBASE_API_KEY && env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
);
check(
  'production emulator bypass disabled',
  !env.FIREBASE_AUTH_EMULATOR_HOST && !env.FIRESTORE_EMULATOR_HOST,
);
let serverCredential = false;
if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const value = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    serverCredential =
      value.type === 'service_account' &&
      value.project_id === env.FIREBASE_PROJECT_ID &&
      Boolean(value.private_key && value.client_email);
  } catch {
    /* Invalid JSON is a failed check; never display it. */
  }
} else
  serverCredential = Boolean(
    env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(env.GOOGLE_APPLICATION_CREDENTIALS),
  );
check('Firebase server credential configured', serverCredential);
let productionOrigin = false;
try {
  const url = new URL(env.SOMA_APP_URL);
  productionOrigin =
    url.protocol === 'https:' && url.origin === env.SOMA_APP_URL && !url.username && !url.password;
} catch {
  /* Failed below. */
}
check('canonical HTTPS application origin', productionOrigin);
let credentialKeysValid = false;
try {
  new CredentialCipher(env);
  credentialKeysValid = true;
} catch {
  /* Never report configuration values. */
}
check('connector encryption key set and write format', credentialKeysValid);
check(
  'Google OAuth client configured',
  Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET),
);
const browserBackend = env.SOMA_BROWSER_BACKEND ?? 'browserbase';
let browserHostValid = browserBackend === 'browserbase' && Boolean(env.BROWSERBASE_API_KEY);
if (browserBackend === 'gcp') {
  try {
    const url = new URL(env.SOMA_GCP_BROWSER_URL);
    browserHostValid =
      url.protocol === 'https:' &&
      /^(?:[a-z0-9-]+\.)+run\.app$/.test(url.hostname) &&
      url.origin === env.SOMA_GCP_BROWSER_URL &&
      Boolean(env.SOMA_GCP_BROWSER_PROJECT_ID) &&
      /^[A-Za-z0-9_-]{40,256}$/.test(env.SOMA_GCP_BROWSER_CONTROL_KEY ?? '');
  } catch {
    /* Report no values. */
  }
}
check('browser hosting configured', browserHostValid);
check(
  'Meta endpoint and model pinned',
  env.META_API_BASE_URL === 'https://api.meta.ai/v1' && env.META_MODEL_ID === 'muse-spark-1.3',
);
const allocation = Number(env.META_ALLOCATION_USD),
  cap = Number(env.META_APP_SPEND_CAP_USD);
check(
  'Meta allocation and 20 percent reserve',
  allocation > 0 &&
    Number.isFinite(allocation) &&
    cap > 0 &&
    Number.isFinite(cap) &&
    cap <= allocation * 0.8,
);
check('Meta inference key configured', Boolean(env.MODEL_API_KEY));
check(
  'background worker enabled with private secret',
  env.SOMA_WORKER_ENABLED === 'true' && /^[^\s]{32,256}$/.test(env.SOMA_WORKER_SECRET ?? ''),
);
for (const item of checks) console.log(`${item.status.toUpperCase()} ${item.name}`);
console.log(
  'This checks configuration only. Live source access, deployed execution, billing and release quality require separate evidence.',
);
if (checks.some((item) => item.status === 'fail')) process.exitCode = 1;
