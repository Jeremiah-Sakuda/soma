/** Reviewed Piazza browser boundaries. Discovery never implies selected-source permission. */
export type PiazzaRequest={url:string;method:string;resourceType:string;topLevel:boolean};
export type PiazzaCatalogCandidate={url:string;title:string;term?:string};
export type PiazzaCatalogCourse={id:string;url:string;title:string;term?:string};
export const PIAZZA_CATALOG_BATCH_LIMIT=1000;
const ORIGIN='https://piazza.com';
const identifier=/^[A-Za-z0-9_-]{1,160}$/;
export class PiazzaCatalogError extends Error{
 constructor(public readonly code:'invalid'|'conflict'|'overflow'){
  super(code==='overflow'?'Piazza course-list batch exceeds the read limit. Continue with a smaller verified batch.':'Piazza returned invalid or conflicting course metadata.');
 }
}
function safeUrl(raw:string):URL|null{
 if(typeof raw!=='string'||raw.length>2048||/[\u0000-\u0020\u007f\\%?#]/.test(raw)
  ||!/^https:\/\/piazza\.com(?::443)?\//.test(raw)||/(?:^|\/)\.{1,2}(?:\/|$)/.test(raw))return null;
 try{const url=new URL(raw);return url.origin===ORIGIN&&!url.username&&!url.password&&!url.search&&!url.hash&&(!url.port||url.port==='443')?url:null;}
 catch{return null;}
}
export function canonicalPiazzaCourseUrl(id:string):string{
 if(!identifier.test(id))throw new PiazzaCatalogError('invalid');
 return `${ORIGIN}/class/${id}`;
}
export function parsePiazzaCourseUrl(raw:string):{id:string;url:string}|null{
 const url=safeUrl(raw),match=url&&/^\/class\/([A-Za-z0-9_-]{1,160})\/?$/.exec(url.pathname);
 return match?{id:match[1],url:canonicalPiazzaCourseUrl(match[1])}:null;
}
function scriptPath(raw:string):boolean{
 return typeof raw==='string'&&raw.length<=2048&&/^\/[A-Za-z0-9_./-]+\.js$/.test(raw)
  &&!raw.includes('//')&&!/(?:^|\/)\.{1,2}(?:\/|$)/.test(raw);
}
/** The script list must be an application-authored inventory observed on the initial shell,
 * never model output or user-supplied permissions. Its default is empty. */
export function isAllowedPiazzaRequest(request:PiazzaRequest,classIds:readonly string[],mode:'catalog'|'collect',observedScriptPaths:readonly string[]=[]):boolean{
 if(request.method!=='GET')return false;
 const url=safeUrl(request.url);if(!url)return false;
 if(request.resourceType==='script')return !request.topLevel&&observedScriptPaths.length<=100
  &&scriptPath(url.pathname)&&observedScriptPaths.some(path=>scriptPath(path)&&path===url.pathname);
 if(request.resourceType!=='document'||!request.topLevel)return false;
 if(mode==='catalog')return url.pathname==='/';
 const course=parsePiazzaCourseUrl(request.url);
 return Boolean(course&&classIds.includes(course.id));
}
function text(value:unknown,maximum:number,required=false):string|undefined{
 if(value===undefined&&!required)return undefined;
 if(typeof value!=='string'||/[\u0000-\u001f\u007f]/.test(value))throw new PiazzaCatalogError('invalid');
 const normalized=value.trim().replace(/\s+/g,' ');
 if((required&&!normalized)||normalized.length>maximum)throw new PiazzaCatalogError('invalid');
 return normalized||undefined;
}
/** Complete normalization of one bounded batch. Overflow and conflicting identities fail explicitly. */
export function normalizePiazzaCatalog(candidates:readonly PiazzaCatalogCandidate[]):PiazzaCatalogCourse[]{
 if(!Array.isArray(candidates))throw new PiazzaCatalogError('invalid');
 if(candidates.length>PIAZZA_CATALOG_BATCH_LIMIT)throw new PiazzaCatalogError('overflow');
 const courses=new Map<string,PiazzaCatalogCourse>();
 for(const candidate of candidates){
  if(!candidate||typeof candidate!=='object')throw new PiazzaCatalogError('invalid');
  const parsed=parsePiazzaCourseUrl(candidate.url);if(!parsed)throw new PiazzaCatalogError('invalid');
  const title=text(candidate.title,300,true)!,term=text(candidate.term,160);
  const next:PiazzaCatalogCourse={...parsed,title,...(term?{term}:{})},previous=courses.get(next.id);
  if(previous&&(previous.title!==next.title||previous.term!==next.term))throw new PiazzaCatalogError('conflict');
  courses.set(next.id,next);
 }
 return [...courses.values()];
}
/** Semester membership requires separately extracted explicit term metadata. */
export function filterPiazzaFall2026(courses:readonly PiazzaCatalogCourse[]):PiazzaCatalogCourse[]{
 return courses.filter(course=>typeof course.term==='string'&&/^fall\s+2026$/i.test(course.term.trim()));
}
