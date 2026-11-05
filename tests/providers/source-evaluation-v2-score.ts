import { solveDc, type DcInput } from '../../src/lib/domain/dc-circuit';
import { runBfs, runDijkstra, type BfsInput } from '../../src/lib/domain/graph-search';

// Scoring for the second fresh source evaluation (tests/fixtures/source-evaluation-v2): a reading
// passes only if it matches the answer key and Soma's own computation on it matches the key's.
export type Part = {
  label?: string;
  kind: DcInput['components'][number]['kind'];
  ends?: [string, string];
  from?: string;
  to?: string;
  value: number;
};
export type Case =
  | {
      id: string;
      subject: 'circuit';
      question: string;
      expected:
        | { outcome: 'declined' }
        | { outcome: 'checked-circuit'; nodes: string[]; ground: string; components: Part[] };
    }
  | {
      id: string;
      subject: 'graph';
      question: string;
      expected: {
        algorithm: 'bfs' | 'dijkstra';
        directed: boolean;
        start: string;
        goal: string;
        nodes: string[];
        edges: [string, string, number?][];
      };
    };
const plain = (label: string) =>
  label
    .replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080))
    .replace(/\s+/g, '')
    .toUpperCase();
const same = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
const sorted = (xs: string[]) => [...xs].sort().join(',');

export function scoreCircuit(
  c: Extract<Case, { subject: 'circuit' }>,
  spec: { mode: string; input?: unknown },
) {
  const mismatches: string[] = [];
  if (c.expected.outcome === 'declined')
    return {
      passed: spec.mode !== 'checked-circuit',
      mismatches:
        spec.mode === 'checked-circuit'
          ? ['solved a circuit containing a capacitor and a switch']
          : [],
    };
  if (spec.mode !== 'checked-circuit')
    return { passed: false, mismatches: [`published ${spec.mode}`] };
  const exp = c.expected,
    input = spec.input as DcInput;
  const node = (id: string) => plain(input.nodes.find((n) => n.id === id)?.label ?? id);
  if (sorted(input.nodes.map((n) => plain(n.label))) !== sorted(exp.nodes))
    mismatches.push(`nodes ${sorted(input.nodes.map((n) => plain(n.label)))}`);
  if (node(input.ground) !== exp.ground) mismatches.push(`ground ${node(input.ground)}`);
  const left = [...input.components];
  for (const e of exp.components) {
    const i = left.findIndex(
      (r) =>
        r.kind === e.kind &&
        same(r.value, e.value) &&
        (e.kind === 'resistor'
          ? plain(r.label) === e.label && sorted([node(r.from), node(r.to)]) === sorted(e.ends!)
          : node(r.from) === e.from && node(r.to) === e.to),
    );
    if (i >= 0) left.splice(i, 1);
    else
      mismatches.push(
        `missing ${e.label ?? e.kind} ${e.ends?.join('–') ?? `${e.from}→${e.to}`} ${e.value}`,
      );
  }
  for (const r of left)
    mismatches.push(`read ${r.label} (${r.kind}) ${node(r.from)}→${node(r.to)} ${r.value}`);
  // Numbers: Soma's own solution of the reading, against the answer key's.
  const key: DcInput = {
    nodes: exp.nodes.map((id) => ({ id, label: id })),
    ground: exp.ground,
    components: exp.components.map((p, i) => ({
      id: `k${i}`,
      label: p.label ?? p.kind,
      kind: p.kind,
      from: p.ends?.[0] ?? p.from!,
      to: p.ends?.[1] ?? p.to!,
      value: p.value,
    })),
  };
  const want = solveDc(key),
    got = solveDc(input);
  const numbers =
    got.status === 'solved' &&
    exp.nodes.every((label) => {
      const id = input.nodes.find((n) => plain(n.label) === label)?.id;
      const a = id ? got.voltages[id] : null,
        b = want.voltages[label];
      return a !== null && a !== undefined && b !== null && same(a, b);
    });
  return { passed: mismatches.length === 0 && numbers, numbersMatch: numbers, mismatches };
}

export function scoreGraph(
  c: Extract<Case, { subject: 'graph' }>,
  spec: { mode: string; input?: unknown },
) {
  const exp = c.expected,
    mode = exp.algorithm === 'bfs' ? 'checked-bfs' : 'checked-dijkstra';
  if (spec.mode !== mode) return { passed: false, mismatches: [`published ${spec.mode}`] };
  const input = spec.input as BfsInput,
    mismatches: string[] = [];
  const name = (id: string | null) =>
    id === null ? 'none' : plain(input.nodes.find((n) => n.id === id)?.label ?? id);
  if (sorted(input.nodes.map((n) => plain(n.label))) !== sorted(exp.nodes))
    mismatches.push(`nodes ${sorted(input.nodes.map((n) => plain(n.label)))}`);
  if (input.directed !== exp.directed) mismatches.push(`directed ${input.directed}`);
  if (name(input.start) !== exp.start || name(input.goal) !== exp.goal)
    mismatches.push(`start/goal ${name(input.start)}/${name(input.goal)}`);
  const k = (a: string, b: string) => (exp.directed ? `${a}>${b}` : [a, b].sort().join('-'));
  const want = new Map(exp.edges.map(([a, b, w]) => [k(a, b), w]));
  const read = new Map(input.edges.map((e) => [k(name(e.from), name(e.to)), e.weight]));
  for (const [key, w] of want) {
    if (!read.has(key)) mismatches.push(`missing ${key}`);
    else if (exp.algorithm === 'dijkstra' && !same(Number(read.get(key)), w!))
      mismatches.push(`${key} read as ${read.get(key)}`);
  }
  for (const key of read.keys()) if (!want.has(key)) mismatches.push(`extra ${key}`);
  // Cost to the goal from Soma's run on the reading, against the answer key's run.
  const run = exp.algorithm === 'bfs' ? runBfs : runDijkstra;
  // The key's labels may be printed numbers ("1"), which are not valid IDs; give it its own.
  const kid = (label: string) => `k_${exp.nodes.indexOf(label)}`;
  const key = run({
    nodes: exp.nodes.map((label) => ({ id: kid(label), label })),
    edges: exp.edges.map(([a, b, w], i) => ({
      id: `e${i}`,
      from: kid(a),
      to: kid(b),
      ...(w !== undefined ? { weight: w } : {}),
    })),
    ...(exp.algorithm === 'dijkstra' ? { algorithm: 'dijkstra' } : {}),
    directed: exp.directed,
    start: kid(exp.start),
    goal: kid(exp.goal),
    neighborOrder: [...exp.nodes].sort().map(kid),
  });
  const wantCost = key.steps.at(-1)!.distances[kid(exp.goal)];
  let gotCost: number | undefined;
  try {
    const exec = run(input);
    gotCost = input.goal === null ? undefined : exec.steps.at(-1)!.distances[input.goal];
  } catch {
    gotCost = undefined;
  }
  const costMatches = gotCost !== undefined && same(gotCost, wantCost);
  return {
    passed: mismatches.length === 0 && costMatches,
    costMatches,
    wantCost,
    gotCost,
    mismatches,
  };
}
