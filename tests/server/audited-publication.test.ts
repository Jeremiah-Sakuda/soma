import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspace, closeLocalStore, readWorkspace, updateWorkspace, WorkspaceConflictError } from '../../src/lib/server/store';
import * as journal from '../../src/lib/server/audit-store';
import { runAuditedPublication, type PublicationOutcome } from '../../src/lib/server/audited-publication';
import type { WorkspaceAccess } from '../../src/lib/server/workspace-access';
import type { InvestigationResult } from '../../src/lib/server/investigator';
import { InferenceBudgetError } from '../../src/lib/server/budget';

const metadata = {kind:'lesson-preparation' as const, trigger:'Original lifecycle scenario', mode:'synthetic' as const};
describe('audited publication commit boundary', () => {
  let directory: string;
  beforeEach(() => {directory=mkdtempSync(join(tmpdir(),'soma-publication-'));vi.stubEnv('SOMA_LOCAL_DATABASE_PATH',join(directory,'store.sqlite'));vi.stubEnv('SOMA_PERSISTENCE','local-synthetic');});
  afterEach(() => {vi.restoreAllMocks();journal.closeLocalAuditStore();closeLocalStore();vi.unstubAllEnvs();rmSync(directory,{recursive:true,force:true});});
  async function fixture() {
    const {workspace:before,token}=await createWorkspace();
    const access:WorkspaceAccess={kind:'demo',token};
    const lesson={...before.lessons[0],id:'original-published-lesson'};
    const run={...before.runs[0],id:'original-published-run',status:'completed' as const};
    const outcome:Extract<PublicationOutcome,{kind:'lesson'}>={kind:'lesson',result:{lesson,run}};
    const execute=vi.fn(async(audit:journal.AuditWriter)=>{
      await audit.append({actor:'model',kind:'decision',summary:'Original synthetic purpose',rationale:'Original selected activity purpose',visibility:'protected'});
      return outcome;
    });
    const publish=vi.fn(async()=>updateWorkspace(token,state=>{state.lessons.unshift(lesson);state.runs.unshift(run);return state;},before.revision));
    const onFailure=vi.fn(async()=>{});
    return {before,access,metadata,token,outcome,execute,publish,onFailure};
  }
  it('publishes once, binds disclosure to the committed activity, and survives reopening storage',async()=>{
    const f=await fixture(),result=await runAuditedPublication(f);
    expect(result).toMatchObject({auditComplete:true,selectedLessonId:f.outcome.result.lesson.id});
    journal.closeLocalAuditStore();closeLocalStore();
    const current=(await readWorkspace(f.token))!,[run]=await journal.readAuditRuns(f.access,current);
    expect(current.revision).toBe(f.before.revision+1);expect(f.publish).toHaveBeenCalledTimes(1);
    expect(run).toMatchObject({status:'published',committedRevision:current.revision,selectedLessonId:f.outcome.result.lesson.id,publishedLessonId:f.outcome.result.lesson.id});
    expect(run.events.map(event=>event.kind)).toEqual(['decision','publication']);expect(run.events[0].protected).toBe(true);
    expect(f.onFailure).not.toHaveBeenCalled();
  });
  it('fails closed before execution when the journal cannot be created',async()=>{
    const f=await fixture(),error=new journal.AuditStoreError('Unavailable',503,'audit_storage_failed');
    vi.spyOn(journal,'createAuditRun').mockRejectedValue(error);
    await expect(runAuditedPublication(f)).rejects.toBe(error);
    expect(f.execute).not.toHaveBeenCalled();expect(f.publish).not.toHaveBeenCalled();expect(f.onFailure).toHaveBeenCalledWith(error);
  });
  it('retains the original failure and recovers the job even when terminal journaling fails',async()=>{
    const f=await fixture(),original=new Error('Original provider boundary');
    const create=journal.createAuditRun;
    vi.spyOn(journal,'createAuditRun').mockImplementation(async(...args)=>{const writer=await create(...args);return {...writer,finish:async()=>{throw new Error('Private cleanup details');}};});
    f.execute.mockRejectedValue(original);
    await expect(runAuditedPublication(f)).rejects.toBe(original);
    expect(f.onFailure).toHaveBeenCalledExactlyOnceWith(original);expect(f.publish).not.toHaveBeenCalled();
    expect(original).toHaveProperty('cleanupFailures',['journal']);expect(JSON.stringify(original)).not.toContain('Private');
    expect((await journal.readAuditRuns(f.access,f.before))[0].status).toBe('running');
  });
  it('does not call failure cleanup after a real commit when confirmation is unavailable',async()=>{
    const f=await fixture(),create=journal.createAuditRun;
    vi.spyOn(journal,'createAuditRun').mockImplementation(async(...args)=>{const writer=await create(...args);return {...writer,finish:async()=>{throw new journal.AuditStoreError('Unavailable',503,'audit_storage_failed');}};});
    const result=await runAuditedPublication(f);
    expect(result.auditComplete).toBe(false);expect((await readWorkspace(f.token))!.lessons[0].id).toBe(f.outcome.result.lesson.id);
    expect(f.publish).toHaveBeenCalledTimes(1);expect(f.onFailure).not.toHaveBeenCalled();
    expect((await journal.readAuditRuns(f.access,result.workspace))[0].status).toBe('running');
  });
  it('reports incomplete background confirmation without relabeling committed work or retrying inference',async()=>{
    const f=await fixture(),create=journal.createAuditRun;
    vi.spyOn(journal,'createAuditRun').mockImplementation(async(...args)=>{const writer=await create(...args);return {...writer,finish:async()=>{throw new journal.AuditStoreError('Unavailable',503,'audit_storage_failed');}};});
    await expect(runAuditedPublication({...f,confirmation:'require'})).rejects.toMatchObject({code:'audit_confirmation_failed'});
    expect((await readWorkspace(f.token))!.lessons[0].id).toBe(f.outcome.result.lesson.id);
    expect(f.publish).toHaveBeenCalledTimes(1);expect(f.execute).toHaveBeenCalledTimes(1);expect(f.onFailure).not.toHaveBeenCalled();
  });
  it('keeps revision races unpublished and does not mask a failed durable cleanup',async()=>{
    const f=await fixture(),original=new WorkspaceConflictError();
    f.publish.mockRejectedValue(original);f.onFailure.mockRejectedValue(new Error('Recovery unavailable'));
    await expect(runAuditedPublication(f)).rejects.toBe(original);
    expect((await readWorkspace(f.token))!.revision).toBe(f.before.revision);
    expect((await journal.readAuditRuns(f.access,f.before))[0]).toMatchObject({status:'failed'});
    expect(original).toHaveProperty('cleanupFailures',['durable-recovery']);
  });
  it('derives prepared, disabled and budget-blocked outcomes without changing failure into success',async()=>{
    for(const failure of [undefined,new Error('Validation stopped'),new InferenceBudgetError('global')]) {
      const f=await fixture();
      const result=await runAuditedPublication({...f,execute:async()=>({kind:'prepared' as const,failure})});
      const [run]=await journal.readAuditRuns(f.access,result.workspace);
      expect(run.status).toBe(failure instanceof InferenceBudgetError?'blocked':failure?'failed':'unchanged');
      expect(run.mode).toBe('prepared');expect(run.publishedLessonId).toBeUndefined();
    }
  });
  it('reopens a cached investigation without a second commit and keeps unpublished proposals protected',async()=>{
    const f=await fixture();
    const result={run:f.outcome.result.run,reused:true,protectUnpublishedActivity:true} as InvestigationResult;
    const saved=await runAuditedPublication({...f,reuse:'reopen',execute:async audit=>{await audit.append({actor:'model',kind:'proposal',summary:'Discarded question details',visibility:'protected'});return {kind:'investigation' as const,result};}});
    expect(saved.workspace).toEqual(f.before);expect(f.publish).not.toHaveBeenCalled();
    const [run]=await journal.readAuditRuns(f.access,f.before);
    expect(run).toMatchObject({status:'unchanged',mode:'prepared',committedRevision:f.before.revision,protectUnpublishedActivity:true});expect(run.events[0].protected).toBe(true);
  });
});
