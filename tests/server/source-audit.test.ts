import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
const fixture = vi.hoisted(() => ({ before: undefined as any, events: [] as any[], finishes: [] as any[], failCreate: false, failAppendAfter: Infinity }));
vi.mock('../../src/lib/server/account-store', () => ({ readAccountWorkspace: async () => fixture.before }));
vi.mock('../../src/lib/server/audit-store', () => ({ createAuditRun: async () => {
  if (fixture.failCreate) throw new Error('journal unavailable');
  return { id: 'fixture-run', append: async (event: unknown) => { if (fixture.events.length >= fixture.failAppendAfter) throw new Error('journal unavailable'); fixture.events.push(event); }, finish: async (patch: unknown) => { fixture.finishes.push(patch); } };
} }));
import { auditedSourceCollection } from '../../src/lib/server/source-audit';
import type { VerifiedAccount } from '../../src/lib/server/account';
const account = {} as VerifiedAccount;
beforeEach(() => { fixture.before = seedEmptyAccountWorkspace('original-source-audit'); fixture.events = []; fixture.finishes = []; fixture.failCreate = false; fixture.failAppendAfter = Infinity; });
describe('selected source collection audit boundaries', () => {
  it('cannot collect when the journal fails before the read', async () => {
    fixture.failCreate = true; const collect = vi.fn(async () => seedEmptyAccountWorkspace('never-collected'));
    await expect(auditedSourceCollection(account, 'gmail', collect, value => value)).rejects.toThrow('journal unavailable');
    expect(collect).not.toHaveBeenCalled();
  });
  it('records actual committed versions without queries, page bodies or credentials', async () => {
    const after = structuredClone(fixture.before);
    after.sources.push({ id: 'observed-course-source', version: 1, title: 'Original synthetic source', body: 'Private-looking synthetic fixture body is excluded from audit.', kind: 'email', status: 'current', retrievedAt: after.createdAt });
    expect(await auditedSourceCollection(account, 'gmail', async () => after, value => value)).toEqual({ value: after, auditComplete: true });
    expect(fixture.events.find(event => event.kind === 'publication').evidence).toEqual([{ sourceId: 'observed-course-source', version: 1 }]);
    expect(fixture.finishes).toEqual([{ status: 'published' }]);
    expect(JSON.stringify(fixture.events)).not.toContain(after.sources[0].body);
    expect(fixture.events.every(event => event.actor === 'application')).toBe(true);
  });
  it('retains successful source persistence when the later journal confirmation fails', async () => {
    fixture.failAppendAfter = 1; const persisted = structuredClone(fixture.before);
    const result = await auditedSourceCollection(account, 'blackboard', async () => persisted, value => value);
    expect(result.value).toBe(persisted); expect(result.auditComplete).toBe(false); expect(fixture.finishes).toEqual([]);
  });
  it('labels unchanged checks and sanitizes failed provider details', async () => {
    await auditedSourceCollection(account, 'calendar', async () => fixture.before, value => value);
    expect(fixture.finishes).toEqual([{ status: 'unchanged' }]);
    const secretMessage = 'DO NOT RETAIN synthetic provider token';
    await expect(auditedSourceCollection(account, 'piazza', async () => { throw new Error(secretMessage); }, value => value)).rejects.toThrow(secretMessage);
    expect(fixture.finishes.at(-1)).toEqual({ status: 'failed' });
    expect(JSON.stringify(fixture.events)).not.toContain(secretMessage);
  });
});
