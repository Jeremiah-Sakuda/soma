'use client';

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { SpatialScene } from '@/lib/domain/spatial-exploration';
import type { SpatialView } from '@/lib/domain/spatial-schema';
import { anatomyConnections, anatomyPaintOrder, anatomyPart, anatomyProjection, type AnatomySolid } from './anatomy-geometry';

function Solid({ solid, emphasized }: { solid: AnatomySolid; emphasized: boolean }) {
  const p = solid.paths;
  return <g className="anatomy-solid" opacity={solid.opacity} style={{ '--part-color': solid.color } as CSSProperties}>
    <path d={p.fill} className="anatomy-fill" />
    {p.shades.map((d, i) => d && <path key={i} d={d} className="anatomy-shade" opacity={[.29, .21, .13, .06][i]} />)}
    <path d={p.top} className="anatomy-top" />
    <path d={p.crease + (p.bevel ?? '')} className="anatomy-crease" />
    <path d={p.outline} className="anatomy-outline" data-emphasis={emphasized} />
  </g>;
}

/** Ease authored steps; direct manipulation must render the requested pose immediately. */
function usePose(scene: SpatialScene) {
  const [frame, setFrame] = useState(scene), current = useRef(scene);
  const direct = scene.parameters?.some(parameter => parameter.overridden) ?? false;
  useEffect(() => {
    const before = current.current;
    const moved = scene.objects.some(o => {
      const old = before.objects.find(p => p.id === o.id);
      return old && o.visible && old.visible && (JSON.stringify(o.position) !== JSON.stringify(old.position) || JSON.stringify(o.parameterValues) !== JSON.stringify(old.parameterValues));
    });
    if (direct || !moved || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.current = scene; setFrame(scene); return;
    }
    let id = 0, start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 360), k = 1 - (1 - t) ** 3;
      // Land on the exact authored values, without interpolation round-off.
      const next = t === 1 ? scene : { ...scene, objects: scene.objects.map(o => {
        const old = before.objects.find(p => p.id === o.id);
        return !old || !old.visible || !o.visible ? o : { ...o, position: {
          x: old.position.x + (o.position.x - old.position.x) * k,
          y: old.position.y + (o.position.y - old.position.y) * k,
          z: old.position.z + (o.position.z - old.position.z) * k,
        }, ...(o.parameterValues ? { parameterValues: Object.fromEntries(Object.entries(o.parameterValues).map(([id, to]) => [id, (old.parameterValues?.[id] ?? to) + (to - (old.parameterValues?.[id] ?? to)) * k])) } : {}) };
      }) };
      current.current = next; setFrame(next);
      if (t < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [scene]);
  // Do not wait for an effect (or one extra stale frame) when scrubbing/reversing.
  return direct ? scene : frame;
}

export default function AnatomyCanvas({ scene, view, selected, onSelect, onView }: {
  scene: SpatialScene; view: SpatialView; selected: string | null;
  onSelect: (id: string) => void; onView: (view: Partial<SpatialView>) => void;
}) {
  const root = useRef<HTMLDivElement>(null), [size, setSize] = useState({ width: 640, height: 360 });
  const drag = useRef<{ x: number; y: number; azimuth: number; elevation: number; moved: boolean; objectId: string | null; last: number } | null>(null);
  const frame = usePose(scene), arrow = `anatomy-arrow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  useEffect(() => {
    const measure = () => { const r = root.current?.getBoundingClientRect(); if (r?.width && r.height) setSize({ width: r.width, height: r.height }); };
    const observer = new ResizeObserver(measure); observer.observe(root.current!); measure();
    return () => observer.disconnect();
  }, []);
  const projection = useMemo(() => anatomyProjection(scene, view, size.width, size.height), [scene, view.azimuth, view.elevation, view.zoom, size.width, size.height]);
  const parts = useMemo(() => frame.objects.filter(o => o.visible).map(o => anatomyPart(o, projection, view.slice)), [frame, projection, view.slice]);
  const solids = useMemo(() => anatomyPaintOrder(parts.flatMap(part => part.solids.map(solid => ({ solid, object: part.object }))), projection), [parts, projection]);
  const links = useMemo(() => anatomyConnections(frame, projection), [frame, projection]);
  const selectedPart = parts.find(p => p.object.id === selected);
  const rotate = (azimuth: number, elevation: number) => onView({ azimuth: ((azimuth + 180) % 360 + 360) % 360 - 180, elevation: Math.max(0, Math.min(85, elevation)) });
  return <div ref={root} className="anatomy-canvas" data-rendered="true" data-object-count={parts.length}>
    <div className="anatomy-plate-head" aria-hidden="true"><span>FIG. 01 <span className="anatomy-plate-divider">/</span> {scene.assurance === 'checked' ? 'CHECKED STATE' : 'INSIDE THE MECHANISM'}</span><span>ANATOMY</span></div>
    <svg viewBox={`0 0 ${size.width} ${size.height}`} role="img" aria-label={`${scene.title}, Anatomy isometric illustration. Select named parts below; camera buttons rotate the drawing.`}
      onPointerDown={e => { if (e.button !== 0) return; drag.current = { x: e.clientX, y: e.clientY, azimuth: view.azimuth, elevation: view.elevation, moved: false, objectId: (e.target as Element).closest('[data-anatomy-object]')?.getAttribute('data-anatomy-object') ?? null, last: 0 }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={e => { const d = drag.current; if (!d) return; if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && !d.moved) return; d.moved = true; if (performance.now() - d.last > 32) { d.last = performance.now(); rotate(d.azimuth - (e.clientX - d.x) * .4, d.elevation + (e.clientY - d.y) * .3); } }}
      onPointerUp={e => { const d = drag.current; drag.current = null; if (d?.moved) rotate(d.azimuth - (e.clientX - d.x) * .4, d.elevation + (e.clientY - d.y) * .3); else if (d?.objectId) onSelect(d.objectId); }}
      onPointerCancel={() => { drag.current = null; }}>
      <defs><marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M1 1L9 5L1 9Z" fill="context-stroke" /></marker></defs>
      {solids.map(({ solid, object }, i) => <g key={`${object.id}-${i}`} data-anatomy-object={object.id} data-selected={selected === object.id} pointerEvents={object.renderStyle === 'housing' ? 'none' : undefined}><Solid solid={solid} emphasized={object.highlighted || selected === object.id} /></g>)}
      <g className="anatomy-wires">{links.map(({ edge, d }) => <path key={edge.id} d={d} data-anatomy-edge={edge.id} data-active={edge.active} data-highlighted={edge.highlighted} markerEnd={edge.directed ? `url(#${arrow})` : undefined} />)}</g>
      {parts.map(({ object, lines }) => <g key={object.id} data-anatomy-object={object.id} data-position={JSON.stringify(object.position)} className="anatomy-details">
        {lines.map((line, i) => <path key={i} d={line.d} stroke={line.color} strokeWidth={line.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
      </g>)}
      {parts.filter(p => p.object.highlighted || p.object.id === selected).map(p => <g key={p.object.id} className="anatomy-part-marker" transform={`translate(${p.anchor[0]},${p.anchor[1] - 10})`} aria-hidden="true">
        <circle r="10" /><text textAnchor="middle" dy=".35em">{scene.objects.findIndex(o => o.id === p.object.id) + 1}</text>
      </g>)}
    </svg>
    {selectedPart && <div className="anatomy-selected-label">{scene.objects.findIndex(o => o.id === selected) + 1}<span>{selectedPart.object.label}</span></div>}
    {!parts.length && <p className="anatomy-empty">No parts visible at this step. Choose another explanation step or show all parts.</p>}
  </div>;
}
