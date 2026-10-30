import type { ExplorationSpec, SourceObservationRef } from './exploration';

export const SPATIAL_EXAMPLE_SOURCE = 'Original synthetic teaching schematic, not a real device: a transparent enclosure contains an input sensor, a processing block and an output indicator. A signal goes from sensor to processor to indicator. The moving signal bead and geometry are explanatory abstractions, not measured electrical behavior. No coursework or model output.';

export function createSpatialExample(source: SourceObservationRef = { observationId: 'spatial-example-source', version: 1, region: null }): ExplorationSpec {
  return {
    schemaVersion: 'exploration-v1', id: 'spatial-example', version: 1, mode: 'explanation',
    title: 'Open up a signal relay', objective: 'Take the enclosure apart and follow one signal through three stages.',
    sources: [source], assumptions: ['Original synthetic schematic. Geometry and signal movement are illustrative, not a physical simulation.'], uncertainty: [], unsupportedClaims: ['No electrical measurements or timing are modeled.'],
    scene: { layout: 'diagram-sidebar', panels: [{
      id: 'relay-world', kind: 'spatial', title: 'Inside the relay', placement: { column: 1, row: 1, columnSpan: 2 },
      objects: [
        { id: 'enclosure', label: 'Enclosure', description: 'A protective shell containing the three stages. Slice or separate it to inspect the interior.', shape: 'box', color: 'blue', position: { x: 0, y: 0, z: 0 }, size: { x: 4, y: 2.1, z: 2.4 }, parentId: null },
        { id: 'sensor', label: 'Input sensor', description: 'The signal enters here.', shape: 'torus', color: 'sage', position: { x: -1.3, y: 0, z: 0 }, size: { x: 0.8, y: 0.8, z: 0.4 }, parentId: 'enclosure' },
        { id: 'processor', label: 'Processor', description: 'The incoming signal is processed before reaching the indicator.', shape: 'box', color: 'clay', position: { x: 0, y: 0, z: 0 }, size: { x: 0.7, y: 0.7, z: 0.7 }, parentId: 'enclosure' },
        { id: 'indicator', label: 'Output indicator', description: 'The indicator receives the processed signal.', shape: 'sphere', color: 'gold', position: { x: 1.3, y: 0, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, parentId: 'enclosure' },
        { id: 'signal', label: 'Signal marker', description: 'This bead marks the explanation stage. It is not a physical particle or a measured wave.', shape: 'sphere', color: 'violet', position: { x: -1.3, y: 0.65, z: 0 }, size: { x: 0.22, y: 0.22, z: 0.22 }, parentId: 'enclosure' },
      ],
      connections: [
        { id: 'input-link', from: 'sensor', to: 'processor', label: 'Input signal', directed: true },
        { id: 'output-link', from: 'processor', to: 'indicator', label: 'Processed signal', directed: true },
      ],
      poses: [
        { stepId: 'receive', objectId: 'signal', position: { x: -1.3, y: 0.65, z: 0 }, visible: true },
        { stepId: 'process', objectId: 'signal', position: { x: 0, y: 0.65, z: 0 }, visible: true },
        { stepId: 'output', objectId: 'signal', position: { x: 1.3, y: 0.65, z: 0 }, visible: true },
      ],
    }] },
    steps: [
      { id: 'receive', caption: 'A signal enters at the input sensor inside the enclosure.', narration: null, highlightIds: ['sensor', 'signal'], execution: null, executionStep: null },
      { id: 'process', caption: 'The processor receives the input; the bead marks this explanation stage.', narration: null, highlightIds: ['processor', 'input-link', 'signal'], execution: null, executionStep: null },
      { id: 'output', caption: 'The output indicator receives the processed signal.', narration: null, highlightIds: ['indicator', 'output-link', 'signal'], execution: null, executionStep: null },
    ],
    followups: ['Explain the processor while keeping this 3D model.', 'Show only the parts that carry the signal.'],
  };
}
