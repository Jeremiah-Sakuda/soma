'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { SpatialScene } from '@/lib/domain/spatial-exploration';
import type { SpatialView } from '@/lib/domain/spatial-schema';

const colors = { clay: 0xc36c47, sage: 0x638977, blue: 0x67869d, gold: 0xc99d44, violet: 0x8b79ac };
type Props = { scene: SpatialScene; view: SpatialView; selected: string | null; onSelect: (id: string) => void; onView: (view: SpatialView) => void; onFailure: () => void };
type Engine = { update: (props: Props) => void; dispose: () => void };

/** No generated code, URLs or assets enter this renderer. GPU work occurs only on change. */
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
    renderer.setClearColor(0xf1f0e9);
    renderer.localClippingEnabled = true;
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-label', 'Interactive 3D scene. Drag to orbit or use the labeled view controls.');
    canvas.setAttribute('role', 'img');
    element.appendChild(canvas);
    const world = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    world.add(new THREE.HemisphereLight(0xffffff, 0xa1aa98, 2.5));
    const light = new THREE.DirectionalLight(0xfff3dd, 3);
    light.position.set(4, 8, 6); world.add(light);
    const fill = new THREE.DirectionalLight(0xbad9ec, 1.2);
    fill.position.set(-5, 3, -4); world.add(fill);
    const group = new THREE.Group(); world.add(group);
    const labels: { element: HTMLSpanElement; position: THREE.Vector3; priority: number }[] = [];
    const resources: { dispose: () => void }[] = [];
    const selectable: THREE.Object3D[] = [];
    let current = latest.current, currentScene: SpatialScene | null = null, currentSelection: string | null = null;
    let center = new THREE.Vector3(), radius = 4, halfWidth = 4, floorY = -1;
    let disposed = false, lost = false;
    const plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    let materialList: THREE.Material[] = [];
    function clear() {
      for (const resource of resources) resource.dispose();
      resources.length = 0; selectable.length = 0; materialList = [];
      for (const label of labels) label.element.remove();
      labels.length = 0; group.clear();
    }
    function geometry(shape: string) {
      const value = shape === 'sphere' ? new THREE.SphereGeometry(0.5, 24, 16)
        : shape === 'cylinder' ? new THREE.CylinderGeometry(0.5, 0.5, 1, 24)
        : shape === 'torus' ? new THREE.TorusGeometry(0.35, 0.14, 12, 32)
        : new THREE.BoxGeometry(1, 1, 1);
      resources.push(value); return value;
    }
    function material(color: number, opacity = 1, highlight = false) {
      const value = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.12, transparent: opacity < 1, opacity, depthWrite: opacity === 1, side: THREE.DoubleSide, emissive: highlight ? color : 0, emissiveIntensity: highlight ? 0.22 : 0 });
      resources.push(value); materialList.push(value); return value;
    }
    function label(text: string, position: THREE.Vector3, priority: number) {
      const span = document.createElement('span'); span.textContent = text;
      span.className = 'spatial-canvas-label'; span.setAttribute('aria-hidden', 'true');
      element.appendChild(span); labels.push({ element: span, position, priority });
    }
    function rebuild() {
      clear();
      const visible = current.scene.objects.filter((object) => object.visible);
      const bounds = new THREE.Box3();
      // Bounds include hidden objects so stepping/isolation never jerks the camera.
      for (const object of current.scene.objects) {
        const p = new THREE.Vector3(object.position.x, object.position.y, object.position.z);
        const s = new THREE.Vector3(object.size.x, object.size.y, object.size.z).multiplyScalar(0.5);
        bounds.expandByPoint(p.clone().sub(s)); bounds.expandByPoint(p.clone().add(s));
      }
      if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-2, -2, -2), new THREE.Vector3(2, 2, 2));
      center = bounds.getCenter(new THREE.Vector3()); radius = Math.max(2, bounds.getSize(new THREE.Vector3()).length() / 2);
      halfWidth = Math.max(0.1, (bounds.max.x - bounds.min.x) / 2); floorY = bounds.min.y - 0.22;
      const grid = new THREE.GridHelper(Math.max(8, radius * 3), 16, 0xcbd0c5, 0xe0e2d8);
      grid.position.set(center.x, floorY, center.z); group.add(grid);
      resources.push(grid.geometry); if (Array.isArray(grid.material)) resources.push(...grid.material); else resources.push(grid.material);
      for (const object of visible) {
        const shell = current.scene.objects.some((o) => o.parentId === object.id);
        const selected = object.id === current.selected;
        const mesh = new THREE.Mesh(geometry(object.shape), material(colors[object.color], shell ? 0.16 : 1, selected || object.highlighted));
        mesh.position.set(object.position.x, object.position.y, object.position.z);
        mesh.scale.set(object.size.x, object.size.y, object.size.z);
        mesh.userData.objectId = object.id;
        group.add(mesh); selectable.push(mesh);
        if (selected || shell) {
          const edges = new THREE.EdgesGeometry(mesh.geometry); resources.push(edges);
          const lineMaterial = new THREE.LineBasicMaterial({ color: selected ? 0x833d25 : colors[object.color], transparent: true, opacity: selected ? 0.95 : 0.25 });
          resources.push(lineMaterial); materialList.push(lineMaterial);
          const outline = new THREE.LineSegments(edges, lineMaterial); outline.position.copy(mesh.position); outline.scale.copy(mesh.scale); group.add(outline);
        }
        label(object.label, mesh.position.clone().add(new THREE.Vector3(0, object.size.y / 2 + 0.18, 0)), selected ? 3 : object.highlighted ? 2 : shell ? 0 : 1);
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
        const geo = new THREE.CylinderGeometry(0.025, 0.025, length, 8); resources.push(geo);
        const line = new THREE.Mesh(geo, mat); line.position.copy(a).add(b).multiplyScalar(0.5);
        line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
        line.userData.objectId = edge.id; group.add(line); selectable.push(line);
        if (edge.directed) {
          const coneGeo = new THREE.ConeGeometry(0.11, 0.25, 12); resources.push(coneGeo);
          const arrow = new THREE.Mesh(coneGeo, mat);
          arrow.position.copy(a).lerp(b, 0.7); arrow.quaternion.copy(line.quaternion); arrow.userData.objectId = edge.id;
          group.add(arrow); selectable.push(arrow);
        }
        if (edge.label) label(edge.label, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.15, 0)), 0);
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
      const distance = radius * (aspect < 1 ? 3.8 / aspect : 3.8) * view.zoom;
      camera.far = Math.max(120, distance + radius * 4); camera.updateProjectionMatrix();
      camera.position.set(center.x + Math.sin(azimuth) * Math.cos(elevation) * distance, center.y + Math.sin(elevation) * distance, center.z + Math.cos(azimuth) * Math.cos(elevation) * distance);
      camera.lookAt(center);
      plane.constant = center.x + halfWidth - view.slice * halfWidth * 2;
      for (const mat of materialList) { mat.clippingPlanes = view.slice > 0 ? [plane] : null; }
      renderer.render(world, camera);
      const occupied: { x: number; y: number; width: number }[] = [];
      for (const item of [...labels].sort((a, b) => b.priority - a.priority)) {
        const projected = item.position.clone().project(camera);
        const x = (projected.x + 1) * width / 2, y = (1 - projected.y) * height / 2;
        const labelWidth = Math.min(160, item.element.textContent!.length * 6 + 16);
        const overlap = occupied.some((p) => Math.abs(p.x - x) < (p.width + labelWidth) / 2 && Math.abs(p.y - y) < 25);
        const shown = !overlap && (view.slice === 0 || plane.distanceToPoint(item.position) >= 0) && x > labelWidth / 2 && x < width - labelWidth / 2 && y > 12 && y < height - 12 && projected.z < 1;
        item.element.style.display = shown ? 'block' : 'none';
        if (shown) { item.element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`; occupied.push({ x, y, width: labelWidth }); }
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
      update(next) { current = drag ? { ...next, view: current.view } : next; if (currentScene !== next.scene || currentSelection !== next.selected) rebuild(); draw(); },
      dispose() {
        disposed = true; observer.disconnect();
        canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('webglcontextlost', contextLost);
        clear(); renderer.dispose(); if (!lost) renderer.forceContextLoss(); canvas.remove();
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
