import type { AuditRun } from '../../domain/audit';
import type { WorkspaceState } from '../../domain/types';
import { WorkspaceStoreError } from '../store';
import type { WorkspaceAccess } from '../workspace-access';

export class AuditStoreError extends WorkspaceStoreError {}
export const AUDIT_LIMITS = { events: 100, runBytes: 128 * 1024, runs: 5000, page: 30 } as const;
export type AuditCursor = [startedAt: string, id: string];
export type AuditMutation<T> = { run: AuditRun; result: T };

/** The adapter commits one owner-checked transition atomically. Policy lives above
 * this boundary; both adapters store the same run without projecting originals. */
export interface AuditStorage {
  create(access: WorkspaceAccess, state: WorkspaceState, run: AuditRun): Promise<void>;
  mutate<T>(
    access: WorkspaceAccess,
    workspaceId: string,
    id: string,
    change: (run: AuditRun) => AuditMutation<T>,
  ): Promise<T>;
  read(
    access: WorkspaceAccess,
    workspaceId: string,
    query: { runId?: string; after?: AuditCursor },
  ): Promise<AuditRun[]>;
  purgeExpiredDemos(limit: number): Promise<number>;
}
