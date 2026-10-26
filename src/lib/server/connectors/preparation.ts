import type { WorkspaceState } from '../../domain/types';
import type { VerifiedAccount } from '../account';
import { enqueuePreparation } from '../jobs';

/** Retry-safe handoff: unchanged reads reuse jobs keyed by the source versions. */
export async function queueCollectedPreparation(account: VerifiedAccount, workspace: WorkspaceState, sourcePrefix: string): Promise<string> {
  const groups = new Map<string, typeof workspace.sources>();
  for (const source of workspace.sources) {
    if (source.origin !== 'live' || source.status !== 'current' || !source.courseId || !source.provenance?.sourceKey.startsWith(sourcePrefix)) continue;
    const group = groups.get(source.courseId) ?? [];
    group.push(source); groups.set(source.courseId, group);
  }
  if (!groups.size) return '';
  let queued = 0; let pending = 0;
  for (const [courseId, sources] of groups) {
    try {
      await enqueuePreparation(account, workspace, courseId,
        sources.map(source => ({ sourceId: source.id, version: source.version })),
        `Selected course material: ${sources.map(source => source.title).sort().join('; ')}`.slice(0, 300), 0);
      queued++;
    } catch { pending++; }
  }
  return `${queued ? ` ${queued} course preparation job(s) saved or already queued; the worker can process them within the configured budget.` : ''}${pending ? ' Some preparation jobs could not be queued. Sources are saved; refresh again to retry.' : ''}`;
}
