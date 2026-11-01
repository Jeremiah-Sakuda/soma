import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { snapNodesToDrawing } from '../../src/lib/server/node-snap';

const W = 1600,
  H = 900;
const truth: Record<string, [number, number]> = { A: [180, 470], B: [380, 350], C: [380, 600], D: [700, 350], E: [700, 600], F: [900, 470] };
async function slide(dark = false, decoy = false) {
  const edges = [['A', 'B'], ['A', 'C'], ['B', 'C'], ['B', 'D'], ['C', 'E'], ['D', 'E'], ['D', 'F'], ['E', 'F']];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${dark ? '#1e1e1e' : 'white'}"/>
    ${edges.map(([a, b]) => `<line x1="${truth[a][0]}" y1="${truth[a][1]}" x2="${truth[b][0]}" y2="${truth[b][1]}" stroke="${dark ? '#ddd' : '#333'}" stroke-width="3"/>`).join('')}
    <g font-size="30" font-family="Arial" fill="#1b1f24">${['Find the cheapest path from A to F.', '1. Set dist[A] = 0', '2. Settle the smallest dist', '3. Relax each edge (u, v)', '4. Repeat until F is settled'].map((t, i) => `<text x="980" y="${380 + i * 48}">${t}</text>`).join('')}</g>
    ${Object.entries(truth).map(([id, [x, y]]) => `<circle cx="${x}" cy="${y}" r="38" fill="${dark ? '#1e1e1e' : 'white'}" stroke="${dark ? '#e8eef7' : '#16365f'}" stroke-width="4"/><text x="${x}" y="${y + 13}" font-size="38" font-family="Arial" font-weight="700" text-anchor="middle" fill="${dark ? '#e8eef7' : '#16365f'}">${id}</text>`).join('')}
    ${decoy ? '<text x="300" y="300" font-size="110" font-family="Arial" text-anchor="middle" fill="#1b1f24">O</text>' : ''}
  </svg>`;
  return 'data:image/png;base64,' + (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64');
}

describe('snapping estimated nodes onto the drawing', () => {
  it('pulls offset estimates back onto the drawn nodes and keeps them distinct', async () => {
    // F's estimate is pushed toward the text column, as seen on real slides.
    const offsets: Record<string, [number, number]> = { A: [22, -18], B: [-25, 12], C: [15, 20], D: [-20, -22], E: [24, 10], F: [55, -15] };
    const estimates = Object.entries(truth).map(([nodeId, [x, y]]) => ({ nodeId, x: (x + offsets[nodeId][0]) / W, y: (y + offsets[nodeId][1]) / H }));
    const { positions, moved } = await snapNodesToDrawing(await slide(), estimates);
    expect(moved).toBe(6);
    for (const p of positions) {
      const [tx, ty] = truth[p.nodeId];
      expect(Math.hypot(p.x * W - tx, p.y * H - ty)).toBeLessThan(6);
    }
  });
  it('leaves estimates alone when nothing is drawn near them', async () => {
    const blank = 'data:image/png;base64,' + (await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ffffff' } }).png().toBuffer()).toString('base64');
    const estimates = [{ nodeId: 'A', x: 0.2, y: 0.3 }, { nodeId: 'B', x: 0.7, y: 0.6 }];
    expect(await snapNodesToDrawing(blank, estimates)).toEqual({ positions: estimates, moved: 0 });
  });
});

describe('snapping robustness', () => {
  const offsets: Record<string, [number, number]> = { A: [20, -16], B: [-22, 14], C: [14, 18], D: [-18, -20], E: [22, 10], F: [26, 14] };
  const estimates = () => Object.entries(truth).map(([nodeId, [x, y]]) => ({ nodeId, x: (x + offsets[nodeId][0]) / W, y: (y + offsets[nodeId][1]) / H }));
  it('finds light-on-dark nodes on a dark slide', async () => {
    const { positions } = await snapNodesToDrawing(await slide(true), estimates());
    for (const p of positions) expect(Math.hypot(p.x * W - truth[p.nodeId][0], p.y * H - truth[p.nodeId][1])).toBeLessThan(6);
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
        ${Object.values(truth).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#dbeafe" stroke="#16365f" stroke-width="4"/>`).join('')}</svg>`;
      return 'data:image/png;base64,' + (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64');
    };
    for (const r of [16, 21, 47, 65, 70, 80]) {
      const { positions } = await snapNodesToDrawing(await sized(r), estimates());
      for (const p of positions) {
        const start = Math.hypot(...offsets[p.nodeId]);
        expect(Math.hypot(p.x * W - truth[p.nodeId][0], p.y * H - truth[p.nodeId][1])).toBeLessThanOrEqual(start + 0.5);
      }
    }
  }, 30000);
});
