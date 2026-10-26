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

/** Retry-safe handoff: unchanged reads reuse jobs keyed by the source versions. */
export async function queueCollectedPreparation(account: VerifiedAccount, workspace: WorkspaceState, sourcePrefix: string): Promise<string> {
  const scopes = collectedPreparationScopes(workspace, sourcePrefix);
  if (!scopes.length) return '';
  let queued = 0; let pending = 0;
  for (const { courseId, sources } of scopes) {
    try {
      await enqueuePreparation(account, workspace, courseId,
        sources.map(source => ({ sourceId: source.id, version: source.version })),
        `Selected course material: ${sources.map(source => source.title).sort().join('; ')}`.slice(0, 300), 0);
      queued++;
    } catch { pending++; }
  }
  return `${queued ? ` ${queued} preparation job(s) saved or already queued; the worker can process them within the configured budget.` : ''}${pending ? ' Some preparation jobs could not be queued. Sources are saved; refresh again to retry.' : ''}`;
}
