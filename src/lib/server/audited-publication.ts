import type { WorkspaceState, AgentRun } from '../domain/types';
import type { AuditFinish, AuditRunMetadata } from '../domain/audit';
import type { WorkspaceAccess } from './workspace-access';
import { createAuditRun, AuditStoreError, type AuditWriter } from './audit-store';
import { InferenceBudgetError } from './budget';
import type { InvestigationResult } from './investigator';
import type { prepareWithSpark } from './meta';

export type PublicationOutcome =
  | { kind: 'lesson'; result: Awaited<ReturnType<typeof prepareWithSpark>> }
  | { kind: 'investigation'; result: InvestigationResult }
  | { kind: 'prepared'; failure?: unknown; failedRun?: AgentRun }
  | { kind: 'failed-investigation'; failedRun: AgentRun };

function confirmation(outcome: PublicationOutcome): AuditFinish {
  if (outcome.kind === 'prepared') return { status: outcome.failure ? outcome.failure instanceof InferenceBudgetError ? 'blocked' : 'failed' : 'unchanged', mode: 'prepared' };
  if (outcome.kind === 'failed-investigation') return { status: 'failed' };
  const result = outcome.result;
  const reused = outcome.kind === 'lesson' ? result.run.status === 'unchanged' : outcome.result.reused;
  const selectedLessonId = outcome.kind === 'lesson' ? outcome.result.lesson.id : outcome.result.selectedLessonId;
  const publishedLessonId = reused ? undefined : outcome.result.lesson?.id;
  return { status: reused ? 'unchanged' : 'published', ...(reused ? { mode: 'prepared' } : {}),
    ...(selectedLessonId ? { selectedLessonId } : {}), ...(publishedLessonId ? { publishedLessonId } : {}),
    ...(outcome.kind === 'investigation' && outcome.result.protectUnpublishedActivity ? { protectUnpublishedActivity: true } : {}) };
}

type PublicationOptions<O extends PublicationOutcome> = {
  access: WorkspaceAccess; before: WorkspaceState; metadata: AuditRunMetadata;
  execute: (audit: AuditWriter) => Promise<O>;
  publish: (outcome: O) => Promise<WorkspaceState>;
  reuse?: 'commit' | 'reopen';
  confirmation?: 'report' | 'require';
  onFailure?: (error: unknown) => Promise<void>;
};

/** Interactive callers show incomplete confirmation; workers report it without relabeling saved work. */
export async function runAuditedPublication<O extends PublicationOutcome>(options: PublicationOptions<O>) {
  const execution = await executePublication(options);
  if (!execution.auditComplete && options.confirmation === 'require') throw new AuditStoreError('The outcome was saved, but final audit confirmation could not be recorded.', 503, 'audit_confirmation_failed');
  return execution;
}

/** Owns the commit boundary: audit failures before work stop it; after commit they cannot undo it. */
async function executePublication<O extends PublicationOutcome>(options: PublicationOptions<O>) {
  let audit: AuditWriter | undefined;
  try {
    audit = await createAuditRun(options.access, options.before, options.metadata);
    const outcome = await options.execute(audit);
    const finish = confirmation(outcome);
    const reopened = options.reuse === 'reopen' && outcome.kind === 'investigation' && outcome.result.reused;
    const workspace = reopened ? options.before : await options.publish(outcome);
    // No catch below this point may call failure cleanup: persistence has succeeded.
    try {
      if (!reopened) await audit.append({ ...(outcome.kind === 'investigation' ? { evidence: outcome.result.record.sourceRefs.map(({sourceId,version})=>({sourceId,version})).slice(0,30) } : {}), actor: 'application', kind: 'publication', visibility: 'public',
        summary: outcome.kind === 'prepared' ? 'Saved the supported prepared-practice outcome. No new live lesson was published.'
          : outcome.kind === 'failed-investigation' ? 'Saved the failed investigation record; current activities remain available.'
          : 'Committed the validated outcome after checking current context and source versions. Background publication also checks its owner lease.' });
      await audit.finish({ ...finish, ...(['published', 'unchanged'].includes(finish.status) ? { committedRevision: workspace.revision } : {}) });
      return { workspace, outcome, selectedLessonId: finish.selectedLessonId, auditComplete: true };
    } catch {
      return { workspace, outcome, selectedLessonId: finish.selectedLessonId, auditComplete: false };
    }
  } catch (error) {
    const cleanupFailures: ('journal' | 'durable-recovery')[] = [];
    if (audit && !(error instanceof AuditStoreError)) {
      try {
        await audit.append({ actor: 'application', kind: 'stopped', visibility: 'public', summary: error instanceof InferenceBudgetError ? 'The enforced model allowance blocked this run. No new model request was made for this attempt.' : 'Execution stopped before an outcome was committed. Confirmed events and prior work are retained.' });
        await audit.finish({ status: error instanceof InferenceBudgetError ? 'blocked' : 'failed' });
      } catch { cleanupFailures.push('journal'); }
    }
    // Journal cleanup must never prevent lease release, failure persistence or budget refunds.
    try { await options.onFailure?.(error); } catch { cleanupFailures.push('durable-recovery'); }
    if (cleanupFailures.length && error instanceof Error) {
      try { Object.defineProperty(error, 'cleanupFailures', { value: cleanupFailures, configurable: true }); } catch { /* Preserve even a frozen original error. */ }
    }
    throw error;
  }
}
