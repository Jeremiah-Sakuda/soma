import { z } from 'zod';
const id = z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/);
const finite = z.number().finite();
const color = z.string().regex(/^(#[0-9a-fA-F]{6}|none)$/);
const property = z.enum(['tx', 'ty', 'scale', 'rotate', 'opacity', 'reveal']);
export const motionFilmSchema = z.strictObject({
  schemaVersion: z.literal('motion-film-v1'),
  title: z.string().min(1).max(90),
  summary: z.string().min(1).max(220),
  width: z.literal(640), height: z.literal(460), duration: z.number().min(20).max(30),
  background: color.refine(c => c !== 'none'),
  assumptions: z.array(z.string().min(1).max(180)).min(1).max(6),
  styles: z.array(z.strictObject({ id, fill: color, stroke: color, strokeWidth: z.number().min(0).max(8), fontSize: z.number().min(28).max(56), fontWeight: z.enum(['400', '500', '600', '700']), fontFamily: z.enum(['sans', 'serif', 'mono']) })).min(3).max(12),
  nodes: z.array(z.strictObject({
    id, parentId: id.nullable(), kind: z.enum(['group', 'path', 'rect', 'circle', 'text']),
    role: z.enum(['assembly', 'guide', 'base', 'head', 'rod', 'grip', 'annotation', 'none']),
    styleId: id, x: finite.min(-640).max(1280), y: finite.min(-460).max(920),
    width: finite.min(0).max(640), height: finite.min(0).max(460), radius: finite.min(0).max(320),
    shape: z.string().max(1800).regex(/^[MmLlHhVvCcSsQqTtAaZz0-9.,+eE\s-]*$/), text: z.string().max(65),
  })).min(8).max(48),
  parameter: z.strictObject({ id: z.literal('compression'), label: z.string().min(1).max(60), description: z.string().min(1).max(180), targetId: id, property: z.enum(['tx', 'ty']), amount: finite.min(-180).max(180) }),
  tracks: z.array(z.strictObject({ targetId: z.union([id, z.literal('$compression')]), property: z.union([property, z.literal('value')]), easing: z.enum(['linear', 'smooth']), keys: z.array(z.strictObject({ at: finite.min(0).max(30), value: finite.min(-1280).max(1280) })).min(2).max(12) })).min(3).max(32),
  chapters: z.array(z.strictObject({ id, at: finite.min(0).max(30), title: z.string().min(1).max(50), caption: z.string().min(1).max(180), narration: z.string().min(1).max(160) })).min(3).max(5),
  experimentAt: finite.min(0).max(30),
});
export type MotionFilm = z.infer<typeof motionFilmSchema>;
export type MotionNode = MotionFilm['nodes'][number];
export type NodePose = Record<z.infer<typeof property>, number>;
const defaults: NodePose = { tx: 0, ty: 0, scale: 1, rotate: 0, opacity: 1, reveal: 1 };

export function validateFilm(raw: unknown): MotionFilm {
  if (JSON.stringify(raw).length > 24576) throw Error('Film exceeds the bounded specification size.');
  const f = motionFilmSchema.parse(raw), nodes = new Map(f.nodes.map(n => [n.id, n]));
  if (nodes.size !== f.nodes.length || new Set(f.styles.map(s => s.id)).size !== f.styles.length) throw Error('Duplicate film identity.');
  const styles = new Set(f.styles.map(s => s.id));
  for (const n of f.nodes) {
    if (!styles.has(n.styleId) || (n.parentId && nodes.get(n.parentId)?.kind !== 'group')) throw Error('Invalid node reference.');
    const seen = new Set([n.id]); let p = n.parentId;
    while (p) { if (seen.has(p) || seen.size > 5) throw Error('Cyclic or deep group.'); seen.add(p); p = nodes.get(p)?.parentId ?? null; }
    if (n.kind === 'text' && n.parentId !== null) throw Error('Labels must be outside moving groups.');
    if (n.kind === 'path' && (n.shape.match(/[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g) ?? []).some(v => !Number.isFinite(Number(v)) || Math.abs(Number(v)) > 2000)) throw Error('Path coordinate limit.');
    if (n.kind === 'path' ? !n.shape.trim() || !/^[Mm]/.test(n.shape.trim()) : n.shape !== '') throw Error('Invalid path data.');
    if ((n.kind === 'text') !== !!n.text.trim()) throw Error('Text belongs only to text nodes.');
    if (n.kind === 'rect' && (!n.width || !n.height)) throw Error('Empty rectangle.');
    if (n.kind === 'circle' && !n.radius) throw Error('Empty circle.');
  }
  for (const role of ['base', 'head', 'rod', 'grip'] as const) if (f.nodes.filter(n => n.role === role).length !== 1) throw Error(`Exactly one ${role} is required.`);
  if (nodes.get(f.parameter.targetId)?.kind !== 'group') throw Error('Control must drive one rigid assembly group.');
  for (const n of f.nodes.filter(n => ['head', 'rod', 'grip'].includes(n.role))) {
    let p = n.parentId; while (p && p !== f.parameter.targetId) p = nodes.get(p)?.parentId ?? null;
    if (!p) throw Error('Moving pieces must share the controlled assembly.');
  }
  for (const n of f.nodes.filter(n => ['base', 'guide'].includes(n.role))) {
    let p: string | null = n.id; while (p) { if (p === f.parameter.targetId) throw Error('Support cannot be part of the moving group.'); p = nodes.get(p)?.parentId ?? null; }
  }
  const targets = new Set<string>();
  for (const t of f.tracks) {
    if ((t.targetId === '$compression') !== (t.property === 'value') || (t.targetId !== '$compression' && !nodes.has(t.targetId))) throw Error('Invalid animation binding.');
    if (['tx', 'ty', 'scale', 'rotate'].includes(t.property)) throw Error('This film uses one rigid parameter driver; tracks may reveal/opacity only.');
    const key = `${t.targetId}:${t.property}`; if (targets.has(key)) throw Error('Conflicting animation tracks.'); targets.add(key);
    for (let i = 0; i < t.keys.length; i++) {
      const k = t.keys[i]; if (k.at > f.duration || (i > 0 && k.at <= t.keys[i - 1].at)) throw Error('Unordered animation time.');
      if (['value', 'opacity', 'reveal'].includes(t.property) && (k.value < 0 || k.value > 1)) throw Error('Out-of-range normalized value.');
      if (t.property === 'scale' && (k.value < .25 || k.value > 3)) throw Error('Out-of-range scale.');
    }
  }
  if (!targets.has('$compression:value')) throw Error('Missing authored compression timeline.');
  if (f.chapters[0].at !== 0 || new Set(f.chapters.map(c => c.id)).size !== f.chapters.length || f.chapters.some((c, i) => c.at >= f.duration || (i > 0 && c.at <= f.chapters[i - 1].at))) throw Error('Invalid chapter timeline.');
  if (f.experimentAt > f.duration) throw Error('Invalid experiment time.');
  return f;
}
export function trackValue(track: MotionFilm['tracks'][number], time: number) {
  const keys = track.keys;
  if (time <= keys[0].at) return keys[0].value;
  for (let i = 1; i < keys.length; i++) if (time <= keys[i].at) {
    const from = keys[i - 1], to = keys[i], t = (time - from.at) / (to.at - from.at), k = track.easing === 'smooth' ? t * t * (3 - 2 * t) : t;
    return from.value + (to.value - from.value) * k;
  }
  return keys[keys.length - 1].value;
}
export function filmFrame(film: MotionFilm, at: number, override: number | null = null) {
  const time = Math.max(0, Math.min(film.duration, Number.isFinite(at) ? at : 0));
  const poses = Object.fromEntries(film.nodes.map(n => [n.id, { ...defaults }])) as Record<string, NodePose>;
  let compression = 0;
  for (const track of film.tracks) {
    const value = trackValue(track, time);
    if (track.targetId === '$compression') compression = value;
    else poses[track.targetId][track.property as keyof NodePose] = value;
  }
  if (override !== null) compression = Number.isFinite(override) ? Math.max(0, Math.min(1, override)) : compression;
  poses[film.parameter.targetId][film.parameter.property] += film.parameter.amount * compression;
  const chapter = film.chapters.filter(c => c.at <= time).at(-1)!;
  return { time, compression, poses, chapter };
}
