import { describe, it, expect, vi } from 'vitest';
import { createAppAuthorizer } from '../../services/credential-runner/authorize.mjs';
const url = 'https://original-synthetic.vercel.app/api/connectors/credentials/authorize';
const key = 'k'.repeat(48),
  grant = { authorizationId: 'original-synthetic', uid: 'original-synthetic' };
function authorizer(fetchImpl: any) {
  return createAppAuthorizer({ url, key, fetchImpl });
}
async function failure(operation: Promise<unknown>, code: string, status: number) {
  const error = (await operation.catch((error) => error)) as Error & {
    code: string;
    status: number;
  };
  expect(error).toMatchObject({
    message: 'Secure sign-in authorization is unavailable.',
    code,
    status,
  });
  expect(
    JSON.stringify({
      message: error.message,
      code: error.code,
      status: error.status,
      stack: error.stack,
    }),
  ).not.toMatch(/private-canary|original-synthetic|https:/);
}
describe('isolated callback authorization failure classes', () => {
  it('accepts the exact verified BU identity shape', async () => {
    const call = vi.fn(async () => Response.json({ identifier: 'Original.Student@BU.EDU' }));
    expect(await authorizer(call)(grant, { purpose: 'session' })).toEqual({
      identifier: 'original.student@bu.edu',
    });
    expect(call.mock.calls).toHaveLength(1);
  });
  it.each([401, 403])('treats explicit app HTTP %s as terminal denial', async (status) => {
    await failure(
      authorizer(async () => new Response('private-canary', { status }))(grant),
      'credential_authorization',
      403,
    );
  });
  it.each([404, 429, 500, 502, 503])(
    'treats uncertain app HTTP %s as unavailable rather than revoked',
    async (status) => {
      await failure(
        authorizer(async () => new Response('private-canary', { status }))(grant),
        'credential_authorization_unavailable',
        503,
      );
    },
  );
  it.each(['network', 'timeout'])('sanitizes an uncertain %s failure', async (kind) => {
    await failure(
      authorizer(async () => {
        throw Object.assign(new Error('private-canary https://private.example'), {
          name: kind === 'timeout' ? 'TimeoutError' : 'Error',
        });
      })(grant),
      'credential_authorization_unavailable',
      503,
    );
  });
  it.each([
    'not-json',
    JSON.stringify({ identifier: 'student@other.example' }),
    JSON.stringify({ identifier: 'student@bu.edu', extra: 'private-canary' }),
    'x'.repeat(1025),
  ])('rejects malformed successful responses as unavailable', async (response) => {
    await failure(
      authorizer(async () => new Response(response, { status: 200 }))(grant),
      'credential_authorization_unavailable',
      503,
    );
  });
});
