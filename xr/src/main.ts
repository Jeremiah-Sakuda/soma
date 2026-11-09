/**
 * Soma Lab: a seated study desk. The Lecture 14 slide hangs in front; its graph lifts off the slide and stands
 * over the desk, within reach, where hands will cut edges and change costs. Everything drawn comes from a
 * LabState; the scene never computes a route or writes a caption itself.
 */
import { World } from '@iwsdk/core';
import {
  BoxGeometry, CylinderGeometry, Color, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SphereGeometry,
  TextureLoader, Vector3, HemisphereLight, DirectionalLight, SRGBColorSpace,
} from 'three';
import type { LabState } from '../../src/lib/xr-lab/contract';
import { openStubLab } from './lab-stub';

const SEATED_EYE = 1.15;
const DESK_TOP = 0.74;
/** The graph's footprint over the desk: slide coordinates map onto this width, centred 0.45 m ahead. */
const GRAPH = { width: 0.56, depth: 0.32, centre: new Vector3(0, DESK_TOP + 0.16, -0.45) };

const world = await World.create(document.getElementById('app')!, {
  xr: { offer: 'always' },
  render: { camera: { position: [0, SEATED_EYE, 0], lookAt: [0, DESK_TOP + 0.1, -0.6] } },
  features: { grabbing: true, spatialUI: true },
});

world.scene.background = new Color(0x101418);
world.scene.add(new HemisphereLight(0xdfe8ff, 0x2a2420, 1.2));
const key = new DirectionalLight(0xfff1dc, 1.4);
key.position.set(0.6, 2.2, 0.8);
world.scene.add(key);

// Desk and the slide on a stand behind it.
const desk = new Mesh(new BoxGeometry(1.4, 0.04, 0.7), new MeshStandardMaterial({ color: 0x5a4636, roughness: 0.8 }));
desk.position.set(0, DESK_TOP - 0.02, -0.5);
world.scene.add(desk);
const slideTexture = new TextureLoader().load('./lecture-14-dijkstra.png');
slideTexture.colorSpace = SRGBColorSpace;
const slide = new Mesh(new PlaneGeometry(1.6, 0.9), new MeshStandardMaterial({ map: slideTexture, roughness: 1 }));
slide.position.set(0, 1.45, -1.25);
world.scene.add(slide);

// The graph, rebuilt from each LabState.
const graph = new Group();
world.scene.add(graph);
const ink = new MeshStandardMaterial({ color: 0xd8dde4, roughness: 0.6 });
const route = new MeshStandardMaterial({ color: 0xffb54a, emissive: 0x6a3a00, roughness: 0.4 });
const cut = new MeshStandardMaterial({ color: 0x4a4f57, transparent: true, opacity: 0.35 });

function place(x: number, y: number): Vector3 {
  return new Vector3(GRAPH.centre.x + (x - 0.32) * GRAPH.width * 2.2, GRAPH.centre.y, GRAPH.centre.z + (y - 0.56) * GRAPH.depth * 3.2);
}

function render(state: LabState) {
  graph.clear();
  const at = new Map(state.nodes.map((n) => [n.id, place(n.x, n.y)]));
  for (const node of state.nodes) {
    const onRoute = state.path?.includes(node.id) ?? false;
    const ball = new Mesh(new SphereGeometry(0.018, 24, 16), onRoute ? route : ink);
    ball.position.copy(at.get(node.id)!);
    ball.name = `node:${node.id}`;
    graph.add(ball);
  }
  for (const edge of state.edges) {
    const a = at.get(edge.from)!, b = at.get(edge.to)!;
    const length = a.distanceTo(b);
    const rod = new Mesh(new CylinderGeometry(0.004, 0.004, length, 10), !edge.enabled ? cut : edge.onPath ? route : ink);
    rod.position.copy(a).add(b).multiplyScalar(0.5);
    rod.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
    rod.name = `edge:${edge.id}`;
    graph.add(rod);
  }
}

const lab = openStubLab();
render(lab.state());
