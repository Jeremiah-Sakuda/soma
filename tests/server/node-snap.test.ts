import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { snapNodesToDrawing } from '../../src/lib/server/node-snap';

const W = 1600,
  H = 900;
const truth: Record<string, [number, number]> = { A: [180, 470], B: [380, 350], C: [380, 600], D: [700, 350], E: [700, 600], F: [900, 470] };
async function slide() {
  const edges = [['A', 'B'], ['A', 'C'], ['B', 'C'], ['B', 'D'], ['C', 'E'], ['D', 'E'], ['D', 'F'], ['E', 'F']];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="white"/>
    ${edges.map(([a, b]) => `<line x1="${truth[a][0]}" y1="${truth[a][1]}" x2="${truth[b][0]}" y2="${truth[b][1]}" stroke="#333" stroke-width="3"/>`).join('')}
    <g font-size="30" font-family="Arial" fill="#1b1f24">${['Find the cheapest path from A to F.', '1. Set dist[A] = 0', '2. Settle the smallest dist', '3. Relax each edge (u, v)', '4. Repeat until F is settled'].map((t, i) => `<text x="980" y="${380 + i * 48}">${t}</text>`).join('')}</g>
    ${Object.entries(truth).map(([id, [x, y]]) => `<circle cx="${x}" cy="${y}" r="38" fill="white" stroke="#16365f" stroke-width="4"/><text x="${x}" y="${y + 13}" font-size="38" font-family="Arial" font-weight="700" text-anchor="middle" fill="#16365f">${id}</text>`).join('')}
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
