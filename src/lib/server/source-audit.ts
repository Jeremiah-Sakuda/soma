import type { WorkspaceState } from '../domain/types';
import type { VerifiedAccount } from './account';
import { readAccountWorkspace } from './account-store';
import { createAuditRun } from './audit-store';
import { WorkspaceStoreError } from './store';

/** Fixed application observations only. Provider queries, URLs, tokens and page bodies never enter the journal. */
export async function auditedSourceCollection<T>(account: VerifiedAccount, provider: string, collect: () => Promise<T>, workspaceOf: (value: T) => WorkspaceState): Promise<{ value: T; auditComplete: boolean }> {
  if (!['gmail', 'calendar', 'blackboard', 'gradescope', 'piazza'].includes(provider)) throw new WorkspaceStoreError('Unsupported source provider.', 400, 'source_provider');
  const before = await readAccountWorkspace(account);
  if (!before) throw new WorkspaceStoreError('Private workspace is unavailable.', 404, 'workspace_missing');
  const audit = await createAuditRun({ kind: 'account', account }, before, { kind: 'source-refresh', trigger: `Selected ${provider} source refresh`, mode: 'live', engineVersion: 'selected-source-collector-v1' });
  await audit.append({ actor: 'application', kind: 'started', summary: `A read-only check of the selected ${provider} scope started.`, visibility: 'public' });
  let value: T;
  try { value = await collect(); }
  catch (error) {
    try { await audit.append({ actor: 'application', kind: 'stopped', summary: 'The source check did not complete. Retained observations and connection status remain inspectable separately.', visibility: 'public' }); await audit.finish({ status: 'failed' }); } catch { /* A confirmed prefix remains; interrupted projection explains incomplete journaling. */ }
    throw error;
  }
  const after = workspaceOf(value);
  if (after.id !== before.id) throw new WorkspaceStoreError('Workspace generation changed during source collection.', 409, 'workspace_changed');
  try {
    const changed = after.sources.filter(source => source.status === 'current' && !before.sources.some(previous => previous.id === source.id && previous.version === source.version));
    await audit.append({ actor: 'application', kind: 'observation', summary: changed.length ? `${changed.length} new source version(s) are present in the saved workspace after this selected-source check.` : 'The selected-source check completed without a new source version. Existing preparation can be preserved.', visibility: 'public' });
    for (let offset = 0; offset < changed.length; offset += 30) await audit.append({ actor: 'application', kind: 'publication', summary: 'These observed source versions were committed to this workspace. Model interpretation and preparation are separate runs.', evidence: changed.slice(offset, offset + 30).map(source => ({ sourceId: source.id, version: source.version })), visibility: 'public' });
    await audit.finish({ status: changed.length ? 'published' : 'unchanged' });
    return { value, auditComplete: true };
  } catch { return { value, auditComplete: false }; }
}
