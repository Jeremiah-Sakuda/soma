import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeLocalStore, createWorkspace, deleteWorkspace, getPersistenceMode, readWorkspace, updateWorkspace } from '../../src/lib/server/store';

describe('durable synthetic session store', () => {
  let directory: string;
  let databasePath: string;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'soma-store-'));
    databasePath = join(directory, 'demo.sqlite');
    vi.stubEnv('SOMA_LOCAL_DATABASE_PATH', databasePath);
    vi.stubEnv('SOMA_PERSISTENCE', 'local-synthetic');
  });
  afterEach(() => {
    closeLocalStore();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    rmSync(directory, { recursive: true, force: true });
  });

  it('isolates ten sessions; IDs and invented tokens cannot authorize access', async () => {
    const sessions = await Promise.all(Array.from({ length: 10 }, () => createWorkspace()));
    expect(new Set(sessions.map(session => session.token)).size).toBe(10);
    await updateWorkspace(sessions[0].token, state => ({ ...state, preferences: { ...state.preferences, sessionMinutes: 35 } }));
    expect((await readWorkspace(sessions[0].token))?.preferences.sessionMinutes).toBe(35);
    for (const other of sessions.slice(1)) {
      expect((await readWorkspace(other.token))?.revision).toBe(0);
      expect(await readWorkspace(other.workspace.id)).toBeNull();
    }
    expect(await readWorkspace('f'.repeat(64))).toBeNull();
    await deleteWorkspace(sessions[0].token);
    expect(await readWorkspace(sessions[0].token)).toBeNull();
    expect(await readWorkspace(sessions[1].token)).not.toBeNull();
  });

  it('persists across closed/reopened SQLite connections and stores only a token hash', async () => {
    const session = await createWorkspace();
    const updated = await updateWorkspace(session.token, state => ({ ...state, preferences: { ...state.preferences, workedExamples: false } }), 0);
    closeLocalStore();
    expect(await readWorkspace(session.token)).toEqual(updated);
    const raw = new DatabaseSync(databasePath);
    const row = raw.prepare('SELECT token_hash, payload FROM demo_sessions').get() as { token_hash: string; payload: string };
    raw.close();
    expect(row.token_hash).toBe(createHash('sha256').update(session.token).digest('hex'));
    expect(row.payload).not.toContain(session.token);
  });

  it('rejects stale revisions before calling a mutator', async () => {
    const { token } = await createWorkspace();
    await updateWorkspace(token, state => state, 0);
    const mutate = vi.fn(state => state);
    await expect(updateWorkspace(token, mutate, 0)).rejects.toMatchObject({ status: 409, code: 'revision_conflict' });
    expect(mutate).not.toHaveBeenCalled();
  });

  it('commits exactly one of two concurrent updates without losing the winning change', async () => {
    const { token } = await createWorkspace();
    let enter!: () => void;
    let release!: () => void;
    const entered = new Promise<void>(resolve => { enter = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const slow = updateWorkspace(token, async state => {
      enter(); await gate;
      return { ...state, preferences: { ...state.preferences, sessionMinutes: 50 } };
    });
    await entered;
    const winner = await updateWorkspace(token, state => ({ ...state, preferences: { ...state.preferences, sessionMinutes: 25 } }));
    release();
    await expect(slow).rejects.toMatchObject({ status: 409 });
    expect(await readWorkspace(token)).toEqual(winner);
    expect(winner.revision).toBe(1);
  });

  it('expires access and cleans local expired sessions', async () => {
    const { token, workspace } = await createWorkspace();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.parse(workspace.expiresAt) + 1));
    expect(await readWorkspace(token)).toBeNull();
    await expect(updateWorkspace(token, state => state)).rejects.toMatchObject({ status: 401 });
    const raw = new DatabaseSync(databasePath);
    expect(raw.prepare('SELECT COUNT(*) AS count FROM demo_sessions').get()?.count).toBe(0);
    raw.close();
  });

  it('rejects session extension, private material, and oversized writes without changing persisted state', async () => {
    const { token, workspace } = await createWorkspace();
    await expect(updateWorkspace(token, state => ({ ...state, expiresAt: '2099-01-01T00:00:00.000Z' }))).rejects.toMatchObject({ code: 'immutable_workspace' });
    await expect(updateWorkspace(token, state => ({ ...state, sources: state.sources.map(source => ({ ...source, kind: 'upload' as const })) }))).rejects.toMatchObject({ code: 'synthetic_only' });
    await expect(updateWorkspace(token, state => ({ ...state, sources: state.sources.map(source => ({ ...source, body: 'x'.repeat(800_000) })) }))).rejects.toMatchObject({ status: 413 });
    expect(await readWorkspace(token)).toEqual(workspace);
  });

  it('requires explicit Firestore selection, independent of credential presence', () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', 'example-project');
    expect(getPersistenceMode()).toBe('local-synthetic');
    vi.stubEnv('SOMA_PERSISTENCE', 'firestore');
    expect(getPersistenceMode()).toBe('firestore');
    vi.stubEnv('SOMA_PERSISTENCE', 'firestrore');
    expect(() => getPersistenceMode()).toThrow('SOMA_PERSISTENCE must be');
  });
});
