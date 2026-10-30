import { randomBytes, randomUUID } from 'node:crypto';
import { getServerFirestore } from './firebase-config';
import { reserveInference, settleInference, inferenceEnabled } from './budget';
import { explorationStore, revalidateExplorationPrincipal } from './exploration-store';
import { verifyWorkerAccount } from './account';
import type { TrustedWorker } from './worker-auth';
import { ExplorationError, type ExplorationPrincipal } from './exploration-types';
import { VoiceTranscriptionError } from './voice-transcribe';

export type VoiceTicket = {
  id: string;
  principal: Omit<ExplorationPrincipal, 'account'>;
  lease: string;
  expiresMs: number;
  state: 'issued' | 'active' | 'done' | 'cancelled';
  expiresAt: Date;
};
export type VoiceTicketStore = {
  create: (record: VoiceTicket) => Promise<void>;
  read: (id: string) => Promise<VoiceTicket | null>;
  transition: (
    id: string,
    from: VoiceTicket['state'][],
    to: VoiceTicket['state'],
  ) => Promise<VoiceTicket>;
};
const managed: VoiceTicketStore = {
  async create(record) {
    await getServerFirestore()
      .doc('somaVoiceStreams/' + record.id)
      .create(record);
  },
  async read(id) {
    const s = await getServerFirestore()
      .doc('somaVoiceStreams/' + id)
      .get();
    return s.exists ? (s.data() as VoiceTicket) : null;
  },
  async transition(id, from, to) {
    const db = getServerFirestore(),
      ref = db.doc('somaVoiceStreams/' + id);
    return db.runTransaction(async (tx) => {
      const s = await tx.get(ref),
        v = s.data() as VoiceTicket | undefined;
      if (!v || v.expiresMs <= Date.now() || !from.includes(v.state))
        throw new ExplorationError('cancelled');
      const next = { ...v, state: to };
      tx.update(ref, { state: to });
      return next;
    });
  },
};
export function createVoiceSessions(
  overrides: Partial<{
    tickets: VoiceTicketStore;
    live: typeof revalidateExplorationPrincipal;
    store: typeof explorationStore;
    reserve: (key: string) => Promise<string>;
    settle: typeof settleInference;
    enabled: () => boolean;
    url: () => string | undefined;
    account: typeof verifyWorkerAccount;
  }> = {},
) {
  const d = {
    tickets: managed,
    live: revalidateExplorationPrincipal,
    store: explorationStore,
    reserve: (key: string) => reserveInference(key, 'voice'),
    settle: settleInference,
    enabled: () => inferenceEnabled() && process.env.SOMA_PERSISTENCE === 'firestore',
    url: () => process.env.SOMA_VOICE_STREAM_URL,
    account: verifyWorkerAccount,
    ...overrides,
  };
  const live = async (p: ExplorationPrincipal) => {
    await d.live(p);
    if (!(await d.store.read(p))) throw new ExplorationError('session_expired');
  };
  async function principal(t: VoiceTicket, cap: TrustedWorker) {
    const p = t.principal;
    if (p.kind === 'guest') return p as ExplorationPrincipal;
    const account = await d.account(cap, p.id, p.workspaceId);
    if (!account) throw new ExplorationError('account_required');
    return { ...p, account };
  }
  return {
    async start(p: ExplorationPrincipal) {
      const url = d.url();
      if (!d.enabled() || !url || new URL(url).protocol !== 'wss:')
        throw new VoiceTranscriptionError('unavailable');
      await live(p);
      const lease = randomUUID();
      let acquired = false,
        reservation: string | undefined,
        issued = false;
      try {
        await d.store.mutate(p, () => {}, { acquire: lease });
        acquired = true;
        reservation = await d.reserve(p.key);
        await live(p);
        const { account: _, ...owner } = p,
          id = randomBytes(32).toString('hex');
        await d.tickets.create({
          id,
          principal: owner,
          lease,
          state: 'issued',
          expiresMs: Date.now() + 60000,
          expiresAt: new Date(Date.now() + 86400000),
        });
        issued = true;
        // Conservative allowance, not claimed provider billing. Never refund a
        // streamed call on a client-supplied duration or a lost callback.
        await d.settle(reservation, 0.01, true);
        await live(p);
        return {
          ticket: id,
          url,
          provider: 'meta',
          model: 'muse-voice-transcribe-1.0',
          maximumSeconds: 30,
        };
      } finally {
        if (!issued) {
          if (reservation) await d.settle(reservation, 0, true).catch(() => {});
          if (acquired) await d.store.mutate(p, () => {}, { release: lease }).catch(() => {});
        }
      }
    },
    async relay(id: string, action: 'claim' | 'complete' | 'cancel', cap: TrustedWorker) {
      const t = await d.tickets.read(id);
      if (!t || t.expiresMs <= Date.now()) throw new ExplorationError('cancelled');
      const p = await principal(t, cap);
      await live(p);
      if (action === 'claim') {
        await d.tickets.transition(id, ['issued'], 'active');
        await live(p);
        return { ready: true };
      }
      await d.tickets.transition(
        id,
        ['issued', 'active'],
        action === 'complete' ? 'done' : 'cancelled',
      );
      await d.store.mutate(p, () => {}, { release: t.lease });
      await live(p);
      return { ready: true };
    },
    async cancel(p: ExplorationPrincipal, id: string) {
      const t = await d.tickets.read(id);
      if (!t || t.principal.key !== p.key) throw new ExplorationError('forbidden');
      await d.tickets.transition(id, ['issued', 'active'], 'cancelled');
      await d.store.mutate(p, () => {}, { release: t.lease });
      return { cancelled: true };
    },
  };
}
export const voiceSessions = createVoiceSessions();
