import { it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createGcsCredentialAudit } from '../../services/credential-runner/audit.mjs';
it('writes only fixed safe audit facts under create-only private object paths', async () => {
  const writes: any[] = [];
  const bucket = {
    file: (path: string) => ({
      save: async (data: string, options: any) => {
        writes.push({ path, data, options });
      },
    }),
  };
  const audit = createGcsCredentialAudit(bucket),
    owner = 'a'.repeat(64),
    event = {
      event: 'credential_saved',
      outcome: 'succeeded',
      provider: 'blackboard',
      sessionHash: 'b'.repeat(64),
      credentialVersion: randomUUID(),
      at: 1000,
    };
  await audit.emit(owner, event);
  await audit.emit(owner, event);
  expect(writes).toHaveLength(2);
  expect(writes[0].path).toMatch(/^credential-audit\/[a-f0-9]{64}\/[a-f0-9-]{36}\.json$/);
  expect(writes[1].path).not.toBe(writes[0].path);
  expect(JSON.parse(writes[0].data)).toEqual(event);
  expect(writes[0].options.preconditionOpts).toEqual({ ifGenerationMatch: 0 });
  await expect(
    audit.emit(owner, { ...event, password: 'synthetic-secret-canary' }),
  ).rejects.toMatchObject({ code: 'credential_audit' });
  expect(writes).toHaveLength(2);
  await expect(
    audit.emit(owner, { ...event, event: 'arbitrary text synthetic-secret-canary' }),
  ).rejects.toMatchObject({ code: 'credential_audit' });
  await expect(
    audit.emit(owner, { ...event, credentialVersion: 'synthetic-secret-canary' }),
  ).rejects.toMatchObject({ code: 'credential_audit' });
});
it('storage failures emit a fixed failure without raw provider errors', async () => {
  const audit = createGcsCredentialAudit({
    file: () => ({
      save: vi.fn(async () => {
        throw Error('synthetic-secret-canary');
      }),
    }),
  });
  const owner = 'a'.repeat(64),
    event = {
      event: 'session_revoked',
      outcome: 'succeeded',
      provider: 'blackboard',
      sessionHash: null,
      credentialVersion: null,
      at: 1000,
    };
  const error = await audit.emit(owner, event).catch((error) => error);
  expect(error.code).toBe('credential_audit');
  expect(error.message).not.toContain('synthetic-secret-canary');
});
