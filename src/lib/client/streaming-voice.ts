'use client';
export type StreamingVoice = { stop: () => void; cancel: () => void };
/** Relay tickets are one-use/short-lived; provider credentials never enter this client. */
export async function startStreamingVoice(
  stream: MediaStream,
  options: {
    signal: AbortSignal;
    partial: (text: string) => void;
    phase: (state: 'recording' | 'transcribing') => void;
    final: (text: string) => void;
    error: () => void;
  },
): Promise<StreamingVoice | null> {
  if (!window.AudioWorkletNode) return null;
  const r = await fetch('/api/explore/transcribe/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'start' }),
    signal: options.signal,
  });
  if (!r.ok) return null;
  const t = await r.json();
  if (
    typeof t.ticket !== 'string' ||
    !/^[a-f0-9]{64}$/.test(t.ticket) ||
    typeof t.url !== 'string' ||
    new URL(t.url).protocol !== 'wss:'
  )
    throw Error('Streaming unavailable.');
  let socket: WebSocket | undefined,
    audio: AudioContext | undefined,
    node: AudioWorkletNode | undefined,
    source: MediaStreamAudioSourceNode | undefined,
    closed = false,
    ending = false,
    ready = false;
  let rejectHandshake: (reason: unknown) => void = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined,
    flushTimer: ReturnType<typeof setTimeout> | undefined;
  const cancelTicket = () =>
    void fetch('/api/explore/transcribe/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', ticket: t.ticket }),
      keepalive: true,
    }).catch(() => {});
  const cleanup = (cancelled: boolean) => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    clearTimeout(flushTimer);
    options.signal.removeEventListener('abort', cancel);
    source?.disconnect();
    node?.disconnect();
    if (audio) void audio.close().catch(() => {});
    for (const track of stream.getTracks()) track.stop();
    socket?.close();
    if (cancelled) {
      rejectHandshake(new DOMException('Cancelled', 'AbortError'));
      cancelTicket();
    }
  };
  const cancel = () => cleanup(true),
    fail = () => {
      if (closed) return;
      cleanup(true);
      options.error();
    };
  options.signal.addEventListener('abort', cancel, { once: true });
  try {
    if (options.signal.aborted) {
      cancel();
      throw new DOMException('Cancelled', 'AbortError');
    }
    audio = new AudioContext({ sampleRate: 24000 });
    if (audio.sampleRate !== 24000) throw Error('Unsupported microphone sample rate.');
    await audio.audioWorklet.addModule('/voice-pcm-worklet.js');
    if (closed) throw Error('Cancelled');
    socket = new WebSocket(t.url);
    socket.binaryType = 'arraybuffer';
    const connected = new Promise<void>((resolve, reject) => {
      rejectHandshake = reject;
      timer = setTimeout(() => {
        reject(Error('Streaming handshake timed out.'));
        fail();
      }, 15000);
      socket!.onopen = () => socket!.send(JSON.stringify({ ticket: t.ticket }));
      socket!.onerror = () => {
        reject(Error('Streaming connection failed.'));
        fail();
      };
      socket!.onclose = () => {
        if (!closed) {
          reject(Error('Streaming closed.'));
          fail();
        }
      };
      socket!.onmessage = (e) => {
        try {
          if (closed || typeof e.data !== 'string' || e.data.length > 4096) return;
          const v = JSON.parse(e.data);
          if (v.type === 'ready' && !ready) {
            ready = true;
            clearTimeout(timer);
            resolve();
          } else if (
            v.type === 'partial' &&
            typeof v.transcript === 'string' &&
            v.transcript.length <= 2000
          )
            options.partial(v.transcript);
          else if (
            v.type === 'final' &&
            typeof v.transcript === 'string' &&
            v.transcript.trim() &&
            v.transcript.length <= 2000
          ) {
            const text = v.transcript.trim();
            cleanup(false);
            options.final(text);
          } else if (v.type === 'error') {
            reject(Error('Streaming unavailable.'));
            fail();
          }
        } catch {
          fail();
        }
      };
    });
    await connected;
    if (closed) throw Error('Cancelled');
    node = new AudioWorkletNode(audio, 'soma-pcm');
    node.port.onmessage = (e) => {
      if (closed) return;
      if (e.data?.type === 'pcm' && e.data.bytes instanceof ArrayBuffer) {
        if (socket?.readyState !== WebSocket.OPEN || socket.bufferedAmount > 256 * 1024)
          return fail();
        socket.send(e.data.bytes);
      } else if (e.data?.type === 'flushed' && ending) {
        clearTimeout(flushTimer);
        socket?.send(JSON.stringify({ type: 'end' }));
        source?.disconnect();
        for (const track of stream.getTracks()) track.stop();
      }
    };
    source = audio.createMediaStreamSource(stream);
    source.connect(node);
    node.connect(audio.destination);
    await audio.resume();
    options.phase('recording');
    timer = setTimeout(() => control.stop(), 30000);
    const control: StreamingVoice = {
      cancel,
      stop: () => {
        if (closed || ending) return;
        ending = true;
        clearTimeout(timer);
        options.phase('transcribing');
        node!.port.postMessage('flush');
        flushTimer = setTimeout(fail, 2000);
        timer = setTimeout(fail, 15000);
      },
    };
    return control;
  } catch (error) {
    cleanup(true);
    throw error;
  }
}
