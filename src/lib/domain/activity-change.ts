import type { Lesson } from './types';
const normalize = (text: string) =>
  text
    .normalize('NFKC')
    .replace(/[\u200b\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?…]+$/u, '')
    .trim()
    .toLowerCase();
/** Identity/status/source revision alone cannot demonstrate a changed learning interaction. */
export function materiallyDifferentActivity(before: Lesson, after: Lesson): boolean {
  if (before.id === after.id) return false;
  if (normalize(before.question) !== normalize(after.question) || before.kind !== after.kind)
    return true;
  if (before.kind !== 'circuit' || after.kind !== 'circuit') return false;
  const a = before.diagnosticExperiment?.input,
    b = after.diagnosticExperiment?.input;
  if (!!a !== !!b) return true;
  const configuration = (lesson: Lesson, input: typeof a) =>
    input
      ? [
          input.baseline.topology,
          input.baseline.voltage,
          input.baseline.r1,
          input.baseline.r2,
          input.change.parameter,
          input.change.value,
          input.observable,
        ]
      : [lesson.circuit.topology, lesson.circuit.voltage, lesson.circuit.r1, lesson.circuit.r2];
  return JSON.stringify(configuration(before, a)) !== JSON.stringify(configuration(after, b));
}
