import type { SpatialPanel, SpatialVector } from './spatial-schema';

/** Soma's built-in four-stroke cutaway: an application-owned illustrative assembly, not
 * measured engine data. Muse places one `engine` part and chooses the crank angle each step
 * stops at; Soma expands it into named parts and poses them with exact slider-crank and
 * idealized valve timing (no overlap, no ignition advance), so joints stay connected at every
 * angle. Units are nominal: the crankshaft axis is the origin, y is up, the bore is 1. */
export const ENGINE = {
  crank: 0.5, // crank radius: the stroke is 1
  rod: 1.7, // connecting rod length, pin centre to pin centre
  pinToCrown: 0.33,
  pinToSkirt: 0.31,
  deck: 2.75, // where the cylinder meets the head
  bore: 0.5,
  valveTilt: 20, // degrees from vertical; intake leans left, exhaust right
  valveSeatX: 0.24,
  valveLift: 0.13,
  /** Pent-roof chamber: its ridge, and the height of each valve seat on the roof's slope. */
  roof: 2.93,
  seatY: 2.845,
  stem: 1.05,
  camBase: 0.13,
  /** The whole assembly's extent at any angle, for framing and tidying. */
  envelope: { min: [-1.25, -1.05, -0.95] as const, max: [1.25, 4.45, 0.75] as const },
} as const;

export const engineRoles = [
  'block', 'piston', 'rod', 'crank', 'intake_valve', 'exhaust_valve', 'intake_cam', 'exhaust_cam',
  'spark_plug', 'timing_belt', 'charge', 'spark', 'intake_flow', 'exhaust_flow',
] as const;
export type EngineRole = (typeof engineRoles)[number];
export const engineStyle = (role: EngineRole) => `engine-${role.replace(/_/g, '-')}` as const;
export const engineRenderStyles = engineRoles.map(engineStyle);
export function engineRoleOf(renderStyle: string | null | undefined): EngineRole | null {
  if (!renderStyle?.startsWith('engine-')) return null;
  const role = renderStyle.slice(7).replace(/-/g, '_');
  return (engineRoles as readonly string[]).includes(role) ? (role as EngineRole) : null;
}

const NAMES: Record<EngineRole, [string, string]> = {
  block: ['Cylinder and head (cut away)', 'The cylinder the piston slides in, with the head that closes it; the front half is cut away to show inside.'],
  piston: ['Piston', 'Slides down to draw in the charge and up to squeeze it; the burning gas pushes it down on the power stroke.'],
  rod: ['Connecting rod', 'Joins the piston pin to the crank pin, turning the piston’s up-and-down into rotation.'],
  crank: ['Crankshaft', 'Turns once for every two piston strokes: two full turns per four-stroke cycle.'],
  intake_valve: ['Intake valve', 'Opens only on the intake stroke so the fresh fuel–air charge can enter.'],
  exhaust_valve: ['Exhaust valve', 'Opens only on the exhaust stroke so the burnt gas can leave.'],
  intake_cam: ['Intake camshaft', 'Its lobe pushes the intake valve open once per turn; it turns once for every two crankshaft turns.'],
  exhaust_cam: ['Exhaust camshaft', 'Its lobe opens the exhaust valve once per turn, at half the crankshaft’s speed.'],
  spark_plug: ['Spark plug', 'Fires once per cycle, at the top of the compression stroke.'],
  timing_belt: ['Timing belt (2 : 1)', 'Links crankshaft to camshafts; the cam sprockets are twice as big, so the cams turn at half speed.'],
  charge: ['Fuel–air charge', 'The gas in the cylinder: fresh mixture drawn in, squeezed, burning, then pushed out.'],
  spark: ['Spark', 'The ignition that starts the power stroke.'],
  intake_flow: ['Mixture in', 'Fresh fuel–air mixture flowing in through the open intake valve.'],
  exhaust_flow: ['Exhaust out', 'Burnt gas pushed out through the open exhaust valve.'],
};
export const engineNames = NAMES;

const rad = (deg: number) => (deg * Math.PI) / 180;
/** Crank angle in degrees from top dead centre at the start of intake, 0 to 720. */
export const crankDegrees = (value01: number) => Math.max(0, Math.min(1, value01)) * 720;
export function pistonPin(theta: number) {
  const a = rad(theta);
  return ENGINE.crank * Math.cos(a) + Math.sqrt(ENGINE.rod ** 2 - (ENGINE.crank * Math.sin(a)) ** 2);
}
export const crankPin = (theta: number) => ({ x: ENGINE.crank * Math.sin(rad(theta)), y: ENGINE.crank * Math.cos(rad(theta)) });
/** Idealized lift: each valve opens over its own half-turn, smoothly, and is shut otherwise. */
export function valveLift(which: 'intake' | 'exhaust', theta: number) {
  const t = ((theta % 720) + 720) % 720, start = which === 'intake' ? 0 : 540;
  return t >= start && t <= start + 180 ? ENGINE.valveLift * Math.sin((Math.PI * (t - start)) / 180) ** 2 : 0;
}
export type Stroke = 'intake' | 'compression' | 'power' | 'exhaust';
export const strokeAt = (theta: number): Stroke =>
  (['intake', 'compression', 'power', 'exhaust'] as const)[Math.min(3, Math.floor((((theta % 720) + 720) % 720) / 180))];
/** How brightly the spark shows: a short flash around top dead centre before power. */
export const sparkGlow = (theta: number) => Math.max(0, 1 - Math.abs(theta - 360) / 14);

/** Where each camshaft turns: on its valve's axis, just above the stem. */
export function camCentre(side: -1 | 1) {
  const tilt = rad(ENGINE.valveTilt), reach = ENGINE.stem + ENGINE.camBase + 0.03;
  return { x: side * ENGINE.valveSeatX + side * Math.sin(tilt) * reach, y: ENGINE.seatY + Math.cos(tilt) * reach };
}
/** Into [-180, 180], as stored rotations are. */
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

/** Pose of one part at a crank angle, in nominal units about the crank axis. */
export function enginePose(role: EngineRole, theta: number): { x: number; y: number; z: number; rotZ: number; open: number } {
  // A valve opens by sliding down its own tilted axis, into the chamber.
  const valveAxis = (side: -1 | 1, lift: number) => {
    const tilt = rad(ENGINE.valveTilt);
    return { x: side * ENGINE.valveSeatX - side * Math.sin(tilt) * lift, y: ENGINE.seatY - Math.cos(tilt) * lift, rotZ: -side * ENGINE.valveTilt };
  };
  switch (role) {
    case 'piston':
      return { x: 0, y: pistonPin(theta), z: 0, rotZ: 0, open: 0 };
    case 'rod': {
      const pin = crankPin(theta), top = pistonPin(theta);
      // The rod's frame is at the crank pin, pointing up the rod.
      return { x: pin.x, y: pin.y, z: 0, rotZ: (Math.atan2(pin.x, top - pin.y) * 180) / Math.PI, open: 0 };
    }
    case 'crank':
      return { x: 0, y: 0, z: 0, rotZ: -theta, open: 0 };
    case 'intake_valve': {
      const lift = valveLift('intake', theta), v = valveAxis(-1, lift);
      return { ...v, z: 0, open: lift / ENGINE.valveLift };
    }
    case 'exhaust_valve': {
      const lift = valveLift('exhaust', theta), v = valveAxis(1, lift);
      return { ...v, z: 0, open: lift / ENGINE.valveLift };
    }
    case 'intake_cam':
    case 'exhaust_cam': {
      const side = role === 'intake_cam' ? -1 : 1, c = camCentre(side);
      // Half the crank's speed; the lobe points down the valve stem at full lift.
      const peak = role === 'intake_cam' ? 90 : 630;
      return { x: c.x, y: c.y, z: 0, rotZ: -(theta - peak) / 2 - side * ENGINE.valveTilt, open: 0 };
    }
    case 'charge': {
      const crown = pistonPin(theta) + ENGINE.pinToCrown;
      return { x: 0, y: crown, z: 0, rotZ: 0, open: Math.max(0.02, ENGINE.deck - crown) };
    }
    case 'spark_plug':
      return { x: 0, y: ENGINE.roof, z: 0, rotZ: 0, open: 0 };
    case 'spark':
      return { x: 0, y: ENGINE.roof - 0.05, z: 0, rotZ: 0, open: sparkGlow(theta) };
    case 'intake_flow':
      return { x: 0, y: 0, z: 0, rotZ: 0, open: valveLift('intake', theta) / ENGINE.valveLift };
    case 'exhaust_flow':
      return { x: 0, y: 0, z: 0, rotZ: 0, open: valveLift('exhaust', theta) / ENGINE.valveLift };
    default:
      return { x: 0, y: 0, z: 0, rotZ: 0, open: 0 };
  }
}

/** Where a part's name sits, in nominal units, at a crank angle. */
export function engineLabelPoint(role: EngineRole, theta: number): { x: number; y: number; z: number } {
  const p = enginePose(role, theta);
  switch (role) {
    case 'block': return { x: 0.95, y: 2.2, z: 0 };
    case 'piston': return { x: 0, y: p.y + 0.2, z: 0.3 };
    case 'rod': { const pin = crankPin(theta), top = pistonPin(theta); return { x: (pin.x) / 2, y: (pin.y + top) / 2, z: 0.15 }; }
    case 'crank': return { x: -0.55, y: -0.45, z: 0.3 };
    case 'intake_valve': return { x: p.x - 0.1, y: p.y + 0.15, z: 0.15 };
    case 'exhaust_valve': return { x: p.x + 0.1, y: p.y + 0.15, z: 0.15 };
    case 'intake_cam': case 'exhaust_cam': return { x: p.x, y: p.y + 0.25, z: 0 };
    case 'spark_plug': return { x: 0, y: 3.85, z: 0 };
    case 'timing_belt': return { x: -0.95, y: 2.0, z: 0.42 };
    case 'charge': return { x: 0, y: (p.y + ENGINE.deck) / 2, z: 0.35 };
    case 'spark': return { x: 0, y: ENGINE.deck - 0.1, z: 0.2 };
    case 'intake_flow': return { x: -1.5, y: 3.45, z: 0.2 };
    case 'exhaust_flow': return { x: 1.5, y: 3.45, z: 0.2 };
  }
}

type Authored = SpatialPanel['objects'][number];
const vec = (v: SpatialVector, s: number, d: { x: number; y: number; z: number }): SpatialVector => ({ x: v.x + s * d.x, y: v.y + s * d.y, z: v.z + s * d.z });

/** Replaces each authored `engine` part with Soma's named parts, in place, and makes sure the
 * panel has the crank control they follow. Part IDs are the engine's ID plus the role
 * (engine -> engine_piston), so a step can highlight exactly the parts it is about. */
export function expandEngine(panel: SpatialPanel): SpatialPanel {
  const engines = panel.objects.filter((o) => o.renderStyle === ('engine' as Authored['renderStyle']));
  if (!engines.length) return panel;
  const next: SpatialPanel = { ...panel, objects: [], poses: panel.poses.filter((p) => !engines.some((e) => e.id === p.objectId)) };
  for (const o of panel.objects) {
    if (!engines.includes(o)) {
      next.objects.push(o);
      continue;
    }
    // One uniform scale: the authored height becomes the assembly's height.
    const height = ENGINE.envelope.max[1] - ENGINE.envelope.min[1];
    const s = Math.max(0.2, Math.min(1.2, Math.max(o.size.x, o.size.y, o.size.z) / height));
    const base = { x: o.position.x, y: o.position.y - (o.size.y / 2) - ENGINE.envelope.min[1] * s, z: o.position.z };
    for (const role of engineRoles) {
      const at = enginePose(role, 0);
      next.objects.push({
        id: `${o.id}_${role}`.slice(0, 48),
        label: NAMES[role][0],
        description: NAMES[role][1],
        shape: 'box',
        renderStyle: engineStyle(role) as Authored['renderStyle'],
        color: o.color,
        position: role === 'block' ? base : vec(base, s, at),
        size: { x: s, y: s, z: s },
        parentId: null,
      });
    }
  }
  if (!(next.parameters ?? []).some((p) => p.id === 'crank'))
    next.parameters = [
      { id: 'crank', label: 'Crankshaft angle', description: '0 to 720 degrees: two full crankshaft turns, one complete four-stroke cycle.', initial: 0 },
      ...(next.parameters ?? []),
    ].slice(0, 3);
  // Highlights and focus naming the whole engine point at its block.
  if (next.viewAction?.focusObjectId && engines.some((e) => e.id === next.viewAction!.focusObjectId))
    next.viewAction = { ...next.viewAction, focusObjectId: `${next.viewAction.focusObjectId}_block` };
  return next;
}

/** How long a step's turn of the crank takes on screen: a quarter turn quickly, two turns slowly. */
export const crankTweenMs = (delta01: number) => Math.min(2800, 500 + Math.abs(delta01) * 4200);
export const easeCrank = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
/** The crank value an engine scene is posed at, if it has one. */
export function engineCrank(objects: readonly { renderStyle?: string | null; parameterValues?: Record<string, number> }[]) {
  return objects.find((o) => engineRoleOf(o.renderStyle) === 'block')?.parameterValues?.crank;
}

/** Poses every engine part in a scene at the crank parameter's value: block-relative, exact. */
export function poseEngineParts<T extends { id: string; renderStyle?: string | null; position: SpatialVector; size: SpatialVector; rotation?: { x: number; y: number; z: number } | null; visible: boolean; parameterValues?: Record<string, number>; labelAt?: SpatialVector }>(
  objects: T[],
  crank01: number,
): T[] {
  const blocks = new Map(objects.filter((o) => engineRoleOf(o.renderStyle) === 'block').map((o) => [o.id.replace(/_block$/, ''), o]));
  if (!blocks.size) return objects;
  const theta = crankDegrees(crank01);
  return objects.map((o) => {
    const role = engineRoleOf(o.renderStyle);
    if (!role) return o;
    const block = blocks.get(o.id.slice(0, o.id.length - role.length - 1));
    if (!block) return o;
    const s = block.size.x, p = enginePose(role, theta);
    const transient = role === 'spark' || role === 'intake_flow' || role === 'exhaust_flow';
    return {
      ...o,
      position: role === 'block' ? o.position : vec(block.position, s, p),
      rotation: { x: 0, y: 0, z: wrap(p.rotZ) },
      parameterValues: { ...(o.parameterValues ?? {}), crank: crank01 },
      labelAt: vec(block.position, s, engineLabelPoint(role, theta)),
      // Flows and the spark show only while they act; the rest keep their own visibility.
      visible: transient ? p.open > 0.04 : o.visible,
      // While a flow or the spark acts, it is what the moment is about.
      ...(transient && p.open > 0.04 && 'highlighted' in o ? { highlighted: true } : {}),
    };
  });
}
