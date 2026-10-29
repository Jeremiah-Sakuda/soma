import {createHash,randomBytes} from 'node:crypto';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {ACCOUNT_SESSION_COOKIE,verifyAccountSession,assertVerifiedAccount,revalidateBackgroundAccount} from './account';
import {readOrCreateAccountWorkspace} from './account-store';
import {getServerFirestore} from './firebase-config';
import {getPersistenceMode} from './store';
import {requireSameOrigin} from './http';
import {ExplorationError,type ExplorationPrincipal,type ExplorationSession,type ExplorationStore} from './exploration-types';

export const EXPLORATION_COOKIE='soma_explore';
const TTL=24*60*60*1000,MAX_BYTES=768*1024,MAX_GLOBAL_ACTIVE=4,MAX_GUESTS_DAY=200,MAX_TURNS_DAY=200;
const databases=new Map<string,DatabaseSync>();
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export const assertExplorationOrigin=requireSameOrigin;
function validatePrincipal(principal:ExplorationPrincipal){if(!principal||!['account','guest'].includes(principal.kind)||!/^[a-f0-9]{64}$/.test(principal.id)||principal.workspaceId!==principal.generation||!principal.generation||principal.generation.length>128||principal.key!==`${principal.kind}-${principal.id}${principal.kind==='account'?`-${principal.generation}`:''}`)throw new ExplorationError('forbidden');if(principal.kind==='account'){if(!principal.account)throw new ExplorationError('account_required');assertVerifiedAccount(principal.account);if(hash(principal.account.uid)!==principal.id)throw new ExplorationError('forbidden');}else if(principal.id!==principal.workspaceId)throw new ExplorationError('forbidden');}
export async function resolveExplorationPrincipal(request:Request,options:{createGuest?:boolean}={}):Promise<{principal:ExplorationPrincipal;setCookie?:string}>{
 const cookie=request.headers.get('cookie')??'',account=await verifyAccountSession(request);
 if(account){const workspace=await readOrCreateAccountWorkspace(account);const id=hash(account.uid);return{principal:{kind:'account',id,workspaceId:workspace.id,generation:workspace.id,key:`account-${id}-${workspace.id}`,account}};}
 if(cookie.split(';').some(value=>value.trim().startsWith(`${ACCOUNT_SESSION_COOKIE}=`)))throw new ExplorationError('account_required');
 const matches=cookie.split(';').map(value=>value.trim()).filter(value=>value.startsWith(`${EXPLORATION_COOKIE}=`));
 let token=matches.length===1?matches[0].slice(EXPLORATION_COOKIE.length+1):'';let setCookie:string|undefined;
 if(!/^[a-f0-9]{64}$/.test(token)){if(!options.createGuest)throw new ExplorationError('session_expired');token=randomBytes(32).toString('hex');setCookie=`${EXPLORATION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${process.env.NODE_ENV==='production'?'; Secure':''}`;}
 const id=hash(token);return{principal:{kind:'guest',id,workspaceId:id,generation:id,key:`guest-${id}`},...(setCookie?{setCookie}:{})};
}
export async function revalidateExplorationPrincipal(principal:ExplorationPrincipal):Promise<void>{validatePrincipal(principal);if(principal.kind==='account')await revalidateBackgroundAccount(principal.account!);}
function empty(principal:ExplorationPrincipal):ExplorationSession{const now=new Date();return{schemaVersion:1,owner:principal.id,workspaceId:principal.workspaceId,generation:principal.generation,createdAt:now.toISOString(),expiresAt:principal.kind==='account'?'2100-01-01T00:00:00.000Z':new Date(now.getTime()+TTL).toISOString(),revision:0,artifacts:[],runs:[],activeRequestId:null};}
function check(principal:ExplorationPrincipal,state:ExplorationSession|null){if(!state||Date.parse(state.expiresAt)<=Date.now())throw new ExplorationError('session_expired');if(state.owner!==principal.id||state.workspaceId!==principal.workspaceId||state.generation!==principal.generation)throw new ExplorationError('forbidden');}
function serialize(state:ExplorationSession){const payload=JSON.stringify(state);if(Buffer.byteLength(payload)>MAX_BYTES||state.artifacts.length>24||state.runs.length>40)throw new ExplorationError('capacity');return payload;}
type Limits={day:string;created:number;turns:number;active:{key:string;requestId:string;deadline:number}[]};
function limits(value:Partial<Limits>|undefined):Limits{const day=new Date().toISOString().slice(0,10),sameDay=value?.day===day;return{day,created:sameDay?Number(value?.created??0):0,turns:sameDay?Number(value?.turns??0):0,active:(value?.active??[]).filter(item=>item.deadline>Date.now())};}
function applyLimits(current:Limits,principal:ExplorationPrincipal,options:{create?:boolean;acquire?:string;release?:string},isNew:boolean){
 if(isNew&&principal.kind==='guest'){if(current.created>=MAX_GUESTS_DAY)throw new ExplorationError('capacity');current.created++;}
 if(options.release)current.active=current.active.filter(item=>item.key!==principal.key||item.requestId!==options.release);
 if(options.acquire){if(current.turns>=MAX_TURNS_DAY)throw new ExplorationError('capacity');if(current.active.length>=MAX_GLOBAL_ACTIVE)throw new ExplorationError('busy');current.turns++;current.active.push({key:principal.key,requestId:options.acquire,deadline:Date.now()+90_000});}
}
function db(){const path=resolve(/* turbopackIgnore: true */process.env.SOMA_EXPLORATION_DB_PATH||'.local/soma-explorations.sqlite');let result=databases.get(path);if(!result){mkdirSync(dirname(path),{recursive:true,mode:0o700});result=new DatabaseSync(path);chmodSync(path,0o600);result.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS exploration_sessions(key TEXT PRIMARY KEY,payload TEXT NOT NULL,expires_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS exploration_limits(day TEXT PRIMARY KEY,payload TEXT NOT NULL);');databases.set(path,result);}return result;}
export function closeExplorationStore(){for(const value of databases.values())value.close();databases.clear();}
export const explorationStore:ExplorationStore={
 async read(principal){
  validatePrincipal(principal);
  if(getPersistenceMode()==='firestore'){const fs=getServerFirestore();const root=principal.kind==='account'?fs.collection('somaAccounts').doc(principal.id):null;const ref=root?root.collection('explorations').doc('session'):fs.collection('somaExploreGuests').doc(principal.id);return fs.runTransaction(async tx=>{const parent=root?await tx.get(root):null;const snap=await tx.get(ref);if(root&&(!parent?.exists||parent.get('deleted')||parent.get('ownerId')!==principal.account?.uid||parent.get('workspaceId')!==principal.generation))throw new ExplorationError('forbidden');const state=(snap.get('state')??null) as ExplorationSession|null;if(!state||Date.parse(state.expiresAt)<=Date.now())return null;check(principal,state);return state;});}
  if(principal.kind==='account')throw new ExplorationError('unavailable');const row=db().prepare('SELECT payload FROM exploration_sessions WHERE key=? AND expires_at>?').get(principal.key,Date.now()) as{payload:string}|undefined;if(!row)return null;const state=JSON.parse(row.payload) as ExplorationSession;check(principal,state);return state;
 },
 async mutate(principal,change,options={}){
  await revalidateExplorationPrincipal(principal);const day='global';
  if(getPersistenceMode()==='firestore'){
   const fs=getServerFirestore(),root=principal.kind==='account'?fs.collection('somaAccounts').doc(principal.id):null,ref=root?root.collection('explorations').doc('session'):fs.collection('somaExploreGuests').doc(principal.id),quota=fs.collection('somaServiceLimits').doc('exploration-global');
   return fs.runTransaction(async tx=>{const parent=root?await tx.get(root):null;const snapshot=await tx.get(ref),quotaSnapshot=await tx.get(quota);if(root&&(!parent?.exists||parent.get('deleted')||parent.get('ownerId')!==principal.account?.uid||parent.get('workspaceId')!==principal.generation))throw new ExplorationError('forbidden');const previous=snapshot.get('state') as ExplorationSession|undefined;const expired=!previous||Date.parse(previous.expiresAt)<=Date.now();if(expired&&!options.create)throw new ExplorationError('session_expired');const state=expired?empty(principal):structuredClone(previous);check(principal,state);const quotaValue=limits(quotaSnapshot.data() as Partial<Limits>);applyLimits(quotaValue,principal,options,expired);change(state);state.revision++;serialize(state);tx.set(ref,{state,expiresAt:new Date(state.expiresAt)});tx.set(quota,{...quotaValue,expiresAt:new Date(Date.now()+48*60*60*1000)});return state;});
  }
  if(principal.kind==='account')throw new ExplorationError('unavailable');const database=db();database.exec('BEGIN IMMEDIATE');try{database.prepare('DELETE FROM exploration_sessions WHERE expires_at<=?').run(Date.now());const row=database.prepare('SELECT payload FROM exploration_sessions WHERE key=?').get(principal.key) as{payload:string}|undefined;const isNew=!row;if(isNew&&!options.create)throw new ExplorationError('session_expired');const state=row?JSON.parse(row.payload) as ExplorationSession:empty(principal);check(principal,state);const quotaRow=database.prepare('SELECT payload FROM exploration_limits WHERE day=?').get(day) as{payload:string}|undefined;const quota=limits(quotaRow?JSON.parse(quotaRow.payload):undefined);applyLimits(quota,principal,options,isNew);change(state);state.revision++;database.prepare('INSERT OR REPLACE INTO exploration_sessions VALUES(?,?,?)').run(principal.key,serialize(state),Date.parse(state.expiresAt));database.prepare('INSERT OR REPLACE INTO exploration_limits VALUES(?,?)').run(day,JSON.stringify(quota));database.exec('COMMIT');return state;}catch(error){database.exec('ROLLBACK');throw error;}
 }
};
/** One owned session record, direct child of account root: existing account
 * deletion enumerates it, and every write checks the root generation atomically.
 * Guest expiry is enforced in code even when managed TTL deletion is delayed. */
