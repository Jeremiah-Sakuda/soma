import { PokeInteractable, RayInteractable, type World } from '@iwsdk/core';
import type {} from '@pmndrs/pointer-events';
import { Vector3 } from 'three';
import { textPanel } from './text';

import type { Finding, LabId } from './finding-replay';

const keyFor = (lab: LabId) => `soma-study-desk-v1:${lab}`;

export function readFinding(lab: LabId): Finding | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(keyFor(lab)) ?? 'null',
    ) as Partial<Finding> | null;
    return value &&
      [value.baseline, value.result, value.caption].every(
        (field) => typeof field === 'string' && field.length > 0 && field.length <= 500,
      )
      ? {
          baseline: value.baseline!,
          result: value.result!,
          caption: value.caption!,
          replay: value.replay,
        }
      : null;
  } catch {
    return null;
  }
}

export function saveFinding(lab: LabId, finding: Finding): boolean {
  try {
    localStorage.setItem(keyFor(lab), JSON.stringify(finding));
    return true;
  } catch {
    return false;
  }
}

export function studyButton(
  world: World,
  parent: ReturnType<World['createTransformEntity']>,
  initialLabel: string,
  position: [number, number, number],
  width: number,
  action: () => void,
) {
  const panel = textPanel(width, 0.037, {
    px: 384,
    font: Math.round(0.018 * (384 / width)),
    background: '#253b3c',
  });
  let label = initialLabel;
  panel.set([label]);
  panel.mesh.position.set(...position);
  panel.mesh.lookAt(new Vector3(0, 1.15, 0));
  const entity = world.createTransformEntity(panel.mesh, parent);
  entity.addComponent(RayInteractable);
  entity.addComponent(PokeInteractable);
  panel.mesh.pointerEventsType = () => parent.object3D!.visible;
  const presses = new Set<number>();
  const hover = new Set<number>();
  panel.mesh.addEventListener('pointerenter', ({ pointerId }) => {
    hover.add(pointerId);
    panel.set([`› ${label}`]);
  });
  panel.mesh.addEventListener('pointerdown', ({ pointerId }) => presses.add(pointerId));
  panel.mesh.addEventListener('pointerleave', ({ pointerId }) => {
    presses.delete(pointerId);
    hover.delete(pointerId);
    if (!hover.size) panel.set([label]);
  });
  panel.mesh.addEventListener('pointercancel', ({ pointerId }) => presses.delete(pointerId));
  panel.mesh.addEventListener('pointerup', ({ pointerId }) => {
    if (presses.delete(pointerId) && parent.object3D!.visible) action();
  });
  return {
    setLabel(next: string) {
      label = next;
      panel.set([hover.size ? `› ${label}` : label]);
    },
  };
}
