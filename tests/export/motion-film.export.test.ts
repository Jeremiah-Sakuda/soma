import { it, expect } from 'vitest';
import { renderMotionComparison } from '../../scripts/render-motion-comparison';
it.skipIf(process.env.SOMA_RENDER_MOTION_FILM !== 'true')('renders the actual Muse SVG composition and complete local narration to a 30fps MP4', async () => {
  const receipt = await renderMotionComparison();
  expect(receipt.frameCount).toBe(720);
  expect(Number(receipt.probe.format.duration)).toBeCloseTo(receipt.duration, 1);
  const video = receipt.probe.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
  expect(video).toMatchObject({ codec_name: 'h264', width: 640, height: 460, avg_frame_rate: '30/1' });
  expect(receipt.probe.streams.some((s: { codec_type: string }) => s.codec_type === 'audio')).toBe(true);
}, 150000);
