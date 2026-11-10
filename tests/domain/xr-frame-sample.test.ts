import { describe, expect, it } from 'vitest';
import { createFrameSampler } from '../../xr/src/frame-sample';

describe('Soma XR app frame sampling', () => {
  it('reports measured intervals, their percentiles, and counts over budget', () => {
    const sampler = createFrameSampler();
    expect(sampler.report()).toMatchObject({ status: 'idle', meanFps: null, p95Ms: null });
    sampler.start('graph', 100);
    // Start can happen mid-frame. Measure from the next callback to its successors.
    for (const stamp of [108, 124, 144, 160, 210]) sampler.tick(stamp);
    expect(sampler.report()).toEqual({
      lab: 'graph',
      status: 'recording',
      sampleCount: 4,
      durationMs: 102,
      meanFps: 4000 / 102,
      medianMs: 18,
      p95Ms: 50,
      maxMs: 50,
      overBudgetFrames: 2,
      stalls: 1,
      pausedCount: 0,
    });
  });

  it('excludes hidden gaps and ignores invalid or backwards timestamps', () => {
    const sampler = createFrameSampler();
    sampler.start('circuit', 100);
    for (const stamp of [99, 100, 116, 116, 113, NaN, Infinity, 132]) sampler.tick(stamp);
    sampler.pause();
    sampler.pause();
    sampler.tick(1200);
    expect(sampler.report()).toMatchObject({ status: 'paused', durationMs: 32, pausedCount: 1 });
    sampler.resume();
    sampler.tick(4000);
    sampler.tick(4016);
    sampler.stop();
    sampler.tick(7000);
    expect(sampler.report()).toMatchObject({
      lab: 'circuit',
      status: 'complete',
      sampleCount: 3,
      durationMs: 48,
      meanFps: 62.5,
      stalls: 0,
      pausedCount: 1,
    });
  });

  it('uses a nearest-rank p95 and distinguishes it from the worst interval', () => {
    const sampler = createFrameSampler();
    sampler.start('graph', 0);
    for (let i = 0; i < 20; i++) sampler.tick(i * 16);
    sampler.tick(19 * 16 + 100);
    expect(sampler.report()).toMatchObject({
      sampleCount: 20,
      medianMs: 16,
      p95Ms: 16,
      maxMs: 100,
      stalls: 1,
    });
  });

  it('stops at the duration and interval bounds and resets for a new lab', () => {
    const sampler = createFrameSampler();
    sampler.start('graph', 0);
    for (let i = 0; i < 8000; i++) sampler.tick(i * 20);
    expect(sampler.report()).toMatchObject({
      status: 'complete',
      durationMs: 120_000,
      sampleCount: 6000,
    });
    sampler.start('circuit', 0);
    expect(sampler.report()).toMatchObject({
      lab: 'circuit',
      status: 'recording',
      sampleCount: 0,
      p95Ms: null,
    });
    for (let i = 0; i < 23_000; i++) sampler.tick(i * 5);
    expect(sampler.report()).toMatchObject({
      status: 'complete',
      sampleCount: 21_600,
      durationMs: 108_000,
    });
  });
});
