import type { WorkspaceState } from '../../domain/types';
import type { VerifiedAccount } from '../account';
import { enqueuePreparation } from '../jobs';

/** Each bounded job covers a stable part of the semester's retained sources. */
export function collectedPreparationScopes(workspace: WorkspaceState, sourcePrefix: string) {
  const groups = new Map<string, typeof workspace.sources>();
  for (const source of workspace.sources) {
    if (source.origin !== 'live' || source.status !== 'current' || !source.courseId || !source.provenance?.sourceKey.startsWith(sourcePrefix)) continue;
    const group = groups.get(source.courseId) ?? [];
    group.push(source); groups.set(source.courseId, group);
  }
  return [...groups].flatMap(([courseId, sources]) => {
    sources.sort((a, b) => a.id.localeCompare(b.id));
    const chunks = [];
    for (let start = 0; start < sources.length; start += 20) chunks.push({ courseId, sources: sources.slice(start, start + 20) });
    return chunks;
  });
}

export type PreparationHandoffFailure = 'capacity' | 'source-change' | 'unavailable';
export type PreparationHandoffResult = { courseId: string } & (
  | { status: 'queued' | 'ready' }
  | { status: 'deferred'; code: PreparationHandoffFailure }
);

function handoffFailure(error: unknown): PreparationHandoffFailure {
  // Preserve only known application facts. Exception text and provider status
  // cannot establish capacity, source state or inference-budget availability.
  let code: unknown;
  try { code = error && typeof error === 'object' && 'code' in error ? error.code : undefined; } catch { return 'unavailable'; }
  if (code === 'job_capacity') return 'capacity';
  if (code === 'job_source_scope' || code === 'revision_conflict' || code === 'workspace_changed') return 'source-change';
  return 'unavailable';
}

/** Retry-safe handoff facts, separate from the successful source collection.
 * A partial enqueue failure never changes saved observations or their freshness. */
export async function handoffCollectedPreparation(account: VerifiedAccount, workspace: WorkspaceState, sourcePrefix: string): Promise<PreparationHandoffResult[]> {
  const outcomes: PreparationHandoffResult[] = [];
  for (const { courseId, sources } of collectedPreparationScopes(workspace, sourcePrefix)) {
    try {
      const job = await enqueuePreparation(account, workspace, courseId,
        sources.map(source => ({ sourceId: source.id, version: source.version })),
        `Selected course material: ${sources.map(source => source.title).sort().join('; ')}`.slice(0, 300), 0, 'investigate-change');
      outcomes.push(job.status === 'ready' ? { courseId, status: 'ready' }
        : job.status === 'stale' ? { courseId, status: 'deferred', code: 'source-change' }
        : ['queued', 'generating', 'checking'].includes(job.status) ? { courseId, status: 'queued' }
        : { courseId, status: 'deferred', code: 'unavailable' });
    } catch (error) { outcomes.push({ courseId, status: 'deferred', code: handoffFailure(error) }); }
  }
  return outcomes;
}

/** Preserve the string response used by current source routes and workers. */
export async function queueCollectedPreparation(account: VerifiedAccount, workspace: WorkspaceState, sourcePrefix: string): Promise<string> {
  const outcomes = await handoffCollectedPreparation(account, workspace, sourcePrefix);
  const queued = outcomes.filter(outcome => outcome.status === 'queued').length;
  const ready = outcomes.filter(outcome => outcome.status === 'ready').length;
  const failures = new Set(outcomes.flatMap(outcome => outcome.status === 'deferred' ? [outcome.code] : []));
  return `${queued ? ` ${queued} source investigation job(s) saved or already queued for background processing.` : ''}`
    + `${ready ? ` ${ready} source investigation job(s) already completed; saved outcomes remain available.` : ''}`
    + `${failures.has('capacity') ? ' Sources are saved. The preparation queue is full; background recovery can queue pending work when a slot opens. You can retry later.' : ''}`
    + `${failures.has('source-change') ? ' Sources are saved, but selected versions changed before preparation could be queued. Refresh selected sources to queue their current versions.' : ''}`
    + `${failures.has('unavailable') ? ' Sources are saved, but preparation is unavailable. Retry later; the background worker can recover pending source handoffs.' : ''}`;
}
