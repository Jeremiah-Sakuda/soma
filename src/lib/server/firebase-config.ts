import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type AppOptions,
} from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/** Server credentials only: local ADC or an encrypted deployment environment value. */
export function firebaseOptions(): AppOptions {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Firebase is not configured.');
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return { projectId, credential: applicationDefault() };
  try {
    const value = JSON.parse(raw);
    if (
      value.type !== 'service_account' ||
      value.project_id !== projectId ||
      typeof value.client_email !== 'string' ||
      typeof value.private_key !== 'string'
    )
      throw new Error();
    return { projectId, credential: cert(value) };
  } catch {
    throw new Error('Firebase server credentials are invalid or belong to another project.');
  }
}

export function getServerApp() {
  return (
    getApps().find((app) => app.name === 'soma-server') ??
    initializeApp(firebaseOptions(), 'soma-server')
  );
}

export function getServerFirestore() {
  return getFirestore(getServerApp());
}
