import { describe, it, expect } from 'vitest';
import { GET, POST } from '../../src/app/api/connectors/blackboard/route';
describe('Blackboard course route outer security boundary', () => {
  it('requires an authenticated account before listing private course metadata', async () => {
    const response = await GET(new Request('https://soma.example/api/connectors/blackboard'));
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('rejects cross-origin writes before touching private source state', async () => {
    const response = await POST(
      new Request('https://soma.example/api/connectors/blackboard', {
        method: 'POST',
        headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'select', courseIds: [] }),
      }),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('does not treat a same-origin request as account authorization', async () => {
    const response = await POST(
      new Request('https://soma.example/api/connectors/blackboard', {
        method: 'POST',
        headers: { origin: 'https://soma.example', 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'discover' }),
      }),
    );
    expect(response.status).toBe(401);
  });
});
