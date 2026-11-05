import { enginePose } from '../pm121/lib/engine';
export function turnAngle(value: number) {
  return Number.isFinite(value) ? ((Math.max(0, Math.min(720, value)) % 360) + 360) % 360 : 0;
}
export function comparisonStates(value: number) {
  const a = turnAngle(value);
  return [enginePose(a), enginePose(a + 360)];
}
export function poseObservation(angle: number) {
  const p = enginePose(angle);
  if (angle % 180 === 0)
    return 'At the stroke boundary: both valves are seated in this idealized model.';
  return p.phase === 0
    ? 'The inlet opens during the intake downstroke.'
    : p.phase === 1
      ? 'The trapped mixture is compressed on the upstroke.'
      : p.phase === 2
        ? 'The power downstroke follows ignition with both valves closed.'
        : 'The outlet opens during the exhaust upstroke.';
}
