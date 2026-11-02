import type { DcInput } from '../../src/lib/domain/dc-circuit';
import type { SourceCircuitLayout } from '../../src/lib/domain/circuit-overlay-model';

/** The original Lecture 9 bridge slide (docs/examples/hero-circuit), as a correct reading. */
export const heroCircuit: DcInput = {
  nodes: [
    { id: 'A', label: 'A' },
    { id: 'B', label: 'B' },
    { id: 'C', label: 'C' },
    { id: 'D', label: 'D' },
  ],
  ground: 'D',
  components: [
    { id: 'V1', label: '12 V battery', kind: 'voltage-source', from: 'D', to: 'A', value: 12 },
    { id: 'R1', label: 'R₁', kind: 'resistor', from: 'A', to: 'B', value: 2 },
    { id: 'R2', label: 'R₂', kind: 'resistor', from: 'B', to: 'D', value: 4 },
    { id: 'R3', label: 'R₃', kind: 'resistor', from: 'A', to: 'C', value: 4 },
    { id: 'R4', label: 'R₄', kind: 'resistor', from: 'C', to: 'D', value: 8 },
    { id: 'R5', label: 'R₅', kind: 'resistor', from: 'B', to: 'C', value: 5 },
  ],
};
/** Measured from the rendered slide (1920 × 1080). */
export const heroCircuitLayout: SourceCircuitLayout = {
  nodes: [
    { nodeId: 'A', x: 0.2948, y: 0.2981 },
    { nodeId: 'B', x: 0.2948, y: 0.5389 },
    { nodeId: 'C', x: 0.4927, y: 0.5389 },
    { nodeId: 'D', x: 0.2948, y: 0.7796 },
  ],
  components: [
    { componentId: 'V1', x1: 0.1125, y1: 0.5148, x2: 0.1125, y2: 0.5519 },
    { componentId: 'R1', x1: 0.2948, y1: 0.3722, x2: 0.2948, y2: 0.4833 },
    { componentId: 'R2', x1: 0.2948, y1: 0.5944, x2: 0.2948, y2: 0.7056 },
    { componentId: 'R3', x1: 0.4927, y1: 0.3722, x2: 0.4927, y2: 0.4833 },
    { componentId: 'R4', x1: 0.4927, y1: 0.5944, x2: 0.4927, y2: 0.7056 },
    { componentId: 'R5', x1: 0.3573, y1: 0.5389, x2: 0.4302, y2: 0.5389 },
  ],
};
