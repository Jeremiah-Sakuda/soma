import { randomUUID } from 'node:crypto';
import { inspectVoiceWav, MAX_VOICE_WAV_BYTES } from '../domain/voice-audio';
import {
  reserveInference,
  settleInference,
  inferenceEnabled,
  InferenceBudgetError,
} from './budget';
import { explorationStore, revalidateExplorationPrincipal } from './exploration-store';
import {
  ExplorationError,
  type ExplorationPrincipal,
  type ExplorationStore,
} from './exploration-types';

export const VOICE_ENDPOINT = 'https://api.meta.ai/v1/asr/transcribe';
export const VOICE_MODEL = 'muse-voice-transcribe-1.0';
const errors = {
  forbidden: [403, 'Use voice transcription from this Soma tab.'],
  invalid_audio: [422, 'Choose a recording of at most 30 seconds. Typed questions still work.'],
  body_size: [413, 'The recording is too large. Record a shorter question.'],
  content_type: [415, 'Use a WAV recording. Typed questions still work.'],
  unavailable: [503, 'Voice transcription is unavailable. Please type your question.'],
  capacity: [429, 'The voice allowance is unavailable. Please type your question.'],
  cancelled: [409, 'Voice transcription stopped.'],
  response_invalid: [502, 'The voice response could not be confirmed. Please type your question.'],
  no_speech: [422, 'No speech was recognized. Try again or type your question.'],
} as const;
export class VoiceTranscriptionError extends Error {
  status: number;
  constructor(public code: keyof typeof errors) {
    super(errors[code][1]);
    this.status = errors[code][0];
  }
}
const stop = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new VoiceTranscriptionError('cancelled');
};
export async function readVoiceBody(request: Request): Promise<Uint8Array> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'audio/wav')
    throw new VoiceTranscriptionError('content_type');
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_VOICE_WAV_BYTES))
    throw new VoiceTranscriptionError('body_size');
  const reader = request.body?.getReader();
  if (!reader) throw new VoiceTranscriptionError('invalid_audio');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      stop(request.signal);
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_VOICE_WAV_BYTES) {
        await reader.cancel();
        throw new VoiceTranscriptionError('body_size');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
async function boundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new VoiceTranscriptionError('response_invalid');
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      stop(signal);
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 32_768) {
        await reader.cancel();
        throw new VoiceTranscriptionError('response_invalid');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new VoiceTranscriptionError('response_invalid');
  }
}
export type VoiceDependencies = {
  store: ExplorationStore;
  revalidate: typeof revalidateExplorationPrincipal;
  reserve: (key: string) => Promise<string>;
  settle: typeof settleInference;
  enabled: () => boolean;
  fetch: typeof fetch;
  key: () => string | undefined;
};
const defaults: VoiceDependencies = {
  store: explorationStore,
  revalidate: revalidateExplorationPrincipal,
  reserve: (key) => reserveInference(key, 'voice'),
  settle: settleInference,
  enabled: inferenceEnabled,
  fetch: (...args) => fetch(...args),
  key: () => process.env.MODEL_API_KEY,
};
/** Explicit single recording; raw audio and transcripts are not persisted.
 * Unknown post-send usage retains the entire durable reservation. */
export function createVoiceTranscriber(overrides: Partial<VoiceDependencies> = {}) {
  const deps = { ...defaults, ...overrides };
  return async (principal: ExplorationPrincipal, bytes: Uint8Array, signal?: AbortSignal) => {
    try {
      inspectVoiceWav(bytes);
    } catch {
      throw new VoiceTranscriptionError('invalid_audio');
    }
    const key = deps.key();
    if (!deps.enabled() || !key) throw new VoiceTranscriptionError('unavailable');
    stop(signal);
    const live = async () => {
      stop(signal);
      await deps.revalidate(principal);
      if (!(await deps.store.read(principal))) throw new ExplorationError('session_expired');
      stop(signal);
    };
    await live();
    const requestId = randomUUID();
    let acquired = false,
      reservation: string | undefined,
      cost = 0,
      certain = true,
      sent = false;
    let result:
      | { transcript: string; audioDurationMs: number; provider: 'meta'; model: typeof VOICE_MODEL }
      | undefined;
    try {
      await deps.store.mutate(principal, () => {}, { acquire: requestId });
      acquired = true;
      await live();
      reservation = await deps.reserve(principal.key);
      await live();
      const body = new FormData();
      body.set(
        'request',
        new Blob(
          [JSON.stringify({ mode: 'PUSH_TO_TALK', model: VOICE_MODEL, audioEncoding: 'WAV' })],
          { type: 'application/json' },
        ),
      );
      body.set('audio', new Blob([new Uint8Array(bytes)], { type: 'audio/wav' }), 'question.wav');
      const combined = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(30_000)]);
      stop(combined);
      sent = true;
      certain = false;
      const response = await deps.fetch(VOICE_ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
        body,
        redirect: 'error',
        cache: 'no-store',
        signal: combined,
      });
      const raw = await boundedJson(response, combined);
      const value = raw as { transcript?: unknown; audioDurationMs?: unknown; turns?: unknown };
      if (
        value &&
        typeof value === 'object' &&
        typeof value.audioDurationMs === 'number' &&
        Number.isFinite(value.audioDurationMs) &&
        value.audioDurationMs >= 0 &&
        value.audioDurationMs <= 30_000
      ) {
        cost = Math.floor(value.audioDurationMs / 1000) / 20_000;
        certain = true;
      }
      if (
        !response.ok ||
        !certain ||
        !value ||
        typeof value.transcript !== 'string' ||
        value.transcript.length > 2000 ||
        !Array.isArray(value.turns) ||
        value.turns.length !== 0
      )
        throw new VoiceTranscriptionError('response_invalid');
      const transcript = value.transcript.trim();
      if (!transcript) throw new VoiceTranscriptionError('no_speech');
      await live();
      stop(combined);
      result = {
        transcript,
        audioDurationMs: value.audioDurationMs as number,
        provider: 'meta',
        model: VOICE_MODEL,
      };
    } catch (error) {
      if (error instanceof VoiceTranscriptionError || error instanceof ExplorationError)
        throw error;
      if (signal?.aborted) throw new VoiceTranscriptionError('cancelled');
      if (error instanceof InferenceBudgetError)
        throw new VoiceTranscriptionError(
          error.reason === 'configured' ? 'unavailable' : 'capacity',
        );
      throw new VoiceTranscriptionError('unavailable');
    } finally {
      if (reservation)
        try {
          await deps.settle(reservation, cost, certain || !sent);
        } catch {
          /* The durable full reservation remains on unknown settlement. */
        }
      if (acquired)
        try {
          await deps.store.mutate(principal, () => {}, { release: requestId });
        } catch {
          /* Expired/deleted sessions cannot be recreated by release. */
        }
    }
    // Cleanup itself awaits storage. Recheck again after it, so deletion, expiry
    // or cancellation while settling cannot release a now-unauthorized transcript.
    await live();
    return result!;
  };
}
export const transcribeVoice = createVoiceTranscriber();
