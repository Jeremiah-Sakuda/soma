#!/usr/bin/env node
// Explicit synthetic-only cloud IAM probe. No IAM changes, real account lookup,
// browser launch or institutional credentials. Tokens are read from private files.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile, lstat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCredentialVault } from '../services/credential-runner/vault.mjs';
import { createGcsVaultAdapter, createKmsVaultAdapter } from '../services/credential-runner/vault-gcp.mjs';
import { createGcsCredentialAudit } from '../services/credential-runner/audit.mjs';
import { createGcsGrantStore } from '../services/credential-runner/grants.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const fail = (code) => { throw Object.assign(new Error('Synthetic credential cloud verification failed.'), { code }); };
const status = (error) => Number(error?.code ?? error?.statusCode);
const exactKeys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...expected].sort().join(',');
const assert = (condition, code) => { if (!condition) fail(code); };

/** Denial requires actual HTTP 403. Absence, transient failure and bad inputs
 * never count as proof of IAM separation. Never surface underlying error text. */
export async function requireCloudPermissionDenial(operation) {
  try { await operation(); } catch (error) {
    if (status(error) === 403) return;
    fail('DENIAL_NOT_PROVEN');
  }
  fail('PERMISSION_UNEXPECTEDLY_ALLOWED');
}

async function privateFile(path, limit) {
  if (typeof path !== 'string' || !isAbsolute(path)) fail('PRIVATE_INPUT_INVALID');
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o077) !== 0 || metadata.size < 1 || metadata.size > limit) fail('PRIVATE_INPUT_INVALID');
  return readFile(path, 'utf8');
}
export async function readCredentialCloudConfiguration(path) {
  let config;
  try { config = JSON.parse(await privateFile(path, 8192)); } catch { fail('PRIVATE_INPUT_INVALID'); }
  if (!exactKeys(config, ['vaultBucket', 'keyName', 'tokens'])
    || typeof config.vaultBucket !== 'string' || !/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(config.vaultBucket)
    || typeof config.keyName !== 'string' || !/^projects\/[a-zA-Z0-9_-]+\/locations\/[a-zA-Z0-9_-]+\/keyRings\/[a-zA-Z0-9_-]+\/cryptoKeys\/[a-zA-Z0-9_-]+$/.test(config.keyName)
    || !exactKeys(config.tokens, ['login', 'browser', 'app', 'operator'])) fail('PRIVATE_INPUT_INVALID');
  /** @type {Record<string,string>} */
  const tokens = {};
  try {
    for (const role of ['login', 'browser', 'app', 'operator']) {
      const token = (await privateFile(config.tokens[role], 16384)).trim();
      if (token.length < 16 || /[^\x21-\x7e]/.test(token)) fail('PRIVATE_INPUT_INVALID');
      tokens[role] = token;
    }
  } catch { fail('PRIVATE_INPUT_INVALID'); }
  if (new Set(Object.values(tokens)).size !== 4) fail('IDENTITIES_NOT_DISTINCT');
  return { vaultBucket: config.vaultBucket, keyName: config.keyName, tokens };
}

/** Clients are explicit workload identities; this function never discovers
 * credentials, reads environment variables, lists a bucket or changes policies. */
export async function verifyCredentialCloud({ buckets, kms, kmsStatus, report = (_value) => {} }) {
  const runId = randomUUID(), workspaceId = `synthetic-cloud-${runId}`;
  const owner = digest(`${workspaceId}:browser-blackboard`);
  const binding = { owner, workspaceId, workspaceGeneration: workspaceId, provider: 'blackboard', origin: 'https://shib.bu.edu' };
  const vaultId = digest(JSON.stringify(['soma-institutional-vault-v1', owner, 'blackboard']));
  const vaultPath = `credential-vault/${vaultId}.json`;
  const deniedVaultPath = `credential-vault/${digest(`synthetic-denied-${runId}`)}.json`;
  const grantId = randomUUID(), deniedGrantId = randomUUID();
  const grantPath = `credential-grants/${grantId}.json`, deniedGrantPath = `credential-grants/${deniedGrantId}.json`;
  const created = new Set(); const checked = []; const rawFailures = [];
  let failure = null;
  const safeReport = (item) => report({ check: item, status: 'passed' });
  const owned = (path) => path === vaultPath || path === deniedVaultPath || path === grantPath || path === deniedGrantPath
    || new RegExp(`^credential-audit/${owner}/[a-f0-9-]{36}\\.json$`).test(path);
  function tracked(bucket) {
    return { file(path, options) {
      assert(typeof path === 'string' && owned(path), 'PATH_OUTSIDE_SYNTHETIC_RUN');
      const file = bucket.file(path, options);
      return {
        getMetadata: (...args) => file.getMetadata(...args), download: (...args) => file.download(...args),
        delete: (...args) => file.delete(...args),
        async save(data, options) {
          if (!created.has(path)) {
            const [exists] = await buckets.operator.file(path).exists();
            assert(!exists, 'SYNTHETIC_PATH_ALREADY_EXISTS');
          }
          // Track uncertain writes too: a failed transport is not proof that
          // the server did not create our uniquely scoped synthetic object.
          created.add(path);
          try { await file.save(data, options); }
          catch (error) { rawFailures.push(status(error)); throw error; }
        },
      };
    } };
  }
  const login = tracked(buckets.login), browser = tracked(buckets.browser), app = tracked(buckets.app);
  const check = async (name, action) => {
    try { await action(); checked.push(name); safeReport(name); } catch (error) {
      failure = { check: name, code: typeof error?.code === 'string' && /^[A-Z_]{1,80}$/.test(error.code) ? error.code : 'CHECK_FAILED' };
      throw error;
    }
  };
  let firstVersion, currentVersion, wrapped;
  const aad = Buffer.from(`synthetic-credential-cloud:${runId}`), testKey = randomBytes(32);
  const synthetic = { identifier: `probe-${runId}@example.invalid`, password: `SYNTHETIC-ONLY-${randomUUID()}` };
  const vault = createCredentialVault({ store: createGcsVaultAdapter(login), kms: kms.login,
    validateOrigin: (provider, origin) => provider === 'blackboard' && origin === 'https://shib.bu.edu' });
  try {
    await check('operator-cleanup-access', async () => {
      // Prove operator can remove only a newly created, explicitly synthetic file
      // before creating immutable probe artifacts. No existing object is touched.
      const file = buckets.operator.file(deniedVaultPath);
      assert(!(await file.exists())[0], 'SYNTHETIC_PATH_ALREADY_EXISTS');
      created.add(deniedVaultPath); await file.save('{"synthetic":true}', { resumable: false, preconditionOpts: { ifGenerationMatch: 0 } });
      await file.delete(); created.delete(deniedVaultPath);
    });
    await check('login-vault-roundtrip', async () => {
      const saved = await vault.save(binding, synthetic, null); firstVersion = saved.version; currentVersion = saved.version;
      assert(JSON.stringify(await vault.decrypt(binding, saved.version)) === JSON.stringify(synthetic), 'ROUNDTRIP_MISMATCH');
      const [bytes] = await buckets.operator.file(vaultPath).download();
      assert(!bytes.toString('utf8').includes(synthetic.password) && !bytes.toString('utf8').includes(synthetic.identifier), 'PLAINTEXT_IN_STORAGE');
      wrapped = await kms.login.wrap(testKey, aad);
    });
    await check('login-vault-concurrent-cas', async () => {
      const results = await Promise.allSettled([vault.save(binding, synthetic, currentVersion), vault.save(binding, synthetic, currentVersion)]);
      const success = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected');
      assert(success.length === 1 && rejected.length === 1 && rejected[0].reason?.code === 'CONFLICT', 'CAS_NOT_PROVEN');
      currentVersion = success[0].value.version;
    });
    await check('login-vault-rotation', async () => {
      const previous = currentVersion; const rotated = await vault.rotate(binding, previous); currentVersion = rotated.version;
      assert(currentVersion !== previous, 'ROTATION_VERSION_UNCHANGED');
      assert(JSON.stringify(await vault.decrypt(binding, currentVersion)) === JSON.stringify(synthetic), 'ROTATION_MISMATCH');
      try { await vault.decrypt(binding, firstVersion); fail('STALE_VERSION_ACCEPTED'); } catch (error) { assert(error.code === 'CONFLICT', 'STALE_VERSION_NOT_FENCED'); }
    });
    for (const [role, bucket] of [['browser', browser], ['app', app]]) {
      await check(`${role}-vault-read-denied`, () => requireCloudPermissionDenial(() => bucket.file(vaultPath).download()));
      await check(`${role}-vault-write-denied`, () => requireCloudPermissionDenial(() => bucket.file(deniedVaultPath).save('{"synthetic":true}', { resumable: false, preconditionOpts: { ifGenerationMatch: 0 } })));
      await check(`${role}-kms-decrypt-denied`, async () => {
        let denied = false;
        try { await kms[role].unwrap(wrapped, aad); } catch { denied = true; }
        assert(denied && kmsStatus[role]() === 403, 'KMS_DENIAL_NOT_PROVEN');
      });
    }
    await check('login-vault-forget-and-fence', async () => {
      const previous = currentVersion; const forgotten = await vault.forget(binding, previous);
      assert(forgotten.status === 'forgotten', 'FORGET_NOT_PROVEN');
      try { await vault.save(binding, synthetic, previous); fail('TOMBSTONE_ACCEPTED_OLD_SAVE'); } catch (error) { assert(error.code === 'CONFLICT', 'FORGET_FENCE_NOT_PROVEN'); }
      const recreated = await vault.save(binding, synthetic, forgotten.version);
      await vault.forget(binding, recreated.version);
      const [bytes] = await buckets.operator.file(vaultPath).download(); const tombstone = JSON.parse(bytes.toString('utf8'));
      assert(tombstone.status === 'forgotten' && !Object.hasOwn(tombstone, 'ciphertext') && !Object.hasOwn(tombstone, 'wrappedKey'), 'FORGET_PAYLOAD_RETAINED');
    });
    const audit = createGcsCredentialAudit(login), grants = createGcsGrantStore(login);
    await check('login-audit-create', async () => audit.emit(owner, { event: 'consent', outcome: 'succeeded', provider: 'blackboard', sessionHash: digest(runId), credentialVersion: null, at: Date.now() }));
    await check('login-grant-consume-and-replay-denied', async () => {
      await grants.consume(grantId, owner); rawFailures.length = 0;
      let denied = false; try { await grants.consume(grantId, owner); } catch { denied = true; }
      assert(denied && [403, 412].includes(rawFailures.at(-1)), 'GRANT_REPLAY_NOT_PROVEN');
    });
    const auditPaths = [...created].filter((path) => path.startsWith(`credential-audit/${owner}/`));
    assert(auditPaths.length === 1, 'AUDIT_ARTIFACT_NOT_PROVEN');
    for (const [kind, path] of [['audit', auditPaths[0]], ['grant', grantPath]]) {
      await check(`login-${kind}-read-denied`, () => requireCloudPermissionDenial(() => login.file(path).download()));
      // No generation precondition: 403 must be IAM denial, never merely CAS.
      await check(`login-${kind}-overwrite-denied`, () => requireCloudPermissionDenial(() => login.file(path).save('{"synthetic":true}', { resumable: false })));
      await check(`login-${kind}-delete-denied`, () => requireCloudPermissionDenial(() => login.file(path).delete()));
      for (const [role, bucket] of [['browser', browser], ['app', app]]) {
        await check(`${role}-${kind}-read-denied`, () => requireCloudPermissionDenial(() => bucket.file(path).download()));
        const deniedPath = kind === 'audit' ? `credential-audit/${owner}/${randomUUID()}.json` : deniedGrantPath;
        await check(`${role}-${kind}-create-denied`, () => requireCloudPermissionDenial(() => bucket.file(deniedPath).save('{"synthetic":true}', { resumable: false, preconditionOpts: { ifGenerationMatch: 0 } })));
      }
    }
  } catch { if (!failure) failure = { check: 'verification-internal', code: 'CHECK_FAILED' }; }
  finally { testKey.fill(0); synthetic.password = ''; synthetic.identifier = ''; }
  let cleanupFailed = 0;
  for (const path of created) {
    try { assert(owned(path), 'CLEANUP_PATH_INVALID'); await buckets.operator.file(path).delete({ ignoreNotFound: true }); }
    catch { cleanupFailed++; }
  }
  const result = { status: !failure && cleanupFailed === 0 ? 'passed' : 'failed', checksPassed: checked.length,
    ...(failure ? { failure } : {}), cleanup: cleanupFailed === 0 ? 'passed' : 'failed', retainedSyntheticObjects: cleanupFailed };
  report(result); return result;
}

async function main() {
  if (process.argv.length !== 3) fail('USAGE_PRIVATE_CONFIG_REQUIRED');
  const config = await readCredentialCloudConfiguration(process.argv[2]);
  const require = createRequire(new URL('../services/credential-runner/package.json', import.meta.url));
  const { Storage } = require('@google-cloud/storage'), { OAuth2Client } = require('google-auth-library');
  const buckets = {}, kms = {}, lastStatus = {};
  for (const role of ['login', 'browser', 'app', 'operator']) {
    const authClient = new OAuth2Client(); authClient.setCredentials({ access_token: config.tokens[role] });
    const storage = new Storage({ authClient, retryOptions: { autoRetry: false } });
    buckets[role] = storage.bucket(config.vaultBucket);
    if (role !== 'operator') kms[role] = createKmsVaultAdapter({ keyName: config.keyName, accessToken: async () => config.tokens[role],
      fetchImpl: async (...args) => { lastStatus[role] = null; const response = await fetch(...args); lastStatus[role] = response.status; return response; } });
  }
  const result = await verifyCredentialCloud({ buckets, kms, kmsStatus: { browser: () => lastStatus.browser, app: () => lastStatus.app }, report: (value) => console.log(JSON.stringify(value)) });
  process.exitCode = result.status === 'passed' ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(JSON.stringify({ status: 'failed', code: typeof error?.code === 'string' && /^[A-Z_]{1,80}$/.test(error.code) ? error.code : 'CHECK_FAILED', details: 'No private inputs or provider errors are printed.' })); process.exitCode = 1; });
}
