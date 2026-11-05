import { describe, it, expect } from 'vitest';
import { enginePose, ENGINE, validateEngine } from '../../docs/examples/pm121/lib/engine';
import { readFileSync } from 'node:fs';
describe('independent slider-crank geometry', () => {
  it('matches dead centers and an independently derived quarter-turn height', () => {
    expect(enginePose(0).pistonY).toBe(216);
    expect(enginePose(180).pistonY).toBe(344);
    expect(enginePose(90).pistonY).toBeCloseTo(450 - Math.sqrt(170 ** 2 - 64 ** 2), 10);
  });
  it('retains both joints, rod length, bore clearance and full-turn symmetry at 1441 angles', () => {
    for (let a = 0; a <= 720; a += 0.5) {
      const p = enginePose(a),
        rad = (p.rodAngle * Math.PI) / 180;
      expect(Math.hypot(p.pinX - 400, p.pinY - p.pistonY)).toBeCloseTo(170, 9);
      expect(p.pinX + 170 * Math.sin(rad)).toBeCloseTo(400, 9);
      expect(p.pinY - 170 * Math.cos(rad)).toBeCloseTo(p.pistonY, 9);
      expect(Math.hypot(p.pinX - 400, p.pinY - 450)).toBeCloseTo(64, 9);
      expect(p.pistonTop).toBeGreaterThanOrEqual(180 - 1e-9);
      expect(p.pistonTop).toBeLessThanOrEqual(308 + 1e-9);
      if (a <= 360) expect(p.pistonY).toBeCloseTo(enginePose(a + 360).pistonY, 9);
    }
  });
  it('opens only the appropriate valve and closes at every boundary', () => {
    for (let a = 0; a <= 720; a++) {
      const p = enginePose(a);
      expect(p.intakeLift * p.exhaustLift).toBe(0);
      if (p.phase !== 0) expect(p.intakeLift).toBe(0);
      if (p.phase !== 3) expect(p.exhaustLift).toBe(0);
    }
    for (const a of [0, 180, 360, 540, 720])
      expect(enginePose(a).intakeLift + enginePose(a).exhaustLift).toBeCloseTo(0, 10);
    expect(enginePose(90).intakeLift).toBe(9);
    expect(enginePose(630).exhaustLift).toBe(9);
  });
  it('limits ignition to the beginning of power', () => {
    expect(enginePose(368.5).spark).toBe(1);
    for (const a of [0, 180, 359, 377, 540, 720]) expect(enginePose(a).spark).toBe(0);
  });
  it('bounds nonfinite and external control values without mutation', () => {
    expect(enginePose(NaN)).toEqual(enginePose(0));
    expect(enginePose(-1)).toEqual(enginePose(0));
    expect(enginePose(721)).toEqual(enginePose(720));
    expect(ENGINE.rodLength).toBe(170);
  });
});
describe('accepted engine data boundary', () => {
  const load = () => JSON.parse(readFileSync('docs/examples/pm121/film.json', 'utf8'));
  it('accepts actual recorded output in correct stroke order', () =>
    expect(validateEngine(load()).strokes.map((s) => s.name)).toEqual([
      'Intake',
      'Compression',
      'Power',
      'Exhaust',
    ]));
  it.each(['<script/>', 'M0 0 url(https://bad)', 'M1e999 0', 'M1201 0'])(
    'rejects unsafe or unbounded path %s',
    (d) => {
      const f = load();
      f.art[0].d = d;
      expect(() => validateEngine(f)).toThrow();
    },
  );
  it('rejects duplicate IDs, missing roles and arbitrary code fields', () => {
    let f = load();
    f.art[1].id = f.art[0].id;
    expect(() => validateEngine(f)).toThrow();
    f = load();
    f.art = f.art.filter((a: { role: string }) => a.role !== 'piston');
    expect(() => validateEngine(f)).toThrow();
    f = load();
    f.script = 'bad';
    expect(() => validateEngine(f)).toThrow();
  });
  it('rejects reordered cycle and oversized documents', () => {
    let f = load();
    f.strokes.reverse();
    expect(() => validateEngine(f)).toThrow();
    expect(() => validateEngine({ extra: 'x'.repeat(26001) })).toThrow();
  });
});

describe('actual model lineage', () => {
  it('reproduces the final accepted artwork exactly from Muse base and restricted path patch', () => {
    const base = JSON.parse(
      readFileSync('docs/examples/pm121/base-author.json', 'utf8'),
    ).structured;
    const patch = JSON.parse(readFileSync('docs/examples/pm121/path-repair-author.json', 'utf8'))
      .structured.updates as { id: string; d: string }[];
    expect(patch.map((a) => a.id).sort()).toEqual(['crank-web', 'exhaust-valve-stem', 'head-deck']);
    const counter = JSON.parse(
      readFileSync('docs/examples/pm121/counterweight-author.json', 'utf8'),
    ).structured.updates as { id: string; d: string }[];
    expect(counter.map((a) => a.id)).toEqual(['crank-counterweight']);
    patch.push(...counter);
    const merged = {
      ...base,
      art: base.art.map((a: { id: string; d: string }) => ({
        ...a,
        d: patch.find((p) => p.id === a.id)?.d ?? a.d,
      })),
    };
    expect(JSON.parse(readFileSync('docs/examples/pm121/film.json', 'utf8'))).toEqual(merged);
  });
});
