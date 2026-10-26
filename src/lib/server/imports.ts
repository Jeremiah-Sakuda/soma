import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { CommitmentObservation, Source, WorkspaceState } from '../domain/types';
import { ingestCommitments, selectAvailability, setCalendarContext, refreshSessionRecommendation } from '../domain/commitments';
import { WorkspaceStoreError } from './store';

const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const timestamp = z.string().datetime({ offset: true });
const timezone = z.string().min(1).max(80).refine(value => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; } catch { return false; }
}, 'Use an IANA timezone');
const common = { importId: id, expectedRevision: z.number().int().min(0), sourceKey: z.string().trim().min(1).max(200), title: z.string().trim().min(1).max(160) };
const course = z.strictObject({ id, code: z.string().trim().min(1).max(40), title: z.string().trim().min(1).max(160), instructor: z.string().trim().max(120).optional() });
const event = z.strictObject({
  id, title: z.string().trim().min(1).max(160), category: z.enum(['Interview', 'Personal', 'Application']), kind: z.enum(['event', 'deadline']),
  startAt: timestamp, endAt: timestamp, status: z.enum(['confirmed', 'tentative', 'cancelled']),
  bufferBeforeMinutes: z.number().int().min(0).max(120).default(0), bufferAfterMinutes: z.number().int().min(0).max(120).default(0),
}).refine(value => value.kind === 'deadline' ? Date.parse(value.endAt) >= Date.parse(value.startAt) : Date.parse(value.endAt) > Date.parse(value.startAt), 'Event end must follow its start');

export const sourceImportSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...common, kind: z.literal('course-text'), text: z.string().trim().min(1).max(48_000), course }),
  z.strictObject({ ...common, kind: z.literal('email-text'), text: z.string().trim().min(1).max(48_000), course }),
  z.strictObject({ ...common, kind: z.literal('calendar-json'), timezone, events: z.array(event).max(50).refine(events => new Set(events.map(event => event.id)).size === events.length, 'Event IDs must be unique') }),
]);
export type SourceImport = z.infer<typeof sourceImportSchema>;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export async function readSourceImport(request: Request): Promise<SourceImport> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new WorkspaceStoreError('JSON is required.', 415, 'json_required');
  const reader = request.body?.getReader();
  if (!reader) throw new WorkspaceStoreError('Import content is required.', 400, 'invalid_import');
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 200_000) { await reader.cancel(); throw new WorkspaceStoreError('Import exceeds 200 KB. Split it into smaller selections.', 413, 'import_capacity'); }
    chunks.push(value);
  }
  let input: unknown;
  try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new WorkspaceStoreError('Import must be valid JSON.', 400, 'invalid_import'); }
  const parsed = sourceImportSchema.safeParse(input);
  if (!parsed.success) throw new WorkspaceStoreError('Import contains invalid fields, dates, timezone, or excessive content.', 400, 'invalid_import');
  return parsed.data;
}

/** Pure import: content is data; no URL fetch, source instruction execution, or external writes. */
export function applySourceImport(input: WorkspaceState, request: SourceImport, at: string | Date = new Date()): { workspace: WorkspaceState; changed: boolean; sourceIds: string[] } {
  if (input.mode !== 'account') throw new WorkspaceStoreError('Sign in to import your own selected material.', 403, 'account_required');
  const now = new Date(at).toISOString();
  const { importId, expectedRevision: _revision, ...content } = request;
  const contentHash = hash(JSON.stringify(content));
  const receipt = input.importReceipts?.find(item => item.key === importId);
  if (receipt) {
    if (receipt.hash !== contentHash) throw new WorkspaceStoreError('That import ID was already used for different content.', 409, 'import_key_conflict');
    return { workspace: input, changed: false, sourceIds: [receipt.sourceId] };
  }
  let state = structuredClone(input);
  const previousAvailability = selectAvailability(input, at);
  const origin = request.kind === 'calendar-json' ? 'manual-calendar' : request.kind === 'email-text' ? 'manual-email' : 'manual-course';
  const sourceId = `import-${hash(`${origin}:${request.sourceKey}`).slice(0, 32)}`;
  const previous = state.sources.filter(source => source.id === sourceId).sort((a, b) => b.version - a.version)[0];
  const courseId = request.kind === 'calendar-json' ? undefined : request.course.id;
  if (previous && previous.courseId !== courseId) throw new WorkspaceStoreError('This source already belongs to another course. Use a new source key or correct its mapping first.', 409, 'source_mapping_conflict');
  if (request.kind !== 'calendar-json') {
    const existingCourse = state.courses.find(item => item.id === request.course.id);
    if (!existingCourse) state.courses.push({ ...request.course, instructor: request.course.instructor ?? '', color: '#2244C2', nextEvent: 'No dated event imported', deadline: '' });
  }
  const changed = previous?.provenance?.contentHash !== contentHash;
  let source = previous;
  if (changed) {
    for (const old of state.sources.filter(item => item.id === sourceId)) old.status = 'stale';
    source = {
      id: sourceId, ...(courseId ? { courseId } : {}), title: request.title,
      body: request.kind === 'calendar-json' ? JSON.stringify({ timezone: request.timezone, events: request.events }, null, 2) : request.text,
      version: (previous?.version ?? 0) + 1, kind: 'upload', origin: 'manual-import', retrievedAt: now, observedAt: now, status: 'current',
      ...(request.kind === 'calendar-json' ? { timezone: request.timezone } : {}),
      provenance: { origin, sourceKey: request.sourceKey, contentHash, importedAt: now },
    };
    state.sources.push(source);
    for (const lesson of state.lessons) if (lesson.sourceIds.includes(sourceId)) lesson.state = 'stale';
  }
  if (!source) throw new Error('Import source was not created.');
  if (request.kind === 'calendar-json') {
    const priorCalendarKeys = new Set(state.sources.filter(item => item.provenance?.origin === 'manual-calendar' && item.status === 'current').map(item => item.provenance!.sourceKey));
    if (priorCalendarKeys.size > 1) throw new WorkspaceStoreError('Use one selected calendar source for this workspace.', 422, 'calendar_scope_limit');
    state.timezone = request.timezone;
    const refs = [{ sourceId: source.id, version: source.version }];
    const includedEventIds = new Set(request.events.map(item => `event-${hash(`${request.sourceKey}:${item.id}`).slice(0, 32)}`));
    const omittedPriorEvent = state.commitments?.some(commitment => commitment.status !== 'cancelled' && commitment.sourceRefs.some(ref => ref.sourceId === source!.id) && !includedEventIds.has(commitment.id));
    // A selection omitting an event does not prove the external event was cancelled.
    setCalendarContext(state, { status: omittedPriorEvent ? 'stale' : 'current', sourceRefs: refs, checkedAt: now, mode: 'manual-import' });
    const observations: CommitmentObservation[] = request.events.map(item => ({
      id: `observation-${hash(`${sourceId}:${source.version}:${item.id}`).slice(0, 32)}`,
      workspaceId: state.id, eventId: `event-${hash(`${request.sourceKey}:${item.id}`).slice(0, 32)}`,
      title: item.title, category: item.category, kind: item.kind, startAt: item.startAt, endAt: item.endAt,
      timezone: request.timezone, status: item.status, bufferBeforeMinutes: item.bufferBeforeMinutes, bufferAfterMinutes: item.bufferAfterMinutes,
      sourceRefs: refs, observedAt: now, identityBasis: 'Student-selected calendar source key and explicit event ID; no cross-source identity inferred.',
    }));
    state = ingestCommitments(state, observations, now, previousAvailability);
    refreshSessionRecommendation(state, now, 'Selected calendar import refreshed', previousAvailability);
  }
  state.importReceipts ??= [];
  state.importReceipts.push({ key: importId, sourceId: source.id, hash: contentHash, importedAt: now, ...(changed && request.kind !== 'calendar-json' ? { preparationRevision: input.revision + 1 } : {}) });
  return { workspace: state, changed, sourceIds: [source.id] };
}
