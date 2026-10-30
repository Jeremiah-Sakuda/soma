import {
  ExplorationError,
  type ExplorationPrincipal,
  type ExplorationSession,
  type ExplorationStore,
} from '../../../src/lib/server/exploration-types';

/** Test-only original synthetic state. Never imported by application routes.
 * Isolation changes persistence/admission, not the real provider or shared budget.
 * Exactly two guests and four sequential turns fit the DSA/speaker rehearsal.
 */
export function createDemoMaterialStore(): ExplorationStore {
  const sessions = new Map<string, ExplorationSession>();
  let turns = 0;
  let lease: { key: string; requestId: string; deadline: number } | null = null;
  function checkPrincipal(p: ExplorationPrincipal) {
    if (p.kind !== 'guest' || !/^[a-f0-9]{64}$/.test(p.id) ||
      p.workspaceId !== p.id || p.generation !== p.id || p.key !== `guest-${p.id}`)
      throw new ExplorationError('forbidden');
  }
  function owned(p: ExplorationPrincipal, s: ExplorationSession) {
    if (s.owner !== p.id || s.workspaceId !== p.workspaceId || s.generation !== p.generation)
      throw new ExplorationError('forbidden');
  }
  return {
    async read(p) {
      checkPrincipal(p);
      const state = sessions.get(p.key);
      if (!state || Date.parse(state.expiresAt) <= Date.now()) return null;
      owned(p, state);
      return structuredClone(state);
    },
    async mutate(p, change, options = {}) {
      checkPrincipal(p);
      const previous = sessions.get(p.key);
      if (previous && Date.parse(previous.expiresAt) <= Date.now())
        throw new ExplorationError('session_expired');
      if (!previous && !options.create) throw new ExplorationError('session_expired');
      if (!previous && sessions.size >= 2) throw new ExplorationError('capacity');
      const now = Date.now();
      const state: ExplorationSession = previous ? structuredClone(previous) : {
        schemaVersion: 1, owner: p.id, workspaceId: p.workspaceId, generation: p.generation,
        createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 3600000).toISOString(),
        revision: 0, artifacts: [], runs: [], activeRequestId: null,
      };
      owned(p, state);
      let nextLease = lease && lease.deadline > now ? lease : null;
      if (options.release && nextLease?.key === p.key && nextLease.requestId === options.release)
        nextLease = null;
      if (options.acquire) {
        if (turns >= 4) throw new ExplorationError('capacity');
        if (nextLease) throw new ExplorationError('busy');
        nextLease = { key: p.key, requestId: options.acquire, deadline: now + 90000 };
      }
      change(state);
      owned(p, state);
      state.revision++;
      if (state.artifacts.length > 24 || state.runs.length > 40 ||
        Buffer.byteLength(JSON.stringify(state)) > 768 * 1024)
        throw new ExplorationError('capacity');
      // No awaits before this atomic in-process commit. Failed mutations consume no slot.
      sessions.set(p.key, structuredClone(state));
      lease = nextLease;
      if (options.acquire) turns++;
      return structuredClone(state);
    },
  };
}
