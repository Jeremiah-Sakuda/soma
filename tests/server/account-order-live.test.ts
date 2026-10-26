import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getAuth } from 'firebase-admin/auth';
import { describe, expect, it, vi } from 'vitest';
import { getServerApp, getServerFirestore } from '../../src/lib/server/firebase-config';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { verifyWorkerRequest } from '../../src/lib/server/worker-auth';
import { verifyWorkerAccount } from '../../src/lib/server/account';
import { encodeAccountRecords, readAccountWorkspace, updateAccountWorkspace } from '../../src/lib/server/account-store';
const enabled=process.env.SOMA_LIVE_ACCOUNT_ORDER_TEST==='true',child=process.env.SOMA_ORDER_CHILD==='true';
async function account(rootId:string,workspaceId:string){
  const capability=verifyWorkerRequest(new Request('https://soma.example/api/internal/worker',{headers:{authorization:`Bearer ${process.env.SOMA_WORKER_SECRET}`}}));
  const verified=await verifyWorkerAccount(capability,rootId,workspaceId);if(!verified)throw new Error('Original fixture account unavailable.');return verified;
}
describe.skipIf(!enabled)('real Firestore semester history ordering',()=>{
  it.skipIf(child)('keeps 1,000 retained lessons unchanged across prepends, append, move and a fresh process',async()=>{
    if(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Requires real Firebase.');
    const db=getServerFirestore(),user=await getAuth(getServerApp()).createUser({email:`soma-order-${randomUUID()}@example.invalid`});
    const rootId=createHash('sha256').update(user.uid).digest('hex'),root=db.collection('somaAccounts').doc(rootId);
    const secret=randomBytes(32).toString('hex');vi.stubEnv('SOMA_WORKER_ENABLED','true');vi.stubEnv('SOMA_WORKER_SECRET',secret);
    try{
      const state=seedWorkspace(randomUUID());state.mode='account';state.lessons=Array.from({length:1000},(_,index)=>({...state.lessons[0],id:`semester-lesson-${index}`}));
      const encoded=encodeAccountRecords(state);
      // Seed as legacy integer/index-key records, in safe batches; app mutations stay atomic.
      const records=Object.entries(encoded.groups).flatMap(([group,{records}])=>Object.entries(records).map(([id,value],index)=>({ref:root.collection(group).doc(id),value:{...value,key:String(index),ownerId:user.uid,workspaceId:state.id}})));
      for(let offset=0;offset<records.length;offset+=400){const batch=db.batch();for(const row of records.slice(offset,offset+400))batch.set(row.ref,row.value);await batch.commit();}
      await root.set({ownerId:user.uid,workspaceId:state.id,revision:state.revision,summary:encoded.summary,groups:Object.fromEntries(Object.entries(encoded.groups).map(([key,value])=>[key,value.kind]))});
      const verified=await account(rootId,state.id),before=await root.collection('lessons').get();
      await updateAccountWorkspace(verified,current=>{current.lessons.unshift({...current.lessons[0],id:'semester-new-first'});return current;});
      const after=await root.collection('lessons').get();expect(after.size).toBe(1001);
      const stored=new Map(after.docs.map(item=>[item.id,item]));
      for(const row of before.docs)expect(stored.get(row.id)!.updateTime!.isEqual(row.updateTime!)).toBe(true);
      expect((await readAccountWorkspace(verified))!.lessons[0].id).toBe('semester-new-first');
      await updateAccountWorkspace(verified,current=>{current.lessons.push({...current.lessons[0],id:'semester-new-last'});return current;});
      await updateAccountWorkspace(verified,current=>{current.lessons.unshift(current.lessons.splice(501,1)[0]);return current;});
      const current=(await readAccountWorkspace(verified))!;
      expect(current.lessons).toHaveLength(1002);expect(current.lessons[0].id).toBe('semester-lesson-500');expect(current.lessons.at(-1)!.id).toBe('semester-new-last');
      // A separate Node/Vitest process reads persisted rational ranks with no in-memory snapshot.
      await promisify(execFile)(process.execPath,['node_modules/vitest/vitest.mjs','run','tests/server/account-order-live.test.ts'],{env:{...process.env,SOMA_ORDER_CHILD:'true',SOMA_ORDER_ROOT:rootId,SOMA_ORDER_WORKSPACE:state.id},timeout:60000,maxBuffer:1_000_000});
    }finally{await db.recursiveDelete(root);await getAuth(getServerApp()).deleteUser(user.uid);vi.unstubAllEnvs();}
  },150000);
  it.skipIf(!child)('reads and incrementally inserts using only the fresh process persisted snapshot',async()=>{
    const verified=await account(process.env.SOMA_ORDER_ROOT!,process.env.SOMA_ORDER_WORKSPACE!);
    const state=(await readAccountWorkspace(verified))!;
    expect(state.lessons).toHaveLength(1002);expect(state.lessons[0].id).toBe('semester-lesson-500');expect(state.lessons[1].id).toBe('semester-new-first');expect(state.lessons.at(-1)!.id).toBe('semester-new-last');
    const expected=state.lessons.map(item=>item.id);expected.splice(1,0,'fresh-process-middle');
    await updateAccountWorkspace(verified,current=>{current.lessons.splice(1,0,{...current.lessons[0],id:'fresh-process-middle'});return current;});
    expect((await readAccountWorkspace(verified))!.lessons.map(item=>item.id)).toEqual(expected);
  },60000);
});
