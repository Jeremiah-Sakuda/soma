import { chmod, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  readCredentialCloudConfiguration,
  requireCloudPermissionDenial,
  verifyCredentialCloud,
} from '../../scripts/check-credential-cloud.mjs';

const denied = (code = 403) =>
  Object.assign(new Error('SYNTHETIC-SECRET-ERROR-MUST-NOT-PRINT'), { code });
function fixture(
  options: {
    browserReadAllowed?: boolean;
    operatorDeleteDenied?: boolean;
    denialCode?: number;
  } = {},
) {
  const records = new Map<string, { generation: string; bytes: Buffer }>();
  let serial = 0;
  const calls: { role: string; path: string; operation: string }[] = [];
  const buckets: any = {};
  for (const role of ['login', 'browser', 'app', 'operator'])
    buckets[role] = {
      file(path: string, selected?: { generation?: string }) {
        const observe = (operation: string) => {
          calls.push({ role, path, operation });
        };
        const authorizeRead = () => {
          if (
            role === 'operator' ||
            (role === 'login' && path.startsWith('credential-vault/')) ||
            (role === 'browser' && options.browserReadAllowed)
          )
            return;
          throw denied(options.denialCode);
        };
        return {
          async exists() {
            observe('exists');
            authorizeRead();
            return [records.has(path)];
          },
          async getMetadata() {
            observe('metadata');
            authorizeRead();
            const record = records.get(path);
            if (!record) throw denied(404);
            return [{ generation: record.generation, size: record.bytes.length }];
          },
          async download() {
            observe('download');
            authorizeRead();
            const record = records.get(path);
            if (!record || (selected?.generation && selected.generation !== record.generation))
              throw denied(404);
            return [Buffer.from(record.bytes)];
          },
          async save(value: string | Buffer, config: any = {}) {
            observe('save');
            const previous = records.get(path);
            if (role !== 'operator' && role !== 'login') throw denied(options.denialCode);
            if (role === 'login' && !path.startsWith('credential-vault/') && previous) {
              if (config.preconditionOpts?.ifGenerationMatch === 0) throw denied(412);
              throw denied(403);
            }
            const expected = config.preconditionOpts?.ifGenerationMatch;
            if (expected !== undefined && String(expected) !== (previous?.generation ?? '0'))
              throw denied(412);
            records.set(path, { generation: String(++serial), bytes: Buffer.from(value) });
          },
          async delete(config: any = {}) {
            observe('delete');
            if (role !== 'operator' || options.operatorDeleteDenied) throw denied();
            if (!records.delete(path) && !config.ignoreNotFound) throw denied(404);
          },
        };
      },
    };
  const keys = new Map<string, { key: Buffer; aad: string }>();
  const kms: any = {
    login: {
      async wrap(bytes: Buffer, aad: Buffer) {
        const wrapped = randomBytes(48).toString('base64');
        keys.set(wrapped, { key: Buffer.from(bytes), aad: aad.toString('base64') });
        return wrapped;
      },
      async unwrap(wrapped: string, aad: Buffer) {
        const value = keys.get(wrapped);
        if (!value || value.aad !== aad.toString('base64')) throw denied();
        return Buffer.from(value.key);
      },
    },
    browser: {
      async unwrap() {
        throw denied();
      },
    },
    app: {
      async unwrap() {
        throw denied();
      },
    },
  };
  const kmsStatus = { browser: () => 403, app: () => 403 };
  const reports: any[] = [];
  return {
    records,
    calls,
    reports,
    run: () =>
      verifyCredentialCloud({
        buckets,
        kms,
        kmsStatus,
        report: (value: unknown) => {
          reports.push(value);
        },
      }),
  };
}

describe('cloud verification control logic — offline synthetic adapters', () => {
  it('requires actual permission denial rather than missing objects, errors or unexpected success', async () => {
    await requireCloudPermissionDenial(async () => {
      throw denied(403);
    });
    await expect(
      requireCloudPermissionDenial(async () => {
        throw denied(404);
      }),
    ).rejects.toMatchObject({ code: 'DENIAL_NOT_PROVEN' });
    await expect(
      requireCloudPermissionDenial(async () => {
        throw new Error('private-provider-text');
      }),
    ).rejects.toMatchObject({ code: 'DENIAL_NOT_PROVEN' });
    await expect(requireCloudPermissionDenial(async () => {})).rejects.toMatchObject({
      code: 'PERMISSION_UNEXPECTEDLY_ALLOWED',
    });
  });

  it('runs lifecycle/CAS/identity/append-only checks and cleans every generated object', async () => {
    const test = fixture();
    const result = await test.run();
    expect(result).toMatchObject({
      status: 'passed',
      cleanup: 'passed',
      retainedSyntheticObjects: 0,
    });
    expect(result.checksPassed).toBeGreaterThanOrEqual(20);
    expect(test.records.size).toBe(0);
    expect(test.calls.every((call) => /^credential-(?:vault|audit|grants)\//.test(call.path))).toBe(
      true,
    );
    const output = JSON.stringify(test.reports);
    expect(output).not.toContain('SYNTHETIC-ONLY');
    expect(output).not.toContain('example.invalid');
    expect(output).not.toContain('credential-vault/');
    expect(output).not.toContain('SECRET-ERROR');
    expect(test.reports.some((value) => value.check === 'login-grant-overwrite-denied')).toBe(true);
    expect(test.reports.some((value) => value.check === 'login-audit-delete-denied')).toBe(true);
  });

  it('fails the cloud gate if the normal browser can read encrypted vault records', async () => {
    const test = fixture({ browserReadAllowed: true });
    const result = await test.run();
    expect(result).toMatchObject({
      status: 'failed',
      failure: { check: 'browser-vault-read-denied', code: 'PERMISSION_UNEXPECTEDLY_ALLOWED' },
      cleanup: 'passed',
    });
    expect(test.records.size).toBe(0);
  });

  it('does not accept a masked 404 as IAM proof', async () => {
    const test = fixture({ denialCode: 404 });
    const result = await test.run();
    expect(result).toMatchObject({
      status: 'failed',
      failure: { check: 'browser-vault-read-denied', code: 'DENIAL_NOT_PROVEN' },
      cleanup: 'passed',
    });
    expect(test.records.size).toBe(0);
  });

  it('reports cleanup failure safely without leaking raw errors or claiming success', async () => {
    const test = fixture({ operatorDeleteDenied: true });
    const result = await test.run();
    expect(result).toMatchObject({
      status: 'failed',
      cleanup: 'failed',
      retainedSyntheticObjects: 1,
    });
    expect(JSON.stringify(test.reports)).not.toContain('SECRET-ERROR');
    expect(JSON.stringify(test.reports)).not.toContain('credential-vault/');
  });
});

describe('private cloud verification configuration', () => {
  async function configFixture() {
    const directory = await mkdtemp(join(tmpdir(), 'soma-cloud-config-'));
    const tokens: Record<string, string> = {};
    for (const role of ['login', 'browser', 'app', 'operator']) {
      tokens[role] = join(directory, role + '.token');
      await writeFile(tokens[role], 'synthetic-distinct-token-' + role, { mode: 0o600 });
    }
    const path = join(directory, 'config.json');
    await writeFile(
      path,
      JSON.stringify({
        vaultBucket: 'synthetic-vault-bucket',
        keyName: 'projects/test/locations/us-east1/keyRings/vault/cryptoKeys/institutional',
        tokens,
      }),
      { mode: 0o600 },
    );
    return { directory, path, tokens };
  }

  it('requires distinct private token files and returns no ambient credentials', async () => {
    const test = await configFixture();
    try {
      const config = await readCredentialCloudConfiguration(test.path);
      expect(config.tokens.login).toBe('synthetic-distinct-token-login');
    } finally {
      await rm(test.directory, { recursive: true, force: true });
    }
  });

  it('rejects world-readable token files, symlinks and accidental identity reuse', async () => {
    const test = await configFixture();
    try {
      await chmod(test.tokens.browser, 0o644);
      await expect(readCredentialCloudConfiguration(test.path)).rejects.toMatchObject({
        code: 'PRIVATE_INPUT_INVALID',
      });
      await chmod(test.tokens.browser, 0o600);
      await writeFile(test.tokens.browser, 'synthetic-distinct-token-login');
      await expect(readCredentialCloudConfiguration(test.path)).rejects.toMatchObject({
        code: 'IDENTITIES_NOT_DISTINCT',
      });
      await rm(test.tokens.browser);
      await symlink(test.tokens.login, test.tokens.browser);
      await expect(readCredentialCloudConfiguration(test.path)).rejects.toMatchObject({
        code: 'PRIVATE_INPUT_INVALID',
      });
    } finally {
      await rm(test.directory, { recursive: true, force: true });
    }
  });
});
