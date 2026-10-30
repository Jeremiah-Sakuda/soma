import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { iso } from '../../src/vendor/anatomy/iso-kit';
import { anatomyConnections, anatomyPaintOrder, anatomyPart, anatomyPoint, anatomyProjection } from '../../src/components/anatomy-geometry';
import AnatomyCanvas from '../../src/components/anatomy-canvas';
import { createSpatialExample } from '../../src/lib/domain/spatial-example';
import { spatialPresentation, spatialScene } from '../../src/lib/domain/spatial-exploration';
import { initialExplorationState } from '../../src/lib/domain/exploration-view';
import { defaultSpatialView, spatialRenderStyles, spatialViewSchema } from '../../src/lib/domain/spatial-schema';

const spec = createSpatialExample(), state = initialExplorationState(spec);
const scene = spatialScene(spec, state)!;
describe('Anatomy adapter boundaries and geometry', () => {
  it('accepts legacy states and only approved renderer choices', () => {
    expect(spatialViewSchema.parse(defaultSpatialView()).renderer).toBeUndefined();
    expect(spatialViewSchema.parse({ ...defaultSpatialView(), renderer: 'anatomy' }).renderer).toBe('anatomy');
    expect(spatialViewSchema.safeParse({ ...defaultSpatialView(), renderer: 'javascript:alert(1)' }).success).toBe(false);
  });
  it.each(spatialRenderStyles)('%s produces bounded finite paths with unchanged source identity and geometry', renderStyle => {
    const object = { ...scene.objects[1], renderStyle };
    const before = JSON.stringify(object);
    for (const azimuth of [-180, -45, 0, 35, 90, 180]) for (const slice of [0, 1]) {
      const p = anatomyProjection(scene, { ...defaultSpatialView(), azimuth }, 375, 290), part = anatomyPart(object, p, slice);
      expect(part.object).toBe(object);
      expect(part.solids.length + part.lines.length).toBeGreaterThan(0);
      expect(part.solids.length + part.lines.length).toBeLessThan(100);
      for (const s of part.solids) {
        expect(Number.isFinite(s.depth)).toBe(true);
        expect(s.paths.fill).not.toMatch(/NaN|Infinity|undefined/);
        expect(s.paths.fill).toMatch(/^M/);
      }
      for (const line of part.lines) expect(line.d).not.toMatch(/NaN|Infinity|undefined/);
    }
    expect(JSON.stringify(object)).toBe(before);
  });
  it('fits every world-bound corner at desktop/phone, including separated and isolated scenes', () => {
    for (const width of [300, 620, 1200]) for (const azimuth of [-180, -90, 0, 35, 90, 180]) for (const elevation of [-85, 0, 25, 85]) for (const isolate of [false, true]) {
      const view = { ...defaultSpatialView(), azimuth, elevation, isolate, spread: 1 };
      const presented = spatialPresentation(scene, { ...state, selectedObjectId: 'processor', spatial: view });
      const projection = anatomyProjection(presented, view, width, 290);
      for (const o of presented.objects.filter(o => o.visible)) for (const dx of [-.5, .5]) for (const dy of [-.5, .5]) for (const dz of [-.5, .5]) {
        const [x, y] = iso([o.position.x + dx * o.size.x, o.position.z + dz * o.size.z, o.position.y + dy * o.size.y], projection);
        expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(width);
        expect(y).toBeGreaterThan(25); expect(y).toBeLessThan(290);
      }
    }
  });
  it('matches the current renderer camera axes and camera-distance zoom convention', () => {
    for (const azimuth of [-90, 0, 35, 90]) {
      const view = { ...defaultSpatialView(), azimuth }, p = anatomyProjection(scene, view, 640, 360);
      const a = azimuth * Math.PI / 180, e = view.elevation * Math.PI / 180, k = p.scale * Math.sqrt(1.6);
      const world = { x: 1.2, y: -.4, z: 2.3 }, projected = iso(anatomyPoint(world), p);
      // Independent camera-right/up dot products from the Three camera convention.
      expect(projected[0] - p.origin[0]).toBeCloseTo((world.x * Math.cos(a) - world.z * Math.sin(a)) * k, 8);
      expect(projected[1] - p.origin[1]).toBeCloseTo(((world.x * Math.sin(a) + world.z * Math.cos(a)) * Math.sin(e) - world.y * Math.cos(e)) * k, 8);
      const far = anatomyProjection(scene, { ...view, zoom: 2 }, 640, 360);
      expect(far.scale).toBeCloseTo(p.scale / 2, 8);
    }
  });
  it('keeps connection identity, direction and active state; excludes hidden endpoints', () => {
    const p = anatomyProjection(scene, defaultSpatialView(), 640, 360);
    expect(anatomyConnections(scene, p).map(e => e.edge)).toEqual(scene.connections);
    const isolated = spatialPresentation(scene, { ...state, selectedObjectId: 'processor', spatial: { ...defaultSpatialView(), isolate: true } });
    expect(anatomyConnections(isolated, p)).toEqual([]);
    const empty = { ...scene, objects: scene.objects.map(o => ({ ...o, visible: false })) };
    expect(Number.isFinite(anatomyProjection(empty, defaultSpatialView(), 320, 290).scale)).toBe(true);
  });
  it('paints the broad circuit board before components above it, including the far-side sensor', () => {
    const p = anatomyProjection(scene, defaultSpatialView(), 640, 360);
    const parts = scene.objects.map(o => anatomyPart(o, p, 0));
    const ordered = anatomyPaintOrder(parts.flatMap(part => part.solids.map(solid => ({ solid, id: part.object.id }))), p);
    const board = ordered.findIndex(x => x.solid.color === '#657e68');
    expect(board).toBeGreaterThanOrEqual(0);
    const boardTop = ordered[board].solid.max[2];
    for (const [index, item] of ordered.entries()) {
      const s = item.solid.screen, b = ordered[board].solid.screen;
      if (item.id !== 'enclosure' && item.solid.min[2] > boardTop && s.right > b.left && s.left < b.right && s.bottom > b.top && s.top < b.bottom)
        expect(index, `${item.id} must paint above its supporting board`).toBeGreaterThan(board);
    }
  });
  it('renders untrusted source labels as escaped text without generated SVG/HTML', () => {
    const unsafe = '<script>alert("source")</script>', altered = { ...scene, title: unsafe, objects: scene.objects.map(o => ({ ...o, label: unsafe })) };
    const html = renderToStaticMarkup(createElement(AnatomyCanvas, { scene: altered, view: defaultSpatialView(), selected: 'processor', onSelect: () => {}, onView: () => {} }));
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;');
  });
});
