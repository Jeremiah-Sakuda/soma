import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';

const PROVIDERS = new Set(['blackboard', 'gradescope', 'piazza']);
const VERSION = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const MESSAGES = Object.freeze({
  INVALID_BINDING: 'Credential destination is not approved.',
  INVALID_CREDENTIAL: 'Credential input is invalid.',
  CONFLICT: 'Credential changed. Refresh and try again.',
  NOT_FOUND: 'Stored credential is unavailable.',
  INTEGRITY: 'Stored credential could not be verified.',
  UNAVAILABLE: 'Credential storage is unavailable.',
});

export class VaultError extends Error {
  constructor(code) {
    super(MESSAGES[code] || MESSAGES.UNAVAILABLE);
    this.name = 'VaultError';
    this.code = Object.hasOwn(MESSAGES, code) ? code : 'UNAVAILABLE';
  }
}

const fail = (code) => { throw new VaultError(code); };
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const bounded = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Internal login-service primitive. Never expose decrypt through an HTTP API.
 * store.write MUST atomically compare its opaque storage generation (null means
 * create-only). A failed comparison must reject; never implement it as read+put.
 * kms.wrap/unwrap MUST authenticate the supplied AAD and have no env-key fallback.
 */
export function createCredentialVault({ store, kms, validateOrigin, now = Date.now }) {
  if (!store?.read || !store?.write || !kms?.wrap || !kms?.unwrap || typeof validateOrigin !== 'function') {
    fail('UNAVAILABLE');
  }

  function bindingFor(input) {
    if (!plainObject(input) || typeof input.owner !== 'string' || !/^[a-f0-9]{64}$/.test(input.owner)
      || !bounded(input.workspaceId, 256) || !PROVIDERS.has(input.provider)
      || !(Number.isSafeInteger(input.workspaceGeneration) && input.workspaceGeneration >= 0
        || bounded(input.workspaceGeneration, 256)) || !bounded(input.origin, 256)) fail('INVALID_BINDING');
    try {
      const url = new URL(input.origin);
      if (url.protocol !== 'https:' || url.origin !== input.origin || url.username || url.password
        || url.port || validateOrigin(input.provider, input.origin) !== true) fail('INVALID_BINDING');
    } catch { fail('INVALID_BINDING'); }
    return { owner: input.owner, workspaceId: input.workspaceId, workspaceGeneration: input.workspaceGeneration,
      provider: input.provider, origin: input.origin };
  }

  function idFor(binding) {
    return createHash('sha256').update(JSON.stringify(['soma-institutional-vault-v1', binding.owner, binding.provider])).digest('hex');
  }
  function aadFor(binding, version) {
    return Buffer.from(JSON.stringify({ schema: 1, ...binding, credentialVersion: version }), 'utf8');
  }
  function metadataFor(record) {
    return record ? { status: record.status, version: record.credentialVersion } : { status: 'empty', version: null };
  }
  function assertVersion(version) { if (typeof version !== 'string' || !VERSION.test(version)) fail('CONFLICT'); }
  function assertExpected(snapshot, version) {
    if (version === null) { if (snapshot) fail('CONFLICT'); return; }
    assertVersion(version);
    if (!snapshot || snapshot.data.credentialVersion !== version) fail('CONFLICT');
  }
  async function read(binding) {
    let snapshot;
    try { snapshot = await store.read(idFor(binding)); } catch { fail('UNAVAILABLE'); }
    if (snapshot === null) return null;
    const record = snapshot?.data;
    if (!bounded(snapshot?.generation, 256) || !plainObject(record) || record.schema !== 1
      || !VERSION.test(record.credentialVersion || '') || !['active', 'forgotten'].includes(record.status)
      || !same(record.binding, binding) || !Number.isSafeInteger(record.updatedAt) || record.updatedAt < 0) fail('INTEGRITY');
    if (record.status === 'forgotten') {
      // A tombstone must not retain recoverable ciphertext or keys.
      if (Object.keys(record).sort().join(',') !== 'binding,credentialVersion,schema,status,updatedAt') fail('INTEGRITY');
    } else if (Object.keys(record).sort().join(',') !== 'binding,ciphertext,credentialVersion,nonce,schema,status,tag,updatedAt,wrappedKey'
      || !bounded(record.wrappedKey, 32768) || !bounded(record.ciphertext, 32768)
      || !bounded(record.nonce, 32) || !bounded(record.tag, 32)) fail('INTEGRITY');
    return snapshot;
  }
  async function write(binding, data, snapshot) {
    try {
      await store.write(idFor(binding), data, snapshot?.generation ?? null);
    } catch (error) {
      // GCS 412 is a storage-generation CAS rejection; adapters may normalize it.
      if (error?.code === 'CONFLICT' || error?.code === 412 || error?.statusCode === 412) fail('CONFLICT');
      fail('UNAVAILABLE');
    }
  }
  function parseBase64(value, length) {
    const buffer = Buffer.from(value, 'base64');
    if (buffer.toString('base64') !== value || length !== undefined && buffer.length !== length) fail('INTEGRITY');
    return buffer;
  }
  async function encrypt(binding, secret) {
    const credentialVersion = randomUUID();
    const dek = randomBytes(32);
    const nonce = randomBytes(12);
    const aad = aadFor(binding, credentialVersion);
    let plaintext;
    try {
      plaintext = Buffer.from(JSON.stringify(secret), 'utf8');
      const cipher = createCipheriv('aes-256-gcm', dek, nonce);
      cipher.setAAD(aad);
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      let wrappedKey;
      try { wrappedKey = await kms.wrap(dek, aad); } catch { fail('UNAVAILABLE'); }
      if (!bounded(wrappedKey, 32768)) fail('UNAVAILABLE');
      return { schema: 1, status: 'active', binding, credentialVersion, wrappedKey,
        nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'),
        ciphertext: ciphertext.toString('base64'), updatedAt: now() };
    } finally { dek.fill(0); plaintext?.fill(0); }
  }
  function secretFor(input) {
    if (!plainObject(input) || !bounded(input.identifier, 512) || !bounded(input.password, 8192)
      || Object.keys(input).sort().join(',') !== 'identifier,password'
      || Buffer.byteLength(JSON.stringify(input), 'utf8') > 16384) fail('INVALID_CREDENTIAL');
    return { identifier: input.identifier, password: input.password };
  }

  async function decryptSnapshot(binding, snapshot) {
    if (!snapshot || snapshot.data.status !== 'active') fail('NOT_FOUND');
    const record = snapshot.data;
    const aad = aadFor(binding, record.credentialVersion);
    let dek;
    let plaintext;
    try {
      try { dek = await kms.unwrap(record.wrappedKey, aad); } catch { fail('UNAVAILABLE'); }
      if (!Buffer.isBuffer(dek) || dek.length !== 32) fail('INTEGRITY');
      const decipher = createDecipheriv('aes-256-gcm', dek, parseBase64(record.nonce, 12));
      decipher.setAAD(aad);
      decipher.setAuthTag(parseBase64(record.tag, 16));
      plaintext = Buffer.concat([decipher.update(parseBase64(record.ciphertext)), decipher.final()]);
      let secret;
      try { secret = secretFor(JSON.parse(plaintext.toString('utf8'))); } catch { fail('INTEGRITY'); }
      // Decryption may await KMS. Revocation/replacement during that wait wins.
      const current = await read(binding);
      if (!current || current.generation !== snapshot.generation
        || current.data.credentialVersion !== record.credentialVersion || current.data.status !== 'active') fail('CONFLICT');
      return secret;
    } catch (error) {
      if (error instanceof VaultError) throw error;
      fail('INTEGRITY');
    } finally { if (Buffer.isBuffer(dek)) dek.fill(0); plaintext?.fill(0); }
  }

  return Object.freeze({
    async metadata(input) {
      const binding = bindingFor(input);
      return metadataFor((await read(binding))?.data);
    },
    async save(input, value, expectedVersion) {
      const binding = bindingFor(input);
      const secret = secretFor(value);
      const snapshot = await read(binding);
      assertExpected(snapshot, expectedVersion);
      const record = await encrypt(binding, secret);
      await write(binding, record, snapshot);
      return metadataFor(record);
    },
    async decrypt(input, version) {
      const binding = bindingFor(input);
      assertVersion(version);
      const snapshot = await read(binding);
      if (!snapshot || snapshot.data.status !== 'active') fail('NOT_FOUND');
      assertExpected(snapshot, version);
      return decryptSnapshot(binding, snapshot);
    },
    async forget(input, expectedVersion) {
      const binding = bindingFor(input);
      const snapshot = await read(binding);
      // Even an empty vault gets a fence: a concurrent create-only save loses.
      assertExpected(snapshot, expectedVersion);
      const record = { schema: 1, status: 'forgotten', binding, credentialVersion: randomUUID(), updatedAt: now() };
      await write(binding, record, snapshot);
      return metadataFor(record);
    },
    async rotate(input, version) {
      const binding = bindingFor(input);
      assertVersion(version);
      const snapshot = await read(binding);
      if (!snapshot || snapshot.data.status !== 'active') fail('NOT_FOUND');
      assertExpected(snapshot, version);
      const secret = await decryptSnapshot(binding, snapshot);
      // Fresh DEK, nonce and version also invalidate previously issued fill grants.
      const record = await encrypt(binding, secret);
      await write(binding, record, snapshot);
      return metadataFor(record);
    },
  });
}
