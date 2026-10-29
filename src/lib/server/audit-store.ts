import { randomUUID } from 'node:crypto';
import { auditEventInputSchema, auditRunMetadataSchema, auditFinishSchema, auditRunView, type AuditRun, type AuditRunMetadata, type AuditEventInput, type AuditFinish, type AuditRunView } from '../domain/audit';
import type { WorkspaceState } from '../domain/types';
import { getPersistenceMode } from './store';
import { readWorkspaceByAccess, type WorkspaceAccess } from './workspace-access';
import { AUDIT_LIMITS, AuditStoreError, type AuditStorage } from './audit-storage/contract';
import { sqliteAuditStorage } from './audit-storage/sqlite';
import { firestoreAuditStorage } from './audit-storage/firestore';
export { AuditStoreError } from './audit-storage/contract';
export { closeLocalAuditStore } from './audit-storage/sqlite';

export type AuditWriter = { id: string; append(event: AuditEventInput): Promise<void>; finish(patch: AuditFinish): Promise<void> };
function auditStorage(): AuditStorage { return getPersistenceMode() === 'firestore' ? firestoreAuditStorage : sqliteAuditStorage; }
async function createAuditRunInternal(access: WorkspaceAccess, state: WorkspaceState, metadata: AuditRunMetadata): Promise<AuditWriter> {
  const parsed = auditRunMetadataSchema.safeParse(metadata);
  if (!parsed.success || (parsed.data.courseId && !state.courses.some(course => course.id === parsed.data.courseId))) throw new AuditStoreError('Invalid audit metadata.', 422, 'invalid_audit_metadata');
  const now = new Date().toISOString();
  const run: AuditRun = { ...parsed.data, id: randomUUID(), workspaceId: state.id, contextRevision: state.revision,
    sourceRefs: state.sources.filter(source => !parsed.data.courseId || source.courseId === parsed.data.courseId).slice(0, 200).map(source => ({ sourceId: source.id, version: source.version })),
    ...(state.sources.filter(source => !parsed.data.courseId || source.courseId === parsed.data.courseId).length > 200 ? { sourceRefsTruncated: true } : {}),
    status: 'running', startedAt: now, updatedAt: now, journalRevision: 0, events: [] };
  const refs = new Set(state.sources.map(source => `${source.id}:${source.version}`));
  // Select once: an in-flight writer cannot switch persistence after creation.
  const storage = auditStorage();
  await storage.create(access, state, run);
  return { id: run.id,
    async append(event) {
      const parsedEvent = auditEventInputSchema.safeParse(event);
      if (!parsedEvent.success) throw new AuditStoreError('Audit event is invalid.', 422, 'invalid_audit_event');
      const unknownRefs = parsedEvent.data.evidence?.filter(ref => !refs.has(`${ref.sourceId}:${ref.version}`)) ?? [];
      if (unknownRefs.length) {
        // A collector may record a newly persisted version after the initial snapshot.
        // Models cannot grant themselves access to later or invented evidence.
        const fresh = parsed.data.kind === 'source-refresh' && parsedEvent.data.actor === 'application' ? await readWorkspaceByAccess(access) : null;
        if (!fresh || fresh.id !== state.id || unknownRefs.some(ref => !fresh.sources.some(source => source.id === ref.sourceId && source.version === ref.version))) throw new AuditStoreError('Audit event refers to unavailable evidence.', 422, 'invalid_audit_event');
      }
      const capacity = await storage.mutate(access, state.id, run.id, current => {
        if (current.status !== 'running') throw new AuditStoreError('Audit run is already closed.', 409, 'audit_closed');
        const next: AuditRun = { ...current, updatedAt: new Date().toISOString(), journalRevision: current.journalRevision + 1,
          events: [...current.events, { ...parsedEvent.data, seq: current.events.length + 1, at: new Date().toISOString() }] };
        if (next.events.length > AUDIT_LIMITS.events || Buffer.byteLength(JSON.stringify(next)) > AUDIT_LIMITS.runBytes) return { run: { ...current, status: 'interrupted', updatedAt: next.updatedAt, journalRevision: next.journalRevision }, result: true };
        return { run: next, result: false };
      });
      if (capacity) throw new AuditStoreError('Audit journal event capacity reached; processing stopped.', 413, 'audit_event_capacity');
    },
    async finish(patch) {
      const parsedFinish = auditFinishSchema.safeParse(patch); if (!parsedFinish.success) throw new AuditStoreError('Invalid audit outcome.', 422, 'invalid_audit_outcome');
      const finishPatch = Object.fromEntries(Object.entries(parsedFinish.data).filter(([, value]) => value !== undefined)) as AuditFinish;
      const hasLesson = Boolean(parsedFinish.data.selectedLessonId || parsedFinish.data.publishedLessonId);
      const fresh = hasLesson || parsedFinish.data.committedRevision !== undefined ? await readWorkspaceByAccess(access) : undefined;
      if (hasLesson && (!fresh || fresh.id !== state.id)) throw new AuditStoreError('Workspace generation is no longer active.', 409, 'audit_generation_changed');
      if (parsedFinish.data.committedRevision !== undefined && (!fresh || fresh.id !== state.id || fresh.revision !== parsedFinish.data.committedRevision)) throw new AuditStoreError('The workspace changed before audit confirmation.', 409, 'audit_context_changed');
      const pins: Pick<AuditRun, 'selectedLessonVersion' | 'publishedLessonVersion' | 'selectedLessonContext' | 'publishedLessonContext'> = {};
      for (const [idKey, versionKey] of [['selectedLessonId', 'selectedLessonVersion'], ['publishedLessonId', 'publishedLessonVersion']] as const) {
        const id = parsedFinish.data[idKey]; if (!id) continue;
        const lesson = fresh?.lessons.find(item => item.id === id && (!parsed.data.courseId || item.courseId === parsed.data.courseId));
        if (!lesson && parsedFinish.data.status !== 'proposed') throw new AuditStoreError('The audit outcome refers to an unavailable activity.', 422, 'invalid_audit_outcome');
        if (lesson) { pins[versionKey] = lesson.version; pins[idKey === 'selectedLessonId' ? 'selectedLessonContext' : 'publishedLessonContext'] = { modelVersion: lesson.modelVersion, sourceVersions: { ...lesson.sourceVersions } }; }
      }
      const capacity = await storage.mutate(access, state.id, run.id, current => {
        if (current.status !== 'running') {
          if (current.status === parsedFinish.data.status && Object.entries(finishPatch).every(([key, value]) => current[key as keyof AuditRun] === value)) return { run: current, result: false };
          throw new AuditStoreError('Audit run is already closed.', 409, 'audit_closed');
        }
        const next = { ...current, ...finishPatch, ...pins, updatedAt: new Date().toISOString(), journalRevision: current.journalRevision + 1 };
        if (Buffer.byteLength(JSON.stringify(next)) > AUDIT_LIMITS.runBytes) return { run: { ...current, status: 'interrupted', updatedAt: next.updatedAt, journalRevision: next.journalRevision }, result: true };
        return { run: next, result: false };
      });
      if (capacity) throw new AuditStoreError('Audit outcome capacity reached; confirmation is incomplete.', 413, 'audit_event_capacity');
    },
  };
}
async function readAuditPageInternal(access: WorkspaceAccess, state: WorkspaceState, runId?: string, cursor?: string): Promise<AuditPage> {
  const after = decodeAuditCursor(cursor);
  if (runId && after) throw new AuditStoreError('Choose a run or a history cursor.', 400, 'invalid_audit_cursor');
  if (runId && !/^[a-f0-9-]{36}$/.test(runId)) throw new AuditStoreError('Invalid audit run.', 400, 'invalid_audit_id');
  const runs = await auditStorage().read(access, state.id, { runId, after });
  const owned = runs.filter(run => run.workspaceId === state.id), hasMore = owned.length > AUDIT_LIMITS.page, page = owned.slice(0, AUDIT_LIMITS.page);
  return { runs: page.map(run => auditRunView(run, state)), ...(hasMore ? { nextCursor: encodeAuditCursor(page[page.length - 1]) } : {}) };
}
export type AuditPage = { runs: AuditRunView[]; nextCursor?: string };
function encodeAuditCursor(run: AuditRun): string { return Buffer.from(JSON.stringify([run.startedAt, run.id])).toString('base64url'); }
function decodeAuditCursor(cursor?: string): [string, string] | undefined {
  if (cursor === undefined) return undefined;
  try {
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(cursor)) throw new Error();
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || new Date(value[0]).toISOString() !== value[0] || typeof value[1] !== 'string' || !/^[a-f0-9-]{36}$/.test(value[1])) throw new Error();
    return value as [string, string];
  } catch { throw new AuditStoreError('Invalid audit history cursor.', 400, 'invalid_audit_cursor'); }
}
export async function readAuditPage(access: WorkspaceAccess, state: WorkspaceState, cursor?: string): Promise<AuditPage> { return readAuditPageInternal(access, state, undefined, cursor); }
export async function readAuditRuns(access: WorkspaceAccess, state: WorkspaceState, runId?: string): Promise<AuditRunView[]> { return (await readAuditPageInternal(access, state, runId)).runs; }


function auditFailure(error: unknown): AuditStoreError {
  if (error instanceof AuditStoreError) return error;
  const typed = error as { status?: number; code?: string; message?: string };
  const status = typed.status && typed.status >= 400 && typed.status <= 503 ? typed.status : 503;
  return new AuditStoreError(status < 500 ? typed.message ?? 'Audit access is no longer valid.' : 'The audit journal is unavailable. Processing stopped before further decisions.', status, typed.status ? typed.code ?? 'audit_access_failed' : 'audit_storage_failed');
}
/** Journal errors remain distinguishable so callers cannot silently fall back unaudited. */
export async function createAuditRun(access: WorkspaceAccess, state: WorkspaceState, metadata: AuditRunMetadata): Promise<AuditWriter> {
  let writer: AuditWriter;
  try { writer = await auditDeadline(createAuditRunInternal(access, state, metadata)); } catch (error) { throw auditFailure(error); }
  return { id: writer.id,
    async append(event) { try { await auditDeadline(writer.append(event)); } catch (error) { throw auditFailure(error); } },
    async finish(patch) { try { await auditDeadline(writer.finish(patch)); } catch (error) { throw auditFailure(error); } },
  };
}

/** Fail closed after five seconds. A dispatched append may still settle remotely;
 * callers must stop and must not retry assuming no event was stored. The journal
 * is the confirmed prefix, and stale in-progress runs display as interrupted. */
function auditDeadline<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new AuditStoreError('Audit confirmation timed out. Processing stopped; the journal may contain only a confirmed prefix.', 503, 'audit_confirmation_timeout')), 5000); timer.unref?.(); });
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}

/** Bounded scheduler janitor; only expired anonymous-demo children qualify. */
export async function purgeExpiredDemoAuditData(limit = 25): Promise<number> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AuditStoreError('Invalid audit cleanup bound.', 422, 'invalid_audit_cleanup');
  try { return await auditDeadline(auditStorage().purgeExpiredDemos(limit)); } catch (error) { throw auditFailure(error); }
}
