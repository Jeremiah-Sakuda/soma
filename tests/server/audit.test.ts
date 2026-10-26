import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspace, closeLocalStore, deleteWorkspace, readWorkspace, updateWorkspace } from '../../src/lib/server/store';
import { createAuditRun, readAuditRuns, readAuditPage, closeLocalAuditStore, AuditStoreError } from '../../src/lib/server/audit-store';
import { GET } from '../../src/app/api/audit/route';
import type { WorkspaceAccess } from '../../src/lib/server/workspace-access';
import * as workspaceAccess from '../../src/lib/server/workspace-access';
import type { AuditEventInput } from '../../src/lib/domain/audit';
const event: AuditEventInput = { actor: 'model', kind: 'decision', summary: 'A diagnostic was selected.', rationale: 'Two explanations remain possible.', visibility: 'protected' };
const metadata = { kind: 'investigation' as const, trigger: 'Original synthetic test', mode: 'synthetic' as const };

describe('durable audit journal and projected API', () => {
  let dir: string, path: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'soma-audit-')); path = join(dir, 'store.sqlite'); vi.stubEnv('SOMA_LOCAL_DATABASE_PATH', path); vi.stubEnv('SOMA_PERSISTENCE', 'local-synthetic'); });
  afterEach(() => { closeLocalAuditStore(); closeLocalStore(); vi.useRealTimers(); vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });
  const fixture = async () => { const session = await createWorkspace(); return { ...session, access: { kind: 'demo', token: session.token } as WorkspaceAccess }; };
  const request = (token?: string, query = '') => new Request(`https://soma.example/api/audit${query}`, { headers: token ? { cookie: `soma_session=${token}` } : {} });

  it('records append-only ordered events across connection restart without changing workspace revision', async () => {
    const { workspace, access, token } = await fixture();
    const writer = await createAuditRun(access, workspace, metadata);
    await Promise.all(Array.from({ length: 8 }, (_, n) => writer.append({ actor: 'application', kind: 'observation', summary: `Checked fixture ${n}`, visibility: 'public' })));
    closeLocalAuditStore(); closeLocalStore();
    const [run] = await readAuditRuns(access, workspace);
    expect(run.events.map(item => item.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(run.journalRevision).toBe(8);
    expect(await readWorkspace(token)).toEqual(workspace);
    expect(run.events[0].rationaleStatus).toBe('unrecorded');
    const db = new DatabaseSync(path), row = db.prepare('SELECT token_hash,payload FROM audit_runs').get()!; db.close();
    expect(row.token_hash).not.toBe(token); expect(row.payload).not.toContain(token);
  });

  it('isolates other tokens, API reads, exports and nonexistent run IDs', async () => {
    const a = await fixture(), b = await fixture(), writer = await createAuditRun(a.access, a.workspace, metadata);
    await writer.append(event);
    expect(await readAuditRuns(b.access, b.workspace)).toEqual([]);
    expect((await GET(request(b.token, `?runId=${writer.id}&format=json`))).status).toBe(404);
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request(a.token, '?workspaceId=spoofed'))).status).toBe(400);
    expect((await GET(request(a.token, '?runId=bad'))).status).toBe(400);
    expect((await GET(request(a.token, '?format=raw'))).status).toBe(400);
    const response = await GET(request(a.token));
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect((await response.json()).workspaceId).toBe(a.workspace.id);
  });

  it('protects model details while live, on failure, and in JSON export', async () => {
    const a = await fixture(), writer = await createAuditRun(a.access, a.workspace, metadata);
    await writer.append({ ...event, visibility: 'public', evidence: [{ sourceId: a.workspace.sources[0].id, version: 1 }] });
    const live = await GET(request(a.token, `?runId=${writer.id}&format=json`));
    expect(live.headers.get('content-disposition')).toContain('attachment');
    const text = await live.text(); expect(text).not.toContain(event.rationale); expect(text).not.toContain(event.summary); expect(text).toContain('protected');
    await writer.finish({ status: 'failed' });
    const [run] = await readAuditRuns(a.access, a.workspace); expect(run.events[0].protected).toBe(true);
    await expect(writer.append(event)).rejects.toMatchObject({ code: 'audit_closed' });
    // The persisted original remains intact; exports never rewrite originals.
    const db = new DatabaseSync(path); expect(String(db.prepare('SELECT payload FROM audit_runs').get()?.payload)).toContain(event.rationale!); db.close();
  });

  it('unlocks terminal source-only rationale and leaves missing motivations unrecorded', async () => {
    const a = await fixture(), writer = await createAuditRun(a.access, a.workspace, metadata);
    await writer.append(event); await writer.append({ actor: 'application', kind: 'publication', summary: 'No study change was needed.', visibility: 'public' });
    await writer.finish({ status: 'unchanged', mode: 'prepared' });
    const [run] = await readAuditRuns(a.access, a.workspace);
    expect(run.mode).toBe('prepared'); expect(run.events[0]).toMatchObject({ rationale: event.rationale, rationaleStatus: 'recorded', protected: false });
    expect(run.events[1].rationaleStatus).toBe('unrecorded');
  });

  it('requires an actual current-version response or new recorded assistance for a selected lesson', async () => {
    const a = await fixture(), lesson = a.workspace.lessons[0], writer = await createAuditRun(a.access, a.workspace, metadata);
    await writer.append(event); await writer.finish({ status: 'published', selectedLessonId: lesson.id });
    expect((await readAuditRuns(a.access, a.workspace))[0].events[0].protected).toBe(true);
    const wrongVersion = structuredClone(a.workspace); wrongVersion.attempts.push({ id: 'old', lessonId: lesson.id, lessonVersion: lesson.version - 1, modelVersion: lesson.modelVersion, question: '', response: '', correct: null, assisted: false, assistance: [], createdAt: new Date().toISOString(), novel: true, feedback: '' });
    expect((await readAuditRuns(a.access, wrongVersion))[0].events[0].protected).toBe(true);
    wrongVersion.attempts[0].lessonVersion = lesson.version;
    expect((await readAuditRuns(a.access, wrongVersion))[0].events[0].protected).toBe(false);
    const changedInPlace = structuredClone(wrongVersion); changedInPlace.lessons[0].version++; changedInPlace.attempts[0].lessonVersion++;
    expect((await readAuditRuns(a.access, changedInPlace))[0].events[0].protected).toBe(true);
    const retainedVersions = structuredClone(wrongVersion); retainedVersions.lessons.unshift({ ...lesson, version: lesson.version + 1 });
    expect((await readAuditRuns(a.access, retainedVersions))[0].events[0].protected).toBe(true);
    const wrongModel = structuredClone(wrongVersion); wrongModel.attempts[0].modelVersion = 'different-model';
    expect((await readAuditRuns(a.access, wrongModel))[0].events[0].protected).toBe(true);
    const changedModel = structuredClone(wrongVersion); changedModel.lessons[0].modelVersion = 'replacement'; changedModel.attempts[0].modelVersion = 'replacement';
    expect((await readAuditRuns(a.access, changedModel))[0].events[0].protected).toBe(true);
    const wrongSources = structuredClone(wrongVersion); wrongSources.attempts[0].sourceVersions = { changed: 99 };
    expect((await readAuditRuns(a.access, wrongSources))[0].events[0].protected).toBe(true);
    const helped = await updateWorkspace(a.token, state => { state.assistance[lesson.id] = [`${new Date().toISOString()} · explanation`]; return state; });
    expect((await readAuditRuns(a.access, helped))[0].events[0].protected).toBe(false);
    expect((await GET(request(a.token, `?runId=${writer.id}&format=json`))).status).toBe(200);
  });

  it('rejects raw arguments, invalid references, oversized explanations, and stamps interrupted at the event bound', async () => {
    const a = await fixture(), writer = await createAuditRun(a.access, a.workspace, metadata);
    await expect(writer.append({ ...event, arguments: { password: 'must not persist' } } as AuditEventInput)).rejects.toMatchObject({ code: 'invalid_audit_event' });
    await expect(writer.append({ ...event, evidence: [{ sourceId: 'foreign', version: 1 }] })).rejects.toMatchObject({ code: 'invalid_audit_event' });
    await expect(writer.append({ ...event, rationale: 'x'.repeat(801) })).rejects.toMatchObject({ code: 'invalid_audit_event' });
    for (let n = 0; n < 100; n++) await writer.append(event);
    await expect(writer.append(event)).rejects.toMatchObject({ code: 'audit_event_capacity' });
    const [run] = await readAuditRuns(a.access, a.workspace); expect(run.status).toBe('interrupted'); expect(run.events).toHaveLength(100);
  });

  it('does not unlock proposed missing lessons or failed runs even after help', async () => {
    const a = await fixture();
    const writer = await createAuditRun(a.access, a.workspace, metadata);
    await writer.append(event); await writer.finish({ status: 'proposed', selectedLessonId: 'missing-lesson' });
    expect((await readAuditRuns(a.access, a.workspace))[0].events[0].protected).toBe(true);
    const sourceOnly = await createAuditRun(a.access, a.workspace, metadata); await sourceOnly.append(event); await sourceOnly.finish({ status: 'proposed' });
    expect((await readAuditRuns(a.access, a.workspace, sourceOnly.id))[0].events[0].protected).toBe(true);
  });

  it('keeps discarded diagnostic motivations protected even when a source-only outcome is terminal', async () => {
    const a = await fixture(), writer = await createAuditRun(a.access, a.workspace, metadata);
    await writer.append(event); await writer.finish({ status: 'unchanged', protectUnpublishedActivity: true });
    const [run] = await readAuditRuns(a.access, a.workspace);
    expect(run.events[0]).toMatchObject({ protected: true, rationaleStatus: 'protected', summary: 'Model details withheld to protect an unanswered or unpublished learning activity.' });
    const json = await (await GET(request(a.token, `?runId=${writer.id}&format=json`))).text(); expect(json).not.toContain(event.rationale);
  });

  it('rejects a finish against a different committed workspace revision', async () => {
    const a = await fixture(), writer = await createAuditRun(a.access, a.workspace, metadata);
    await updateWorkspace(a.token, state => state);
    await expect(writer.finish({ status: 'published', selectedLessonId: a.workspace.lessons[0].id, committedRevision: a.workspace.revision })).rejects.toMatchObject({ code: 'audit_context_changed' });
    expect((await readAuditRuns(a.access, (await readWorkspace(a.token))!))[0].status).toBe('running');
  });

  it('allows only application source-refresh observations to reference newly persisted versions', async () => {
    const a = await fixture(), ref = { sourceId: a.workspace.sources[0].id, version: 2 };
    const collector = await createAuditRun(a.access, a.workspace, { ...metadata, kind: 'source-refresh' });
    const model = await createAuditRun(a.access, a.workspace, metadata);
    await expect(collector.append({ ...event, actor: 'application', evidence: [ref] })).rejects.toMatchObject({ code: 'invalid_audit_event' });
    await updateWorkspace(a.token, state => { state.sources[0].version = 2; return state; });
    await collector.append({ ...event, actor: 'application', evidence: [ref] });
    await expect(collector.append({ ...event, evidence: [ref] })).rejects.toMatchObject({ code: 'invalid_audit_event' });
    await expect(model.append({ ...event, actor: 'application', evidence: [ref] })).rejects.toMatchObject({ code: 'invalid_audit_event' });
  });

  it('fails closed on a slow journal confirmation even if the dispatched creation settles later', async () => {
    const a = await fixture(); let release!: (state: typeof a.workspace) => void;
    const gate = new Promise<typeof a.workspace>(resolve => { release = resolve; });
    const reader = vi.spyOn(workspaceAccess, 'readWorkspaceByAccess').mockImplementationOnce(() => gate);
    vi.useFakeTimers();
    let proceeded = false;
    const pending = createAuditRun(a.access, a.workspace, metadata).then(async writer => { proceeded = true; await writer.append(event); }).catch(error => error);
    await vi.advanceTimersByTimeAsync(5001);
    expect(await pending).toMatchObject({ status: 503, code: 'audit_confirmation_timeout' }); expect(proceeded).toBe(false);
    release(a.workspace); await Promise.resolve(); await Promise.resolve(); reader.mockRestore(); vi.useRealTimers();
    expect((await readAuditRuns(a.access, a.workspace))[0].events).toEqual([]);
  });

  it('paginates a semester of same-timestamp runs without omissions or duplicates', async () => {
    const a = await fixture(); vi.useFakeTimers(); const ids: string[] = [];
    for (let index = 0; index < 67; index++) ids.push((await createAuditRun(a.access, a.workspace, metadata)).id);
    const first = await readAuditPage(a.access, a.workspace); expect(first.runs).toHaveLength(30); expect(first.nextCursor).toBeTruthy();
    const second = await readAuditPage(a.access, a.workspace, first.nextCursor); expect(second.runs).toHaveLength(30);
    const third = await readAuditPage(a.access, a.workspace, second.nextCursor); expect(third.runs).toHaveLength(7); expect(third.nextCursor).toBeUndefined();
    expect([...first.runs, ...second.runs, ...third.runs].map(run => run.id)).toEqual(ids.sort().reverse());
    expect((await GET(request(a.token, `?cursor=${first.nextCursor}&format=json`))).status).toBe(200);
    expect((await GET(request(a.token, `?cursor=${first.nextCursor}&runId=${ids[0]}`))).status).toBe(400);
    expect((await GET(request(a.token, '?cursor=not-a-cursor'))).status).toBe(400);
  });

  it('wraps raw persistence failure as a fatal typed journal failure', async () => {
    const a = await fixture(), writer = await createAuditRun(a.access, a.workspace, metadata);
    const db = new DatabaseSync(path); db.exec('DROP TABLE audit_runs'); db.close();
    await expect(writer.append(event)).rejects.toBeInstanceOf(AuditStoreError);
    await expect(writer.finish({ status: 'failed' })).rejects.toMatchObject({ status: 503, code: 'audit_storage_failed' });
  });

  it('enforces deletion, expiration, stale-running status, and read bounds', async () => {
    const a = await fixture(), writer = await createAuditRun(a.access, a.workspace, metadata);
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 6 * 60_000);
    expect((await readAuditRuns(a.access, a.workspace))[0].status).toBe('interrupted');
    vi.useRealTimers();
    for (let n = 0; n < 31; n++) await createAuditRun(a.access, a.workspace, metadata);
    expect(await readAuditRuns(a.access, a.workspace)).toHaveLength(30);
    await deleteWorkspace(a.token);
    await expect(writer.append(event)).rejects.toMatchObject({ status: 401 });
    const db = new DatabaseSync(path); expect(db.prepare('SELECT COUNT(*) AS count FROM audit_runs').get()?.count).toBe(0); db.close();
    const b = await fixture(), expired = await createAuditRun(b.access, b.workspace, metadata);
    vi.useFakeTimers(); vi.setSystemTime(Date.parse(b.workspace.expiresAt) + 1);
    await expect(expired.append(event)).rejects.toMatchObject({ status: 401 });
    expect((await GET(request(b.token))).status).toBe(401);
  });
});
