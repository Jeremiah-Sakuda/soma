import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once, EventEmitter } from 'node:events';
import { WebSocket } from 'ws';
import { createVoiceRunner } from '../server.mjs';
const ticket = 'a'.repeat(64),
  origin = 'https://soma.test';
async function harness({ deny = false } = {}) {
  const calls = [],
    providers = [];
  let consumed = false;
  const r = createVoiceRunner({
    origins: [origin],
    providerKey: 'ORIGINAL-SYNTHETIC-NOT-A-KEY',
    claim: async (id) => {
      calls.push(['claim', id]);
      if (deny || consumed) throw Error();
      consumed = true;
    },
    complete: async (id, outcome) => calls.push([outcome, id]),
    connect: () => {
      const p = new EventEmitter();
      p.sent = [];
      p.bufferedAmount = 0;
      p.send = (x) => {
        p.sent.push(x);
        if (typeof x === 'string' && JSON.parse(x).authorization)
          setImmediate(() => p.emit('message', Buffer.from('{"sessionId":"synthetic"}'), false));
      };
      p.close = () => {};
      providers.push(p);
      setImmediate(() => p.emit('open'));
      return p;
    },
  });
  r.server.listen(0, '127.0.0.1');
  await once(r.server, 'listening');
  return { r, calls, providers, url: `ws://127.0.0.1:${r.server.address().port}/stream` };
}
const message = (ws) => once(ws, 'message').then(([v]) => JSON.parse(v.toString()));
test('one-use authorization precedes provider connection; partials stream and final requires end plus confirmed completion', async () => {
  const h = await harness();
  const ws = new WebSocket(h.url, { origin });
  try {
    await once(ws, 'open');
    const ready = message(ws);
    ws.send(JSON.stringify({ ticket }));
    assert.equal((await ready).type, 'ready');
    assert.equal(h.calls[0][0], 'claim');
    const p = h.providers[0];
    const partial = message(ws);
    p.emit(
      'message',
      Buffer.from('{"type":"transcript","transcript":"Why this edge","final":false}'),
      false,
    );
    assert.equal((await partial).transcript, 'Why this edge');
    ws.send(Buffer.alloc(1920));
    ws.send('{"type":"end"}');
    while (!p.sent.some((v) => typeof v === 'string' && v.includes('endStream')))
      await new Promise((r) => setTimeout(r, 5));
    const final = message(ws);
    p.emit(
      'message',
      Buffer.from('{"type":"transcript","transcript":"Why this edge?","final":true}'),
      false,
    );
    assert.equal((await final).type, 'final');
    assert.equal(h.calls.at(-1)[0], 'complete');
    const again = new WebSocket(h.url, { origin });
    await once(again, 'open');
    const rejected = message(again);
    again.send(JSON.stringify({ ticket }));
    assert.equal((await rejected).type, 'error');
    assert.equal(h.providers.length, 1);
    again.close();
  } finally {
    ws.close();
    await h.r.close();
  }
});
test('unauthorized tickets never open a provider connection', async () => {
  const h = await harness({ deny: true }),
    ws = new WebSocket(h.url, { origin });
  try {
    await once(ws, 'open');
    const rejected = message(ws);
    ws.send(JSON.stringify({ ticket }));
    assert.equal((await rejected).type, 'error');
    assert.equal(h.providers.length, 0);
  } finally {
    ws.close();
    await h.r.close();
  }
});
test('a final before explicit release fails closed', async () => {
  const h = await harness(),
    ws = new WebSocket(h.url, { origin });
  try {
    await once(ws, 'open');
    const ready = message(ws);
    ws.send(JSON.stringify({ ticket }));
    await ready;
    const rejected = message(ws);
    h.providers[0].emit(
      'message',
      Buffer.from('{"type":"transcript","transcript":"Unexpected early final","final":true}'),
      false,
    );
    assert.equal((await rejected).type, 'error');
    assert.equal(h.calls.at(-1)[0], 'cancel');
  } finally {
    ws.close();
    await h.r.close();
  }
});
