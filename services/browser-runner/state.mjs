import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const OWNER = /^[a-f0-9]{64}$/;
const MAX_STATE_BYTES = 8 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 12 * 1024 * 1024;
const MAX_SESSION_MS = 30 * 60_000;
export class BrowserStateError extends Error {
  constructor(code, status = 409) {
    super('Private browser state is unavailable for this operation.');
    this.code = code;
    this.status = status;
  }
}
const fail = (code, status = 422) => {
  throw new BrowserStateError(code, status);
};
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function keys(value, required, optional = []) {
  return (
    object(value) &&
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => required.includes(key) || optional.includes(key))
  );
}
function boundedString(value, max, nonempty = false) {
  return typeof value === 'string' && value.length <= max && (!nonempty || value.length > 0);
}
function hostname(value) {
  return (
    typeof value === 'string' &&
    value.length <= 253 &&
    value.split('.').every((label) => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label))
  );
}
function origin(value) {
  try {
    const url = new URL(value);
    return (
      typeof value === 'string' &&
      url.origin === value &&
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.port &&
      hostname(url.hostname)
    );
  } catch {
    return false;
  }
}
function jsonValue(value, budget, depth = 0) {
  if (++budget.nodes > 100_000 || depth > 32) fail('state_invalid');
  if (
    value === null ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
    return;
  if (boundedString(value, MAX_STATE_BYTES)) return;
  if (Array.isArray(value)) {
    if (value.length > 10_000) fail('state_invalid');
    for (const item of value) jsonValue(item, budget, depth + 1);
    return;
  }
  if (!object(value) || Object.keys(value).length > 10_000) fail('state_invalid');
  for (const [key, item] of Object.entries(value)) {
    if (!boundedString(key, 4096) || ['__proto__', 'prototype', 'constructor'].includes(key))
      fail('state_invalid');
    jsonValue(item, budget, depth + 1);
  }
}
// Playwright's storage serializer accepts encoded dates/maps/binary values.
// Keep those data types, but never accept binding/function/handle tags.
function encodedValue(value, budget, refs = new Set(), depth = 0) {
  if (++budget.nodes > 100_000 || depth > 32) fail('state_invalid');
  if (
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    boundedString(value, MAX_STATE_BYTES)
  )
    return;
  if (!object(value)) fail('state_invalid');
  if (keys(value, ['ref']) && Number.isSafeInteger(value.ref) && refs.has(value.ref)) return;
  if (
    keys(value, ['v']) &&
    ['undefined', 'null', 'NaN', 'Infinity', '-Infinity', '-0'].includes(value.v)
  )
    return;
  if (keys(value, ['d']) && boundedString(value.d, 64) && Number.isFinite(Date.parse(value.d)))
    return;
  if (keys(value, ['u']) && boundedString(value.u, 8192)) {
    try {
      new URL(value.u);
      return;
    } catch {
      fail('state_invalid');
    }
  }
  if (keys(value, ['bi']) && typeof value.bi === 'string' && /^-?\d{1,1024}$/.test(value.bi))
    return;
  if (
    keys(value, ['r']) &&
    keys(value.r, ['p', 'f']) &&
    boundedString(value.r.p, 1024) &&
    typeof value.r.f === 'string' &&
    /^[dgimsuvy]*$/.test(value.r.f)
  ) {
    try {
      new RegExp(value.r.p, value.r.f);
      return;
    } catch {
      fail('state_invalid');
    }
  }
  if (
    keys(value, ['e']) &&
    keys(value.e, ['n', 'm', 's']) &&
    Object.values(value.e).every((item) => boundedString(item, 16_384))
  )
    return;
  for (const tag of ['ta', 'ab']) {
    if (!keys(value, [tag])) continue;
    const item = value[tag];
    if (
      !keys(item, tag === 'ta' ? ['b', 'k'] : ['b']) ||
      typeof item.b !== 'string' ||
      item.b.length > Math.ceil((MAX_STATE_BYTES * 4) / 3) ||
      item.b.length % 4 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(item.b) ||
      Buffer.from(item.b, 'base64').toString('base64') !== item.b
    )
      fail('state_invalid');
    if (
      tag === 'ta' &&
      !['i8', 'ui8', 'ui8c', 'i16', 'ui16', 'i32', 'ui32', 'f32', 'f64', 'bi64', 'bui64'].includes(
        item.k,
      )
    )
      fail('state_invalid');
    return;
  }
  for (const tag of ['a', 'o', 'm', 's']) {
    if (
      !keys(value, [tag, 'id']) ||
      !Number.isSafeInteger(value.id) ||
      value.id < 1 ||
      refs.has(value.id) ||
      !Array.isArray(value[tag]) ||
      value[tag].length > 10_000
    )
      continue;
    refs.add(value.id);
    for (const item of value[tag]) {
      if (tag === 'o' || tag === 'm') {
        if (!keys(item, ['k', 'v'])) fail('state_invalid');
        if (tag === 'o') {
          if (
            !boundedString(item.k, 4096) ||
            ['__proto__', 'prototype', 'constructor'].includes(item.k)
          )
            fail('state_invalid');
        } else encodedValue(item.k, budget, refs, depth + 1);
        encodedValue(item.v, budget, refs, depth + 1);
      } else encodedValue(item, budget, refs, depth + 1);
    }
    return;
  }
  fail('state_invalid');
}
function keyPath(value) {
  return (
    boundedString(value, 4096) ||
    (Array.isArray(value) &&
      value.length > 0 &&
      value.length <= 100 &&
      value.every((item) => boundedString(item, 4096)))
  );
}
function indexedDB(databases, budget) {
  if (!Array.isArray(databases) || databases.length > 100) fail('state_invalid');
  for (const database of databases) {
    if (
      !keys(database, ['name', 'version', 'stores']) ||
      !boundedString(database.name, 4096, true) ||
      !Number.isSafeInteger(database.version) ||
      database.version < 1 ||
      !Array.isArray(database.stores) ||
      database.stores.length > 100
    )
      fail('state_invalid');
    for (const store of database.stores) {
      if (
        !keys(
          store,
          ['name', 'autoIncrement', 'records', 'indexes'],
          ['keyPath', 'keyPathArray'],
        ) ||
        !boundedString(store.name, 4096, true) ||
        typeof store.autoIncrement !== 'boolean' ||
        (store.keyPath !== undefined && !boundedString(store.keyPath, 4096)) ||
        (store.keyPathArray !== undefined &&
          (!Array.isArray(store.keyPathArray) || !keyPath(store.keyPathArray))) ||
        (store.keyPath !== undefined && store.keyPathArray !== undefined) ||
        !Array.isArray(store.records) ||
        store.records.length > 10_000 ||
        !Array.isArray(store.indexes) ||
        store.indexes.length > 100
      )
        fail('state_invalid');
      for (const index of store.indexes) {
        if (
          !keys(index, ['name', 'multiEntry', 'unique'], ['keyPath', 'keyPathArray']) ||
          !boundedString(index.name, 4096, true) ||
          typeof index.multiEntry !== 'boolean' ||
          typeof index.unique !== 'boolean' ||
          (index.keyPath === undefined) === (index.keyPathArray === undefined) ||
          (index.keyPath !== undefined && !boundedString(index.keyPath, 4096)) ||
          (index.keyPathArray !== undefined &&
            (!Array.isArray(index.keyPathArray) || !keyPath(index.keyPathArray)))
        )
          fail('state_invalid');
      }
      for (const record of store.records) {
        if (
          !keys(record, [], ['key', 'keyEncoded', 'value', 'valueEncoded']) ||
          Object.hasOwn(record, 'value') === Object.hasOwn(record, 'valueEncoded') ||
          (Object.hasOwn(record, 'key') && Object.hasOwn(record, 'keyEncoded'))
        )
          fail('state_invalid');
        for (const field of ['key', 'value']) {
          if (Object.hasOwn(record, field)) jsonValue(record[field], budget);
          if (Object.hasOwn(record, `${field}Encoded`))
            encodedValue(record[`${field}Encoded`], budget);
        }
      }
    }
  }
}
/** Only Playwright cookies/localStorage/IndexedDB are imported. No executable payload,
 * paths, launch options, credentials object or arbitrary browser configuration. */
export function validateStorageState(state) {
  if (
    !keys(state, ['cookies', 'origins']) ||
    !Array.isArray(state.cookies) ||
    state.cookies.length > 5000 ||
    !Array.isArray(state.origins) ||
    state.origins.length > 2000
  )
    fail('state_invalid');
  for (const cookie of state.cookies) {
    if (
      !keys(
        cookie,
        ['name', 'value', 'domain', 'path', 'expires', 'httpOnly', 'secure', 'sameSite'],
        ['partitionKey'],
      ) ||
      !boundedString(cookie.name, 4096, true) ||
      /[\x00-\x20\x7f;=]/.test(cookie.name) ||
      !boundedString(cookie.value, MAX_STATE_BYTES) ||
      !hostname(typeof cookie.domain === 'string' ? cookie.domain.replace(/^\./, '') : null) ||
      !boundedString(cookie.path, 4096, true) ||
      !cookie.path.startsWith('/') ||
      /[\x00-\x1f\x7f]/.test(cookie.path) ||
      typeof cookie.expires !== 'number' ||
      !Number.isFinite(cookie.expires) ||
      cookie.expires < -1 ||
      cookie.expires > 32_503_680_000 ||
      typeof cookie.httpOnly !== 'boolean' ||
      typeof cookie.secure !== 'boolean' ||
      !['Strict', 'Lax', 'None'].includes(cookie.sameSite) ||
      (cookie.partitionKey !== undefined && !origin(cookie.partitionKey))
    )
      fail('state_invalid');
  }
  const budget = { nodes: 0 };
  for (const entry of state.origins) {
    if (
      !keys(entry, ['origin', 'localStorage'], ['indexedDB']) ||
      !origin(entry.origin) ||
      !Array.isArray(entry.localStorage) ||
      entry.localStorage.length > 10_000
    )
      fail('state_invalid');
    if (
      entry.localStorage.some(
        (item) =>
          !keys(item, ['name', 'value']) ||
          !boundedString(item.name, 4096) ||
          !boundedString(item.value, MAX_STATE_BYTES),
      )
    )
      fail('state_invalid');
    if (entry.indexedDB !== undefined) indexedDB(entry.indexedDB, budget);
  }
  let encoded;
  try {
    encoded = JSON.stringify(state);
  } catch {
    fail('state_invalid');
  }
  if (Buffer.byteLength(encoded) > MAX_STATE_BYTES) fail('state_too_large', 413);
  // Detach untrusted objects before retaining/importing them.
  return JSON.parse(encoded);
}
function stateKey(raw) {
  if (Buffer.isBuffer(raw) && raw.length === 32) return Buffer.from(raw);
  if (typeof raw !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(raw))
    fail('state_key_unavailable', 503);
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length !== 32 || decoded.toString('base64') !== raw)
    fail('state_key_unavailable', 503);
  return decoded;
}
function identity(id, owner) {
  if (!UUID.test(id) || !OWNER.test(owner)) fail('state_not_found', 404);
}
const aad = (id, owner) => Buffer.from(`soma-browser-state:v1\0${id}\0${owner}`, 'utf8');
function seal(state, key, id, owner) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad(id, owner));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(state), 'utf8'), cipher.final()]);
  return {
    v: 1,
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
  };
}
function base64url(value, exactBytes, maxBytes = exactBytes) {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9_-]+$/.test(value) ||
    value.length > Math.ceil((maxBytes * 4) / 3)
  )
    return false;
  const decoded = Buffer.from(value, 'base64url');
  return (
    decoded.toString('base64url') === value &&
    decoded.length <= maxBytes &&
    (!exactBytes || decoded.length === exactBytes)
  );
}
function unseal(value, key, id, owner) {
  if (value === null) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64url'));
    decipher.setAAD(aad(id, owner));
    decipher.setAuthTag(Buffer.from(value.tag, 'base64url'));
    const bytes = Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, 'base64url')),
      decipher.final(),
    ]);
    if (bytes.length > MAX_STATE_BYTES) throw new Error();
    return validateStorageState(JSON.parse(bytes.toString('utf8')));
  } catch {
    fail('state_integrity_failed', 503);
  }
}
function manifest(value, owner) {
  if (
    !keys(value, ['v', 'owner', 'deleted', 'state', 'active']) ||
    value.v !== 1 ||
    !OWNER.test(value.owner) ||
    typeof value.deleted !== 'boolean'
  )
    fail('state_corrupt', 503);
  if (value.owner !== owner) fail('state_not_found', 404);
  if (
    value.active !== null &&
    (!keys(value.active, ['id', 'expiresAt']) ||
      !UUID.test(value.active.id) ||
      !Number.isSafeInteger(value.active.expiresAt) ||
      value.active.expiresAt < 0)
  )
    fail('state_corrupt', 503);
  if (
    value.state !== null &&
    (!keys(value.state, ['v', 'iv', 'tag', 'ciphertext']) ||
      value.state.v !== 1 ||
      !base64url(value.state.iv, 12) ||
      !base64url(value.state.tag, 16) ||
      !base64url(value.state.ciphertext, 0, MAX_STATE_BYTES))
  )
    fail('state_corrupt', 503);
  if (value.deleted && (value.state !== null || value.active !== null)) fail('state_corrupt', 503);
  return value;
}
function conflict(error) {
  return error?.code === 412 || error?.code === '412' || error?.code === 'state_conflict';
}
async function cas(adapter, id, data, generation) {
  try {
    const result = await adapter.write(id, data, generation);
    if (result === false) fail('state_conflict', 409);
  } catch (error) {
    if (conflict(error)) fail('state_conflict', 409);
    throw error instanceof BrowserStateError
      ? error
      : new BrowserStateError('state_storage_unavailable', 503);
  }
}
/** The only persistence contract: generation-pinned read and conditional write.
 * CAS protects session ownership and tombstones from late browser snapshots.
 * @param {any} adapter
 * @param {Buffer|string|undefined} rawKey
 * @param {{now?:()=>number}} options
 */
export function createStateStore(
  adapter,
  rawKey = process.env.SOMA_GCP_BROWSER_STATE_KEY,
  { now = Date.now } = {},
) {
  const key = stateKey(rawKey);
  async function record(id, owner, allowDeleted = false) {
    identity(id, owner);
    let stored;
    try {
      stored = await adapter.read(id);
    } catch {
      fail('state_storage_unavailable', 503);
    }
    if (!stored) fail('state_not_found', 404);
    const value = manifest(stored.data, owner);
    if (value.deleted && !allowDeleted) fail('state_not_found', 404);
    return { generation: stored.generation, value };
  }
  return {
    async create(owner) {
      if (!OWNER.test(owner)) fail('state_not_found', 404);
      const id = randomUUID();
      await cas(adapter, id, { v: 1, owner, deleted: false, state: null, active: null }, null);
      return id;
    },
    async inspect(id, owner) {
      const { value } = await record(id, owner);
      return { active: value.active ? { ...value.active } : null };
    },
    async read(id, owner) {
      const { value } = await record(id, owner);
      return unseal(value.state, key, id, owner);
    },
    async claim(id, owner, sessionId, expiresAt) {
      if (
        !UUID.test(sessionId) ||
        !Number.isSafeInteger(expiresAt) ||
        expiresAt <= now() ||
        expiresAt > now() + MAX_SESSION_MS
      )
        fail('state_session_invalid');
      const { value, generation } = await record(id, owner);
      if (value.active && value.active.expiresAt > now()) fail('state_session_active', 409);
      const storageState = unseal(value.state, key, id, owner);
      await cas(adapter, id, { ...value, active: { id: sessionId, expiresAt } }, generation);
      return { storageState, expiresAt };
    },
    async finish(id, owner, sessionId, state) {
      const { value, generation } = await record(id, owner);
      if (
        !UUID.test(sessionId) ||
        !value.active ||
        value.active.id !== sessionId ||
        value.active.expiresAt <= now()
      )
        fail('state_session_stale', 409);
      const sealed = seal(validateStorageState(state), key, id, owner);
      await cas(adapter, id, { ...value, state: sealed, active: null }, generation);
    },
    async abandon(id, owner, sessionId) {
      const { value, generation } = await record(id, owner);
      if (!UUID.test(sessionId) || !value.active || value.active.id !== sessionId)
        fail('state_session_stale', 409);
      await cas(adapter, id, { ...value, active: null }, generation);
    },
    async remove(id, owner) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const { value, generation } = await record(id, owner, true);
        if (value.deleted) return;
        try {
          await cas(
            adapter,
            id,
            { v: 1, owner, deleted: true, state: null, active: null },
            generation,
          );
          return;
        } catch (error) {
          if (error.code !== 'state_conflict' || attempt === 3) throw error;
        }
      }
    },
  };
}

/** Pass a private @google-cloud/storage Bucket. No signed download URLs,
 * public ACLs, unencrypted files or unconditional object replacements. */
export function createGcsStateAdapter(bucket) {
  const filename = (id) => {
    if (!UUID.test(id)) fail('state_not_found', 404);
    return `browser-contexts/${id}.json`;
  };
  return {
    async read(id) {
      // Generation-specific download prevents metadata/payload races. If an
      // overwrite removes that generation, retry metadata rather than mixing it.
      for (let attempt = 0; attempt < 3; attempt++) {
        let metadata;
        try {
          [metadata] = await bucket.file(filename(id)).getMetadata();
        } catch (error) {
          if (error.code === 404) return null;
          throw error;
        }
        if (
          !/^\d+$/.test(String(metadata.generation)) ||
          !Number.isSafeInteger(Number(metadata.size)) ||
          Number(metadata.size) < 1 ||
          Number(metadata.size) > MAX_MANIFEST_BYTES
        )
          fail('state_corrupt', 503);
        try {
          const [bytes] = await bucket
            .file(filename(id), { generation: String(metadata.generation) })
            .download({ validation: 'crc32c' });
          if (bytes.length !== Number(metadata.size) || bytes.length > MAX_MANIFEST_BYTES)
            fail('state_corrupt', 503);
          let data;
          try {
            data = JSON.parse(bytes.toString('utf8'));
          } catch {
            fail('state_corrupt', 503);
          }
          return { generation: String(metadata.generation), data };
        } catch (error) {
          if (error.code !== 404 || attempt === 2) throw error;
        }
      }
      fail('state_conflict', 409);
    },
    async write(id, data, expectedGeneration) {
      const encoded = JSON.stringify(data);
      if (Buffer.byteLength(encoded) > MAX_MANIFEST_BYTES) fail('state_too_large', 413);
      await bucket.file(filename(id)).save(encoded, {
        resumable: false,
        validation: 'crc32c',
        contentType: 'application/json',
        timeout: 15_000,
        metadata: { cacheControl: 'no-store' },
        preconditionOpts: { ifGenerationMatch: expectedGeneration ?? 0 },
      });
    },
  };
}
