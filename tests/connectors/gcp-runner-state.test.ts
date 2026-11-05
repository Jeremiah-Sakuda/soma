import { randomBytes, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  createGcsStateAdapter,
  createStateStore,
  validateStorageState,
} from '../../services/browser-runner/state.mjs';

const owner = 'a'.repeat(64),
  other = 'b'.repeat(64),
  key = randomBytes(32);
const state = () => ({
  cookies: [
    {
      name: 'session',
      value: 'original-synthetic-cookie',
      domain: '.example.com',
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ],
  origins: [
    {
      origin: 'https://example.com',
      localStorage: [{ name: 'fixture', value: 'original-synthetic-local-storage' }],
    },
  ],
});
type RecordValue = { generation: number; data: any };
function memory() {
  const records = new Map<string, RecordValue>();
  const adapter = {
    beforeWrite: undefined as
      undefined | ((id: string, data: any, expected: number | null) => Promise<void>),
    async read(id: string) {
      return structuredClone(records.get(id) ?? null);
    },
    async write(id: string, data: any, expected: number | null) {
      await adapter.beforeWrite?.(id, data, expected);
      const previous = records.get(id);
      if ((previous?.generation ?? null) !== expected)
        throw Object.assign(new Error('CAS conflict'), { code: 412 });
      records.set(id, { generation: (previous?.generation ?? 0) + 1, data: structuredClone(data) });
    },
  };
  return { records, adapter };
}
function fixture() {
  const { records, adapter } = memory();
  let clock = Date.now();
  return {
    records,
    adapter,
    now: () => clock,
    advance: (delta: number) => {
      clock += delta;
    },
    store: createStateStore(adapter, key, { now: () => clock }),
  };
}

describe('encrypted browser state and generation fencing', () => {
  it('roundtrips only encrypted private state, exposes metadata alone, and does not print auth material', async () => {
    const f = fixture(),
      log = vi.spyOn(console, 'log'),
      error = vi.spyOn(console, 'error');
    try {
      const id = await f.store.create(owner),
        session = randomUUID();
      expect(await f.store.read(id, owner)).toBeNull();
      expect(await f.store.claim(id, owner, session, f.now() + 60_000)).toEqual({
        storageState: null,
        expiresAt: f.now() + 60_000,
      });
      expect(await f.store.inspect(id, owner)).toEqual({
        active: { id: session, expiresAt: f.now() + 60_000 },
      });
      await f.store.finish(id, owner, session, state());
      expect(await f.store.read(id, owner)).toEqual(state());
      const persisted = JSON.stringify(f.records.get(id));
      expect(persisted).not.toContain('original-synthetic-cookie');
      expect(persisted).not.toContain('original-synthetic-local-storage');
      expect(await f.store.inspect(id, owner)).toEqual({ active: null });
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });

  it('serializes competing claims and prevents another owner from reading, claiming or deleting', async () => {
    const f = fixture(),
      id = await f.store.create(owner);
    const results = await Promise.allSettled([
      f.store.claim(id, owner, randomUUID(), f.now() + 60_000),
      f.store.claim(id, owner, randomUUID(), f.now() + 60_000),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(f.store.claim(id, owner, randomUUID(), f.now() + 60_000)).rejects.toMatchObject({
      code: 'state_session_active',
      status: 409,
    });
    for (const operation of [
      f.store.read(id, other),
      f.store.inspect(id, other),
      f.store.claim(id, other, randomUUID(), f.now() + 60_000),
      f.store.remove(id, other),
    ])
      await expect(operation).rejects.toMatchObject({ code: 'state_not_found', status: 404 });
    expect(f.records.get(id)?.data.deleted).toBe(false);
  });

  it('rejects late snapshots after expiry or a replacement session', async () => {
    const f = fixture(),
      id = await f.store.create(owner),
      old = randomUUID(),
      replacement = randomUUID();
    await f.store.claim(id, owner, old, f.now() + 10_000);
    f.advance(10_001);
    await expect(f.store.finish(id, owner, old, state())).rejects.toMatchObject({
      code: 'state_session_stale',
    });
    await f.store.claim(id, owner, replacement, f.now() + 60_000);
    await expect(f.store.finish(id, owner, old, state())).rejects.toMatchObject({
      code: 'state_session_stale',
    });
    await expect(f.store.abandon(id, owner, old)).rejects.toMatchObject({
      code: 'state_session_stale',
    });
    expect((await f.store.inspect(id, owner)).active?.id).toBe(replacement);
  });

  it('retains previous encrypted state when a failed startup abandons its exact claim', async () => {
    const f = fixture(),
      id = await f.store.create(owner),
      first = randomUUID(),
      failed = randomUUID();
    await f.store.claim(id, owner, first, f.now() + 60_000);
    await f.store.finish(id, owner, first, state());
    const sealed = structuredClone(f.records.get(id)?.data.state);
    await f.store.claim(id, owner, failed, f.now() + 60_000);
    await f.store.abandon(id, owner, failed);
    expect((await f.store.inspect(id, owner)).active).toBeNull();
    expect(f.records.get(id)?.data.state).toEqual(sealed);
    expect((await f.store.claim(id, owner, randomUUID(), f.now() + 60_000)).storageState).toEqual(
      state(),
    );
  });

  it('tombstones racing finishes and cannot resurrect a removed context', async () => {
    const f = fixture(),
      id = await f.store.create(owner),
      session = randomUUID();
    await f.store.claim(id, owner, session, f.now() + 60_000);
    let release!: () => void, paused!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
      }),
      entered = new Promise<void>((resolve) => {
        paused = resolve;
      });
    f.adapter.beforeWrite = async (_id, data) => {
      if (data.state !== null) {
        paused();
        await gate;
      }
    };
    const finishing = f.store.finish(id, owner, session, state());
    await entered;
    await f.store.remove(id, owner);
    release();
    await expect(finishing).rejects.toMatchObject({ code: 'state_conflict' });
    await f.store.remove(id, owner);
    expect(f.records.get(id)?.data).toEqual({
      v: 1,
      owner,
      deleted: true,
      state: null,
      active: null,
    });
    await expect(f.store.read(id, owner)).rejects.toMatchObject({ status: 404 });
    await expect(f.store.inspect(id, owner)).rejects.toMatchObject({ status: 404 });
    await expect(f.store.abandon(id, owner, session)).rejects.toMatchObject({ status: 404 });
    await expect(f.store.claim(id, owner, randomUUID(), f.now() + 60_000)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('retries deletion after a racing claim and leaves metadata only', async () => {
    const f = fixture(),
      id = await f.store.create(owner);
    let interposed = false;
    f.adapter.beforeWrite = async (_id, data, expected) => {
      if (data.deleted && !interposed) {
        interposed = true;
        const previous = f.records.get(id)!;
        f.records.set(id, {
          generation: Number(expected) + 1,
          data: { ...previous.data, active: { id: randomUUID(), expiresAt: f.now() + 60_000 } },
        });
      }
    };
    await f.store.remove(id, owner);
    expect(f.records.get(id)?.data).toEqual({
      v: 1,
      owner,
      deleted: true,
      state: null,
      active: null,
    });
  });

  it('authenticates context, owner, key and ciphertext without disclosing the saved tokens in errors', async () => {
    const f = fixture(),
      id = await f.store.create(owner),
      session = randomUUID();
    await f.store.claim(id, owner, session, f.now() + 60_000);
    await f.store.finish(id, owner, session, state());
    const wrong = createStateStore(f.adapter, randomBytes(32), { now: f.now });
    await expect(wrong.read(id, owner)).rejects.toMatchObject({ code: 'state_integrity_failed' });
    const replay = await f.store.create(owner);
    f.records.get(replay)!.data.state = structuredClone(f.records.get(id)!.data.state);
    await expect(f.store.read(replay, owner)).rejects.toMatchObject({
      code: 'state_integrity_failed',
    });
    f.records.get(id)!.data.owner = other;
    await expect(f.store.read(id, other)).rejects.toMatchObject({ code: 'state_integrity_failed' });
    f.records.get(id)!.data.owner = owner;
    f.records.get(id)!.data.state.tag = randomBytes(16).toString('base64url');
    let message = '';
    try {
      await f.store.read(id, owner);
    } catch (error) {
      message = String(error);
    }
    expect(message).toBe('Error: Private browser state is unavailable for this operation.');
    expect(message).not.toContain('synthetic');
  });

  it('validates identities, key formats, manifest fields, leases and the 8MiB import limit', async () => {
    expect(() => createStateStore(memory().adapter, '')).toThrow();
    expect(() => createStateStore(memory().adapter, Buffer.alloc(31))).toThrow();
    const f = fixture(),
      id = await f.store.create(owner);
    await expect(f.store.create('invalid')).rejects.toMatchObject({ status: 404 });
    await expect(f.store.read('../context', owner)).rejects.toMatchObject({ status: 404 });
    await expect(f.store.claim(id, owner, randomUUID(), f.now())).rejects.toMatchObject({
      code: 'state_session_invalid',
    });
    await expect(
      f.store.claim(id, owner, randomUUID(), f.now() + 31 * 60_000),
    ).rejects.toMatchObject({ code: 'state_session_invalid' });
    const huge = state();
    huge.cookies[0].value = 'x'.repeat(8 * 1024 * 1024);
    expect(() => validateStorageState(huge)).toThrow(
      expect.objectContaining({ code: 'state_too_large', status: 413 }),
    );
    f.records.get(id)!.data.credentials = [{ privateKey: 'not real' }];
    await expect(f.store.read(id, owner)).rejects.toMatchObject({ code: 'state_corrupt' });
  });

  it('roundtrips actual Playwright IndexedDB JSON/encoded data while rejecting executable or malformed imports', async () => {
    const original: any = state();
    original.origins[0].indexedDB = [
      {
        name: 'synthetic-auth',
        version: 1,
        stores: [
          {
            name: 'tokens',
            autoIncrement: false,
            keyPath: 'id',
            indexes: [{ name: 'by-id', keyPath: 'id', multiEntry: false, unique: true }],
            records: [
              { value: { id: 'synthetic', token: 'original-synthetic-idb-token' } },
              {
                valueEncoded: {
                  o: [
                    { k: 'id', v: 'encoded-synthetic' },
                    { k: 'date', v: { d: '2026-10-27T00:00:00.000Z' } },
                    { k: 'binary', v: { ta: { k: 'ui8', b: 'AQID' } } },
                  ],
                  id: 1,
                },
              },
            ],
          },
        ],
      },
    ];
    const f = fixture(),
      id = await f.store.create(owner),
      session = randomUUID();
    await f.store.claim(id, owner, session, f.now() + 60_000);
    await f.store.finish(id, owner, session, original);
    expect(await f.store.read(id, owner)).toEqual(original);
    expect(JSON.stringify(f.records.get(id))).not.toContain('original-synthetic-idb-token');
    for (const invalid of [
      { ...state(), credentials: [{ privateKey: 'excluded' }] },
      { ...state(), origins: [{ origin: 'https://user:password@example.com', localStorage: [] }] },
      { ...state(), origins: [{ origin: 'file:///tmp/private', localStorage: [] }] },
      { ...state(), origins: [{ origin: 'https://example.com', localStorage: [], opfs: [] }] },
      { ...state(), cookies: [{ ...state().cookies[0], expires: Infinity }] },
      { ...state(), cookies: [{ ...state().cookies[0], domain: 'example.com/path' }] },
    ])
      expect(() => validateStorageState(invalid)).toThrow(
        expect.objectContaining({ code: 'state_invalid' }),
      );
    for (const valueEncoded of [
      { fn: 'malicious-binding' },
      { h: 1 },
      { ref: 999 },
      { o: [{ k: '__proto__', v: 'bad' }], id: 1 },
    ]) {
      const invalid = structuredClone(original);
      invalid.origins[0].indexedDB[0].stores[0].records = [{ valueEncoded }];
      expect(() => validateStorageState(invalid)).toThrow(
        expect.objectContaining({ code: 'state_invalid' }),
      );
    }
  });

  it('pins GCS payload download to metadata generation and uses conditional replacements', async () => {
    const content = { v: 1, owner, deleted: false, state: null, active: null },
      bytes = Buffer.from(JSON.stringify(content));
    const download = vi.fn(async () => [bytes]),
      save = vi.fn(async (_contents: string, _options: unknown) => {}),
      calls: any[] = [];
    const bucket = {
      file: vi.fn((path: string, options?: unknown) => {
        calls.push([path, options]);
        return {
          getMetadata: async () => [
            { generation: '90071992547409931', size: String(bytes.length) },
          ],
          download,
          save,
        };
      }),
    };
    const adapter = createGcsStateAdapter(bucket),
      id = randomUUID();
    expect(await adapter.read(id)).toEqual({ generation: '90071992547409931', data: content });
    expect(calls).toEqual([
      [`browser-contexts/${id}.json`, undefined],
      [`browser-contexts/${id}.json`, { generation: '90071992547409931' }],
    ]);
    await adapter.write(id, content, '90071992547409931');
    expect(save.mock.calls[0][1]).toMatchObject({
      preconditionOpts: { ifGenerationMatch: '90071992547409931' },
      resumable: false,
      metadata: { cacheControl: 'no-store' },
    });
    await adapter.write(id, content, null);
    expect(save.mock.calls[1][1]).toMatchObject({ preconditionOpts: { ifGenerationMatch: 0 } });
  });
});
