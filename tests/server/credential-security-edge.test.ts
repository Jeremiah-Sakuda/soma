import { describe, it, expect } from 'vitest';
import { readJsonBody, requireSameOrigin } from '../../src/lib/server/http';
import { browserActionSchema } from '../../src/lib/server/connectors/browser';

describe('credential request byte and origin limits', () => {
  it('rejects a different scheme on the same host', () => {
    expect(() =>
      requireSameOrigin(
        new Request('https://soma.example/api/connectors/browser', {
          headers: { host: 'soma.example', origin: 'http://soma.example' },
        }),
      ),
    ).toThrow();
  });
  it('cancels oversized UTF-8 streams without trusting Content-Length', async () => {
    let cancelled = false;
    const encoded = new TextEncoder().encode('界'.repeat(6000));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded);
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request('https://soma.example', {
      method: 'POST',
      body: stream,
      headers: { 'content-type': 'application/json', 'content-length': '2' },
      duplex: 'half',
    } as RequestInit);
    await expect(readJsonBody(request)).rejects.toMatchObject({ status: 413 });
    expect(cancelled).toBe(true);
  });
  it('accepts a bounded split JSON request and rejects malformed content types and bodies', async () => {
    const chunks = ['{"provider":', '"blackboard",', '"action":"start"}'];
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      },
    });
    const request = new Request('https://soma.example', {
      method: 'POST',
      body: stream,
      headers: { 'content-type': 'Application/JSON; charset=utf-8' },
      duplex: 'half',
    } as RequestInit);
    expect(await readJsonBody(request)).toEqual({ provider: 'blackboard', action: 'start' });
    await expect(
      readJsonBody(new Request('https://soma.example', { method: 'POST', body: '{}' })),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      readJsonBody(
        new Request('https://soma.example', {
          method: 'POST',
          body: '{',
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('rejects credential and capability fields at the browser login interface', () => {
    for (const field of [
      'password',
      'totp',
      'cookies',
      'storageState',
      'contextId',
      'connectUrl',
      'loginUrl',
      'ownerId',
    ])
      expect(
        browserActionSchema.safeParse({
          provider: 'blackboard',
          action: 'start',
          [field]: 'original-synthetic-canary',
        }).success,
      ).toBe(false);
  });
});
