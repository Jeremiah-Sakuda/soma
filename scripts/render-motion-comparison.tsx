import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { MotionScene } from '../docs/examples/pm120/lib/MotionScene';
import { validateFilm } from '../docs/examples/pm120/lib/motion-film';
export async function renderMotionComparison() {
  const film = validateFilm(JSON.parse(readFileSync('docs/examples/pm120/film.json', 'utf8'))), folder = resolve('.local/pm120/render'), output = resolve('docs/examples/pm120/public');
  mkdirSync(folder, { recursive: true }); mkdirSync(`${folder}/frames`, { recursive: true });
  const run = (bin: string, args: string[]) => {
    const r = spawnSync(bin, args, { encoding: 'utf8', timeout: 90000, maxBuffer: 2_000_000 });
    if (r.error || r.status !== 0) throw Error(`${bin} failed: ${r.error?.message ?? r.stderr.slice(-800)}`);
    return r.stdout;
  };
  const chapters: { at: number; text: string; rawDuration: number; paddedDuration: number }[] = [];
  for (const [i, chapter] of film.chapters.entries()) {
    const duration = (film.chapters[i + 1]?.at ?? film.duration) - chapter.at, aiff = `${folder}/voice-${i}.aiff`, wav = `${folder}/voice-${i}.wav`;
    run('/usr/bin/say', ['-v', 'Samantha', '-r', '145', '-o', aiff, chapter.narration]);
    const rawDuration = Number(run('/opt/homebrew/bin/ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', aiff]).trim());
    if (!Number.isFinite(rawDuration) || rawDuration > duration - .1) throw Error(`Narration exceeds chapter ${chapter.id}; retain complete speech and revise timing before rendering.`);
    run('/opt/homebrew/bin/ffmpeg', ['-nostdin', '-y', '-loglevel', 'error', '-i', aiff, '-af', 'apad', '-t', String(duration), '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
    chapters.push({ at: chapter.at, text: chapter.narration, rawDuration, paddedDuration: duration });
  }
  const list = `${folder}/voice-list.txt`; writeFileSync(list, film.chapters.map((_, i) => `file '${(`${folder}/voice-${i}.wav`).replaceAll("'", "'\\''")}'`).join('\n')+'\n');
  run('/opt/homebrew/bin/ffmpeg', ['-nostdin', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'copy', `${output}/narration.wav`]);
  const fps = 30, count = film.duration * fps;
  for (let frame = 0; frame < count; frame++) {
    const svg = renderToStaticMarkup(<MotionScene film={film} time={frame / fps} captions />);
    await sharp(Buffer.from(svg)).resize(film.width, film.height).png().toFile(`${folder}/frames/${String(frame).padStart(5, '0')}.png`);
  }
  run('/opt/homebrew/bin/ffmpeg', ['-nostdin', '-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${folder}/frames/%05d.png`, '-i', `${output}/narration.wav`, '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-t', String(film.duration), `${output}/piston-film.mp4`]);
  const probe = JSON.parse(run('/opt/homebrew/bin/ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', `${output}/piston-film.mp4`]));
  delete probe.format.filename;
  const receipt = { renderer: 'Same React/SVG MotionScene, rasterized with sharp and encoded locally with FFmpeg; no video model', voice: 'macOS Samantha, prepared locally; Muse authored the script', filmSha256: createHash('sha256').update(JSON.stringify(film)).digest('hex'), videoSha256: createHash('sha256').update(readFileSync(`${output}/piston-film.mp4`)).digest('hex'), fps, frameCount: count, duration: film.duration, chapters, probe };
  writeFileSync('docs/examples/pm120/render-receipt.json', JSON.stringify(receipt, null, 2)+'\n');
  return receipt;
}
