import { describe, expect, it } from 'vitest';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { accountRecordChanges, decodeAccountRecords, encodeAccountRecords } from '../../src/lib/server/account-store';

describe('stable semester record ordering',()=>{
  const fixture=()=>{const state=seedWorkspace('original-order-fixture');state.mode='account';state.lessons=Array.from({length:1000},(_,index)=>({...state.lessons[0],id:`lesson-${index}`}));return state;};
  it('prepends and appends without rewriting retained rows, including after a decoded read',()=>{
    const original=fixture(),before=encodeAccountRecords(original),next=structuredClone(original);
    next.lessons.unshift({...next.lessons[0],id:'new-prepend'});
    const after=encodeAccountRecords(next,before);
    expect(accountRecordChanges(before,after)).toHaveLength(1);
    const loaded=decodeAccountRecords(JSON.parse(JSON.stringify(after)));
    expect(loaded.lessons.map(item=>item.id)).toEqual(next.lessons.map(item=>item.id));
    const appended=structuredClone(loaded);appended.lessons.push({...appended.lessons[0],id:'new-append'});
    const final=encodeAccountRecords(appended,encodeAccountRecords(loaded));
    expect(accountRecordChanges(after,final)).toHaveLength(1);
    expect(decodeAccountRecords(final).lessons.map(item=>item.id)).toEqual(appended.lessons.map(item=>item.id));
  });
  it('moves one retained row without rewriting a thousand neighbors',()=>{
    const original=fixture(),before=encodeAccountRecords(original),next=structuredClone(original);
    next.lessons.unshift(next.lessons.pop()!);
    const after=encodeAccountRecords(next,before);
    expect(accountRecordChanges(before,after)).toHaveLength(1);
    expect(decodeAccountRecords(after).lessons.map(item=>item.id)).toEqual(next.lessons.map(item=>item.id));
  });
  // This is a 200-step correctness stress case, not a five-second performance SLA.
  it('retains exact order through repeated middle insertions beyond floating-point precision',()=>{
    let state=fixture();state.lessons=state.lessons.slice(0,2);let saved=encodeAccountRecords(state);
    for(let i=0;i<200;i++){
      state=decodeAccountRecords(JSON.parse(JSON.stringify(saved)));
      state.lessons.splice(1,0,{...state.lessons[0],id:`middle-${i}`});
      const next=encodeAccountRecords(state,saved);
      expect(accountRecordChanges(saved,next)).toHaveLength(1);
      expect(decodeAccountRecords(next).lessons.map(item=>item.id)).toEqual(state.lessons.map(item=>item.id));saved=next;
    }
  },15_000);
});
