import { expect, it } from 'vitest';
import { createDemoMaterialStore } from '../fixtures/demo-material/isolated-store';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';
const principal = (letter: string): ExplorationPrincipal => ({
  kind: 'guest', id: letter.repeat(64), workspaceId: letter.repeat(64),
  generation: letter.repeat(64), key: `guest-${letter.repeat(64)}`,
});
it('bounds isolated rehearsal to two owned guests and four turns without restarting admission on cleanup', async () => {
  const store = createDemoMaterialStore(), a = principal('a'), b = principal('b');
  await store.mutate(a, () => {}, {create:true});
  await store.mutate(b, () => {}, {create:true});
  await expect(store.mutate(principal('c'), () => {}, {create:true})).rejects.toMatchObject({code:'capacity'});
  for (let i = 0; i < 4; i++) {
    const p = i < 2 ? a : b;
    await store.mutate(p, s => { s.activeRequestId = `turn-${i}`; }, {acquire:`turn-${i}`});
    await expect(store.mutate(p === a ? b : a, () => {}, {acquire:'parallel'})).rejects.toMatchObject({code:i===3?'capacity':'busy'});
    await store.mutate(p, s => { s.activeRequestId = null; }, {release:`turn-${i}`});
  }
  const before = await store.read(a);
  await expect(store.mutate(a, s => { s.activeRequestId = 'fifth'; }, {acquire:'fifth'})).rejects.toMatchObject({code:'capacity'});
  expect(await store.read(a)).toEqual(before);
});
it('clones reads and atomically rejects foreign ownership and failed mutations', async () => {
  const store = createDemoMaterialStore(), p = principal('a');
  await store.mutate(p, () => {}, {create:true});
  const original = await store.read(p), detached = await store.read(p);
  detached!.owner = 'outside';
  expect(await store.read(p)).toEqual(original);
  await expect(store.mutate(p, s => { s.owner = 'outside'; })).rejects.toMatchObject({code:'forbidden'});
  await expect(store.mutate(p, s => { s.activeRequestId = 'no'; throw Error('rejected'); }, {acquire:'no'})).rejects.toThrow('rejected');
  expect(await store.read(p)).toEqual(original);
  await expect(store.read({...p, workspaceId:'outside'})).rejects.toMatchObject({code:'forbidden'});
  await store.mutate(p, () => {}, {acquire:'valid'});
});
