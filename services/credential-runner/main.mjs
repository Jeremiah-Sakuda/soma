import { Storage } from '@google-cloud/storage';
import { GoogleAuth } from 'google-auth-library';
import { createStateStore, createGcsStateAdapter } from '../browser-runner/state.mjs';
import { startEgressProxy } from './egress.mjs';
import { createLoginEngine } from './browser.mjs';
import { createCredentialRunner } from './server.mjs';
import { createCredentialVault } from './vault.mjs';
import { createGcsVaultAdapter, createKmsVaultAdapter } from './vault-gcp.mjs';
import { createGcsCredentialAudit } from './audit.mjs';
import { createGcsGrantStore } from './grants.mjs';
import { createAppAuthorizer } from './authorize.mjs';
import { ALLOWED_HOSTS, allowedOrigin } from './policy.mjs';
const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error('Missing credential-runner configuration.');
  return value;
};
if (process.env.SOMA_CREDENTIAL_RUNNER_ENABLED !== 'true')
  throw new Error('Credential runner disabled.');
const publicOrigin = required('SOMA_CREDENTIAL_RUNNER_URL');
if (new URL(publicOrigin).protocol !== 'https:')
  throw new Error('HTTPS credential-runner origin required.');
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }),
  storage = new Storage();
const stateBucket = storage.bucket(required('SOMA_GCP_BROWSER_BUCKET')),
  vaultBucket = storage.bucket(required('SOMA_CREDENTIAL_VAULT_BUCKET'));
if (stateBucket.name === vaultBucket.name) throw new Error('Dedicated vault bucket required.');
const store = createStateStore(
  createGcsStateAdapter(stateBucket),
  required('SOMA_GCP_BROWSER_STATE_KEY'),
);
const vault = createCredentialVault({
  store: createGcsVaultAdapter(vaultBucket),
  kms: createKmsVaultAdapter({
    keyName: required('SOMA_CREDENTIAL_KMS_KEY'),
    accessToken: async () => {
      const token = await auth.getAccessToken();
      if (typeof token !== 'string') throw new Error('Workload identity unavailable.');
      return token;
    },
  }),
  validateOrigin: allowedOrigin,
});
const proxy = await startEgressProxy({
  allowedHosts: ALLOWED_HOSTS,
  blockedHosts: [
    new URL(publicOrigin).hostname,
    `${stateBucket.name}.storage.googleapis.com`,
    `${vaultBucket.name}.storage.googleapis.com`,
  ],
});
const runner = createCredentialRunner({
  store,
  vault,
  grantStore: createGcsGrantStore(vaultBucket),
  audit: createGcsCredentialAudit(vaultBucket),
  engine: createLoginEngine(),
  authorize: createAppAuthorizer({
    url: required('SOMA_CREDENTIAL_AUTHORIZATION_URL'),
    key: required('SOMA_CREDENTIAL_AUTHORIZATION_KEY'),
  }),
  controlKey: required('SOMA_CREDENTIAL_RUNNER_CONTROL_KEY'),
  publicOrigin,
  proxyUrl: proxy.url,
});
runner.server.listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
let stopping = false;
process.on('SIGTERM', () => {
  if (stopping) return;
  stopping = true;
  void runner
    .close()
    .finally(() => proxy.close())
    .finally(() => process.exit(0));
});
