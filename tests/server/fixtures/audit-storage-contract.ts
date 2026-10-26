import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AuditEventInput, AuditRun } from '../../../src/lib/domain/audit';
import type { WorkspaceState } from '../../../src/lib/domain/types';
import type { WorkspaceAccess } from '../../../src/lib/server/workspace-access';
import { createAuditRun, readAuditPage, readAuditRuns } from '../../../src/lib/server/audit-store';

export type AuditContractFixture = {
  workspace: WorkspaceState; access: WorkspaceAccess;
  other: { workspace: WorkspaceState; access: WorkspaceAccess };
  update(change: (state: WorkspaceState) => WorkspaceState): Promise<WorkspaceState>;
  reopen(): Promise<void>;
  raw(id: string): Promise<AuditRun>;
  // Native fixture setup does not stand in for adapter behavior under test. It
  // bounds managed writes while exercising real transactions at the boundaries.
  seed(runs: AuditRun[]): Promise<void>;
  exhaustQuota(run: AuditRun): Promise<void>;
  close(): Promise<void>;
};
const metadata = { kind: 'investigation' as const, trigger: 'Original synthetic adapter contract', mode: 'synthetic' as const };
const application: AuditEventInput = { actor: 'application', kind: 'observation', summary: 'A synthetic observation was recorded.', visibility: 'public' };
const model: AuditEventInput = { actor: 'model', kind: 'decision', summary: 'Selected a synthetic diagnostic.', rationale: 'The source leaves two possibilities open.', visibility: 'protected' };

/** Identical behavioral assertions execute against both actual persistence
 * engines. Firebase is opt-in; neither harness substitutes a fake transaction. */
export function auditStorageContract(name: string, setup: () => Promise<AuditContractFixture>, enabled = true) {
  describe.skipIf(!enabled)(`${name}: shared audit storage contract`, () => {
    let fixture: AuditContractFixture;
    beforeEach(async () => { fixture = await setup(); });
    afterEach(async () => { await fixture?.close(); });

    it('serializes concurrent appends, survives reopen and leaves the study revision alone', async () => {
      const writer = await createAuditRun(fixture.access, fixture.workspace, metadata);
      await Promise.all([writer.append(application), writer.append({ ...application, summary: 'Another actual append.' })]);
      await fixture.reopen();
      const [run] = await readAuditRuns(fixture.access, fixture.workspace, writer.id);
      expect(run.events.map(event => event.seq)).toEqual([1, 2]); expect(run.journalRevision).toBe(2);
      expect(run.events.map(event => event.summary).sort()).toEqual([application.summary, 'Another actual append.'].sort());
      expect(await fixture.update(state => { expect(state.revision).toBe(fixture.workspace.revision); return state; })).toMatchObject({ id: fixture.workspace.id });
    }, 30_000);

    it('isolates owners, rejects invalid fields/references, and validates fresh collector evidence', async () => {
      const writer = await createAuditRun(fixture.access, fixture.workspace, metadata);
      expect(await readAuditRuns(fixture.other.access, fixture.other.workspace, writer.id)).toEqual([]);
      await expect(writer.append({ ...application, arguments: { credential: 'not a real secret' } } as AuditEventInput)).rejects.toMatchObject({ code: 'invalid_audit_event' });
      await expect(writer.append({ ...model, evidence: [{ sourceId: 'not-owned', version: 1 }] })).rejects.toMatchObject({ code: 'invalid_audit_event' });
      const collector = await createAuditRun(fixture.access, fixture.workspace, { ...metadata, kind: 'source-refresh' });
      const source = fixture.workspace.sources[0], ref = { sourceId: source.id, version: source.version + 1 };
      await expect(collector.append({ ...application, evidence: [ref] })).rejects.toMatchObject({ code: 'invalid_audit_event' });
      await fixture.update(state => { state.sources[0].version++; return state; });
      await collector.append({ ...application, evidence: [ref] });
      await expect(collector.append({ ...model, evidence: [ref] })).rejects.toMatchObject({ code: 'invalid_audit_event' });
      await expect(writer.append({ ...application, evidence: [ref] })).rejects.toMatchObject({ code: 'invalid_audit_event' });
      expect((await fixture.raw(collector.id)).events).toHaveLength(1);
    }, 30_000);

    it('makes matching terminal confirmation idempotent and refuses conflicting closure or append', async () => {
      const writer = await createAuditRun(fixture.access, fixture.workspace, metadata);
      await writer.append(model); await writer.finish({ status: 'unchanged', mode: 'prepared' });
      const original = await fixture.raw(writer.id);
      await writer.finish({ status: 'unchanged', mode: 'prepared' });
      expect(await fixture.raw(writer.id)).toEqual(original);
      await expect(writer.finish({ status: 'failed' })).rejects.toMatchObject({ code: 'audit_closed' });
      await expect(writer.append(application)).rejects.toMatchObject({ code: 'audit_closed' });
      expect((await readAuditRuns(fixture.access, fixture.workspace, writer.id))[0].events[0]).toMatchObject({ rationale: model.rationale, protected: false });
    }, 30_000);

    it('preserves the confirmed prefix and closes atomically at the event and byte limits', async () => {
      const writer = await createAuditRun(fixture.access, fixture.workspace, metadata), initial = await fixture.raw(writer.id);
      const events = Array.from({ length: 99 }, (_, index) => ({ ...application, seq: index + 1, at: initial.startedAt }));
      await fixture.seed([{ ...initial, events, journalRevision: 99 }]);
      await writer.append(application);
      await expect(writer.append(application)).rejects.toMatchObject({ code: 'audit_event_capacity' });
      const full = await fixture.raw(writer.id);
      expect(full.events).toHaveLength(100); expect(full.status).toBe('interrupted'); expect(full.journalRevision).toBe(101);
      const bytesWriter = await createAuditRun(fixture.access, fixture.workspace, metadata), bytesRun = await fixture.raw(bytesWriter.id);
      const large = { ...model, summary: 's'.repeat(600), rationale: 'r'.repeat(800) };
      while (Buffer.byteLength(JSON.stringify(bytesRun)) + 1600 < 128 * 1024) {
        bytesRun.events.push({ ...large, seq: bytesRun.events.length + 1, at: bytesRun.startedAt });
      }
      bytesRun.journalRevision = bytesRun.events.length;
      expect(bytesRun.events.length).toBeLessThan(100);
      // Fit a valid last event below the byte limit; the next append must fail.
      await fixture.seed([bytesRun]);
      await expect(bytesWriter.append({ ...large, evidence: Array.from({ length: 30 }, () => ({ sourceId: fixture.workspace.sources[0].id, version: fixture.workspace.sources[0].version })) })).rejects.toMatchObject({ code: 'audit_event_capacity' });
      const bounded = await fixture.raw(bytesWriter.id);
      expect(bounded.events).toEqual(bytesRun.events); expect(bounded.status).toBe('interrupted');
      expect(Buffer.byteLength(JSON.stringify(bounded))).toBeLessThanOrEqual(128 * 1024);
    }, 30_000);

    it('enforces the per-owner run quota without deleting existing history', async () => {
      const writer = await createAuditRun(fixture.access, fixture.workspace, metadata), original = await fixture.raw(writer.id);
      await fixture.exhaustQuota(original);
      await expect(createAuditRun(fixture.access, fixture.workspace, metadata)).rejects.toMatchObject({ code: 'audit_capacity', status: 429 });
      expect(await fixture.raw(writer.id)).toEqual(original);
      const other = await createAuditRun(fixture.other.access, fixture.other.workspace, metadata);
      expect(other.id).not.toBe(writer.id);
    }, 30_000);

    it('paginates tied timestamps without omissions and rejects malformed cursors', async () => {
      const writer = await createAuditRun(fixture.access, fixture.workspace, metadata), initial = await fixture.raw(writer.id);
      const runs = Array.from({ length: 32 }, () => ({ ...initial, id: randomUUID() }));
      await fixture.seed(runs);
      const first = await readAuditPage(fixture.access, fixture.workspace);
      expect(first.runs).toHaveLength(30); expect(first.nextCursor).toBeTruthy();
      const second = await readAuditPage(fixture.access, fixture.workspace, first.nextCursor);
      expect(second.runs).toHaveLength(3); expect(second.nextCursor).toBeUndefined();
      expect([...first.runs, ...second.runs].map(run => run.id)).toEqual([...runs, initial].map(run => run.id).sort().reverse());
      await expect(readAuditPage(fixture.access, fixture.workspace, 'not-a-cursor')).rejects.toMatchObject({ code: 'invalid_audit_cursor' });
    }, 30_000);

    it('uses current lesson/model/source pins to disclose a completed diagnostic without rewriting originals', async () => {
      const writer = await createAuditRun(fixture.access, fixture.workspace, metadata), lesson = fixture.workspace.lessons[0];
      await writer.append(model); await writer.finish({ status: 'published', selectedLessonId: lesson.id, committedRevision: fixture.workspace.revision });
      const original = await fixture.raw(writer.id);
      expect((await readAuditRuns(fixture.access, fixture.workspace, writer.id))[0].events[0].protected).toBe(true);
      const responded = await fixture.update(state => { state.assistance[lesson.id] = [`${new Date().toISOString()} · explanation`]; return state; });
      expect((await readAuditRuns(fixture.access, responded, writer.id))[0].events[0].protected).toBe(false);
      for (const change of [(state: WorkspaceState) => { state.lessons[0].version++; }, (state: WorkspaceState) => { state.lessons[0].modelVersion = 'replacement'; }, (state: WorkspaceState) => { state.lessons[0].sourceVersions = { unavailable: 99 }; }]) {
        const changed = structuredClone(responded); change(changed);
        expect((await readAuditRuns(fixture.access, changed, writer.id))[0].events[0].protected).toBe(true);
      }
      expect(await fixture.raw(writer.id)).toEqual(original);
      const discarded = await createAuditRun(fixture.access, responded, metadata);
      await discarded.append(model); await discarded.finish({ status: 'unchanged', protectUnpublishedActivity: true });
      expect((await readAuditRuns(fixture.access, responded, discarded.id))[0].events[0]).toMatchObject({ protected: true, rationaleStatus: 'protected' });
    }, 30_000);
  });
}
