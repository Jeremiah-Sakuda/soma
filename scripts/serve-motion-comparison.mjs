import http from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
const root = resolve('.local/pm120/viewer/dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8' };
http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname), file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
    const info = await stat(file); if (!info.isFile()) throw Error('Not a file');
    const headers = { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", 'Accept-Ranges': 'bytes' };
    if (req.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range), start = Number(match?.[1]), end = match?.[2] ? Number(match[2]) : info.size - 1;
      if (!match || start >= info.size || end < start || end >= info.size) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); return res.end(); }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${info.size}`, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') return res.end(); createReadStream(file, { start, end }).pipe(res); return;
    }
    res.writeHead(200, { ...headers, 'Content-Length': info.size });
    if (req.method === 'HEAD') return res.end(); createReadStream(file).pipe(res);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(41912, '127.0.0.1', () => console.log('Soma motion comparison: http://localhost:41912'));
