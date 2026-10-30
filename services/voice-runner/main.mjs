import { createVoiceRunner } from './server.mjs';
const key = process.env.MODEL_API_KEY,
  control = process.env.SOMA_VOICE_CONTROL_KEY,
  origin = process.env.SOMA_APP_ORIGIN;
if (!key || !control || control.length < 32 || origin !== 'https://soma-woad-beta.vercel.app')
  throw Error('Voice relay configuration unavailable.');
async function callback(ticket, action) {
  const r = await fetch(origin + '/api/explore/transcribe/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + control },
    body: JSON.stringify({ ticket, action }),
    signal: AbortSignal.timeout(12000),
    redirect: 'error',
  });
  if (!r.ok) throw Error('Voice authorization unavailable.');
}
const runner = createVoiceRunner({
  providerKey: key,
  origins: [origin],
  claim: (ticket) => callback(ticket, 'claim'),
  complete: callback,
});
runner.server.listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
process.on('SIGTERM', () => void runner.close().finally(() => process.exit(0)));
