import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { CredentialCipher } from './credential-crypto';

export type CredentialRotationReport = {
  scanned: number;
  current: number;
  wouldMigrate: number;
  migrated: number;
  busy: number;
  changedGeneration: number;
  failed: number;
  incomplete: boolean;
  issues: { record: string; code: string }[];
};
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const binding = (uid: string, workspaceId: string, id: string) =>
  JSON.stringify({ uid, workspaceId, id });

/** Admin-only maintenance. Never returns plaintext, and only updates encrypted fields.
 * Each row rechecks owner, generation, lease and current ciphertext in one transaction.
 * Partial progress is safe to rerun; key retirement always needs a separate fleet audit. */
export async function rotateAccountCredentials(
  db: Firestore,
  rootId: string,
  cipher: CredentialCipher,
  options: { apply?: boolean; maxRecords?: number } = {},
): Promise<CredentialRotationReport> {
  if (!/^[a-f0-9]{64}$/.test(rootId)) throw new Error('Invalid credential account scope.');
  if (options.apply && cipher.writeFormat !== 'v2')
    throw new Error('Apply requires the v2 write format after compatible readers are deployed.');
  const maximum = options.maxRecords ?? 500;
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 1000)
    throw new Error('Invalid credential record limit.');
  const report: CredentialRotationReport = {
    scanned: 0,
    current: 0,
    wouldMigrate: 0,
    migrated: 0,
    busy: 0,
    changedGeneration: 0,
    failed: 0,
    incomplete: false,
    issues: [],
  };
  const root = db.collection('somaAccounts').doc(rootId),
    initial = (await root.get()).data();
  if (!initial || initial.deletionComplete) return report;
  if (
    typeof initial.ownerId !== 'string' ||
    hash(initial.ownerId) !== rootId ||
    typeof initial.workspaceId !== 'string'
  )
    throw new Error('Credential account ownership is invalid.');
  for (const [group, field] of [
    ['connections', 'encryptedSecret'],
    ['connectionStates', 'encrypted'],
  ] as const) {
    const documents = await root
      .collection(group)
      .limit(maximum + 1)
      .get();
    for (const snapshot of documents.docs) {
      if (report.scanned >= maximum) {
        report.incomplete = true;
        return report;
      }
      report.scanned++;
      try {
        const outcome = await db.runTransaction(async (transaction) => {
          const metadata = (await transaction.get(root)).data(),
            document = await transaction.get(snapshot.ref);
          if (
            !metadata ||
            metadata.ownerId !== initial.ownerId ||
            metadata.workspaceId !== initial.workspaceId ||
            metadata.deletionComplete
          )
            return 'changedGeneration' as const;
          if (!document.exists) return 'changedGeneration' as const;
          const record = document.data()!;
          if (
            record.ownerId !== initial.ownerId ||
            record.workspaceId !== initial.workspaceId ||
            (group === 'connections' && record.id !== snapshot.id)
          )
            throw new Error('ownership');
          if (group === 'connections' && record.leaseId) return 'busy' as const;
          const context = binding(
            initial.ownerId,
            initial.workspaceId,
            group === 'connections' ? snapshot.id : `state-${snapshot.id}`,
          );
          const result = cipher.rewrap(record[field], context);
          if (!result.changed) return 'current' as const;
          if (!options.apply) return 'wouldMigrate' as const;
          transaction.update(snapshot.ref, { [field]: result.encrypted });
          return 'migrated' as const;
        });
        report[outcome]++;
      } catch {
        report.failed++;
        report.issues.push({
          record: `${group}/${hash(snapshot.id)}`,
          code: 'credential_record_unavailable',
        });
      }
    }
  }
  return report;
}
