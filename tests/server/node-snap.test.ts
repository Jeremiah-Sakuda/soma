import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { snapNodesToDrawing } from '../../src/lib/server/node-snap';
import recordedGraph from '../../src/lib/fixtures/recorded-graph.json';

const W = 1600,
  H = 900;
const truth: Record<string, [number, number]> = {
  A: [180, 470],
  B: [380, 350],
  C: [380, 600],
  D: [700, 350],
  E: [700, 600],
  F: [900, 470],
};
async function slide(dark = false, decoy = false) {
  const edges = [
    ['A', 'B'],
    ['A', 'C'],
    ['B', 'C'],
    ['B', 'D'],
    ['C', 'E'],
    ['D', 'E'],
    ['D', 'F'],
    ['E', 'F'],
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${dark ? '#1e1e1e' : 'white'}"/>
    ${edges.map(([a, b]) => `<line x1="${truth[a][0]}" y1="${truth[a][1]}" x2="${truth[b][0]}" y2="${truth[b][1]}" stroke="${dark ? '#ddd' : '#333'}" stroke-width="3"/>`).join('')}
    <g font-size="30" font-family="Arial" fill="#1b1f24">${['Find the cheapest path from A to F.', '1. Set dist[A] = 0', '2. Settle the smallest dist', '3. Relax each edge (u, v)', '4. Repeat until F is settled'].map((t, i) => `<text x="980" y="${380 + i * 48}">${t}</text>`).join('')}</g>
    ${Object.entries(truth)
      .map(
        ([id, [x, y]]) =>
          `<circle cx="${x}" cy="${y}" r="38" fill="${dark ? '#1e1e1e' : 'white'}" stroke="${dark ? '#e8eef7' : '#16365f'}" stroke-width="4"/><text x="${x}" y="${y + 13}" font-size="38" font-family="Arial" font-weight="700" text-anchor="middle" fill="${dark ? '#e8eef7' : '#16365f'}">${id}</text>`,
      )
      .join('')}
    ${decoy ? '<text x="300" y="300" font-size="110" font-family="Arial" text-anchor="middle" fill="#1b1f24">O</text>' : ''}
  </svg>`;
  return (
    'data:image/png;base64,' + (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64')
  );
}

describe('snapping estimated nodes onto the drawing', () => {
  it('pulls offset estimates back onto the drawn nodes and keeps them distinct', async () => {
    // F's estimate is pushed toward the text column, as seen on real slides.
    const offsets: Record<string, [number, number]> = {
      A: [22, -18],
      B: [-25, 12],
      C: [15, 20],
      D: [-20, -22],
      E: [24, 10],
      F: [55, -15],
    };
    const estimates = Object.entries(truth).map(([nodeId, [x, y]]) => ({
      nodeId,
      x: (x + offsets[nodeId][0]) / W,
      y: (y + offsets[nodeId][1]) / H,
    }));
    const { positions, moved } = await snapNodesToDrawing(await slide(), estimates);
    expect(moved).toBe(6);
    for (const p of positions) {
      const [tx, ty] = truth[p.nodeId];
      expect(Math.hypot(p.x * W - tx, p.y * H - ty)).toBeLessThan(6);
    }
  });
  it('leaves estimates alone when nothing is drawn near them', async () => {
    const blank =
      'data:image/png;base64,' +
      (
        await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ffffff' } })
          .png()
          .toBuffer()
      ).toString('base64');
    const estimates = [
      { nodeId: 'A', x: 0.2, y: 0.3 },
      { nodeId: 'B', x: 0.7, y: 0.6 },
    ];
    expect(await snapNodesToDrawing(blank, estimates)).toEqual({ positions: estimates, moved: 0 });
  });
});

describe('snapping robustness', () => {
  const offsets: Record<string, [number, number]> = {
    A: [20, -16],
    B: [-22, 14],
    C: [14, 18],
    D: [-18, -20],
    E: [22, 10],
    F: [26, 14],
  };
  const estimates = () =>
    Object.entries(truth).map(([nodeId, [x, y]]) => ({
      nodeId,
      x: (x + offsets[nodeId][0]) / W,
      y: (y + offsets[nodeId][1]) / H,
    }));
  it('finds light-on-dark nodes on a dark slide', async () => {
    const { positions } = await snapNodesToDrawing(await slide(true), estimates());
    for (const p of positions)
      expect(Math.hypot(p.x * W - truth[p.nodeId][0], p.y * H - truth[p.nodeId][1])).toBeLessThan(
        6,
      );
  });
  it('is not pulled onto a large letter within reach of a node', async () => {
    const { positions } = await snapNodesToDrawing(await slide(false, true), estimates());
    const b = positions.find((p) => p.nodeId === 'B')!;
    expect(Math.hypot(b.x * W - truth.B[0], b.y * H - truth.B[1])).toBeLessThan(8);
  });
  it('stays fast on a full-size capture', async () => {
    const started = performance.now();
    await snapNodesToDrawing(await slide(), estimates());
    expect(performance.now() - started).toBeLessThan(1500);
  });
  it('never moves a node further from its drawing than the estimate, whatever the node size', async () => {
    const sized = async (r: number) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="white"/>
        ${Object.values(truth)
          .map(
            ([x, y]) =>
              `<circle cx="${x}" cy="${y}" r="${r}" fill="#dbeafe" stroke="#16365f" stroke-width="4"/>`,
          )
          .join('')}</svg>`;
      return (
        'data:image/png;base64,' +
        (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64')
      );
    };
    for (const r of [16, 21, 47, 65, 70, 80]) {
      const { positions } = await snapNodesToDrawing(await sized(r), estimates());
      for (const p of positions) {
        const start = Math.hypot(...offsets[p.nodeId]);
        expect(
          Math.hypot(p.x * W - truth[p.nodeId][0], p.y * H - truth[p.nodeId][1]),
        ).toBeLessThanOrEqual(start + 0.5);
      }
    }
  }, 30000);
});

describe('optional topology corroboration for farther circles', () => {
  const edges = [
    ['A', 'B'],
    ['A', 'C'],
    ['B', 'C'],
    ['B', 'D'],
    ['C', 'E'],
    ['D', 'E'],
    ['D', 'F'],
    ['E', 'F'],
  ];
  const graph = { edges: edges.map(([from, to]) => ({ from, to })) };
  const estimates = () =>
    Object.entries(truth).map(([nodeId, [x, y]]) => ({
      nodeId,
      x: (x + (nodeId === 'D' ? 70 : 1)) / W,
      y: (y + (nodeId === 'D' ? -20 : 1)) / H,
    }));
  async function drawing(
    options: { edges?: string[][]; curved?: boolean; rival?: boolean; letterO?: boolean } = {},
  ) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="white"/>
      ${(options.edges ?? edges)
        .map(([a, b]) =>
          options.curved && [a, b].includes('D')
            ? `<path d="M ${truth[a].join(' ')} Q ${(truth[a][0] + truth[b][0]) / 2 + 90} ${(truth[a][1] + truth[b][1]) / 2 - 110} ${truth[b].join(' ')}" fill="none" stroke="#333" stroke-width="3"/>`
            : `<line x1="${truth[a][0]}" y1="${truth[a][1]}" x2="${truth[b][0]}" y2="${truth[b][1]}" stroke="#333" stroke-width="3"/>`,
        )
        .join('')}
      ${Object.entries(truth)
        .map(
          ([id, [x, y]]) =>
            `<circle cx="${x}" cy="${y}" r="38" fill="white" stroke="#16365f" stroke-width="4"/><text x="${x}" y="${y + 13}" font-size="38" font-family="Arial" font-weight="700" text-anchor="middle" fill="#16365f">${id === 'D' && options.letterO ? 'O' : id}</text>`,
        )
        .join('')}
      ${options.rival ? '<circle cx="760" cy="410" r="38" fill="white" stroke="#16365f" stroke-width="4"/>' : ''}
    </svg>`;
    return (
      'data:image/png;base64,' + (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64')
    );
  }

  it('requires checked adjacency and straight pixel connections to move an otherwise rejected far node', async () => {
    const start = estimates();
    const image = await drawing();
    const baseline = await snapNodesToDrawing(image, start);
    expect(baseline.positions.find((p) => p.nodeId === 'D')).toEqual(
      start.find((p) => p.nodeId === 'D'),
    );
    const snapped = await snapNodesToDrawing(image, start, graph);
    const d = snapped.positions.find((p) => p.nodeId === 'D')!;
    expect(Math.hypot(d.x * W - truth.D[0], d.y * H - truth.D[1])).toBeLessThan(6);
    expect(start).toEqual(estimates());
  });

  it.each([
    'unconnected O',
    'one straight edge',
    'curved edges',
    'rival ring',
    'narrow connection angle',
  ] as const)('keeps a distant estimate when the pixels provide %s', async (caseName) => {
    const noD = edges.filter((edge) => !edge.includes('D'));
    const custom =
      caseName === 'narrow connection angle' ? [...noD, ['D', 'A'], ['D', 'B']] : undefined;
    const image = await drawing({
      edges:
        caseName === 'unconnected O'
          ? noD
          : caseName === 'one straight edge'
            ? [...noD, ['D', 'E']]
            : custom,
      curved: caseName === 'curved edges',
      rival: caseName === 'rival ring',
      letterO: caseName === 'unconnected O',
    });
    const start = estimates();
    const actualGraph = custom ? { edges: custom.map(([from, to]) => ({ from, to })) } : graph;
    const snapped = await snapNodesToDrawing(image, start, actualGraph);
    expect(snapped.positions.find((p) => p.nodeId === 'D')).toEqual(
      start.find((p) => p.nodeId === 'D'),
    );
  });

  it('requires at least three reliable local anchors before using topology', async () => {
    const start = estimates()
      .filter((p) => ['B', 'D', 'E'].includes(p.nodeId))
      .map((p) => (p.nodeId === 'D' ? { ...p, x: (truth.D[0] + 85) / W } : p));
    const image = await drawing();
    const baseline = await snapNodesToDrawing(image, start);
    expect(baseline.positions.find((p) => p.nodeId === 'D')).toEqual(
      start.find((p) => p.nodeId === 'D'),
    );
    const snapped = await snapNodesToDrawing(image, start, graph);
    expect(snapped.positions.find((p) => p.nodeId === 'D')).toEqual(
      start.find((p) => p.nodeId === 'D'),
    );
  });

  it('corrects the real captured D/F offsets from pixels without changing the recorded fixture', async () => {
    const before = structuredClone(recordedGraph);
    const start = recordedGraph.source.layout.nodes;
    const image =
      'data:image/png;base64,' +
      readFileSync('public/synthetic/recorded-lecture-14.png').toString('base64');
    const baseline = await snapNodesToDrawing(image, start);
    const snapped = await snapNodesToDrawing(image, start, recordedGraph.spec.input);
    // Independent drawing coordinates from the original slide, used only as a test oracle.
    for (const [id, x, y] of [
      ['D', 663.33, 373.33],
      ['F', 855, 490],
    ] as const) {
      expect(baseline.positions.find((p) => p.nodeId === id)).toEqual(
        start.find((p) => p.nodeId === id),
      );
      const point = snapped.positions.find((p) => p.nodeId === id)!;
      expect(Math.hypot(point.x * W - x, point.y * H - y)).toBeLessThan(3);
    }
    expect(recordedGraph).toEqual(before);
  });
});
