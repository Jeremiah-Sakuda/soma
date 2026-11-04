'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createSpatialPart } from './spatial-parts';
import { ENGINE, engineRoleOf } from '@/lib/domain/engine-kinematics';
import { placeSpatialLabel, spatialCameraDistance, type LabelRect } from './spatial-layout';
import { mechanismBounds } from '@/lib/domain/mechanism-geometry';
import type { SpatialScene } from '@/lib/domain/spatial-exploration';
import type { SpatialView } from '@/lib/domain/spatial-schema';

type Props = { scene: SpatialScene; view: SpatialView; selected: string | null; onSelect: (id: string) => void; onView: (view: SpatialView) => void; onFailure: () => void };
type Engine = { update: (props: Props) => void; dispose: () => void };

/** No generated code, URLs or assets enter this renderer. GPU work occurs on change or a bounded step transition; no idle animation. */
export default function SpatialCanvas(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const engine = useRef<Engine | null>(null);
  latest.current = props;
  useEffect(() => {
    const element = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' }); }
    catch { latest.current.onFailure(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xf7f6f2);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.localClippingEnabled = true;
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-label', 'Interactive 3D scene. Drag to orbit or use the labeled view controls.');
    canvas.setAttribute('role', 'img');
    element.appendChild(canvas);
    const world = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    world.add(new THREE.HemisphereLight(0xffffff, 0x919f9e, 2.4));
    const light = new THREE.DirectionalLight(0xfff3dd, 3);
    light.position.set(-3, 7, 5); light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024); light.shadow.normalBias = 0.03;
    light.shadow.camera.left = -14; light.shadow.camera.right = 14;
    light.shadow.camera.top = 14; light.shadow.camera.bottom = -14;
    world.add(light, light.target);
    const fill = new THREE.DirectionalLight(0xbad9ec, 1.2);
    fill.position.set(-5, 3, -4); world.add(fill);
    const group = new THREE.Group(); world.add(group);
    const labelLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    labelLayer.classList.add('spatial-label-leaders'); labelLayer.setAttribute('aria-hidden', 'true'); element.appendChild(labelLayer);
    const labels: { element: HTMLSpanElement; line: SVGPathElement; position: THREE.Vector3; priority: number; objectId?: string; offset?: number }[] = [];
    const nodes = new Map<string, THREE.Group>();
    const links: { from: string; to: string; line: THREE.Mesh; arrow?: THREE.Mesh }[] = [];
    let animationFrame = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const resources: { dispose: () => void }[] = [];
    const selectable: THREE.Object3D[] = [];
    let current = latest.current, currentScene: SpatialScene | null = null, currentSelection: string | null = null;
    let center = new THREE.Vector3(), radius = 4, halfWidth = 4, floorY = -1;
    let framingBounds = new THREE.Box3();
    let disposed = false, lost = false;
    const plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    let materialList: THREE.Material[] = [];
    function clear() {
      for (const resource of new Set(resources)) resource.dispose();
      resources.length = 0; selectable.length = 0; materialList = [];
      for (const label of labels) label.element.remove();
      labels.length = 0; labelLayer.replaceChildren(); nodes.clear(); links.length = 0; group.clear();
    }
    function material(color: number, opacity = 1, highlight = false) {
      const value = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.12, transparent: opacity < 1, opacity, depthWrite: opacity === 1, side: THREE.DoubleSide, emissive: highlight ? color : 0, emissiveIntensity: highlight ? 0.22 : 0 });
      resources.push(value); materialList.push(value); return value;
    }
    function label(text: string, position: THREE.Vector3, priority: number, objectId?: string, offset?: number) {
      const span = document.createElement('span'); span.textContent = text;
      span.className = 'spatial-canvas-label'; span.setAttribute('aria-hidden', 'true');
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path'); labelLayer.appendChild(line);
      element.appendChild(span); labels.push({ element: span, line, position, priority, objectId, offset });
    }
    function rebuild() {
      clear();
      const visible = current.scene.objects.filter((object) => object.visible);
      const bounds = new THREE.Box3();
      // Stepping retains whole-scene framing; explicit isolation frames the selected assembly.
      const framing = current.view.isolate && visible.length ? visible : current.scene.objects;
      for (const object of framing) {
        // The engine frames on its block's extent at any angle, so turning the crank never moves the camera.
        const engineRole = engineRoleOf(object.renderStyle);
        if (engineRole) {
          if (engineRole !== 'block') continue;
          const s = object.size.x, p = object.position, e = ENGINE.envelope;
          bounds.expandByPoint(new THREE.Vector3(p.x + e.min[0] * s, p.y + e.min[1] * s, p.z + e.min[2] * s));
          bounds.expandByPoint(new THREE.Vector3(p.x + e.max[0] * s, p.y + e.max[1] * s, p.z + e.max[2] * s));
          continue;
        }
        if (object.geometry?.length) {
          const b = mechanismBounds(object); bounds.expandByPoint(new THREE.Vector3(...b.min)); bounds.expandByPoint(new THREE.Vector3(...b.max)); continue;
        }
        if (object.path?.length) { for (const q of object.path) bounds.expandByPoint(new THREE.Vector3(q.x, q.y, q.z)); continue; }
        const p = new THREE.Vector3(object.position.x, object.position.y, object.position.z);
        const s = new THREE.Vector3(object.size.x, object.size.y, object.size.z).multiplyScalar(0.5);
        bounds.expandByPoint(p.clone().sub(s)); bounds.expandByPoint(p.clone().add(s));
      }
      if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-2, -2, -2), new THREE.Vector3(2, 2, 2));
      framingBounds = bounds;
      center = bounds.getCenter(new THREE.Vector3()); radius = Math.max(current.view.isolate ? 0.65 : 2, bounds.getSize(new THREE.Vector3()).length() / 2);
      const shadowExtent = Math.max(2, radius * 1.4);
      light.position.copy(center).add(new THREE.Vector3(-3, 7, 5).multiplyScalar(Math.max(1, radius / 4)));
      light.target.position.copy(center);
      Object.assign(light.shadow.camera, { left: -shadowExtent, right: shadowExtent, top: shadowExtent, bottom: -shadowExtent });
      light.shadow.camera.updateProjectionMatrix();
      halfWidth = Math.max(0.1, (bounds.max.x - bounds.min.x) / 2); floorY = bounds.min.y - 0.22;
      if (current.scene.assurance === 'checked') {
        const grid = new THREE.GridHelper(Math.max(8, radius * 3), 16, 0xd0d4cd, 0xe9ebe5);
        grid.position.set(center.x, floorY, center.z); group.add(grid);
        resources.push(grid.geometry); if (Array.isArray(grid.material)) resources.push(...grid.material); else resources.push(grid.material);
      } else {
        const floorGeometry = new THREE.PlaneGeometry(80, 80);
        const floorMaterial = new THREE.ShadowMaterial({ color: 0x4c645d, opacity: 0.16 });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial); floor.rotation.x = -Math.PI / 2;
        floor.position.set(center.x, floorY, center.z); floor.receiveShadow = true; group.add(floor);
        resources.push(floorGeometry, floorMaterial);
      }
      for (const object of visible) {
        const shell = object.shell || current.scene.objects.some((o) => o.parentId === object.id);
        const selected = object.id === current.selected;
        const part = createSpatialPart(object, selected, shell);
        part.traverse((item) => {
          if (!(item instanceof THREE.Mesh)) return;
          resources.push(item.geometry); selectable.push(item);
          const materials = Array.isArray(item.material) ? item.material : [item.material];
          resources.push(...materials); materialList.push(...materials);
        });
        group.add(part); nodes.set(object.id, part);
        // Signal markers show motion, not another competing label on the mechanism.
        if (object.renderStyle !== 'marker' || selected)
        {
          // An arrow is named at its tip, a tube or sheet at its middle.
          const path = object.path, ref = path?.length ? (object.shape === 'arrow' ? path[path.length - 1] : path[Math.floor(path.length / 2)]) : null;
          if (ref) label(object.label, new THREE.Vector3(ref.x, ref.y + 0.15, ref.z), selected ? 3 : object.highlighted ? 2 : 1);
          else label(object.label, part.position.clone(), selected ? 3 : object.highlighted ? 2 : shell || engineRoleOf(object.renderStyle) ? 0 : 1, object.id, new THREE.Box3().setFromObject(part).max.y - part.position.y);
        }
      }
      const byId = new Map(visible.map((object) => [object.id, object]));
      for (const edge of current.scene.connections) {
        const from = byId.get(edge.from), to = byId.get(edge.to);
        if (!from || !to) continue;
        const a = new THREE.Vector3(from.position.x, from.position.y, from.position.z), b = new THREE.Vector3(to.position.x, to.position.y, to.position.z);
        const direction = b.clone().sub(a), length = direction.length();
        if (length < 0.01) continue;
        const selected = current.selected === edge.id;
        const mat = material(edge.highlighted || selected ? 0x52775f : 0x969d91, edge.active ? 0.9 : 0.2, selected);
        const geo = new THREE.CylinderGeometry(0.025, 0.025, 1, 12); resources.push(geo);
        const line = new THREE.Mesh(geo, mat); line.position.copy(a).add(b).multiplyScalar(0.5);
        line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
        line.scale.y = length; line.userData.objectId = edge.id; group.add(line); selectable.push(line);
        const binding: typeof links[number] = { from: edge.from, to: edge.to, line }; links.push(binding);
        if (edge.directed) {
          const coneGeo = new THREE.ConeGeometry(0.11, 0.25, 12); resources.push(coneGeo);
          const arrow = new THREE.Mesh(coneGeo, mat);
          arrow.position.copy(a).lerp(b, 0.7); arrow.quaternion.copy(line.quaternion); arrow.userData.objectId = edge.id;
          group.add(arrow); selectable.push(arrow); binding.arrow = arrow;
        }
        if (edge.label && selected) label(edge.label, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.15, 0)), 0);
      }
      currentScene = current.scene; currentSelection = current.selected;
    }
    function draw() {
      if (disposed || lost) return;
      const width = element.clientWidth, height = element.clientHeight;
      if (!width || !height) return;
      const { view } = current;
      const aspect = width / height;
      camera.aspect = aspect;
      const azimuth = THREE.MathUtils.degToRad(view.azimuth), elevation = THREE.MathUtils.degToRad(view.elevation);
      const distance = spatialCameraDistance(framingBounds, azimuth, elevation, aspect, camera.fov, height) * view.zoom;
      camera.far = Math.max(120, distance + radius * 4); camera.updateProjectionMatrix();
      camera.position.set(center.x + Math.sin(azimuth) * Math.cos(elevation) * distance, center.y + Math.sin(elevation) * distance, center.z + Math.cos(azimuth) * Math.cos(elevation) * distance);
      camera.lookAt(center);
      plane.constant = center.x + halfWidth - view.slice * halfWidth * 2;
      for (const mat of materialList) { mat.clippingPlanes = view.slice > 0 ? [plane] : null; }
      for (const link of links) {
        const a = nodes.get(link.from)?.position, b = nodes.get(link.to)?.position;
        if (!a || !b) continue;
        const direction = b.clone().sub(a), length = direction.length();
        link.line.visible = length > 0.01;
        if (link.arrow) link.arrow.visible = length > 0.01;
        if (length <= 0.01) continue;
        link.line.position.copy(a).lerp(b, 0.5); link.line.scale.y = length;
        link.line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
        if (link.arrow) { link.arrow.position.copy(a).lerp(b, 0.7); link.arrow.quaternion.copy(link.line.quaternion); }
      }
      renderer.render(world, camera);
      const occupied: LabelRect[] = [];
      // Callouts should reveal the mechanism, not cover it. Reserve projected
      // solid-part silhouettes; enclosing shells deliberately remain permeable.
      for (const object of current.scene.objects) {
        const node = nodes.get(object.id);
        if (!node || object.renderStyle === 'marker' || current.scene.objects.some((o) => o.parentId === object.id)) continue;
        const bounds = new THREE.Box3().setFromObject(node);
        const points: THREE.Vector3[] = [];
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) points.push(new THREE.Vector3(x, y, z).project(camera));
        if (points.some((p) => p.z <= -1 || p.z >= 1)) continue;
        const left = Math.max(0, Math.min(...points.map((p) => (p.x + 1) * width / 2)));
        const right = Math.min(width, Math.max(...points.map((p) => (p.x + 1) * width / 2)));
        const top = Math.max(0, Math.min(...points.map((p) => (1 - p.y) * height / 2)));
        const bottom = Math.min(height, Math.max(...points.map((p) => (1 - p.y) * height / 2)));
        if (right > left && bottom > top) occupied.push({ x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top });
      }
      labelLayer.setAttribute('viewBox', `0 0 ${width} ${height}`);
      for (const item of [...labels].sort((a, b) => b.priority - a.priority)) {
        const node = item.objectId ? nodes.get(item.objectId) : undefined;
        const anchor = node ? node.position.clone().add(new THREE.Vector3(0, item.offset ?? 0, 0)) : item.position;
        const projected = anchor.clone().project(camera);
        const px = (projected.x + 1) * width / 2, py = (1 - projected.y) * height / 2;
        item.element.style.display = 'block';
        item.element.dataset.emphasis = item.priority > 1 ? 'true' : 'false';
        const placement = placeSpatialLabel({ x: px, y: py }, { width: item.element.offsetWidth, height: item.element.offsetHeight }, { width, height }, occupied);
        const shown = placement && px > 0 && px < width && py > 0 && py < height && projected.z > -1 && projected.z < 1 && (view.slice === 0 || plane.distanceToPoint(anchor) >= 0);
        item.element.style.display = shown ? 'block' : 'none'; item.line.style.display = shown ? 'block' : 'none';
        if (shown && placement) {
          const { x, y, height: labelHeight } = placement;
          item.element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
          item.element.dataset.emphasis = item.priority > 1 ? 'true' : 'false';
          const edgeY = y + (py > y ? 1 : -1) * labelHeight / 2;
          item.line.setAttribute('d', `M${px},${py} L${px},${edgeY} L${x},${edgeY}`);
          occupied.push(placement);
        }
      }
      canvas.dataset.rendered = 'true';
    }
    const observer = new ResizeObserver(() => {
      try { renderer.setSize(element.clientWidth, element.clientHeight, false); draw(); }
      catch { latest.current.onFailure(); }
    });
    observer.observe(element);
    let drag: { x: number; y: number; view: SpatialView } | null = null;
    const wrap = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;
    function down(event: PointerEvent) {
      if (event.button !== 0) return;
      drag = { x: event.clientX, y: event.clientY, view: { ...current.view } };
      canvas.setPointerCapture(event.pointerId);
    }
    function move(event: PointerEvent) {
      if (!drag) return;
      current = { ...current, view: { ...drag.view, azimuth: wrap(drag.view.azimuth - (event.clientX - drag.x) * 0.4), elevation: Math.max(-85, Math.min(85, drag.view.elevation + (event.clientY - drag.y) * 0.3)) } };
      draw();
    }
    function up(event: PointerEvent) {
      if (!drag) return;
      const clicked = Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5;
      const nextView = { ...drag.view, azimuth: wrap(drag.view.azimuth - (event.clientX - drag.x) * 0.4), elevation: Math.max(-85, Math.min(85, drag.view.elevation + (event.clientY - drag.y) * 0.3)) };
      drag = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (!clicked) { latest.current.onView(nextView); return; }
      // A click-sized wobble is selection, not an unsaved camera edit.
      current = latest.current; draw();
      const rect = canvas.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1), camera);
      const hits = ray.intersectObjects(selectable).filter((hit) => current.view.slice === 0 || plane.distanceToPoint(hit.point) >= 0);
      // Transparent enclosing shells do not steal clicks on their contained objects.
      const hit = hits.find((hit) => !current.scene.objects.some((o) => o.parentId === hit.object.userData.objectId)) ?? hits[0];
      if (hit) latest.current.onSelect(hit.object.userData.objectId);
    }
    function cancel() { drag = null; current = latest.current; draw(); }
    function contextLost(event: Event) { event.preventDefault(); lost = true; latest.current.onFailure(); }
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', cancel);
    canvas.addEventListener('webglcontextlost', contextLost);
    const instance: Engine = {
      update(next) {
        // Parent callbacks can change without a visual change. Keep the latest
        // handlers, but do not submit duplicate GPU frames while the view is idle.
        const unchanged = currentScene === next.scene && currentSelection === next.selected && JSON.stringify(current.view) === JSON.stringify(next.view);
        current = drag ? { ...next, view: current.view } : next;
        if (unchanged) return;
        if (currentScene !== next.scene || currentSelection !== next.selected) {
          const before = new Map([...nodes].map(([id, node]) => [id, node.position.clone()]));
          cancelAnimationFrame(animationFrame); rebuild();
          const transitions = [...nodes].flatMap(([id, node]) => {
            // Engine parts are posed exactly at each angle; sliding them would break the joints.
            if (engineRoleOf(next.scene.objects.find((o) => o.id === id)?.renderStyle)) return [];
            const from = before.get(id), to = node.position.clone();
            return from && from.distanceTo(to) > 0.001 ? [{ node, from, to }] : [];
          });
          if (transitions.length && !reduced.matches && !drag) {
            const began = performance.now(); canvas.dataset.transitioning = 'true';
            const animate = (now: number) => {
              if (disposed || lost) return;
              const progress = reduced.matches ? 1 : Math.min(1, (now - began) / 360), eased = 1 - Math.pow(1 - progress, 3);
              for (const item of transitions) item.node.position.copy(item.from).lerp(item.to, eased);
              draw();
              if (progress < 1) animationFrame = requestAnimationFrame(animate);
              else canvas.dataset.transitioning = 'false';
            };
            animate(began);
          } else canvas.dataset.transitioning = 'false';
        }
        draw();
      },
      dispose() {
        disposed = true; cancelAnimationFrame(animationFrame); observer.disconnect();
        canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('webglcontextlost', contextLost);
        clear(); light.shadow.dispose(); renderer.dispose(); if (!lost) renderer.forceContextLoss(); canvas.remove(); labelLayer.remove();
      },
    };
    engine.current = instance;
    try { renderer.setSize(element.clientWidth, element.clientHeight, false); instance.update(latest.current); }
    catch { latest.current.onFailure(); }
    return () => { engine.current = null; instance.dispose(); };
  }, []);
  useEffect(() => { try { engine.current?.update(props); } catch { props.onFailure(); } }, [props]);
  return <div className="spatial-canvas" ref={host} />;
}
