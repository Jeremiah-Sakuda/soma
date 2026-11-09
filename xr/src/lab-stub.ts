/**
 * A stand-in for the lab-model branch's openRecordedGraphLab, so the scene can be built before it lands.
 * It shows the recorded graph and its recorded route but computes nothing: toggling and costs change only the
 * flags, and the caption says so. Replace the import in main.ts with the real implementation when it merges.
 */
import type { Lab, LabEdge, LabState } from '../../src/lib/xr-lab/contract';
import recorded from '../../src/lib/fixtures/recorded-graph.json';
import presentation from '../../src/lib/fixtures/recorded-graph-presentation.json';

type RecordedEdge = { id: string; from: string; to: string; weight?: number };

export function openStubLab(): Lab {
  const input = recorded.spec.input as { nodes: { id: string; label: string }[]; edges: RecordedEdge[]; start: string; goal: string };
  const positions = new Map(presentation.layout.nodes.map((n) => [n.nodeId, n]));
  const labels = new Map(presentation.layout.edgeLabels.map((l) => [l.edgeId, l]));
  const recordedPath = ['A', 'B', 'D', 'F'];
  const onPath = (e: RecordedEdge) =>
    recordedPath.some((n, i) => i > 0 && ((recordedPath[i - 1] === e.from && n === e.to) || (recordedPath[i - 1] === e.to && n === e.from)));
  const base = (): LabEdge[] =>
    input.edges.map((e) => ({
      id: e.id, from: e.from, to: e.to, cost: e.weight ?? 1, enabled: true, onPath: onPath(e),
      labelX: labels.get(e.id)?.x ?? 0, labelY: labels.get(e.id)?.y ?? 0,
    }));
  let edges = base();
  const state = (caption: string): LabState => ({
    nodes: input.nodes.map((n) => ({ id: n.id, label: n.label, x: positions.get(n.id)?.x ?? 0, y: positions.get(n.id)?.y ?? 0 })),
    edges: edges.map((e) => ({ ...e })),
    start: input.start,
    goal: input.goal,
    path: recordedPath,
    totalCost: null,
    status: 'found',
    probe: { edgeId: recorded.experiment.edgeId, originalCost: recorded.experiment.originalCost, criticalCost: recorded.experiment.criticalCost },
    caption,
    provenance: { model: 'muse-spark-1.3', recordedAt: recorded.updatedAt, label: 'Stub: recorded graph, nothing computed' },
  });
  return {
    state: () => state('Stub lab: the real solver lands from the lab-model branch.'),
    toggleEdge(id) { edges = edges.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e)); return state('Stub: edge toggled, route not recomputed.'); },
    setCost(id, cost) { edges = edges.map((e) => (e.id === id ? { ...e, cost: Math.min(10, Math.max(0, cost)) } : e)); return state('Stub: cost changed, route not recomputed.'); },
    reset() { edges = base(); return state('Stub: reset.'); },
  };
}
