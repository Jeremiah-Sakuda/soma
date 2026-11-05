import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const boundary = vi.hoisted(() => ({ token: '' }));
// Only the account identity adapter is replaced. Collection publication, the audit
// writer, fresh evidence authorization and every journal read use actual SQLite.
vi.mock('../../src/lib/server/account-store', async (original) => ({
  ...(await original<typeof import('../../src/lib/server/account-store')>()),
  readAccountWorkspace: async () =>
    (await import('../../src/lib/server/store')).readWorkspace(boundary.token),
}));
vi.mock('../../src/lib/server/audit-store', async (original) => {
  const actual = await original<typeof import('../../src/lib/server/audit-store')>();
  return {
    ...actual,
    createAuditRun: (
      _access: unknown,
      ...args: Parameters<typeof actual.createAuditRun> extends [unknown, ...infer Rest]
        ? Rest
        : never
    ) => actual.createAuditRun({ kind: 'demo', token: boundary.token }, ...args),
  };
});
import {
  createWorkspace,
  readWorkspace,
  updateWorkspace,
  closeLocalStore,
} from '../../src/lib/server/store';
import { auditedSourceCollection } from '../../src/lib/server/source-audit';
import { readAuditRuns, closeLocalAuditStore } from '../../src/lib/server/audit-store';
import type { VerifiedAccount } from '../../src/lib/server/account';
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'soma-source-audit-integration-'));
  vi.stubEnv('SOMA_PERSISTENCE', 'local-synthetic');
  vi.stubEnv('SOMA_LOCAL_DATABASE_PATH', join(directory, 'workspace.sqlite'));
});
afterEach(() => {
  closeLocalAuditStore();
  closeLocalStore();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

describe('source collection wrapper with the durable audit store', () => {
  it('authorizes a newly committed source version and completes its journal from the earlier snapshot', async () => {
    const fixture = await createWorkspace();
    boundary.token = fixture.token;
    const source = fixture.workspace.sources.find((item) => item.id === 'source-probability')!;
    const body =
      'Original synthetic changed course material; never copy this body into the journal.';
    const outcome = await auditedSourceCollection(
      {} as VerifiedAccount,
      'gmail',
      async () =>
        updateWorkspace(fixture.token, (state) => {
          const previous = state.sources.find((item) => item.id === source.id)!;
          previous.status = 'stale';
          state.sources.push({ ...previous, version: 2, status: 'current', body });
          return state;
        }),
      (value) => value,
    );
    expect(outcome.auditComplete).toBe(true);
    expect(
      outcome.value.sources.some(
        (item) => item.id === source.id && item.version === 2 && item.status === 'current',
      ),
    ).toBe(true);
    closeLocalAuditStore();
    closeLocalStore();
    const persisted = (await readWorkspace(fixture.token))!;
    const [run] = await readAuditRuns({ kind: 'demo', token: fixture.token }, persisted);
    expect(run).toMatchObject({ kind: 'source-refresh', status: 'published' });
    expect(run.sourceRefs).toContainEqual({ sourceId: source.id, version: 1 });
    expect(
      run.events.some(
        (event) =>
          event.kind === 'publication' &&
          event.evidence?.some((ref) => ref.sourceId === source.id && ref.version === 2),
      ),
    ).toBe(true);
    expect(JSON.stringify(run)).not.toContain(body);
    expect(run.events.every((event) => event.actor === 'application')).toBe(true);
    expect(run.events.map((event) => event.seq)).toEqual([1, 2, 3]);
  });
});
