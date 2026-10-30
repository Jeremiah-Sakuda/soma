import {
  explorationProgressSchema,
  type ExplorationProgress,
} from '../domain/exploration-progress';

/** Progress contains application phases, never partial model output. The final
 * JSON response still goes through the existing artifact validation/error path. */
export async function readExplorationStream(
  response: Response,
  progress: (value: ExplorationProgress) => void,
  signal?: AbortSignal,
): Promise<Response> {
  if (!response.body) throw new Error('The explanation connection closed before completing.');
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let pending = '',
    total = 0,
    events = 0,
    terminal: Response | undefined;
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', abort, { once: true });
  const consume = (line: string) => {
    if (!line.trim()) return;
    if (terminal || ++events > 64) throw new Error('Invalid explanation stream.');
    const value: unknown = JSON.parse(line);
    if (!value || typeof value !== 'object' || !('type' in value))
      throw new Error('Invalid explanation stream.');
    const event = value as Record<string, unknown>;
    if (event.type === 'progress') progress(explorationProgressSchema.parse(event.progress));
    else if (event.type === 'result' && event.result && typeof event.result === 'object')
      terminal = Response.json(event.result);
    else if (
      event.type === 'error' &&
      typeof event.code === 'string' &&
      event.code.length <= 40 &&
      Number.isInteger(event.status) &&
      Number(event.status) >= 400 &&
      Number(event.status) <= 599
    )
      terminal = Response.json({ code: event.code }, { status: Number(event.status) });
    else throw new Error('Invalid explanation stream.');
  };
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const part = await reader.read();
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (part.done) break;
      total += part.value.byteLength;
      if (total > 512_000) throw new Error('The explanation response exceeded its limit.');
      pending += decoder.decode(part.value, { stream: true });
      let newline: number;
      while ((newline = pending.indexOf('\n')) >= 0) {
        consume(pending.slice(0, newline));
        pending = pending.slice(newline + 1);
      }
    }
    pending += decoder.decode();
    if (pending.trim()) consume(pending);
    if (!terminal)
      throw new Error(
        'The explanation connection closed before completing. Your last visual is unchanged.',
      );
    return terminal;
  } finally {
    signal?.removeEventListener('abort', abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
