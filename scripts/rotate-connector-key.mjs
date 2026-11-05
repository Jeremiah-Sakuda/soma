// Run with Node's type stripping; imports share the exact application cipher.
// Default is dry-run. No credential values, tokens or plaintext are printed.
import { CredentialCipher } from '../src/lib/server/credential-crypto.ts';
import { rotateAccountCredentials } from '../src/lib/server/credential-rotation.ts';
import { getServerFirestore } from '../src/lib/server/firebase-config.ts';

const args = process.argv.slice(2),
  apply = args.includes('--apply'),
  rootIndex = args.indexOf('--account-root');
const rootId = rootIndex >= 0 ? args[rootIndex + 1] : undefined,
  all = args.includes('--all-accounts');
const allowed = new Set(
  ['--apply', '--dry-run', '--account-root', '--all-accounts', rootId].filter(Boolean),
);
try {
  if (
    args.some((value) => !allowed.has(value)) ||
    (rootId ? all : !all) ||
    args.filter((value) => value === '--account-root').length > 1 ||
    (args.includes('--dry-run') && apply)
  )
    throw new Error();
  if (rootId && !/^[a-f0-9]{64}$/.test(rootId)) throw new Error();
  const cipher = new CredentialCipher(),
    db = getServerFirestore();
  if (cipher.writeFormat !== 'v2') throw new Error();
  const totals = {
    scanned: 0,
    current: 0,
    wouldMigrate: 0,
    migrated: 0,
    busy: 0,
    changedGeneration: 0,
    failed: 0,
    incomplete: false,
  };
  let accountCount = 0,
    cursor;
  for (;;) {
    const query = db.collection('somaAccounts').orderBy('__name__').limit(50);
    const roots = rootId
      ? [rootId]
      : (await (cursor ? query.startAfter(cursor) : query).get()).docs.map(
          (document) => document.id,
        );
    if (!roots.length) break;
    for (const id of roots) {
      const report = await rotateAccountCredentials(db, id, cipher, { apply });
      accountCount++;
      for (const field of [
        'scanned',
        'current',
        'wouldMigrate',
        'migrated',
        'busy',
        'changedGeneration',
        'failed',
      ])
        totals[field] += report[field];
      totals.incomplete ||= report.incomplete;
      // Only hashed record identities and fixed error codes; never provider payloads.
      if (report.issues.length)
        console.error(JSON.stringify({ accountRoot: id, issues: report.issues }));
    }
    if (rootId || roots.length < 50) break;
    cursor = roots.at(-1);
  }
  console.log(
    JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      targetKeyId: cipher.activeId,
      accountCount,
      ...totals,
      keyRetirement:
        'Requires a separate full inventory and confirmation that old writers have drained.',
    }),
  );
  if (totals.failed || totals.busy || totals.changedGeneration || totals.incomplete)
    process.exitCode = 2;
} catch {
  console.error(
    'Credential rotation could not complete. Supply one explicit account scope (or --all-accounts), v2 configuration and available keys. No secret details are printed.',
  );
  process.exitCode = 1;
}
