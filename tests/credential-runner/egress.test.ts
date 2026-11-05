import { it, expect } from 'vitest';
import { resolveEgressTarget } from '../../services/credential-runner/egress.mjs';
it('credential proxy enforces an exact HTTPS host allowlist before DNS or direct IP connect', async () => {
  let lookedUp = 0;
  const lookup = async () => {
    lookedUp++;
    return [{ address: '93.184.216.34', family: 4 }];
  };
  const config = { allowedHosts: ['learn.bu.edu', 'shib.bu.edu'], lookup };
  expect(await resolveEgressTarget({ host: 'shib.bu.edu', port: 443 }, config)).toMatchObject({
    host: 'shib.bu.edu',
    address: '93.184.216.34',
  });
  expect(lookedUp).toBe(1);
  for (const host of [
    '93.184.216.34',
    '127.0.0.1',
    'metadata.google.internal',
    'evil.com',
    'shib.bu.edu.evil.com',
    'sub.shib.bu.edu',
  ])
    await expect(resolveEgressTarget({ host, port: 443 }, config)).rejects.toThrow();
  await expect(resolveEgressTarget({ host: 'shib.bu.edu', port: 80 }, config)).rejects.toThrow();
  expect(lookedUp).toBe(1);
  await expect(
    resolveEgressTarget(
      { host: 'shib.bu.edu', port: 443 },
      { ...config, lookup: async () => [{ address: '169.254.169.254', family: 4 }] },
    ),
  ).rejects.toThrow();
});
