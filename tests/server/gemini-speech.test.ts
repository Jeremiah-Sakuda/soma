import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createGeminiSpeaker,
  parseGeminiSpeech,
  GEMINI_TTS_MODEL,
} from '../../src/lib/server/gemini-speech';
import { createExampleExploration } from '../../src/lib/domain/exploration';
import { initialExplorationState } from '../../src/lib/domain/exploration-view';
import { encodeVoiceWav } from '../../src/lib/domain/voice-audio';
import {
  ExplorationError,
  type ExplorationPrincipal,
} from '../../src/lib/server/exploration-types';
const principal: ExplorationPrincipal = {
  kind: 'guest',
  id: 'a'.repeat(64),
  workspaceId: 'a'.repeat(64),
  generation: 'a'.repeat(64),
  key: 'guest-' + 'a'.repeat(64),
};
const wav = () => encodeVoiceWav(new Float32Array(24000));
const envelope = () => ({
  candidates: [
    {
      finishReason: 'STOP',
      content: {
        parts: [
          { inlineData: { mimeType: 'audio/wav', data: Buffer.from(wav()).toString('base64') } },
        ],
      },
    },
  ],
});
function harness() {
  const spec = createExampleExploration(),
    artifact = { id: randomUUID(), version: 1, spec };
  const store = {
      read: vi.fn(async () => ({ artifacts: [artifact] })),
      mutate: vi.fn(async () => ({})),
    },
    revalidate = vi.fn(async () => {}),
    reserve = vi.fn(async () => randomUUID()),
    settle = vi.fn(async () => {}),
    fetch = vi.fn(async () => Response.json(envelope())),
    token = vi.fn(async () => 'private-original-test-token');
  const speak = createGeminiSpeaker({
    store: store as never,
    revalidate,
    reserve,
    settle,
    fetch: fetch as never,
    token,
    project: () => 'soma-original-test',
    enabled: () => true,
  });
  return {
    speak,
    store,
    revalidate,
    reserve,
    settle,
    fetch,
    token,
    request: { artifactId: artifact.id, version: 1, state: initialExplorationState(spec) },
    artifact,
  };
}
describe('owned, bounded Gemini playback', () => {
  it('derives narration on the server and sends only text with fixed voice/model and bounded output', async () => {
    const h = harness();
    expect(await h.speak(principal, h.request)).toEqual(wav());
    const [url, options] = h.fetch.mock.calls[0] as unknown as [string, RequestInit],
      body = JSON.parse(options.body as string);
    expect(url).toContain(`/models/${GEMINI_TTS_MODEL}:generateContent`);
    expect(body.contents[0].parts[0].text).toContain('S starts in the queue');
    expect(body.generationConfig.maxOutputTokens).toBeUndefined();
    expect(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe(
      'Sulafat',
    );
    expect(body.contents[0].parts[0].text.startsWith('You are a friendly teaching assistant')).toBe(
      true,
    );
    expect(options.redirect).toBe('error');
    expect(JSON.stringify(body)).not.toContain('artifactId');
    expect(h.settle).toHaveBeenCalledWith(expect.any(String), 0.03, true);
  });
  it('rejects arbitrary client narration, unknown steps, foreign artifacts and versions before spend', async () => {
    const h = harness();
    await expect(
      h.speak(principal, { ...h.request, text: 'Speak this arbitrary text' }),
    ).rejects.toMatchObject({ code: 'invalid' });
    await expect(
      h.speak(principal, { ...h.request, state: { ...h.request.state, step: 99 } }),
    ).rejects.toMatchObject({ code: 'invalid' });
    await expect(
      h.speak(principal, { ...h.request, artifactId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(h.speak(principal, { ...h.request, version: 2 })).rejects.toMatchObject({
      code: 'not_found',
    });
    expect(h.reserve).not.toHaveBeenCalled();
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it('uses recomputed captions after changing experiment inputs rather than obsolete authored narration', async () => {
    const h = harness();
    if (h.artifact.spec.mode !== 'checked-bfs') throw Error();
    h.artifact.spec.steps[0].narration = 'S is the start.';
    await h.speak(principal, { ...h.request, state: { ...h.request.state, start: 'b' } });
    const body = JSON.parse(
      (h.fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.contents[0].parts[0].text).toContain('B starts');
  });
  it('retains the conservative allowance on provider errors without leaking credentials', async () => {
    const h = harness();
    h.fetch.mockRejectedValue(new Error('private-original-test-token'));
    await expect(h.speak(principal, h.request)).rejects.toMatchObject({
      code: 'unavailable',
      message: 'Gemini voice is unavailable. Captions and manual steps still work.',
    });
    expect(h.settle).toHaveBeenCalledWith(expect.any(String), 0.03, true);
  });
  it('refunds a pre-send authentication failure and releases its concurrency slot', async () => {
    const h = harness();
    h.token.mockRejectedValue(new Error('auth'));
    await expect(h.speak(principal, h.request)).rejects.toMatchObject({ code: 'unavailable' });
    expect(h.settle).toHaveBeenCalledWith(expect.any(String), 0, true);
    expect(h.store.mutate).toHaveBeenCalledTimes(2);
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it('withholds generated audio after artifact deletion during the request', async () => {
    const h = harness();
    h.fetch.mockImplementation(async () => {
      h.store.read.mockResolvedValue({ artifacts: [] });
      return Response.json(envelope());
    });
    await expect(h.speak(principal, h.request)).rejects.toMatchObject({ code: 'not_found' });
    expect(h.settle).toHaveBeenCalledWith(expect.any(String), 0.03, true);
  });
  it('withholds audio if identity is revoked while settlement awaits', async () => {
    const h = harness();
    h.settle.mockImplementation(async () => {
      h.revalidate.mockRejectedValue(new ExplorationError('forbidden'));
    });
    await expect(h.speak(principal, h.request)).rejects.toMatchObject({ code: 'forbidden' });
  });
  it('does not release a provider slot early or play a response arriving after cancellation', async () => {
    const h = harness(),
      abort = new AbortController();
    let finish!: (r: Response) => void;
    h.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const result = h.speak(principal, h.request, abort.signal);
    await vi.waitFor(() => expect(h.fetch).toHaveBeenCalled());
    abort.abort();
    expect(h.store.mutate).toHaveBeenCalledTimes(1);
    finish(Response.json(envelope()));
    await expect(result).rejects.toMatchObject({ code: 'cancelled' });
    expect(h.store.mutate).toHaveBeenCalledTimes(2);
  });
  it('wraps documented 24kHz little-endian PCM into WAV without changing samples', () => {
    const samples = new Float32Array([-0.75, 0, 0.5, 1, -1]),
      audio = encodeVoiceWav(samples),
      raw = envelope();
    raw.candidates[0].content.parts[0].inlineData = {
      mimeType: 'audio/L16;codec=pcm;rate=24000',
      data: Buffer.from(audio.subarray(44)).toString('base64'),
    };
    expect(parseGeminiSpeech(raw)).toEqual(audio);
    // Gemini 3.1 Flash TTS spells the same format differently; other rates and stereo are refused.
    raw.candidates[0].content.parts[0].inlineData.mimeType = 'audio/l16; rate=24000; channels=1';
    expect(parseGeminiSpeech(raw)).toEqual(audio);
    for (const mimeType of [
      'audio/l16; rate=16000; channels=1',
      'audio/l16; rate=24000; channels=2',
      'audio/mpeg',
    ]) {
      raw.candidates[0].content.parts[0].inlineData.mimeType = mimeType;
      expect(() => parseGeminiSpeech(raw)).toThrow();
    }
  });
  it('rejects truncated, invalid and oversized audio envelopes', () => {
    expect(parseGeminiSpeech(envelope())).toEqual(wav());
    const truncated = envelope();
    truncated.candidates[0].finishReason = 'MAX_TOKENS';
    expect(() => parseGeminiSpeech(truncated)).toThrow();
    const broken = envelope();
    broken.candidates[0].content.parts[0].inlineData.data =
      Buffer.from('not audio').toString('base64');
    expect(() => parseGeminiSpeech(broken)).toThrow();
    const huge = envelope();
    huge.candidates[0].content.parts[0].inlineData.data = 'A'.repeat(2_000_000);
    expect(() => parseGeminiSpeech(huge)).toThrow();
  });
});
