import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId)) {
  console.error('Set FIREBASE_PROJECT_ID before testing.');
  process.exit(1);
}
const app = initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);
const ref = db.collection('somaConnectionChecks').doc(randomUUID());
let created = false;
try {
  await ref.create({ synthetic: true, purpose: 'connectivity-probe', createdAt: new Date().toISOString() });
  created = true;
  const result = await ref.get();
  if (result.data()?.synthetic !== true) throw new Error('Unexpected read result');
  await ref.delete(); created = false;
  console.log('Firestore synthetic write/read/delete probe passed. No course or learner data was used.');
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', code: error.code ?? 'unknown', cleanupRequired: created }));
  if (created) { try { await ref.delete(); console.log('Probe document cleaned up.'); } catch { console.error('Probe cleanup failed; inspect somaConnectionChecks.'); } }
  process.exitCode = 1;
} finally { await db.terminate(); }
