import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { WorkspaceState } from '../domain/types';

/** Server SDK only. Client Firestore access must remain denied by firestore.rules. */
function sessions() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required for Firestore persistence.');
  const app = getApps().find(app => app.name === 'soma-server') ?? initializeApp({ projectId, credential: applicationDefault() }, 'soma-server');
  return getFirestore(app).collection('somaDemoSessions');
}

export async function insertManagedWorkspace(tokenHash: string, workspace: WorkspaceState): Promise<void> {
  const ref = sessions().doc(tokenHash);
  const now = new Date();
  const quotaRef = ref.firestore.collection('somaServiceLimits').doc(`anonymous-${now.toISOString().slice(0, 10)}`);
  await ref.firestore.runTransaction(async transaction => {
    const quota = await transaction.get(quotaRef);
    const count = Number(quota.get('created') ?? 0);
    if (count >= 200) {
      throw Object.assign(new Error('Today’s demo session limit has been reached. Please try again tomorrow.'), { status: 429, code: 'session_capacity' });
    }
    transaction.set(quotaRef, { created: count + 1, expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000) });
    transaction.create(ref, { workspace, revision: workspace.revision, expiresAt: new Date(workspace.expiresAt) });
  });
}

export async function readManagedWorkspace(tokenHash: string): Promise<WorkspaceState | null> {
  const snapshot = await sessions().doc(tokenHash).get();
  if (!snapshot.exists) return null;
  const workspace = snapshot.get('workspace') as WorkspaceState;
  // Firestore TTL deletion is asynchronous; expiry is always enforced on reads.
  return Date.parse(workspace.expiresAt) > Date.now() ? workspace : null;
}

export async function replaceManagedWorkspace(tokenHash: string, workspace: WorkspaceState, expectedRevision: number): Promise<boolean> {
  const ref = sessions().doc(tokenHash);
  return ref.firestore.runTransaction(async transaction => {
    const current = await transaction.get(ref);
    if (!current.exists || current.get('revision') !== expectedRevision || Date.parse(current.get('workspace.expiresAt')) <= Date.now()) return false;
    if (current.get('workspace.id') !== workspace.id || current.get('workspace.createdAt') !== workspace.createdAt || current.get('workspace.expiresAt') !== workspace.expiresAt) return false;
    transaction.update(ref, { workspace, revision: workspace.revision });
    return true;
  });
}

export async function deleteManagedWorkspace(tokenHash: string): Promise<void> {
  await sessions().doc(tokenHash).delete();
}
