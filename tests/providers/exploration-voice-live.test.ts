import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encodeVoiceWav } from '../../src/lib/domain/voice-audio';
import { transcribeVoice } from '../../src/lib/server/voice-transcribe';
import { explorationService } from '../../src/lib/server/exploration';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';
// An original silent WAV verifies the actual multipart/format/no-speech path;
// it does not measure word accuracy or human microphone permission.
describe.skipIf(process.env.SOMA_EXPLORATION_VOICE_LIVE !== 'true')(
  'actual Muse ASR boundary',
  () => {
    it('accepts canonical original silent PCM and returns the typed no-speech state', async () => {
      const id = randomBytes(32).toString('hex'),
        principal: ExplorationPrincipal = {
          kind: 'guest',
          id,
          workspaceId: id,
          generation: id,
          key: `guest-${id}`,
        };
      await explorationService.initialize(principal);
      await expect(
        transcribeVoice(principal, encodeVoiceWav(new Float32Array(24_000))),
      ).rejects.toMatchObject({ code: 'no_speech' });
    }, 40_000);
  },
);
