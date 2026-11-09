/**
 * The XR lab contract: the only surface the IWSDK scene (xr/) reads.
 *
 * The scene renders a LabState and calls Lab methods in response to hands; it never runs a solver or composes
 * text itself. Every number and caption comes from the checked domain (applyGraphControls → runDijkstra), so a
 * visual change in the headset always matches a computed result. Provenance distinguishes the recorded Muse run
 * that chose the experiment from values computed now.
 */

/** A graph node, positioned in slide-normalised coordinates (0..1, origin top-left) from the drawing alignment. */
export type LabNode = { id: string; label: string; x: number; y: number };

/** An edge with its current cost. `enabled` is false once cut; `onPath` marks the current shortest route. */
export type LabEdge = {
  id: string;
  from: string;
  to: string;
  cost: number;
  enabled: boolean;
  onPath: boolean;
  /** Where the slide prints this edge's cost, slide-normalised. */
  labelX: number;
  labelY: number;
};

export type LabState = {
  nodes: LabNode[];
  edges: LabEdge[];
  start: string;
  goal: string | null;
  /** The current shortest route as node IDs, or null when the goal is unreachable. */
  path: string[] | null;
  totalCost: number | null;
  status: 'found' | 'unreachable' | 'complete';
  /** The experiment the recorded Muse run chose: the edge to vary and the cost at which the route changes. */
  probe: { edgeId: string; originalCost: number; criticalCost: number };
  /** One computed sentence describing the current result and what the last change did. */
  caption: string;
  provenance: { model: string; recordedAt: string; label: string };
};

/** Costs are clamped to this range so a dragged handle cannot leave the checked domain. */
export const LAB_COST_RANGE = { min: 0, max: 10 } as const;

export interface Lab {
  state(): LabState;
  /** Cut an enabled edge, or restore a cut one. */
  toggleEdge(edgeId: string): LabState;
  /** Set an edge's cost, clamped to LAB_COST_RANGE. */
  setCost(edgeId: string, cost: number): LabState;
  /** Restore the recorded starting graph. */
  reset(): LabState;
}

/** Implemented in ./recorded-graph-lab.ts from the recorded Lecture 14 run (owned by the lab-model branch). */
export type OpenRecordedGraphLab = () => Lab;
