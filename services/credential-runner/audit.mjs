import { randomUUID } from 'node:crypto';
const EVENTS = new Set([
  'consent',
  'credential_saved',
  'fill_started',
  'fill_succeeded',
  'fill_failed',
  'credential_forgotten',
  'credential_rotated',
  'session_saved',
  'session_revoked',
  'grant_issued',
  'grant_used',
  'grant_denied',
  'grant_replayed',
]);
const OUTCOMES = new Set(['started', 'succeeded', 'failed']);
const hash = /^[a-f0-9]{64}$/,
  version = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function failure() {
  throw Object.assign(new Error('Credential audit unavailable.'), {
    code: 'credential_audit',
    status: 503,
  });
}
/** Append-only safe facts. Never accept a raw credential, error, URL, account
 * identifier, browser observation or arbitrary caller-selected object path. */
export function createGcsCredentialAudit(bucket) {
  return {
    async emit(owner, event) {
      if (
        typeof owner !== 'string' ||
        !hash.test(owner) ||
        !event ||
        Object.keys(event).sort().join(',') !==
          'at,credentialVersion,event,outcome,provider,sessionHash' ||
        !EVENTS.has(event.event) ||
        !OUTCOMES.has(event.outcome) ||
        event.provider !== 'blackboard' ||
        !Number.isSafeInteger(event.at) ||
        event.at < 0 ||
        !(
          event.credentialVersion === null ||
          (typeof event.credentialVersion === 'string' && version.test(event.credentialVersion))
        ) ||
        !(
          event.sessionHash === null ||
          (typeof event.sessionHash === 'string' && hash.test(event.sessionHash))
        )
      )
        failure();
      try {
        await bucket
          .file(`credential-audit/${owner}/${randomUUID()}.json`)
          .save(JSON.stringify(event), {
            resumable: false,
            validation: 'crc32c',
            contentType: 'application/json',
            metadata: { cacheControl: 'no-store' },
            preconditionOpts: { ifGenerationMatch: 0 },
            timeout: 15000,
          });
      } catch {
        failure();
      }
    },
  };
}
