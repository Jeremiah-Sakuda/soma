import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getServerApp } from './firebase-config';
import { explorationStore, revalidateExplorationPrincipal } from './exploration-store';
import { explorationViewStateSchema, validateExplorationViewState } from './exploration';
import { explorationNarration } from '../domain/exploration-view';
import { inspectVoiceWav, encodeVoiceWav, MAX_VOICE_WAV_BYTES } from '../domain/voice-audio';
import { reserveInference, settleInference, InferenceBudgetError } from './budget';
import {
  ExplorationError,
  type ExplorationPrincipal,
  type ExplorationStore,
} from './exploration-types';

export const GEMINI_TTS_MODEL = 'gemini-2.5-flash-tts';
export const GEMINI_TTS_VOICE = 'Kore';
export const speechRequestSchema = z.strictObject({
  artifactId: z.uuid(),
  version: z.number().int().positive(),
  state: explorationViewStateSchema,
});
const errors = {
  unavailable: [503, 'Gemini voice is unavailable. Captions and manual steps still work.'],
  invalid: [400, 'Choose a valid exploration step to play.'],
  capacity: [429, 'The voice allowance has been reached. Captions still work.'],
  cancelled: [409, 'Playback preparation stopped.'],
  response_invalid: [
    502,
    'Gemini did not return a complete playable explanation. Please try again.',
  ],
} as const;
export class GeminiSpeechError extends Error {
  status: number;
  constructor(public code: keyof typeof errors) {
    super(errors[code][1]);
    this.status = errors[code][0];
  }
}
const stop = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new GeminiSpeechError('cancelled');
};
export type GeminiSpeechDependencies = {
  store: ExplorationStore;
  revalidate: typeof revalidateExplorationPrincipal;
  reserve: (key: string) => Promise<string>;
  settle: typeof settleInference;
  fetch: typeof fetch;
  token: () => Promise<string>;
  project: () => string | undefined;
  enabled: () => boolean;
};
const defaults: GeminiSpeechDependencies = {
  store: explorationStore,
  revalidate: revalidateExplorationPrincipal,
  reserve: (key) => reserveInference(key, 'tts'),
  settle: settleInference,
  fetch: (...args) => fetch(...args),
  project: () => process.env.FIREBASE_PROJECT_ID,
  enabled: () => process.env.SOMA_GEMINI_TTS === 'true',
  token: async () => {
    const credential = getServerApp().options.credential;
    if (!credential) throw new GeminiSpeechError('unavailable');
    return (await credential.getAccessToken()).access_token;
  },
};
async function readResponse(response: Response, signal: AbortSignal): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new GeminiSpeechError('response_invalid');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      stop(signal);
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2_000_000) {
        await reader.cancel();
        throw new GeminiSpeechError('response_invalid');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new GeminiSpeechError('response_invalid');
  }
}
export function parseGeminiSpeech(raw: unknown): Uint8Array {
  const parsed = z
    .object({
      candidates: z
        .array(
          z.object({
            finishReason: z.literal('STOP'),
            content: z.object({
              parts: z
                .array(
                  z.object({
                    inlineData: z.object({
                      mimeType: z.enum(['audio/wav', 'audio/L16;codec=pcm;rate=24000']),
                      data: z
                        .string()
                        .min(4)
                        .max(Math.ceil(MAX_VOICE_WAV_BYTES / 3) * 4)
                        .regex(/^[A-Za-z0-9+/]+={0,2}$/),
                    }),
                  }),
                )
                .length(1),
            }),
          }),
        )
        .length(1),
    })
    .safeParse(raw);
  if (!parsed.success) throw new GeminiSpeechError('response_invalid');
  const part = parsed.data.candidates[0].content.parts[0].inlineData,
    data = part.data;
  let bytes: Uint8Array = new Uint8Array(Buffer.from(data, 'base64'));
  if (Buffer.from(bytes).toString('base64') !== data)
    throw new GeminiSpeechError('response_invalid');
  if (part.mimeType !== 'audio/wav') {
    if (bytes.length % 2 || bytes.length < 2 || bytes.length > MAX_VOICE_WAV_BYTES - 44)
      throw new GeminiSpeechError('response_invalid');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      samples = new Float32Array(bytes.length / 2);
    for (let i = 0; i < samples.length; i++) {
      const value = view.getInt16(i * 2, true);
      samples[i] = value / (value < 0 ? 32768 : 32767);
    }
    bytes = encodeVoiceWav(samples);
  }
  try {
    inspectVoiceWav(bytes);
  } catch {
    throw new GeminiSpeechError('response_invalid');
  }
  return bytes;
}
/** Only server-derived narration from an owned immutable artifact goes to Google.
 * No screenshot, arbitrary client text, raw response or audio is persisted. */
export function createGeminiSpeaker(overrides: Partial<GeminiSpeechDependencies> = {}) {
  const deps = { ...defaults, ...overrides };
  return async (principal: ExplorationPrincipal, raw: unknown, signal?: AbortSignal) => {
    const parsed = speechRequestSchema.safeParse(raw);
    if (!parsed.success) throw new GeminiSpeechError('invalid');
    const request = parsed.data,
      project = deps.project();
    if (!deps.enabled() || !project || !/^[-a-z0-9]{6,63}$/.test(project))
      throw new GeminiSpeechError('unavailable');
    const live = async () => {
      stop(signal);
      await deps.revalidate(principal);
      const session = await deps.store.read(principal);
      const artifact = session?.artifacts.find(
        (item) => item.id === request.artifactId && item.version === request.version,
      );
      if (!artifact) throw new ExplorationError('not_found');
      stop(signal);
      return artifact;
    };
    const artifact = await live(),
      state = validateExplorationViewState(artifact.spec, request.state),
      text = explorationNarration(artifact.spec, state);
    if (!text.trim() || text.length > 600) throw new GeminiSpeechError('invalid');
    let reservation: string | undefined,
      sent = false,
      acquired = false;
    const lease = randomUUID();
    let audio: Uint8Array | undefined;
    try {
      await deps.store.mutate(principal, () => {}, { acquire: lease });
      acquired = true;
      reservation = await deps.reserve(principal.key);
      const token = await deps.token();
      await live();
      const combined = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(25_000)]);
      stop(combined);
      sent = true;
      const response = await deps.fetch(
        `https://us-central1-aiplatform.googleapis.com/v1/projects/${project}/locations/us-central1/publishers/google/models/${GEMINI_TTS_MODEL}:generateContent`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text:
                      'Read this explanation aloud in a clear, warm, natural voice. Say only the explanation:\n' +
                      text,
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ['AUDIO'],
              maxOutputTokens: 1024,
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_TTS_VOICE } },
              },
            },
          }),
          redirect: 'error',
          cache: 'no-store',
          signal: combined,
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw new GeminiSpeechError('unavailable');
      }
      audio = parseGeminiSpeech(await readResponse(response, combined));
      await live();
      stop(combined);
    } catch (error) {
      if (error instanceof GeminiSpeechError || error instanceof ExplorationError) throw error;
      if (signal?.aborted) throw new GeminiSpeechError('cancelled');
      if (error instanceof InferenceBudgetError)
        throw new GeminiSpeechError(error.reason === 'configured' ? 'unavailable' : 'capacity');
      throw new GeminiSpeechError('unavailable');
    } finally {
      // Conservative charge, not a claim about provider billing: bounded 1024
      // output tokens + <=600 text characters fit below this $0.03 reservation.
      // Retain it even on post-send failure/cancellation; never retry implicitly.
      if (reservation)
        try {
          await deps.settle(reservation, sent ? 0.03 : 0, true);
        } catch {
          /* Durable reservation remains. */
        }
      if (acquired)
        try {
          await deps.store.mutate(principal, () => {}, { release: lease });
        } catch {
          /* Never recreate a deleted session. */
        }
    }
    await live();
    return audio!;
  };
}
export const speakExploration = createGeminiSpeaker();
