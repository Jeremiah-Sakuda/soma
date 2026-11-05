import { cleanupBrowsersForDeletion } from './connectors/browser';
import type { WorkspaceState } from '../domain/types';
import {
  ACCOUNT_SESSION_COOKIE,
  AccountSessionError,
  verifyAccountSession,
  type VerifiedAccount,
} from './account';
import {
  readAccountWorkspace,
  readOrCreateAccountWorkspace,
  updateAccountWorkspace,
  deleteAccountWorkspace,
} from './account-store';
import { readSessionToken } from './session';
import { readWorkspace, updateWorkspace, deleteWorkspace } from './store';

export type WorkspaceAccess =
  { kind: 'account'; account: VerifiedAccount } | { kind: 'demo'; token: string };

export async function resolveWorkspaceAccess(request: Request): Promise<WorkspaceAccess | null> {
  const account = await verifyAccountSession(request);
  if (account) return { kind: 'account', account };
  // An expired account cookie must not silently redirect private work into demo.
  if (
    (request.headers.get('cookie') ?? '')
      .split(';')
      .some((part) => part.trim().startsWith(`${ACCOUNT_SESSION_COOKIE}=`))
  )
    throw new AccountSessionError(
      'Please sign in again or sign out to open the demo.',
      401,
      'account_session_expired',
    );
  const token = await readSessionToken(request);
  return token ? { kind: 'demo', token } : null;
}

export async function readWorkspaceByAccess(
  access: WorkspaceAccess,
  createAccount = false,
): Promise<WorkspaceState | null> {
  return access.kind === 'account'
    ? createAccount
      ? readOrCreateAccountWorkspace(access.account)
      : readAccountWorkspace(access.account)
    : readWorkspace(access.token);
}
export async function updateWorkspaceByAccess(
  access: WorkspaceAccess,
  mutator: (state: WorkspaceState) => WorkspaceState | Promise<WorkspaceState>,
  expectedRevision?: number,
): Promise<WorkspaceState> {
  return access.kind === 'account'
    ? updateAccountWorkspace(access.account, mutator, expectedRevision)
    : updateWorkspace(access.token, mutator, expectedRevision);
}
export async function deleteWorkspaceByAccess(access: WorkspaceAccess): Promise<void> {
  return access.kind === 'account'
    ? deleteAccountWorkspace(access.account, (generation) =>
        cleanupBrowsersForDeletion(access.account, generation),
      )
    : deleteWorkspace(access.token);
}
