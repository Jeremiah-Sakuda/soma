import { createHash } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';
import {
  assertVerifiedAccount,
  type VerifiedAccount,
  requireRecentAuthentication,
} from '../account';
import { getServerApp, getServerFirestore } from '../firebase-config';
import { WorkspaceStoreError } from '../store';

const fail = () =>
  new WorkspaceStoreError(
    'Secure sign-in authorization changed. Return to Soma and start again.',
    409,
    'credential_authorization',
  );
const digest = (v: string) => createHash('sha256').update(v).digest('hex');
export const credentialGrantSchema = z.strictObject({
  authorizationId: z.string().uuid(),
  uid: z.string().min(1).max(128),
  owner: z.string().regex(/^[a-f0-9]{64}$/),
  workspaceId: z.string().min(1).max(128),
  workspaceGeneration: z.string().min(1).max(128),
  provider: z.literal('blackboard'),
  contextId: z.string().uuid(),
  connectionVersion: z.number().int().positive(),
  recentAuthAt: z.number().int().positive(),
});
export type CredentialGrant = z.infer<typeof credentialGrantSchema>;
export type CredentialAuthorization = CredentialGrant & { active: boolean; expiresAt: number };
export function validCredentialAuthorization(
  record: unknown,
  claimed: CredentialGrant,
  purpose: 'credential' | 'session',
  now = Date.now(),
): boolean {
  if (!record || typeof record !== 'object') return false;
  const value = record as CredentialAuthorization;
  if (!value.active || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= now)
    return false;
  if (
    Object.keys(credentialGrantSchema.shape).some(
      (key) => value[key as keyof CredentialGrant] !== claimed[key as keyof CredentialGrant],
    )
  )
    return false;
  if (
    claimed.workspaceGeneration !== claimed.workspaceId ||
    claimed.owner !== digest(`${claimed.workspaceId}:browser-${claimed.provider}`)
  )
    return false;
  if (purpose === 'credential')
    try {
      requireRecentAuthentication(value.recentAuthAt, now / 1000);
    } catch {
      return false;
    }
  return true;
}
export async function createCredentialAuthorization(
  account: VerifiedAccount,
  grant: CredentialGrant,
  leaseId: string,
): Promise<void> {
  assertVerifiedAccount(account);
  if (
    account.uid !== grant.uid ||
    !credentialGrantSchema.safeParse(grant).success ||
    !validCredentialAuthorization(
      { ...grant, active: true, expiresAt: Date.now() + 1800000 },
      grant,
      'credential',
    )
  )
    throw fail();
  const root = getServerFirestore().collection('somaAccounts').doc(digest(account.uid));
  await root.firestore.runTransaction(async (tx) => {
    const meta = await tx.get(root),
      ref = root.collection('connections').doc(`browser-${grant.provider}`),
      connection = await tx.get(ref);
    if (
      meta.get('deleted') ||
      meta.get('ownerId') !== account.uid ||
      meta.get('workspaceId') !== grant.workspaceId ||
      connection.get('ownerId') !== account.uid ||
      connection.get('workspaceId') !== grant.workspaceId ||
      connection.get('status') === 'disconnected' ||
      connection.get('version') !== grant.connectionVersion ||
      connection.get('leaseId') !== leaseId ||
      connection.get('leaseUntil') <= Date.now() ||
      connection.get('credentialLoginId')
    )
      throw fail();
    tx.create(root.collection('credentialLogins').doc(grant.authorizationId), {
      ...grant,
      active: true,
      expiresAt: Date.now() + 1800000,
    });
    tx.update(ref, { credentialLoginId: grant.authorizationId });
  });
}
export async function revokeCredentialAuthorization(
  account: VerifiedAccount,
  workspaceId: string,
  id: string,
): Promise<void> {
  assertVerifiedAccount(account);
  if (!z.string().uuid().safeParse(id).success) throw fail();
  const root = getServerFirestore().collection('somaAccounts').doc(digest(account.uid));
  await root.firestore.runTransaction(async (tx) => {
    const meta = await tx.get(root),
      ref = root.collection('credentialLogins').doc(id),
      doc = await tx.get(ref);
    // Cleanup is permitted after this exact generation was frozen for deletion.
    if (meta.get('ownerId') !== account.uid || meta.get('workspaceId') !== workspaceId)
      throw fail();
    if (doc.exists) {
      if (doc.get('uid') !== account.uid || doc.get('workspaceId') !== workspaceId) throw fail();
      tx.update(ref, { active: false, revokedAt: Date.now() });
    }
  });
}
export async function clearCredentialAuthorizationReference(
  account: VerifiedAccount,
  workspaceId: string,
  id: string,
): Promise<void> {
  assertVerifiedAccount(account);
  const root = getServerFirestore().collection('somaAccounts').doc(digest(account.uid));
  await root.firestore.runTransaction(async (tx) => {
    const meta = await tx.get(root),
      ref = root.collection('connections').doc('browser-blackboard'),
      doc = await tx.get(ref);
    if (
      meta.get('ownerId') !== account.uid ||
      meta.get('workspaceId') !== workspaceId ||
      doc.get('ownerId') !== account.uid ||
      doc.get('workspaceId') !== workspaceId
    )
      throw fail();
    if (doc.get('credentialLoginId') === id) tx.update(ref, { credentialLoginId: '' });
  });
}
/** Called by the separately authenticated login service before every sensitive boundary. */
export async function authorizeCredentialGrant(
  grant: CredentialGrant,
  purpose: 'credential' | 'session',
): Promise<{ identifier: string }> {
  const root = getServerFirestore().collection('somaAccounts').doc(digest(grant.uid));
  const check = () =>
    root.firestore.runTransaction(
      async (tx) => {
        const meta = await tx.get(root),
          doc = await tx.get(root.collection('credentialLogins').doc(grant.authorizationId)),
          connection = await tx.get(
            root.collection('connections').doc(`browser-${grant.provider}`),
          );
        if (
          meta.get('deleted') ||
          meta.get('ownerId') !== grant.uid ||
          meta.get('workspaceId') !== grant.workspaceId ||
          !validCredentialAuthorization(doc.data(), grant, purpose) ||
          connection.get('ownerId') !== grant.uid ||
          connection.get('workspaceId') !== grant.workspaceId ||
          connection.get('status') === 'disconnected' ||
          connection.get('version') !== grant.connectionVersion ||
          connection.get('credentialLoginId') !== grant.authorizationId
        )
          throw fail();
      },
      { readOnly: true },
    );
  await check();
  let user;
  try {
    user = await getAuth(getServerApp()).getUser(grant.uid);
  } catch {
    throw fail();
  }
  if (
    user.disabled ||
    !user.email ||
    !/^[-a-z0-9._+]+@bu\.edu$/i.test(user.email) ||
    Date.parse(user.tokensValidAfterTime ?? '1970-01-01') / 1000 > grant.recentAuthAt
  )
    throw fail();
  await check();
  return { identifier: user.email.toLowerCase() };
}
