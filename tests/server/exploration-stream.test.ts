import { expect, it } from 'vitest';
import { readExplorationStream } from '../../src/lib/client/exploration-stream';

function response(events: unknown[], stride = 19) {
  const bytes = new TextEncoder().encode(
    events.map((e) => JSON.stringify(e)).join('\n') + '\n',
  );
  return new Response(
    new ReadableStream({
      start(c) {
        for (let i = 0; i < bytes.length; i += stride) c.enqueue(bytes.slice(i, i + stride));
        c.close();
      },
    }),
  );
}

it('decodes fragmented UTF-8 and reports real phases before returning the complete result', async () => {
  const seen: string[] = [];
  const result = await readExplorationStream(
    response(
      [
        {
          type: 'progress',
          progress: { phase: 'reading-source', elapsedMs: 12 },
        },
        {
          type: 'progress',
          progress: { phase: 'reviewing-visual', elapsedMs: 9000 },
        },
        { type: 'result', result: { artifact: { spec: { title: 'α → β' } } } },
      ],
      1,
    ),
    (p) => seen.push(p.phase),
  );
  expect(seen).toEqual(['reading-source', 'reviewing-visual']);
  expect(await result.json()).toEqual({
    artifact: { spec: { title: 'α → β' } },
  });
});

it('retains the existing error-code path and never turns incomplete output into success', async () => {
  const result = await readExplorationStream(
    response([{ type: 'error', status: 422, code: 'generation_invalid' }]),
    () => {},
  );
  expect(result.status).toBe(422);
  expect(await result.json()).toEqual({ code: 'generation_invalid' });
  await expect(
    readExplorationStream(
      response([
        {
          type: 'progress',
          progress: { phase: 'building-visual', elapsedMs: 100 },
        },
      ]),
      () => {},
    ),
  ).rejects.toThrow('before completing');
});

it('rejects unknown phases, duplicate terminals and oversized streams', async () => {
  await expect(
    readExplorationStream(
      response([
        {
          type: 'progress',
          progress: { phase: 'invented-success', elapsedMs: 1 },
        },
      ]),
      () => {},
    ),
  ).rejects.toThrow();
  await expect(
    readExplorationStream(
      response([
        { type: 'result', result: {} },
        { type: 'result', result: {} },
      ]),
      () => {},
    ),
  ).rejects.toThrow('Invalid explanation stream');
  await expect(
    readExplorationStream(
      response([{ type: 'result', result: { oversized: 'x'.repeat(513000) } }], 600000),
      () => {},
    ),
  ).rejects.toThrow('exceeded its limit');
});

it('cancels a pending reader and rejects a late result on abort', async () => {
  const abort = new AbortController();
  let cancelled = false;
  const result = readExplorationStream(
    new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        },
      }),
    ),
    () => {},
    abort.signal,
  );
  abort.abort();
  await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  expect(cancelled).toBe(true);
});
