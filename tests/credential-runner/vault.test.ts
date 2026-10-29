import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createCredentialVault, VaultError } from '../../services/credential-runner/vault.mjs';
import { createGcsVaultAdapter, createKmsVaultAdapter, vaultCrc32c } from '../../services/credential-runner/vault-gcp.mjs';

const binding = { owner: 'a'.repeat(64), workspaceId: 'synthetic-workspace', workspaceGeneration: 1,
  provider: 'blackboard', origin: 'https://shib.bu.edu' };
const secret = { identifier: 'synthetic@example.invalid', password: 'SYNTHETIC-password-canary-759' };
const allowed = (provider: string, origin: string) => provider === 'blackboard' && origin === 'https://shib.bu.edu';
type Snapshot = { generation: string; data: any };
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => { resolve = yes; });
  return { promise, resolve };
}
function memoryStore() {
  const records = new Map<string, Snapshot>();
  let generation = 0;
  return { records,
    read: vi.fn(async (id: string) => structuredClone(records.get(id) ?? null)),
    write: vi.fn(async (id: string, data: unknown, expectedGeneration: string | null) => {
      if ((records.get(id)?.generation ?? null) !== expectedGeneration) throw Object.assign(new Error(secret.password), { code: 412 });
      records.set(id, { generation: String(++generation), data: structuredClone(data) });
    }),
  };
}
function cryptographicKms() {
  let key = randomBytes(32);
  const keys = new Map<string, Buffer>([['1', key]]);
  let version = '1';
  return {
    rotate() { version = String(Number(version) + 1); key = randomBytes(32); keys.set(version, key); },
    wrap: vi.fn(async (bytes: Buffer, aad: Buffer) => {
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, nonce); cipher.setAAD(aad);
      const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
      return JSON.stringify({ version, nonce: nonce.toString('base64'), ciphertext: ciphertext.toString('base64'), tag: cipher.getAuthTag().toString('base64') });
    }),
    unwrap: vi.fn(async (wrapped: string, aad: Buffer) => {
      const value = JSON.parse(wrapped);
      const decipher = createDecipheriv('aes-256-gcm', keys.get(value.version)!, Buffer.from(value.nonce, 'base64'));
      decipher.setAAD(aad); decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64')), decipher.final()]);
    }),
  };
}
function setup() {
  const store = memoryStore(); const kms = cryptographicKms();
  const vault = createCredentialVault({ store, kms, validateOrigin: allowed, now: () => 123 });
  return { store, kms, vault };
}
const code = async (operation: Promise<unknown>, expected: string) => {
  try { await operation; throw new Error('Operation unexpectedly succeeded'); }
  catch (error) { expect(error).toBeInstanceOf(VaultError); expect((error as VaultError).code).toBe(expected);
    expect(String(error)).not.toContain(secret.password); expect(String(error)).not.toContain(secret.identifier); }
};

describe('isolated institutional vault — original synthetic credentials', () => {
  it('stores only encrypted credentials and returns safe metadata; real GCM round trip', async () => {
    const { vault, store } = setup();
    expect(await vault.metadata(binding)).toEqual({ status: 'empty', version: null });
    const saved = await vault.save(binding, secret, null);
    expect(saved).toEqual({ status: 'active', version: expect.any(String) });
    const stored = JSON.stringify([...store.records.values()]);
    expect(stored).not.toContain(secret.password); expect(stored).not.toContain(secret.identifier);
    expect(await vault.decrypt(binding, saved.version)).toEqual(secret);
    expect(await vault.metadata(binding)).toEqual(saved);
  });

  it('randomizes per-version DEK, nonce, ciphertext and version on replacement', async () => {
    const { vault, store } = setup();
    const first = await vault.save(binding, secret, null);
    const firstRecord = [...store.records.values()][0].data;
    const second = await vault.save(binding, secret, first.version);
    const secondRecord = [...store.records.values()][0].data;
    for (const field of ['credentialVersion', 'nonce', 'ciphertext', 'wrappedKey']) expect(secondRecord[field]).not.toBe(firstRecord[field]);
    await code(vault.decrypt(binding, first.version), 'CONFLICT');
    expect(await vault.decrypt(binding, second.version)).toEqual(secret);
  });

  it.each([
    { owner: 'b'.repeat(64) }, { provider: 'piazza', origin: 'https://piazza.com' },
  ])('never reads a different owner/provider record: %j', async (change) => {
    const { vault, store, kms } = setup(); const first = await vault.save(binding, secret, null);
    const other = { ...binding, ...change };
    // A different provider needs independent explicit destination approval.
    const foreign = change.provider ? createCredentialVault({ store, kms, validateOrigin: () => true }) : vault;
    expect(await foreign.metadata(other)).toEqual({ status: 'empty', version: null });
    await code(foreign.decrypt(other, first.version), 'NOT_FOUND');
  });

  it.each([{ workspaceId: 'another' }, { workspaceGeneration: 2 }])('rejects mismatched bound workspace %j', async (change) => {
    const { vault, kms } = setup(); const first = await vault.save(binding, secret, null);
    await code(vault.decrypt({ ...binding, ...change }, first.version), 'INTEGRITY');
    expect(kms.unwrap).not.toHaveBeenCalled();
  });

  it.each(['http://shib.bu.edu', 'https://shib.bu.edu:443', 'https://shib.bu.edu/path',
    'https://shib.bu.edu.evil.invalid', 'https://shib.bu.edu:444', 'https://user@shib.bu.edu'])('rejects unreviewed origin %s before storage', async (origin) => {
    const { vault, store, kms } = setup();
    await code(vault.save({ ...binding, origin }, secret, null), 'INVALID_BINDING');
    expect(store.read).not.toHaveBeenCalled(); expect(kms.wrap).not.toHaveBeenCalled();
  });

  it('authenticates record origin and version even if stored binding metadata is transplanted', async () => {
    const { vault, store, kms } = setup(); const saved = await vault.save(binding, secret, null);
    const record = [...store.records.values()][0];
    record.data.binding.workspaceGeneration = 2;
    await code(vault.decrypt({ ...binding, workspaceGeneration: 2 }, saved.version), 'UNAVAILABLE');
    expect(kms.unwrap).toHaveBeenCalled();
  });

  it('rejects ciphertext transplanted under another owner and a forged current version', async () => {
    const { vault, store } = setup(); const saved = await vault.save(binding, secret, null);
    const first = structuredClone([...store.records.values()][0]);
    const other = { ...binding, owner: 'd'.repeat(64) };
    await vault.save(other, { ...secret, identifier: 'different@example.invalid' }, null);
    const foreign = [...store.records.values()][1];
    foreign.data = { ...first.data, binding: other };
    await code(vault.decrypt(other, saved.version), 'UNAVAILABLE');
    const current = [...store.records.values()][0];
    current.data.credentialVersion = '11111111-1111-4111-8111-111111111111';
    await code(vault.decrypt(binding, current.data.credentialVersion), 'UNAVAILABLE');
  });

  it.each(['ciphertext', 'tag', 'nonce'])('rejects tampered %s without exposing provider details', async (field) => {
    const { vault, store } = setup(); const saved = await vault.save(binding, secret, null);
    const value = [...store.records.values()][0].data;
    const bytes = Buffer.from(value[field], 'base64'); bytes[0] ^= 1; value[field] = bytes.toString('base64');
    await code(vault.decrypt(binding, saved.version), 'INTEGRITY');
  });

  it('refuses malformed/injected record fields and secret payload extras', async () => {
    const { vault, store } = setup();
    await code(vault.save(binding, { ...secret, mfaSeed: 'never' }, null), 'INVALID_CREDENTIAL');
    const saved = await vault.save(binding, secret, null);
    [...store.records.values()][0].data.password = secret.password;
    await code(vault.decrypt(binding, saved.version), 'INTEGRITY');
  });

  it('does not store plaintext or publish records when KMS is unavailable', async () => {
    const { vault, store, kms } = setup();
    kms.wrap.mockRejectedValueOnce(new Error(secret.password));
    await code(vault.save(binding, secret, null), 'UNAVAILABLE'); expect(store.records.size).toBe(0);
    const saved = await vault.save(binding, secret, null);
    kms.unwrap.mockRejectedValueOnce(new Error(secret.identifier));
    await code(vault.decrypt(binding, saved.version), 'UNAVAILABLE');
    expect((await vault.metadata(binding)).version).toBe(saved.version);
  });

  it('allows exactly one concurrent create and one concurrent replacement', async () => {
    const { vault } = setup();
    const creates = await Promise.allSettled([vault.save(binding, secret, null), vault.save(binding, secret, null)]);
    expect(creates.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(creates.filter((x) => x.status === 'rejected')).toHaveLength(1);
    const version = (await vault.metadata(binding)).version;
    const updates = await Promise.allSettled([vault.save(binding, secret, version), vault.save(binding, secret, version)]);
    expect(updates.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(updates.filter((x) => x.status === 'rejected')).toHaveLength(1);
  });

  it('forgets ciphertext and forces explicit fresh tombstone version for recreate', async () => {
    const { vault, store } = setup(); const saved = await vault.save(binding, secret, null);
    const forgotten = await vault.forget(binding, saved.version);
    expect(forgotten.status).toBe('forgotten'); expect(forgotten.version).not.toBe(saved.version);
    const stored = [...store.records.values()][0].data;
    expect(Object.keys(stored).sort()).toEqual(['binding', 'credentialVersion', 'schema', 'status', 'updatedAt']);
    await code(vault.decrypt(binding, saved.version), 'NOT_FOUND');
    await code(vault.save(binding, secret, null), 'CONFLICT');
    await code(vault.save(binding, secret, saved.version), 'CONFLICT');
    const fresh = await vault.save(binding, secret, forgotten.version);
    expect(await vault.decrypt(binding, fresh.version)).toEqual(secret);
  });

  it('forget on empty vault fences an already-encrypting create', async () => {
    const { vault, kms } = setup(); const wait = deferred(); const entered = deferred();
    const wrap = kms.wrap.getMockImplementation()!;
    kms.wrap.mockImplementationOnce(async (...args) => { entered.resolve(); await wait.promise; return wrap(...args); });
    const saving = vault.save(binding, secret, null); await entered.promise;
    const tombstone = await vault.forget(binding, null);
    wait.resolve(); await code(saving, 'CONFLICT'); expect(await vault.metadata(binding)).toEqual(tombstone);
  });

  it('forget wins over pending decryption', async () => {
    const { vault, kms } = setup(); const saved = await vault.save(binding, secret, null);
    const wait = deferred(); const entered = deferred(); const unwrap = kms.unwrap.getMockImplementation()!;
    kms.unwrap.mockImplementationOnce(async (...args) => { entered.resolve(); await wait.promise; return unwrap(...args); });
    const decrypting = vault.decrypt(binding, saved.version); await entered.promise;
    await vault.forget(binding, saved.version); wait.resolve(); await code(decrypting, 'CONFLICT');
  });

  it('forget wins over a pending replacement and stale recreation', async () => {
    const { vault, kms } = setup(); const saved = await vault.save(binding, secret, null);
    const wait = deferred(); const entered = deferred(); const wrap = kms.wrap.getMockImplementation()!;
    kms.wrap.mockImplementationOnce(async (...args) => { entered.resolve(); await wait.promise; return wrap(...args); });
    const replacing = vault.save(binding, { ...secret, password: 'synthetic-new-secret' }, saved.version);
    await entered.promise; const tombstone = await vault.forget(binding, saved.version); wait.resolve();
    await code(replacing, 'CONFLICT'); expect(await vault.metadata(binding)).toEqual(tombstone);
    await code(vault.save(binding, secret, saved.version), 'CONFLICT');
  });

  it('checks version before KMS and refuses malformed owners or oversized inputs', async () => {
    const { vault, kms } = setup(); const saved = await vault.save(binding, secret, null);
    await code(vault.decrypt(binding, 'not-a-version'), 'CONFLICT');
    expect(kms.unwrap).not.toHaveBeenCalled();
    await code(vault.metadata({ ...binding, owner: [binding.owner] }), 'INVALID_BINDING');
    await code(vault.save(binding, { ...secret, password: '🧪'.repeat(8000) }, saved.version), 'INVALID_CREDENTIAL');
  });

  it('rotates key/version and keeps old grants invalid while preserving the secret', async () => {
    const { vault, kms, store } = setup(); const saved = await vault.save(binding, secret, null);
    const old = structuredClone([...store.records.values()][0].data); kms.rotate();
    const rotated = await vault.rotate(binding, saved.version);
    const fresh = [...store.records.values()][0].data;
    expect(rotated.version).not.toBe(saved.version); expect(fresh.wrappedKey).not.toBe(old.wrappedKey);
    expect(JSON.parse(fresh.wrappedKey).version).toBe('2');
    expect(await vault.decrypt(binding, rotated.version)).toEqual(secret);
    await code(vault.decrypt(binding, saved.version), 'CONFLICT');
  });

  it('a late rotation cannot revive forgotten credentials', async () => {
    const { vault, kms } = setup(); const saved = await vault.save(binding, secret, null);
    const wait = deferred(); const entered = deferred(); const wrap = kms.wrap.getMockImplementation()!;
    kms.wrap.mockImplementationOnce(async (...args) => { entered.resolve(); await wait.promise; return wrap(...args); });
    const rotating = vault.rotate(binding, saved.version); await entered.promise;
    const tombstone = await vault.forget(binding, saved.version); wait.resolve();
    await code(rotating, 'CONFLICT'); expect(await vault.metadata(binding)).toEqual(tombstone);
  });

  it('does not replace a usable record after failed rotation', async () => {
    const { vault, kms } = setup(); const saved = await vault.save(binding, secret, null);
    kms.wrap.mockRejectedValueOnce(new Error(secret.password));
    await code(vault.rotate(binding, saved.version), 'UNAVAILABLE');
    expect(await vault.decrypt(binding, saved.version)).toEqual(secret);
  });
});

describe('vault production adapter boundaries', () => {
  it('pins GCS downloads to the generation and writes with atomic preconditions', async () => {
    const calls: any[] = []; const payload = Buffer.from('{"synthetic":true}');
    const save = vi.fn(async (_bytes: Buffer, _options: unknown) => {});
    const bucket = { file: vi.fn((path: string, options?: unknown) => {
      calls.push({ path, options }); return { getMetadata: async () => [{ generation: '17', size: payload.length }],
        download: async () => [payload], save };
    }) };
    const adapter = createGcsVaultAdapter(bucket); const id = 'c'.repeat(64);
    expect(await adapter.read(id)).toEqual({ generation: '17', data: { synthetic: true } });
    expect(calls[1]).toEqual({ path: `credential-vault/${id}.json`, options: { generation: '17' } });
    await adapter.write(id, { safe: true }, '17');
    expect(save.mock.calls[0][1]).toMatchObject({ preconditionOpts: { ifGenerationMatch: '17' }, validation: 'crc32c' });
    await adapter.write(id, { safe: true }, null);
    expect(save.mock.calls[1][1]).toMatchObject({ preconditionOpts: { ifGenerationMatch: 0 } });
  });

  it('GCS rejects generation conflicts, large records and paths without leaking underlying errors', async () => {
    const bucket = { file: () => ({ save: async () => { throw Object.assign(new Error(secret.password), { code: 412 }); },
      getMetadata: async () => [{ generation: '1', size: 65537 }] }) };
    const adapter = createGcsVaultAdapter(bucket);
    await code(adapter.write('c'.repeat(64), {}, null), 'CONFLICT');
    await code(adapter.read('c'.repeat(64)), 'INTEGRITY');
    await code(adapter.read('../browser-contexts'), 'INTEGRITY');
  });

  it('uses fixed Cloud KMS resource, authenticated AAD and verified CRC32C', async () => {
    expect(vaultCrc32c(Buffer.from('123456789'))).toBe('3808858755');
    const dek = randomBytes(32); const wrapped = randomBytes(72); const aad = Buffer.from('synthetic-bound-context');
    const requests: any[] = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request, options?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(options?.body)); requests.push({ url, options, body });
      const encrypt = url.endsWith(':encrypt'); const output = encrypt ? wrapped : dek;
      const field = encrypt ? 'ciphertext' : 'plaintext';
      return new Response(JSON.stringify({ [field]: output.toString('base64'), [`${field}Crc32c`]: vaultCrc32c(output),
        verifiedPlaintextCrc32c: true, verifiedAdditionalAuthenticatedDataCrc32c: true }));
    });
    const kms = createKmsVaultAdapter({ keyName: 'projects/test/locations/us-east1/keyRings/vault/cryptoKeys/institutional', accessToken: async () => 'synthetic-token', fetchImpl });
    expect(await kms.wrap(dek, aad)).toBe(wrapped.toString('base64'));
    expect(await kms.unwrap(wrapped.toString('base64'), aad)).toEqual(dek);
    expect(requests[0].url).toBe('https://cloudkms.googleapis.com/v1/projects/test/locations/us-east1/keyRings/vault/cryptoKeys/institutional:encrypt');
    expect(requests[0].body.additionalAuthenticatedData).toBe(aad.toString('base64'));
    expect(requests[0].body.plaintextCrc32c).toBe(vaultCrc32c(dek));
    expect(requests[0].options.redirect).toBe('error');
  });

  it.each(['permission', 'checksum', 'aad-checksum'])('fails closed on KMS %s failure', async (failure) => {
    const dek = randomBytes(32);
    const fetchImpl = async () => failure === 'permission' ? new Response(secret.password, { status: 403 })
      : new Response(JSON.stringify({ ciphertext: dek.toString('base64'), ciphertextCrc32c: failure === 'checksum' ? '0' : vaultCrc32c(dek),
        verifiedPlaintextCrc32c: true, verifiedAdditionalAuthenticatedDataCrc32c: failure !== 'aad-checksum' }));
    const kms = createKmsVaultAdapter({ keyName: 'projects/test/locations/global/keyRings/vault/cryptoKeys/test', accessToken: async () => 'synthetic-token', fetchImpl });
    await code(kms.wrap(dek, Buffer.from('aad')), failure === 'permission' ? 'UNAVAILABLE' : 'INTEGRITY');
  });
});
