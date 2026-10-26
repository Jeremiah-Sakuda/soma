import { NextResponse } from 'next/server';
import { verifyAccountSession, AccountSessionError } from '@/lib/server/account';
import { readOrCreateAccountWorkspace, updateAccountWorkspace } from '@/lib/server/account-store';
import { applySourceImport, readSourceImport } from '@/lib/server/imports';
import { apiError, requireSameOrigin, workspaceResponse } from '@/lib/server/http';
import { enqueuePreparation } from '@/lib/server/jobs';
import type { WorkspaceState } from '@/lib/domain/types';
import type { VerifiedAccount } from '@/lib/server/account';
import type { SourceImport } from '@/lib/server/imports';

export const runtime = 'nodejs';

async function importedResponse(account: VerifiedAccount, workspace: WorkspaceState, input: SourceImport) {
  let notice = 'Selected material imported. This is a manual import, not a live source connection.';
  if (input.kind !== 'calendar-json') {
    const receipt = workspace.importReceipts?.find(receipt => receipt.key === input.importId);
    const source = workspace.sources.filter(item => item.id === receipt?.sourceId && item.provenance?.contentHash === receipt?.hash && item.status === 'current').sort((a, b) => b.version - a.version)[0];
    if (source && receipt?.preparationRevision !== undefined) {
      try {
        await enqueuePreparation(account, workspace, input.course.id, [{ sourceId: source.id, version: source.version }], input.title, receipt.preparationRevision);
        notice += ' A preparation job is saved; the worker can process it within the configured budget.';
      } catch {
        notice += ' Automatic preparation could not be queued. Your source is saved; retry this import to queue it.';
      }
    }
  }
  return workspaceResponse(workspace, notice);
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const account = await verifyAccountSession(request);
    if (!account) throw new AccountSessionError('Sign in to import your own selected material.', 401, 'account_required');
    const input = await readSourceImport(request);
    const current = await readOrCreateAccountWorkspace(account);
    // Idempotent retries return the committed result even if their old revision is stale.
    if (current.importReceipts?.some(receipt => receipt.key === input.importId)) {
      applySourceImport(current, input);
      return importedResponse(account, current, input);
    }
    const saved = await updateAccountWorkspace(account, workspace => applySourceImport(workspace, input).workspace, input.expectedRevision);
    return importedResponse(account, saved, input);
  } catch (error) {
    // A simultaneous retry can finish after the first import; the client can retry safely.
    return apiError(error);
  }
}

// No GET collector or remote URL adapter: this route reads only the supplied selection.
export function GET() {
  return NextResponse.json({ modes: ['course-text', 'email-text', 'calendar-json'], collection: 'manual-import', liveSources: [] }, { headers: { 'Cache-Control': 'no-store' } });
}
