import { EngineScene } from '../pm121/lib/EngineScene';
import { enginePose, type EngineFilm } from '../pm121/lib/engine';
export function EngineFilmFrame({ film, degrees }: { film: EngineFilm; degrees: number }) {
  const p = enginePose(degrees),
    s = film.strokes[p.phase],
    color = ['#39798a', '#8a7639', '#ae603b', '#657281'][p.phase];
  const words = s.caption.split(' '),
    lines: string[] = [];
  for (const word of words) {
    if (!lines.length || lines.at(-1)!.length + word.length > 31) lines.push(word);
    else lines[lines.length - 1] += ' ' + word;
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1920"
      height="1080"
      viewBox="0 0 1920 1080"
      fontFamily="Arial, sans-serif"
    >
      <rect width="1920" height="1080" fill="#f7f6f2" />
      <text x="64" y="68" fontSize="36" fontWeight="700" fill="#20352e" letterSpacing="-1.5">
        soma
      </text>
      <text x="1856" y="64" textAnchor="end" fontSize="17" fill="#68746b" letterSpacing="2">
        MOTION STUDY / 001
      </text>
      <path d="M64 100 H1856" stroke="#dfe4da" />
      <rect x="48" y="122" width="1824" height="786" rx="22" fill="#fbfaf7" stroke="#dfe4da" />
      <svg x="58" y="130" width="1210" height="770" viewBox="0 0 800 600">
        <EngineScene film={film} degrees={degrees} />
      </svg>
      <path d="M1284 166 V864" stroke="#dfe4da" />
      <g transform="translate(1340 226)">
        <text fontSize="18" letterSpacing="2" fill="#68746b">
          THE WORKING CYCLE
        </text>
        <text x="462" y="0" textAnchor="end" fontSize="28" fill={color}>
          {String(p.phase + 1).padStart(2, '0')} / 04
        </text>
        <text y="94" fontSize="23" fill={color}>
          {s.verb}
        </text>
        <text y="177" fontSize="64" fill="#20352e" letterSpacing="-2">
          {s.name}.
        </text>
        {lines.map((line, i) => (
          <text key={i} y={244 + i * 42} fontSize="29" fill="#46544c">
            {line}
          </text>
        ))}
        <path d="M0 418 H464" stroke="#dfe4da" />
        <text y="462" fontSize="20" fill="#68746b">
          Intake valve
        </text>
        <text x="464" y="462" textAnchor="end" fontSize="22" fill="#20352e">
          {p.intakeLift > 0.01 ? 'Open' : 'Closed'}
        </text>
        <text y="512" fontSize="20" fill="#68746b">
          Exhaust valve
        </text>
        <text x="464" y="512" textAnchor="end" fontSize="22" fill="#20352e">
          {p.exhaustLift > 0.01 ? 'Open' : 'Closed'}
        </text>
        <text y="604" fontSize="18" fill="#68746b">
          ONE CYCLE / TWO TURNS
        </text>
        <text x="464" y="604" textAnchor="end" fontSize="30" fill="#20352e">
          {Math.round(degrees)}°
        </text>
      </g>
      {film.strokes.map((stroke, i) => (
        <g key={stroke.name} transform={`translate(${64 + i * 452} 954)`}>
          <rect width="430" height="3" rx="1.5" fill="#dfe4da" />
          <rect
            width={430 * Math.max(0, Math.min(1, (degrees - i * 180) / 180))}
            height="3"
            fill={['#39798a', '#8a7639', '#ae603b', '#657281'][i]}
          />
          <text y="42" fontSize="21" fill={p.phase === i ? '#20352e' : '#68746b'}>
            {String(i + 1).padStart(2, '0')} / {stroke.name}
          </text>
        </g>
      ))}
      <text x="64" y="1042" fontSize="16" fill="#68746b">
        Recorded Muse artwork & script · Soma motion & material finish · prepared Mac voice
      </text>
      <text x="1856" y="1042" textAnchor="end" fontSize="16" fill="#68746b">
        Idealized mechanics
      </text>
    </svg>
  );
}
