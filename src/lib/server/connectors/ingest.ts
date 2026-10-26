import { validateSourceContext, reconcileSourceRefresh, type SourceAuthorityContext } from '../../domain/source-context';
import { createHash } from 'node:crypto';
import type { Source, WorkspaceState } from '../../domain/types';
import { WorkspaceStoreError } from '../store';

export type CollectedSource = {
  id: string; title: string; body: string; courseId?: string; context?: SourceAuthorityContext; url?: string; modifiedAt?: string;
  kind: 'blackboard' | 'gradescope' | 'piazza' | 'email' | 'calendar';
};
export type CollectionContext = { provider: string; connectionId: string; checkedAt: string };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

/** Version normalized observations, without executing source text or inferring facts. */
export function applyCollectedSources(input: WorkspaceState, records: CollectedSource[], context: CollectionContext): { workspace: WorkspaceState; changedSourceIds: string[] } {
  if (input.mode !== 'account') throw new WorkspaceStoreError('Live collection requires a private account.', 403, 'account_required');
  if (records.length > 50 || !context.provider || !context.connectionId || !Number.isFinite(Date.parse(context.checkedAt))) throw new WorkspaceStoreError('Invalid collection batch.', 422, 'invalid_collection');
  const state = structuredClone(input); const changedSourceIds: string[] = []; const seen = new Set<string>();
  for (const record of records) {
    if (!record.id || record.id.length > 512 || !record.title || record.title.length > 300 || !record.body || record.body.length > 48_000 || !['blackboard', 'gradescope', 'piazza', 'email', 'calendar'].includes(record.kind)) throw new WorkspaceStoreError('Collected source exceeds its supported bounds.', 422, 'invalid_source');
    if (record.courseId && !state.courses.some(course => course.id === record.courseId)) throw new WorkspaceStoreError('Select a course in this workspace before collecting its sources.', 422, 'source_course_scope');
    if (record.url) {
      const url = new URL(record.url);
      if (url.protocol !== 'https:' || url.username || url.password || [...url.searchParams.keys()].some(key => /^(access_token|refresh_token|password|secret|authorization)$/i.test(key))) throw new WorkspaceStoreError('Source location is not safe to retain.', 422, 'source_location');
    }
    const declaredContext = validateSourceContext(state, record.courseId, record.context, record.body);
    const sourceKey = `${context.provider}:${context.connectionId}:${record.id}`;
    const id = `live-${digest(sourceKey).slice(0, 40)}`;
    if (seen.has(id)) throw new WorkspaceStoreError('Duplicate source identity in one collection.', 422, 'source_duplicate');
    seen.add(id);
    const fingerprint = digest(JSON.stringify({ title: record.title, body: record.body, courseId: record.courseId ?? null, url: record.url ?? null, kind: record.kind, context: declaredContext ?? null }));
    const previous = state.sources.filter(source => source.id === id).sort((a, b) => b.version - a.version)[0];
    if (previous && previous.courseId !== record.courseId) throw new WorkspaceStoreError('Source mapping changed; correct the connection selection first.', 409, 'source_mapping_conflict');
    if (previous?.provenance?.contentHash === fingerprint) {
      previous.retrievedAt = context.checkedAt;
      previous.status = 'current';
      reconcileSourceRefresh(state, previous);
      continue;
    }
    for (const source of state.sources.filter(source => source.id === id)) source.status = 'stale';
    const source: Source = {
      id, ...(record.courseId ? { courseId: record.courseId } : {}), title: record.title, body: record.body,
      kind: record.kind, version: (previous?.version ?? 0) + 1, origin: 'live', status: 'current',
      retrievedAt: context.checkedAt, observedAt: context.checkedAt,
      ...(declaredContext ? { context: declaredContext } : {}), ...(record.url ? { url: record.url } : {}), ...(record.modifiedAt ? { modifiedAt: record.modifiedAt } : {}),
      provenance: { origin: ['email', 'calendar'].includes(record.kind) ? 'live-google' : 'live-browser', sourceKey, contentHash: fingerprint, importedAt: context.checkedAt },
    };
    state.sources.push(source); changedSourceIds.push(id);
    reconcileSourceRefresh(state, source, previous);
  }
  return { workspace: state, changedSourceIds };
}
