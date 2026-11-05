import { Storage } from '@google-cloud/storage';
import { createStateStore, createGcsStateAdapter } from './state.mjs';
import { startEgressProxy } from './egress.mjs';
import { createChromiumEngine } from './engine.mjs';
import { createRunner } from './server.mjs';

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error('Missing required runner configuration.');
  return value;
};
const origin = required('SOMA_GCP_BROWSER_URL');
if (new URL(origin).protocol !== 'https:') throw new Error('HTTPS runner origin required.');
const bucket = required('SOMA_GCP_BROWSER_BUCKET');
const storage = new Storage();
const store = createStateStore(
  createGcsStateAdapter(storage.bucket(bucket)),
  required('SOMA_GCP_BROWSER_STATE_KEY'),
);
const proxy = await startEgressProxy({
  blockedHosts: [
    new URL(origin).hostname,
    'metadata.google.internal',
    'metadata',
    'storage.googleapis.com',
    `${bucket}.storage.googleapis.com`,
  ],
});
const runner = createRunner({
  store,
  engine: createChromiumEngine(),
  controlKey: required('SOMA_GCP_BROWSER_CONTROL_KEY'),
  publicOrigin: origin,
  projectId: required('SOMA_GCP_BROWSER_PROJECT_ID'),
  proxyUrl: proxy.url,
});
runner.server.listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
let stopping = false;
process.on('SIGTERM', () => {
  if (stopping) return;
  stopping = true;
  void runner
    .close()
    .finally(() => proxy.close())
    .finally(() => process.exit(0));
});
