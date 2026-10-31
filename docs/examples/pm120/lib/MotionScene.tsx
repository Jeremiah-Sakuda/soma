import { useId } from 'react';
import { filmFrame, type MotionFilm } from './motion-film';
export function MotionScene({ film, time, compression = null, captions = false }: { film: MotionFilm; time: number; compression?: number | null; captions?: boolean }) {
  const frame = filmFrame(film, time, compression), instance = useId().replace(/[^a-z0-9]/gi, '');
  const draw = (parent: string | null): React.ReactNode => film.nodes.filter(n => n.parentId === parent).map(n => {
    const s = film.styles.find(s => s.id === n.styleId)!, p = frame.poses[n.id];
    const style = { fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth, fontSize: s.fontSize, fontWeight: s.fontWeight, fontFamily: s.fontFamily === 'serif' ? 'Georgia, serif' : s.fontFamily === 'mono' ? 'ui-monospace, monospace' : 'Arial, sans-serif' };
    return <g key={n.id} data-film-node={n.id} data-role={n.role} transform={`translate(${n.x + p.tx} ${n.y + p.ty}) rotate(${p.rotate}) scale(${p.scale})`} opacity={p.opacity * (n.kind === 'path' ? 1 : p.reveal)}>
      {n.kind === 'group' ? draw(n.id) : n.kind === 'path' ? <path {...style} d={n.shape} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={p.reveal < 1 ? 1 : undefined} strokeDashoffset={p.reveal < 1 ? 1 - p.reveal : undefined} />
        : n.kind === 'rect' ? <rect {...style} width={n.width} height={n.height} rx={n.radius} />
        : n.kind === 'circle' ? <circle {...style} r={n.radius} />
        : <text {...style} stroke="none" dominantBaseline="hanging">{n.text}</text>}
    </g>;
  });
  return <svg xmlns="http://www.w3.org/2000/svg" width={film.width} height={film.height} className="motion-scene" viewBox={`0 0 ${film.width} ${film.height}`} role="img" aria-labelledby={`film-title-${instance} film-desc-${instance}`} data-time={frame.time.toFixed(3)} data-compression={frame.compression.toFixed(4)}>
    <title id={`film-title-${instance}`}>{film.title}</title><desc id={`film-desc-${instance}`}>{compression !== null ? `Your travel setting: ${Math.round(frame.compression * 100)} percent. The guide stays fixed.` : frame.chapter.caption} {film.parameter.description}</desc>
    <rect width={film.width} height={film.height} fill={film.background} />
    <text data-film-heading="true" x="32" y="36" fill="#2e3b38" fontFamily="Arial, sans-serif" fontSize="28" fontWeight="600" dominantBaseline="hanging">{frame.chapter.title}</text>
    {draw(null)}
    {captions && <g fill="#2e3b38" fontFamily="Arial, sans-serif" fontSize="24" aria-label={frame.chapter.caption}>{wrapCaption(frame.chapter.caption).map((line, i) => <text key={i} x="32" y={396 + i * 28} dominantBaseline="hanging">{line}</text>)}</g>}
  </svg>;
}

function wrapCaption(text: string) {
  const lines: string[] = []; let line = '';
  for (const word of text.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > 43 && line) { lines.push(line); line = word; }
    else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}
