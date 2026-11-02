// Renders the second fresh source evaluation: original lecture-style slides for checked DC circuits
// (including one the solver must decline) and larger weighted graphs. Each case's answer key is
// written to cases.json beside its PNG; the model never sees it. Headless, no window.
// Run: node scripts/render-source-evaluation-v2.mjs
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const out = path.resolve('tests/fixtures/source-evaluation-v2');
mkdirSync(out, { recursive: true });

const THEMES = {
  navy: { accent: '#16365f', font: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  maroon: { accent: '#6b1f2a', font: '"Times New Roman", Times, serif' },
  teal: { accent: '#0f5257', font: 'Avenir Next, Avenir, "Helvetica Neue", sans-serif' },
};

// ---------- circuit drawing ----------
const W = 'stroke:#3a4350;stroke-width:4;fill:none;stroke-linejoin:round;stroke-linecap:round';
const line = (x1, y1, x2, y2, style = W) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="${style}"/>`;
const poly = (pts, style = W) => `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" style="${style}"/>`;
function resistor([x1, y1], [x2, y2], accent) {
  const n = 12, dx = (x2 - x1) / n, dy = (y2 - y1) / n, len = Math.hypot(x2 - x1, y2 - y1);
  const [px, py] = [-(y2 - y1) / len, (x2 - x1) / len];
  const pts = [[x1, y1]];
  for (let i = 1; i < n; i++) {
    const s = i % 2 ? 18 : -18;
    pts.push([x1 + dx * i + px * s, y1 + dy * i + py * s].map((v) => +v.toFixed(1)));
  }
  pts.push([x2, y2]);
  return poly(pts, `stroke:${accent};stroke-width:4.5;fill:none;stroke-linejoin:round`);
}
function plate([x, y], [ux, uy], half, width) {
  const [px, py] = [-uy, ux];
  return line(x - px * half, y - py * half, x + px * half, y + py * half, `stroke:#3a4350;stroke-width:${width};stroke-linecap:round`);
}
function battery(a, b, plusEnd) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const [long, short] = plusEnd === 'a' ? [a, b] : [b, a];
  return plate(long, u, 40, 5) + plate(short, u, 22, 9);
}
function capacitor(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  return plate(a, u, 36, 5) + plate(b, u, 36, 5);
}
function currentSource(a, b) {
  const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], r = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
  const u = [(b[0] - a[0]) / (2 * r), (b[1] - a[1]) / (2 * r)];
  const tail = [c[0] - u[0] * r * 0.6, c[1] - u[1] * r * 0.6], tip = [c[0] + u[0] * r * 0.6, c[1] + u[1] * r * 0.6];
  const [px, py] = [-u[1], u[0]];
  const head = [
    [tip[0] - u[0] * 14 + px * 9, tip[1] - u[1] * 14 + py * 9],
    tip,
    [tip[0] - u[0] * 14 - px * 9, tip[1] - u[1] * 14 - py * 9],
  ];
  return `<circle cx="${c[0]}" cy="${c[1]}" r="${r}" style="stroke:#3a4350;stroke-width:4;fill:#fff"/>` +
    line(tail[0], tail[1], tip[0], tip[1]) + `<polygon points="${head.map((p) => p.join(',')).join(' ')}" fill="#3a4350"/>`;
}
function openSwitch(a, b) {
  return `<circle cx="${a[0]}" cy="${a[1]}" r="6" fill="#3a4350"/><circle cx="${b[0]}" cy="${b[1]}" r="6" style="stroke:#3a4350;stroke-width:3;fill:#fff"/>` +
    line(a[0], a[1], b[0] - 8, b[1] - 42);
}
function ground([x, y]) {
  return line(x, y, x, y + 26) + line(x - 26, y + 26, x + 26, y + 26) + line(x - 16, y + 38, x + 16, y + 38) + line(x - 7, y + 50, x + 7, y + 50);
}
function circuitSvg(d, theme) {
  const t = THEMES[theme];
  const parts = d.parts.map((p) =>
    p.type === 'resistor' ? resistor(p.a, p.b, t.accent)
    : p.type === 'battery' ? battery(p.a, p.b, p.plus)
    : p.type === 'current' ? currentSource(p.a, p.b)
    : p.type === 'capacitor' ? capacitor(p.a, p.b)
    : openSwitch(p.a, p.b));
  const text = (x, y, s, size, weight, fill) => `<text x="${x}" y="${y}" style="font:${weight} ${size}px ${t.font};fill:${fill}">${s}</text>`;
  return `<svg width="1040" height="660" viewBox="0 0 1040 660">` +
    d.wires.map((w) => poly(w)).join('') + parts.join('') +
    (d.ground ? ground(d.ground) : '') +
    (d.dots ?? []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${t.accent}"/>`).join('') +
    (d.nodes ?? []).map(([x, y, s]) => text(x, y, s, 34, 700, t.accent)).join('') +
    d.labels.map(([x, y, s, kind]) => text(x, y, s, kind === 'v' ? 30 : 32, kind === 'v' ? 400 : 700, '#1b1f24')).join('') +
    `</svg>`;
}

// ---------- graph drawing ----------
function graphSvg(g, theme) {
  const t = THEMES[theme], r = 34;
  const edges = g.edges.map(([a, b, w]) => {
    const [x1, y1] = g.at[a], [x2, y2] = g.at[b], len = Math.hypot(x2 - x1, y2 - y1), u = [(x2 - x1) / len, (y2 - y1) / len];
    const s = [x1 + u[0] * r, y1 + u[1] * r], e = [x2 - u[0] * (r + (g.directed ? 4 : 0)), y2 - u[1] * (r + (g.directed ? 4 : 0))];
    let svg = `<line x1="${s[0]}" y1="${s[1]}" x2="${e[0]}" y2="${e[1]}" style="stroke:#3a4350;stroke-width:4" ${g.directed ? 'marker-end="url(#arrow)"' : ''}/>`;
    if (w !== undefined) {
      const m = [(x1 + x2) / 2, (y1 + y2) / 2], label = String(w), wpx = 18 * label.length + 14;
      svg += `<rect x="${m[0] - wpx / 2}" y="${m[1] - 21}" width="${wpx}" height="40" rx="6" fill="#fff"/>` +
        `<text x="${m[0]}" y="${m[1] + 11}" text-anchor="middle" style="font:600 30px ${t.font};fill:#1b1f24">${label}</text>`;
    }
    return svg;
  });
  const nodes = Object.entries(g.at).map(([id, [x, y]]) =>
    `<circle cx="${x}" cy="${y}" r="${r}" style="fill:#fff;stroke:${t.accent};stroke-width:4"/>` +
    `<text x="${x}" y="${y + 12}" text-anchor="middle" style="font:700 32px ${t.font};fill:${t.accent}">${id}</text>`);
  return `<svg width="1040" height="660" viewBox="0 0 1040 660"><defs><marker id="arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="#3a4350"/></marker></defs>${edges.join('')}${nodes.join('')}</svg>`;
}

function slide(c, svg) {
  const t = THEMES[c.theme];
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#fff}
  .slide{width:1920px;height:1080px;box-sizing:border-box;position:relative;padding:72px 96px 0;font-family:${t.font};color:#1b1f24}
  .kicker{font-size:26px;letter-spacing:.04em;color:#5b6573;text-transform:uppercase}
  h1{margin:10px 0 0;font-size:62px;font-weight:700;color:${t.accent}}
  .rule{height:4px;background:${t.accent};margin:26px 0 0}
  .body{display:grid;grid-template-columns:1040px 1fr;gap:64px;margin-top:30px}
  .task{font-size:34px;margin:6px 0 28px}
  ol{margin:0;padding-left:40px;font-size:28px;line-height:1.5} li{margin-bottom:14px}
  .note{margin-top:30px;font-size:28px;color:#5b6573}
  .footer{position:absolute;left:96px;right:96px;bottom:36px;display:flex;justify-content:space-between;font-size:20px;color:#8a93a0;border-top:1px solid #dde2e8;padding-top:14px}
  </style></head><body><div class="slide">
  <div class="kicker">${c.kicker}</div><h1>${c.title}</h1><div class="rule"></div>
  <div class="body">${svg}<div><p class="task"><strong>${c.task}</strong></p><ol>${c.steps.map((s) => `<li>${s}</li>`).join('')}</ol>${c.note ? `<p class="note">${c.note}</p>` : ''}</div></div>
  <div class="footer"><span>${c.kicker.split(' · ').slice(0, 1)}</span><span>Original test slide made for Soma</span><span>${c.page}</span></div>
  </div></body></html>`;
}

// ---------- cases ----------
const R = (label, a, b, value) => ({ label, kind: 'resistor', ends: [a, b], value });
const V = (minus, plus, value) => ({ kind: 'voltage-source', from: minus, to: plus, value });
const I = (from, to, value) => ({ kind: 'current-source', from, to, value });

const circuits = [
  {
    id: 'circuit-series-parallel-kohm', theme: 'navy', page: 7,
    kicker: 'Physics 2 · Lecture 7 · Series and parallel', title: 'Resistors in Combination',
    task: 'Find the current through R₃.', steps: ['Combine R₂ and R₃ in parallel.', 'Add R₁ in series.', 'Find the total current, then split it.'],
    question: 'How much current flows through R3?',
    expected: { outcome: 'checked-circuit', nodes: ['A', 'B', 'D'], ground: 'D', components: [V('D', 'A', 9), R('R1', 'A', 'B', 1000), R('R2', 'B', 'D', 2200), R('R3', 'B', 'D', 3300)] },
    draw: {
      wires: [[[120, 310], [120, 90], [330, 90]], [[470, 90], [900, 90], [900, 250]], [[640, 90], [640, 250]], [[640, 390], [640, 570]], [[900, 390], [900, 570], [120, 570], [120, 350]]],
      parts: [{ type: 'battery', a: [120, 310], b: [120, 350], plus: 'a' }, { type: 'resistor', a: [330, 90], b: [470, 90] }, { type: 'resistor', a: [640, 250], b: [640, 390] }, { type: 'resistor', a: [900, 250], b: [900, 390] }],
      dots: [[640, 90], [640, 570]], ground: [120, 570],
      nodes: [[200, 70, 'A'], [628, 62, 'B'], [628, 616, 'D']],
      labels: [[150, 300, '+'], [150, 346, '9 V', 'v'], [372, 62, 'R₁'], [360, 140, '1 kΩ', 'v'], [560, 310, 'R₂'], [532, 346, '2.2 kΩ', 'v'], [930, 310, 'R₃'], [930, 346, '3.3 kΩ', 'v']],
    },
  },
  {
    id: 'circuit-two-sources', theme: 'maroon', page: 11,
    kicker: 'EE 201 · Lecture 11 · Nodal analysis', title: 'Two Sources, One Node',
    task: 'Find the current through R₃.', steps: ['Take D as the reference node.', 'Write KCL at node B.', 'Solve for V_B, then I₃ = V_B / R₃.'],
    question: 'Which way does current flow through R3, and how much?',
    expected: { outcome: 'checked-circuit', nodes: ['A', 'B', 'C', 'D'], ground: 'D', components: [V('D', 'A', 12), V('D', 'C', 6), R('R1', 'A', 'B', 4), R('R2', 'B', 'C', 6), R('R3', 'B', 'D', 3)] },
    draw: {
      wires: [[[120, 310], [120, 90], [260, 90]], [[400, 90], [640, 90]], [[780, 90], [920, 90], [920, 310]], [[520, 90], [520, 250]], [[520, 390], [520, 570]], [[120, 350], [120, 570], [920, 570], [920, 350]]],
      parts: [{ type: 'battery', a: [120, 310], b: [120, 350], plus: 'a' }, { type: 'battery', a: [920, 310], b: [920, 350], plus: 'a' }, { type: 'resistor', a: [260, 90], b: [400, 90] }, { type: 'resistor', a: [640, 90], b: [780, 90] }, { type: 'resistor', a: [520, 250], b: [520, 390] }],
      dots: [[520, 90], [520, 570]], ground: [120, 570],
      nodes: [[180, 70, 'A'], [508, 62, 'B'], [846, 70, 'C'], [540, 610, 'D']],
      labels: [[150, 300, '+'], [150, 346, '12 V', 'v'], [882, 300, '+'], [828, 346, '6 V', 'v'], [310, 62, 'R₁'], [305, 140, '4 Ω', 'v'], [690, 62, 'R₂'], [685, 140, '6 Ω', 'v'], [550, 310, 'R₃'], [550, 346, '3 Ω', 'v']],
    },
  },
  {
    id: 'circuit-current-source-ma', theme: 'teal', page: 5,
    kicker: 'Circuits I · Lecture 5 · Sources', title: 'Driving a Network with a Current Source',
    task: 'Find the voltage at node A.', steps: ['D is the reference node.', 'R₁ and R₃ are in series.', 'That pair is in parallel with R₂.'],
    question: 'What is the voltage at A?',
    expected: { outcome: 'checked-circuit', nodes: ['A', 'B', 'D'], ground: 'D', components: [I('D', 'A', 0.005), R('R1', 'A', 'B', 2000), R('R2', 'A', 'D', 1000), R('R3', 'B', 'D', 3000)] },
    draw: {
      wires: [[[120, 290], [120, 90], [520, 90]], [[380, 90], [380, 250]], [[380, 390], [380, 570]], [[660, 90], [880, 90], [880, 250]], [[880, 390], [880, 570], [120, 570], [120, 370]]],
      parts: [{ type: 'current', a: [120, 370], b: [120, 290] }, { type: 'resistor', a: [380, 250], b: [380, 390] }, { type: 'resistor', a: [520, 90], b: [660, 90] }, { type: 'resistor', a: [880, 250], b: [880, 390] }],
      dots: [[380, 90], [380, 570]], ground: [120, 570],
      nodes: [[368, 66, 'A'], [770, 70, 'B'], [368, 616, 'D']],
      labels: [[175, 320, 'I₁'], [175, 356, '5 mA', 'v'], [410, 310, 'R₂'], [410, 346, '1 kΩ', 'v'], [570, 62, 'R₁'], [560, 140, '2 kΩ', 'v'], [910, 310, 'R₃'], [910, 346, '3 kΩ', 'v']],
    },
  },
  {
    id: 'circuit-ladder-unmarked-ground', theme: 'navy', page: 8,
    kicker: 'Physics 2 · Lecture 8 · Ladder networks', title: 'A Three-Rung Resistor Ladder',
    task: 'How much current reaches R₆?', steps: ['Start at the far end: R₅ + R₆.', 'Combine with R₄, then add R₃.', 'Repeat back toward the battery.'],
    question: 'How much current reaches R6?',
    expected: { outcome: 'checked-circuit', nodes: ['A', 'B', 'C', 'D', 'E'], ground: 'E', components: [V('E', 'A', 10), R('R1', 'A', 'B', 10), R('R2', 'B', 'E', 20), R('R3', 'B', 'C', 10), R('R4', 'C', 'E', 20), R('R5', 'C', 'D', 10), R('R6', 'D', 'E', 20)] },
    draw: {
      wires: [[[100, 310], [100, 90], [150, 90]], [[270, 90], [420, 90]], [[540, 90], [690, 90]], [[810, 90], [900, 90], [900, 250]], [[340, 90], [340, 250]], [[340, 390], [340, 570]], [[610, 90], [610, 250]], [[610, 390], [610, 570]], [[900, 390], [900, 570], [100, 570], [100, 350]]],
      parts: [{ type: 'battery', a: [100, 310], b: [100, 350], plus: 'a' }, { type: 'resistor', a: [150, 90], b: [270, 90] }, { type: 'resistor', a: [340, 250], b: [340, 390] }, { type: 'resistor', a: [420, 90], b: [540, 90] }, { type: 'resistor', a: [610, 250], b: [610, 390] }, { type: 'resistor', a: [690, 90], b: [810, 90] }, { type: 'resistor', a: [900, 250], b: [900, 390] }],
      dots: [[340, 90], [610, 90], [340, 570], [610, 570]],
      nodes: [[112, 70, 'A'], [328, 62, 'B'], [598, 62, 'C'], [918, 80, 'D'], [478, 616, 'E']],
      labels: [[130, 300, '+'], [130, 346, '10 V', 'v'], [195, 62, 'R₁'], [182, 140, '10 Ω', 'v'], [370, 310, 'R₂'], [370, 346, '20 Ω', 'v'], [465, 62, 'R₃'], [452, 140, '10 Ω', 'v'], [640, 310, 'R₄'], [640, 346, '20 Ω', 'v'], [735, 62, 'R₅'], [722, 140, '10 Ω', 'v'], [930, 310, 'R₆'], [930, 346, '20 Ω', 'v']],
    },
  },
  {
    id: 'circuit-decimal-mesh', theme: 'maroon', page: 14,
    kicker: 'EE 201 · Lecture 14 · Mesh and nodal practice', title: 'A Six-Node Network',
    task: 'Find the current through R₃.', steps: ['Choose D as reference.', 'Write KCL at B, C, E and F.', 'Solve the four equations together.'],
    question: 'What current flows through R3?',
    expected: { outcome: 'checked-circuit', nodes: ['A', 'B', 'C', 'D', 'E', 'F'], ground: 'D', components: [V('D', 'A', 24), R('R1', 'A', 'B', 1.5), R('R2', 'B', 'C', 4.7), R('R3', 'B', 'E', 10), R('R4', 'C', 'F', 6.8), R('R5', 'E', 'F', 3.3), R('R6', 'D', 'E', 2.2)] },
    draw: {
      wires: [[[120, 310], [120, 90], [200, 90]], [[340, 90], [640, 90]], [[780, 90], [900, 90], [900, 250]], [[900, 390], [900, 570], [780, 570]], [[640, 570], [340, 570]], [[200, 570], [120, 570], [120, 350]], [[520, 90], [520, 250]], [[520, 390], [520, 570]]],
      parts: [{ type: 'battery', a: [120, 310], b: [120, 350], plus: 'a' }, { type: 'resistor', a: [200, 90], b: [340, 90] }, { type: 'resistor', a: [640, 90], b: [780, 90] }, { type: 'resistor', a: [520, 250], b: [520, 390] }, { type: 'resistor', a: [900, 250], b: [900, 390] }, { type: 'resistor', a: [640, 570], b: [780, 570] }, { type: 'resistor', a: [200, 570], b: [340, 570] }],
      dots: [[520, 90], [520, 570]], ground: [120, 570],
      nodes: [[150, 70, 'A'], [508, 62, 'B'], [918, 80, 'C'], [152, 612, 'D'], [508, 616, 'E'], [918, 596, 'F']],
      labels: [[150, 300, '+'], [150, 346, '24 V', 'v'], [250, 62, 'R₁'], [238, 140, '1.5 Ω', 'v'], [690, 62, 'R₂'], [678, 140, '4.7 Ω', 'v'], [550, 310, 'R₃'], [550, 346, '10 Ω', 'v'], [930, 310, 'R₄'], [930, 346, '6.8 Ω', 'v'], [690, 540, 'R₅'], [678, 624, '3.3 Ω', 'v'], [250, 540, 'R₆'], [238, 624, '2.2 Ω', 'v']],
    },
  },
  {
    id: 'circuit-ground-on-plus', theme: 'teal', page: 6,
    kicker: 'Circuits I · Lecture 6 · Reference nodes', title: 'Choosing the Reference Node',
    task: 'Find the voltage at A. D is ground.', steps: ['Use D as the reference node.', 'R₃ and R₄ are in series.', 'That pair is in parallel with R₂.'],
    question: 'What is the voltage at A?',
    expected: { outcome: 'checked-circuit', nodes: ['A', 'B', 'C', 'D'], ground: 'D', components: [V('A', 'D', 15), R('R1', 'A', 'B', 5), R('R2', 'B', 'D', 10), R('R3', 'B', 'C', 2), R('R4', 'C', 'D', 8)] },
    draw: {
      wires: [[[120, 310], [120, 90], [260, 90]], [[400, 90], [640, 90]], [[780, 90], [900, 90], [900, 250]], [[520, 90], [520, 250]], [[520, 390], [520, 570]], [[900, 390], [900, 570], [120, 570], [120, 350]]],
      parts: [{ type: 'battery', a: [120, 310], b: [120, 350], plus: 'b' }, { type: 'resistor', a: [260, 90], b: [400, 90] }, { type: 'resistor', a: [520, 250], b: [520, 390] }, { type: 'resistor', a: [640, 90], b: [780, 90] }, { type: 'resistor', a: [900, 250], b: [900, 390] }],
      dots: [[520, 90], [520, 570]], ground: [900, 570],
      nodes: [[190, 70, 'A'], [508, 62, 'B'], [918, 80, 'C'], [508, 616, 'D']],
      labels: [[152, 378, '+'], [152, 322, '15 V', 'v'], [310, 62, 'R₁'], [305, 140, '5 Ω', 'v'], [550, 310, 'R₂'], [550, 346, '10 Ω', 'v'], [690, 62, 'R₃'], [685, 140, '2 Ω', 'v'], [930, 310, 'R₄'], [930, 346, '8 Ω', 'v']],
    },
  },
  {
    id: 'circuit-rc-declined', theme: 'navy', page: 12,
    kicker: 'Physics 2 · Lecture 12 · RC circuits', title: 'Charging a Capacitor',
    task: 'The switch closes at t = 0. Find v_C(t).', steps: ['τ = RC = 10 ms', 'v_C(t) = 5(1 − e^(−t/τ)) V', 'After 5τ the capacitor is nearly full.'],
    question: 'How does the capacitor voltage change after the switch closes?',
    expected: { outcome: 'declined' },
    draw: {
      wires: [[[120, 310], [120, 90], [300, 90]], [[400, 90], [500, 90]], [[640, 90], [880, 90], [880, 300]], [[880, 330], [880, 570], [120, 570], [120, 350]]],
      parts: [{ type: 'battery', a: [120, 310], b: [120, 350], plus: 'a' }, { type: 'switch', a: [300, 90], b: [400, 90] }, { type: 'resistor', a: [500, 90], b: [640, 90] }, { type: 'capacitor', a: [880, 300], b: [880, 330] }],
      labels: [[150, 300, '+'], [150, 346, '5 V', 'v'], [336, 30, 'S'], [550, 62, 'R₁'], [540, 140, '1 kΩ', 'v'], [920, 300, 'C₁'], [920, 340, '10 µF', 'v']],
    },
  },
];

const graphs = [
  {
    id: 'graph-undirected-8', theme: 'teal', page: 14, algorithm: 'dijkstra', directed: false, start: 'A', goal: 'H',
    kicker: 'Algorithms · Lecture 14 · Shortest paths', title: 'Dijkstra on an Eight-Vertex Graph',
    task: 'Find the shortest path from A to H.', steps: ['dist(A) = 0; every other vertex ∞.', 'Settle the closest unsettled vertex.', 'Relax its edges; repeat until H is settled.'],
    question: 'Show me how Dijkstra finds the shortest path on this slide.',
    at: { A: [70, 330], B: [250, 120], C: [250, 540], D: [450, 330], E: [650, 120], F: [650, 540], G: [830, 330], H: [980, 330] },
    edges: [['A', 'B', 4], ['A', 'C', 2], ['B', 'C', 5], ['B', 'D', 10], ['C', 'D', 3], ['B', 'E', 8], ['D', 'E', 6], ['D', 'F', 8], ['C', 'F', 12], ['E', 'G', 5], ['F', 'G', 2], ['G', 'H', 3], ['E', 'H', 14]],
  },
  {
    id: 'graph-directed-7', theme: 'navy', page: 15, algorithm: 'dijkstra', directed: true, start: 'S', goal: 'T',
    kicker: 'Algorithms · Lecture 15 · Directed graphs', title: 'One-Way Edges',
    task: 'Find the shortest path from S to T. Edges are one-way.', steps: ['Follow edges only in the arrow’s direction.', 'Settle vertices in order of distance.', 'Stop when T is settled.'],
    question: 'Show me the shortest path from S to T and how Dijkstra finds it.',
    at: { S: [70, 330], A: [270, 130], B: [270, 530], C: [500, 330], D: [720, 130], E: [720, 530], T: [960, 330] },
    edges: [['S', 'A', 3], ['S', 'B', 6], ['A', 'B', 2], ['A', 'C', 7], ['B', 'C', 3], ['A', 'D', 9], ['C', 'D', 2], ['C', 'E', 6], ['B', 'E', 11], ['D', 'E', 3], ['D', 'T', 8], ['E', 'T', 2]],
  },
  {
    id: 'graph-decimal-10', theme: 'maroon', page: 16, algorithm: 'dijkstra', directed: false, start: 'A', goal: 'J',
    kicker: 'Algorithms · Lecture 16 · Weighted graphs', title: 'Fractional Costs',
    task: 'Find the cheapest route from A to J.', steps: ['Costs are in kilometres.', 'Settle the nearest vertex each round.', 'Record each vertex’s predecessor.'],
    question: 'What is the cheapest route from A to J?',
    at: { A: [70, 330], B: [230, 130], C: [230, 530], D: [410, 330], E: [560, 130], F: [560, 530], G: [720, 330], H: [860, 130], I: [860, 530], J: [985, 330] },
    edges: [['A', 'B', 2.5], ['A', 'C', 1.5], ['B', 'D', 3], ['C', 'D', 2.5], ['B', 'E', 4.5], ['D', 'E', 1.5], ['D', 'F', 3.5], ['C', 'F', 6.5], ['E', 'G', 2], ['F', 'G', 1], ['E', 'H', 5.5], ['G', 'H', 2.5], ['G', 'I', 3], ['F', 'I', 4], ['H', 'J', 2], ['I', 'J', 3.5]],
  },
  {
    id: 'graph-bfs-9', theme: 'teal', page: 13, algorithm: 'bfs', directed: false, start: 'A', goal: 'I',
    kicker: 'Algorithms · Lecture 13 · Graph traversal', title: 'Breadth-First Search',
    task: 'Run BFS from A until I is reached.', steps: ['Visit neighbors in alphabetical order.', 'Use a FIFO queue.', 'Mark a vertex when it is discovered.'],
    question: 'Walk me through the breadth-first search on this slide.',
    at: { A: [70, 330], B: [260, 130], C: [260, 330], D: [260, 530], E: [500, 130], F: [500, 330], G: [500, 530], H: [760, 230], I: [960, 330] },
    edges: [['A', 'B'], ['A', 'C'], ['A', 'D'], ['B', 'E'], ['C', 'F'], ['D', 'G'], ['E', 'F'], ['F', 'G'], ['E', 'H'], ['F', 'H'], ['G', 'I'], ['H', 'I']],
  },
  {
    id: 'graph-undirected-12', theme: 'navy', page: 17, algorithm: 'dijkstra', directed: false, start: 'A', goal: 'L',
    kicker: 'Algorithms · Lecture 17 · Larger graphs', title: 'Dijkstra at Scale',
    task: 'Find the shortest path from A to L.', steps: ['Twelve vertices, twenty edges.', 'Keep a priority queue of tentative distances.', 'Stop when L is settled.'],
    question: 'Show me how Dijkstra finds the shortest path from A to L.',
    at: { A: [80, 330], B: [300, 110], C: [300, 330], D: [300, 550], E: [520, 110], F: [520, 330], G: [520, 550], H: [740, 110], I: [740, 330], J: [740, 550], K: [960, 220], L: [960, 440] },
    edges: [['A', 'B', 3], ['A', 'C', 5], ['A', 'D', 4], ['B', 'C', 1], ['C', 'D', 2], ['B', 'E', 6], ['C', 'F', 4], ['D', 'G', 8], ['E', 'F', 2], ['F', 'G', 3], ['E', 'H', 5], ['F', 'I', 6], ['G', 'J', 2], ['H', 'I', 1], ['I', 'J', 4], ['H', 'K', 3], ['I', 'K', 5], ['I', 'L', 7], ['J', 'L', 3], ['K', 'L', 4]],
  },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const cases = [];
for (const c of [...circuits, ...graphs]) {
  const svg = c.draw ? circuitSvg(c.draw, c.theme) : graphSvg(c, c.theme);
  await page.setContent(slide(c, svg));
  await page.screenshot({ path: path.join(out, `${c.id}.png`), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  cases.push(
    c.draw
      ? { id: c.id, subject: 'circuit', question: c.question, expected: c.expected }
      : { id: c.id, subject: 'graph', question: c.question, expected: { algorithm: c.algorithm, directed: c.directed, start: c.start, goal: c.goal, nodes: Object.keys(c.at), edges: c.edges } },
  );
}
await browser.close();
writeFileSync(path.join(out, 'cases.json'), JSON.stringify(cases, null, 1) + '\n');
// Freeze: one hash over the answer key and every image, recorded before any provider call.
const hash = createHash('sha256');
for (const file of ['cases.json', ...cases.map((c) => `${c.id}.png`)]) hash.update(readFileSync(path.join(out, file)));
console.log(`${cases.length} cases, freeze sha256 ${hash.digest('hex')}`);
