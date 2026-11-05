import { describe, it, expect } from 'vitest';
import { motionGuides, playbackDegrees } from '../../docs/examples/pm124/motion-guides';
describe('forward-cycle cues', () => {
  it('agrees with independent dead-center heights and direction reversals', () => {
    for (const [a, y] of [
      [0, 180],
      [180, 308],
      [360, 180],
      [540, 308],
      [720, 180],
    ]) {
      expect(motionGuides(a).travelY).toBeCloseTo(y, 10);
      expect(motionGuides(a).atTurn).toBe(true);
    }
    expect([90, 270, 450, 630].map((a) => motionGuides(a).direction)).toEqual([
      'down',
      'up',
      'down',
      'up',
    ]);
  });
  it('uses one half-turn per stroke without nonfinite geometry at phase boundaries', () => {
    for (const a of [0, 180, 360, 540]) expect(motionGuides(a).arc).toBe('');
    for (let a = 0; a <= 720; a++) {
      const g = motionGuides(a);
      expect(g.travelY).toBeGreaterThanOrEqual(180 - 1e-8);
      expect(g.travelY).toBeLessThanOrEqual(308 + 1e-8);
      expect(g.arc).not.toMatch(/NaN|Infinity/);
      expect(g.intakeOpen && g.exhaustOpen).toBe(false);
    }
  });
});
describe('silent media-equivalent clock', () => {
  it('half speed advances one stroke in twelve real seconds', () => {
    expect(playbackDegrees(12000, 0, 0.5, false)).toBe(180);
    expect(playbackDegrees(12000, 0, 1, false)).toBe(360);
  });
  it('retains a mid-cycle pose when restarting a changed clock', () => {
    expect(playbackDegrees(2000, 270, 0.5, false)).toBe(300);
  });
  it('wraps cleanly on repeat without changing the ordinary endpoint', () => {
    expect(playbackDegrees(24000, 0, 1, true)).toBe(0);
    expect(playbackDegrees(24000, 0, 1, false)).toBe(720);
    expect(playbackDegrees(100, 719, 0.5, true)).toBe(0.5);
    expect(playbackDegrees(49000, 0, 1, true)).toBe(30);
  });
  it('bounds invalid elapsed and pose values', () => {
    expect(playbackDegrees(NaN, Infinity, 1, false)).toBe(0);
    expect(playbackDegrees(-1, -2, 1, false)).toBe(0);
  });
});
