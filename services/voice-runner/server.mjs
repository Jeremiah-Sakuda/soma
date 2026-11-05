import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
/** No credentials in client tickets, no audio/transcript logs, no arbitrary destinations. */
export function createVoiceRunner({
  claim,
  complete,
  providerKey,
  origins,
  connect = (url) => new WebSocket(url),
  maximum = 4,
}) {
  const peers = new Set(),
    wss = new WebSocketServer({
      noServer: true,
      maxPayload: 128 * 1024,
      perMessageDeflate: false,
    });
  const server = http.createServer((req, res) => {
    res.writeHead(req.url === '/health' ? 200 : 404, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({ ready: req.url === '/health' }));
  });
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/stream' || !origins.includes(req.headers.origin) || peers.size >= maximum) {
      socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  });
  wss.on('connection', (client) => {
    peers.add(client);
    let upstream = null,
      ticket = null,
      ready = false,
      ended = false,
      finished = false,
      total = 0,
      connecting = false;
    const send = (v) => {
      if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(v));
    };
    const initial = setTimeout(() => void finish(false), 3000),
      limit = setTimeout(() => void finish(false), 45000);
    async function finish(success, transcript) {
      if (finished) return;
      finished = true;
      clearTimeout(initial);
      clearTimeout(limit);
      upstream?.close();
      try {
        if (ticket) await complete(ticket, success ? 'complete' : 'cancel');
        if (
          success &&
          typeof transcript === 'string' &&
          transcript.trim() &&
          transcript.length <= 2000
        )
          send({ type: 'final', transcript: transcript.trim() });
        else send({ type: 'error', message: 'Streaming stopped. Record again or type.' });
      } catch {
        send({ type: 'error', message: 'This voice session could not be confirmed.' });
      } finally {
        client.close();
        peers.delete(client);
      }
    }
    client.on('message', async (data, binary) => {
      try {
        if (finished) return;
        if (!ticket) {
          if (binary || data.length > 2048 || connecting) throw Error();
          const v = JSON.parse(data.toString());
          if (
            !v ||
            Object.keys(v).length !== 1 ||
            typeof v.ticket !== 'string' ||
            !/^[a-f0-9]{64}$/.test(v.ticket)
          )
            throw Error();
          connecting = true;
          await claim(v.ticket);
          if (finished) {
            await complete(v.ticket, 'cancel').catch(() => {});
            return;
          }
          ticket = v.ticket;
          clearTimeout(initial);
          upstream = connect('wss://api.meta.ai/v1/asr/realtime');
          upstream.on('open', () => {
            if (finished) return upstream.close();
            upstream.send(
              JSON.stringify({
                authorization: { accessToken: 'Bearer ' + providerKey },
                audioEncoding: 'PCM_24KHZ',
                model: 'muse-voice-transcribe-1.0',
                mode: 'PUSH_TO_TALK',
                partialMode: 'CUMULATIVE',
                emitAudioProgress: false,
              }),
            );
          });
          upstream.on('message', (raw, isBinary) => {
            try {
              if (finished || isBinary || raw.length > 32768) return;
              const e = JSON.parse(raw.toString());
              if (!ready && typeof e.sessionId === 'string') {
                ready = true;
                send({ type: 'ready' });
              } else if (e.type === 'error') void finish(false);
              else if (
                e.type === 'transcript' &&
                typeof e.transcript === 'string' &&
                e.transcript.length <= 2000
              ) {
                if (e.final === true) {
                  if (!ended) return void finish(false);
                  void finish(true, e.transcript);
                } else send({ type: 'partial', transcript: e.transcript });
              }
            } catch {
              void finish(false);
            }
          });
          upstream.on('error', () => void finish(false));
          upstream.on('close', () => {
            if (!finished) void finish(false);
          });
          return;
        }
        if (!ready) throw Error();
        if (binary) {
          if (ended || data.length % 2) throw Error();
          total += data.length;
          if (total > 30 * 24000 * 2) throw Error();
          if (upstream.bufferedAmount > 256 * 1024) throw Error();
          upstream.send(data);
        } else {
          if (data.length > 100) throw Error();
          const v = JSON.parse(data.toString());
          if (v.type === 'end' && !ended) {
            ended = true;
            upstream.send(JSON.stringify({ type: 'endStream' }));
          } else throw Error();
        }
      } catch {
        void finish(false);
      }
    });
    client.on('close', () => void finish(false));
    client.on('error', () => void finish(false));
  });
  return {
    server,
    close: async () => {
      for (const p of peers) p.close();
      wss.close();
      await new Promise((r) => server.close(r));
    },
  };
}
