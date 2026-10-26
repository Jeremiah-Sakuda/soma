import { describe, expect, it } from 'vitest';
import { requireSameOrigin } from '../../src/lib/server/http';
describe('HTTP origin boundary', () => {
  it('accepts actual loopback Host even when Next normalizes its internal URL', () => {
    expect(() => requireSameOrigin(new Request('http://localhost:3100/api/actions', { headers: { host: '127.0.0.1:3100', origin: 'http://127.0.0.1:3100' } }))).not.toThrow();
  });
  it('rejects cross-site origin, opaque origin, and untrusted forwarded-host', () => {
    for (const origin of ['https://attacker.example', 'null', 'https://soma.example/path']) expect(() => requireSameOrigin(new Request('https://soma.example/api/actions', { headers: { host: 'soma.example', origin, 'x-forwarded-host': 'attacker.example' } }))).toThrow();
  });
});
