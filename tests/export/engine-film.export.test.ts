import { it, expect } from 'vitest';
import { renderEngineFilm } from '../../scripts/render-engine-film';
it.skipIf(process.env.SOMA_RENDER_ENGINE_FILM !== 'true')(
  'exports all720 engine frames with full local narration',
  async () => {
    const r = await renderEngineFilm();
    expect(r.frameCount).toBe(720);
    const v = r.probe.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
    expect(v.width).toBe(1920);
    expect(v.height).toBe(1080);
    expect(v.nb_frames).toBe('720');
    expect(r.probe.streams.some((s: { codec_type: string }) => s.codec_type === 'audio')).toBe(
      true,
    );
    expect(Number(r.probe.format.duration)).toBeCloseTo(24, 1);
  },
  180000,
);
