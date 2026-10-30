import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createVoiceSessions,
  type VoiceTicket,
  type VoiceTicketStore,
} from '../../src/lib/server/voice-session';
import { verifyVoiceRelayRequest, verifyWorkerRequest } from '../../src/lib/server/worker-auth';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';
const p = (c = 'a'): ExplorationPrincipal => ({
  kind: 'guest',
  id: c.repeat(64),
  workspaceId: c.repeat(64),
  generation: c.repeat(64),
  key: 'guest-' + c.repeat(64),
});
function harness() {
  const rows = new Map<string, VoiceTicket>();
  let deleted = false;
  const releases: string[] = [];
  const tickets: VoiceTicketStore = {
    create: async (r) => {
      rows.set(r.id, structuredClone(r));
    },
    read: async (id) => rows.get(id) ?? null,
    transition: async (id, from, to) => {
      const r = rows.get(id);
      if (!r || r.expiresMs <= Date.now() || !from.includes(r.state))
        throw Error('Invalid/replayed ticket');
      r.state = to;
      return structuredClone(r);
    },
  };
  const settle = vi.fn(async () => {}),
    reserve = vi.fn(async () => 'budget-reservation');
  const service = createVoiceSessions({
    tickets,
    enabled: () => true,
    url: () => 'wss://voice.soma.test/stream',
    reserve,
    settle,
    live: async () => {
      if (deleted) throw Error('Deleted owner');
    },
    store: {
      read: async () => (deleted ? null : ({} as any)),
      mutate: async (_p, _fn, o) => {
        if (o?.release) releases.push(o.release);
        return {} as any;
      },
    },
  });
  return {
    service,
    rows,
    releases,
    settle,
    reserve,
    remove: () => {
      deleted = true;
    },
  };
}
beforeEach(() => vi.stubEnv('SOMA_VOICE_CONTROL_KEY', 'v'.repeat(48)));
afterEach(() => vi.unstubAllEnvs());
const capability = () =>
  verifyVoiceRelayRequest(
    new Request('https://soma.test', {
      headers: { authorization: 'Bearer ' + 'v'.repeat(48) },
    }),
  );
it('creates one-use tickets with conservative spend fencing and no key/audio/secret session material', async () => {
  const h = harness(),
    t = await h.service.start(p());
  expect(t.url).toBe('wss://voice.soma.test/stream');
  expect(t.ticket).toMatch(/^[a-f0-9]{64}$/);
  expect(h.settle).toHaveBeenCalledWith('budget-reservation', 0.01, true);
  expect(JSON.stringify([...h.rows.values()])).not.toMatch(
    /accessToken|MODEL_API_KEY|audio|transcript|sessionCookie/,
  );
  await h.service.relay(t.ticket, 'claim', capability());
  await expect(h.service.relay(t.ticket, 'claim', capability())).rejects.toThrow();
  await h.service.relay(t.ticket, 'complete', capability());
  expect(h.releases).toHaveLength(1);
  await expect(h.service.relay(t.ticket, 'complete', capability())).rejects.toThrow();
});
it('a different guest cannot cancel a ticket or release its owner lease', async () => {
  const h = harness(),
    t = await h.service.start(p());
  await expect(h.service.cancel(p('b'), t.ticket)).rejects.toMatchObject({ code: 'forbidden' });
  expect(h.rows.get(t.ticket)?.state).toBe('issued');
  expect(h.releases).toEqual([]);
  await h.service.cancel(p(), t.ticket);
  expect(h.rows.get(t.ticket)?.state).toBe('cancelled');
});
it('deleted/expired source owners cannot claim or confirm a final transcript', async () => {
  const h = harness(),
    t = await h.service.start(p());
  await h.service.relay(t.ticket, 'claim', capability());
  h.remove();
  await expect(h.service.relay(t.ticket, 'complete', capability())).rejects.toThrow(
    'Deleted owner',
  );
  expect(h.rows.get(t.ticket)?.state).toBe('active');
});
it('expired or already cancelled grants fail before another provider session can be claimed', async () => {
  const h = harness(),
    t = await h.service.start(p());
  h.rows.get(t.ticket)!.expiresMs = Date.now() - 1;
  await expect(h.service.relay(t.ticket, 'claim', capability())).rejects.toMatchObject({
    code: 'cancelled',
  });
});
it('voice capabilities require their own secret and do not enable general worker access', () => {
  vi.stubEnv('SOMA_WORKER_ENABLED', 'true');
  vi.stubEnv('SOMA_WORKER_SECRET', 'w'.repeat(48));
  expect(() =>
    verifyVoiceRelayRequest(
      new Request('https://soma.test', {
        headers: { authorization: 'Bearer ' + 'w'.repeat(48) },
      }),
    ),
  ).toThrow();
  expect(() =>
    verifyWorkerRequest(
      new Request('https://soma.test', {
        headers: { authorization: 'Bearer ' + 'v'.repeat(48) },
      }),
    ),
  ).toThrow();
  expect(capability()).toBeDefined();
});
