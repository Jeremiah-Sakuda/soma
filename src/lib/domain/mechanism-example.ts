import type { ExplorationSpec, SourceObservationRef } from './exploration';
import type { MechanismPiece } from './mechanism-schema';

// Original synthetic fixture for compiler/interaction verification, not model output.
export const MECHANISM_EXAMPLE_SOURCE =
  'Original synthetic teaching mechanism: a rectangular passage frame holds a hinged gate with a handle. The gate and handle rotate together about the left hinge to uncover the passage. Dimensions, hardware and motion are illustrative. No forces, flow rates or engineering tolerances are modeled.';
const zero = { x: 0, y: 0, z: 0 },
  one = { x: 1, y: 1, z: 1 };
const outline = [
  { x: -0.5, z: -0.5 },
  { x: 0.5, z: -0.5 },
  { x: 0.5, z: 0.5 },
  { x: -0.5, z: 0.5 },
];
const hinge = {
  parameterId: 'opening',
  pivot: { x: -0.3, y: 0, z: 0 },
  translation: zero,
  rotation: { x: 0, y: -100, z: 0 },
};
function beam(
  id: string,
  position: typeof zero,
  scale: typeof zero,
  color: MechanismPiece['color'],
  driver: MechanismPiece['driver'] = null,
): MechanismPiece {
  return {
    id,
    purpose: driver ? 'Moves with the hinged gate.' : 'Supports the passage.',
    form: { kind: 'prism', outline: outline.map((p) => ({ ...p })), height: 1 },
    position: { ...position },
    rotation: { ...zero },
    scale: { ...scale },
    color,
    driver: driver ? structuredClone(driver) : null,
  };
}
export function createMechanismExample(
  source: SourceObservationRef = {
    observationId: 'mechanism-example-source',
    version: 1,
    region: null,
  },
): ExplorationSpec {
  return {
    schemaVersion: 'exploration-v1',
    id: 'mechanism-example',
    version: 1,
    mode: 'explanation',
    title: 'Design a hinged passage',
    objective: 'Inspect custom surfaces and change the gate opening.',
    sources: [source],
    assumptions: [
      'Original prepared compiler example, not a Muse generation. All geometry and coupled motion are illustrative.',
    ],
    uncertainty: [],
    unsupportedClaims: ['No checked physical simulation or measured geometry.'],
    scene: {
      layout: 'diagram-sidebar',
      panels: [
        {
          id: 'gate-world',
          kind: 'spatial',
          title: 'One hinge, two moving parts',
          placement: { column: 1, row: 1, columnSpan: 2 },
          parameters: [
            {
              id: 'opening',
              label: 'Gate opening',
              description: 'Move the gate and handle together. This is illustrative motion.',
              initial: 0,
            },
          ],
          parameterPoses: [
            { stepId: 'closed', parameterId: 'opening', value: 0 },
            { stepId: 'opening-step', parameterId: 'opening', value: 0.45 },
            { stepId: 'open', parameterId: 'opening', value: 1 },
          ],
          objects: [
            {
              id: 'frame',
              label: 'Passage frame',
              description: 'The fixed frame leaves a visible opening.',
              shape: 'box',
              renderStyle: null,
              color: 'sage',
              position: { ...zero },
              size: { x: 3, y: 3, z: 3 },
              parentId: null,
              geometry: [
                beam('left-post', { x: -0.35, y: 0, z: 0 }, { x: 0.08, y: 0.85, z: 0.16 }, 'sage'),
                beam('right-post', { x: 0.35, y: 0, z: 0 }, { x: 0.08, y: 0.85, z: 0.16 }, 'sage'),
                beam('lintel', { x: 0, y: 0.4, z: 0 }, { x: 0.78, y: 0.07, z: 0.16 }, 'sage'),
                beam(
                  'threshold',
                  { x: 0, y: -0.4, z: 0 },
                  { x: 0.9, y: 0.06, z: 0.34 },
                  'graphite',
                ),
              ],
            },
            {
              id: 'gate',
              label: 'Hinged gate',
              description: 'The gate rotates around its left edge; the frame stays fixed.',
              shape: 'box',
              renderStyle: null,
              color: 'clay',
              position: { ...zero },
              size: { x: 3, y: 3, z: 3 },
              parentId: null,
              geometry: [
                beam('panel', zero, { x: 0.58, y: 0.72, z: 0.045 }, 'clay', hinge),
                {
                  id: 'hinge-pin',
                  purpose: 'Marks the rotation axis.',
                  form: {
                    kind: 'lathe',
                    profile: [
                      { radius: 0.04, y: -0.5 },
                      { radius: 0.04, y: 0.5 },
                    ],
                  },
                  position: { x: -0.3, y: 0, z: 0 },
                  rotation: { ...zero },
                  scale: { x: 1, y: 0.8, z: 1 },
                  color: 'metal',
                  driver: null,
                },
              ],
            },
            {
              id: 'handle',
              label: 'Gate handle',
              description: 'The handle is attached to the moving gate.',
              shape: 'box',
              renderStyle: null,
              color: 'gold',
              position: { ...zero },
              size: { x: 3, y: 3, z: 3 },
              parentId: null,
              geometry: [
                {
                  id: 'grip',
                  purpose: 'Shows the handle remaining attached during rotation.',
                  form: {
                    kind: 'tube',
                    path: [
                      { x: 0.19, y: -0.07, z: 0.04 },
                      { x: 0.19, y: -0.07, z: 0.1 },
                      { x: 0.19, y: 0.07, z: 0.1 },
                      { x: 0.19, y: 0.07, z: 0.04 },
                    ],
                    radius: 0.018,
                  },
                  position: zero,
                  rotation: { ...zero },
                  scale: { ...one },
                  color: 'gold',
                  driver: structuredClone(hinge),
                },
              ],
            },
          ],
          connections: [],
          poses: [],
        },
      ],
    },
    steps: [
      {
        id: 'closed',
        caption: 'The gate covers the passage; the frame remains fixed.',
        narration: null,
        highlightIds: ['gate'],
        execution: null,
        executionStep: null,
      },
      {
        id: 'opening-step',
        caption: 'The gate and its handle turn together about the same hinge.',
        narration: null,
        highlightIds: ['gate', 'handle'],
        execution: null,
        executionStep: null,
      },
      {
        id: 'open',
        caption: 'The open gate reveals the passage. The source describes no forces or flow rates.',
        narration: null,
        highlightIds: ['frame', 'gate'],
        execution: null,
        executionStep: null,
      },
    ],
    followups: [
      'Explain the hinge while preserving this opening.',
      'Why does the handle move with the gate?',
    ],
  };
}
