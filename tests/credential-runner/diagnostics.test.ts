import { describe, it, expect } from 'vitest';
import { credentialFailureFacts } from '../../services/credential-runner/diagnostics.mjs';
describe('credential failure facts', () => {
  it('preserves only fixed reason, operation and status vocabulary', () => {
    const facts = credentialFailureFacts(
      Object.assign(new Error('private password and provider response'), {
        code: 'credential_frame_guard',
        status: 409,
        request: { password: 'private-password' },
        url: 'https://private.invalid/?token=secret',
      }),
      'save-fill',
    );
    expect(facts).toEqual({
      event: 'credential_operation_failed',
      operation: 'save-fill',
      code: 'credential_frame_guard',
      status: 409,
    });
    expect(Object.isFrozen(facts)).toBe(true);
    expect(JSON.stringify(facts)).not.toMatch(/private|password|provider|token|response|url/);
  });
  it.each([
    null,
    undefined,
    {},
    new Error('private'),
    { code: 'private_password', status: 200 },
    { code: 'x'.repeat(2000), status: 999 },
    { code: { toString: () => 'credential_frame_guard' }, status: '409' },
  ])('rejects arbitrary errors without serializing them (%#)', (error) => {
    expect(credentialFailureFacts(error, 'private-session-id')).toEqual({
      event: 'credential_operation_failed',
      operation: 'unknown',
      code: 'credential_unavailable',
      status: 503,
    });
  });
});
