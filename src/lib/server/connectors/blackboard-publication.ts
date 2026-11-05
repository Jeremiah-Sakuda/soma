import type { Source, WorkspaceState } from '../../domain/types';
import { applyCollectedSources, staleCollectedSources, type CollectedSource } from './ingest';

/** Withdrawal is visible immediately in both observations and prepared lessons. */
export function withdrawBlackboardSources(
  state: WorkspaceState,
  matches: (source: Source) => boolean,
): WorkspaceState {
  return staleCollectedSources(state, matches);
}

/** Publish only observed text. A finished walk may stale missing observations, never erase them. */
export function publishBlackboardRead(
  state: WorkspaceState,
  input: {
    providerCourseId: string;
    courseId: string;
    records: CollectedSource[];
    materialIds: string[];
    complete: boolean;
    checkedAt: string;
  },
) {
  const prefix = 'blackboard:browser-blackboard:';
  const result = applyCollectedSources(
    state,
    input.records.map((record) => ({ ...record, courseId: input.courseId })),
    {
      provider: 'blackboard',
      connectionId: 'browser-blackboard',
      checkedAt: input.checkedAt,
    },
  );
  if (input.complete) {
    const observed = new Set(input.materialIds.map((id) => `${prefix}${id}`));
    withdrawBlackboardSources(result.workspace, (source) => {
      const key = source.provenance?.sourceKey;
      // Legacy exact-page observations are superseded only for this explicitly mapped course.
      const scoped = key?.startsWith(`${prefix}${input.providerCourseId}:`);
      const legacy = key?.startsWith(`${prefix}https://`) && source.courseId === input.courseId;
      return Boolean((scoped && !observed.has(key!)) || legacy);
    });
  }
  return result;
}
