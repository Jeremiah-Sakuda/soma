import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import raw from '../../docs/examples/pm120/film.json';
import { filmFrame, trackValue, validateFilm } from '../../docs/examples/pm120/lib/motion-film';
import { MotionScene } from '../../docs/examples/pm120/lib/MotionScene';
const film = validateFilm(raw);
describe('bounded vector motion films', () => {
  it('uses real authored vector shapes, semantic coupling and a complete caption/narration timeline', () => {
    expect(film.duration).toBe(24);
    expect(film.chapters.map((c) => c.at)).toEqual([0, 6, 12, 18]);
    expect(film.nodes.some((n) => n.kind === 'path')).toBe(true);
    expect(film.chapters.every((c) => c.narration.split(/\s+/).length <= 12)).toBe(true);
  });
  it('interpolates time deterministically, clamps endpoints and permits exact interruption/reversal', () => {
    const input = JSON.stringify(film),
      track = {
        targetId: 'test',
        property: 'ty' as const,
        easing: 'smooth' as const,
        keys: [
          { at: 2, value: 10 },
          { at: 6, value: 30 },
        ],
      };
    expect(trackValue(track, 0)).toBe(10);
    expect(trackValue(track, 4)).toBe(20);
    expect(trackValue(track, 9)).toBe(30);
    expect(filmFrame(film, -10).time).toBe(0);
    expect(filmFrame(film, Infinity).time).toBe(0);
    expect(filmFrame(film, 40).time).toBe(24);
    for (const t of [0, 7.25, 24, 12.3, 1]) expect(filmFrame(film, t)).toEqual(filmFrame(film, t));
    for (const value of [0.83, 0.17, 1, 0, 0.65])
      expect(
        filmFrame(film, 18, value).poses[film.parameter.targetId][film.parameter.property],
      ).toBe(film.parameter.amount * value);
    expect(JSON.stringify(film)).toBe(input);
  });
  it('escapes model text and renders only the controlled SVG grammar', () => {
    const copy = structuredClone(film),
      text = copy.nodes.find((n) => n.kind === 'text')!;
    text.text = '<script>alert(1)</script>';
    const svg = renderToStaticMarkup(
      createElement(MotionScene, { film: validateFilm(copy), time: 18 }),
    );
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('foreignObject');
  });
  for (const [name, mutate] of [
    ['arbitrary attributes', (f: typeof film) => Object.assign(f.nodes[0], { onload: 'alert(1)' })],
    [
      'external fills',
      (f: typeof film) => {
        f.styles[0].fill = 'url(https://example.com/x)';
      },
    ],
    [
      'markup in paths',
      (f: typeof film) => {
        f.nodes.find((n) => n.kind === 'path')!.shape = '<svg onload="x">';
      },
    ],
    [
      'non-finite path coordinates',
      (f: typeof film) => {
        f.nodes.find((n) => n.kind === 'path')!.shape = 'M 1e999 0 L 10 10';
      },
    ],
    [
      'duplicate IDs',
      (f: typeof film) => {
        f.nodes[1].id = f.nodes[0].id;
      },
    ],
    [
      'cyclic groups',
      (f: typeof film) => {
        const g = f.nodes.find((n) => n.kind === 'group')!;
        g.parentId = g.id;
      },
    ],
    [
      'unowned style reference',
      (f: typeof film) => {
        f.nodes[0].styleId = 'missing';
      },
    ],
    [
      'moving labels',
      (f: typeof film) => {
        f.nodes.find((n) => n.kind === 'text')!.parentId = f.parameter.targetId;
      },
    ],
    [
      'decoupled rod',
      (f: typeof film) => {
        f.nodes.find((n) => n.role === 'rod')!.parentId = null;
      },
    ],
    [
      'moving support',
      (f: typeof film) => {
        f.nodes.find((n) => n.role === 'base')!.parentId = f.parameter.targetId;
      },
    ],
    [
      'duplicate motion driver',
      (f: typeof film) => {
        f.tracks.push({
          targetId: f.parameter.targetId,
          property: 'ty',
          easing: 'linear',
          keys: [
            { at: 0, value: 0 },
            { at: 24, value: 70 },
          ],
        });
      },
    ],
    [
      'out-of-range control',
      (f: typeof film) => {
        f.tracks.find((t) => t.targetId === '$compression')!.keys[1].value = 2;
      },
    ],
    [
      'unordered times',
      (f: typeof film) => {
        f.tracks[0].keys[1].at = 0;
      },
    ],
    [
      'missing initial chapter',
      (f: typeof film) => {
        f.chapters[0].at = 1;
      },
    ],
    [
      'unknown target',
      (f: typeof film) => {
        f.tracks[0].targetId = 'missing';
      },
    ],
    [
      'conflicting tracks',
      (f: typeof film) => {
        f.tracks.push(structuredClone(f.tracks[0]));
      },
    ],
  ] as const)
    it(`rejects ${name}`, () => {
      const copy = structuredClone(film);
      mutate(copy);
      expect(() => validateFilm(copy)).toThrow();
    });
  it('bounds payload size and node count before rendering', () => {
    expect(() => validateFilm({ ...film, summary: 'x'.repeat(25000) })).toThrow();
    expect(() => validateFilm({ ...film, nodes: Array(49).fill(film.nodes[0]) })).toThrow();
  });
});
