const MAX_DURATION_MS = 120_000;
const MAX_INTERVALS = 21_600;
const FRAME_BUDGET_MS = 16.7;
const STALL_MS = 50;

export type FrameSampleReport = {
  lab: string | null;
  status: 'idle' | 'recording' | 'paused' | 'complete';
  sampleCount: number;
  durationMs: number;
  /** Rate of app callbacks over measured intervals, not GPU throughput. */
  meanFps: number | null;
  medianMs: number | null;
  p95Ms: number | null;
  maxMs: number | null;
  overBudgetFrames: number;
  stalls: number;
  pausedCount: number;
};

/**
 * Opt-in sampling of monotonic app callback timestamps. The caller pauses on
 * hidden tabs, switches, or XR session interruptions. A resumed run waits for
 * two new callbacks before recording an interval. Sampling stops at the first
 * callback that reaches 120 measured seconds or 21,600 intervals.
 */
export function createFrameSampler() {
  const intervals: number[] = [];
  let lab: FrameSampleReport['lab'] = null;
  let status: FrameSampleReport['status'] = 'idle';
  let startedAt = 0;
  let previousFrame: number | null = null;
  let durationMs = 0;
  let overBudgetFrames = 0;
  let stalls = 0;
  let pausedCount = 0;

  function start(nextLab: string, now = performance.now()) {
    lab = nextLab;
    status = 'recording';
    startedAt = Number.isFinite(now) ? now : 0;
    previousFrame = null;
    intervals.length = 0;
    durationMs = 0;
    overBudgetFrames = 0;
    stalls = 0;
    pausedCount = 0;
  }

  function stop() {
    if (status === 'idle') return;
    previousFrame = null;
    status = 'complete';
  }

  function tick(now = performance.now()) {
    if (status !== 'recording' || !Number.isFinite(now) || now < startedAt) return;
    if (previousFrame === null) {
      previousFrame = now;
      return;
    }
    const elapsed = now - previousFrame;
    if (!Number.isFinite(elapsed) || elapsed <= 0) return;
    previousFrame = now;
    intervals.push(elapsed);
    durationMs += elapsed;
    if (elapsed > FRAME_BUDGET_MS) overBudgetFrames++;
    if (elapsed >= STALL_MS) stalls++;
    if (durationMs >= MAX_DURATION_MS || intervals.length >= MAX_INTERVALS) stop();
  }

  function pause() {
    if (status !== 'recording') return;
    previousFrame = null;
    status = 'paused';
    pausedCount++;
  }

  function resume() {
    if (status === 'paused') status = 'recording';
  }

  function report(): FrameSampleReport {
    const sorted = [...intervals].sort((a, b) => a - b);
    const sampleCount = sorted.length;
    const middle = Math.floor(sampleCount / 2);
    const medianMs =
      sampleCount === 0
        ? null
        : sampleCount % 2 === 0
          ? (sorted[middle - 1] + sorted[middle]) / 2
          : sorted[middle];
    return {
      lab,
      status,
      sampleCount,
      durationMs,
      meanFps: durationMs > 0 ? (sampleCount * 1000) / durationMs : null,
      medianMs,
      p95Ms: sampleCount > 0 ? sorted[Math.ceil(sampleCount * 0.95) - 1] : null,
      maxMs: sorted.at(-1) ?? null,
      overBudgetFrames,
      stalls,
      pausedCount,
    };
  }

  return { start, tick, pause, resume, stop, report };
}
