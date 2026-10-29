import {describe,expect,it} from 'vitest';
import {canonicalPiazzaCourseUrl,filterPiazzaFall2026,isAllowedPiazzaRequest,normalizePiazzaCatalog,parsePiazzaCourseUrl,parsePiazzaRenderedCourseUrl,PIAZZA_CATALOG_BATCH_LIMIT,PiazzaCatalogError} from '../../src/lib/domain/piazza-navigation';
const origin='https://piazza.com';
const request=(url:string)=>({url,method:'GET',resourceType:'document',topLevel:true});
const candidate=(id:string,title='Synthetic Algorithms',term:string|undefined='Fall 2026')=>({url:`${origin}/class/${id}`,title,term});
describe('Piazza exact browser navigation boundaries',()=>{
 it('permits only the root catalog document and selected class documents in their respective modes',()=>{
  expect(isAllowedPiazzaRequest(request(origin+'/'),[],'catalog')).toBe(true);
  expect(isAllowedPiazzaRequest(request(origin+'/class/synthetic_1'),['synthetic_1'],'catalog')).toBe(false);
  expect(isAllowedPiazzaRequest(request(origin+'/class/synthetic_1'),['synthetic_1'],'collect')).toBe(true);
  expect(isAllowedPiazzaRequest(request(origin+'/class/synthetic_1/'),['synthetic_1'],'collect')).toBe(true);
  expect(isAllowedPiazzaRequest(request(origin+'/class/synthetic_2'),['synthetic_1'],'collect')).toBe(false);
  expect(isAllowedPiazzaRequest(request(origin+'/'),['synthetic_1'],'collect')).toBe(false);
 });
 it.each(['POST','HEAD','PUT','DELETE','PATCH','OPTIONS'])('denies %s requests, including allowlisted scripts',method=>{
  expect(isAllowedPiazzaRequest({...request(origin+'/'),method},[],'catalog')).toBe(false);
  expect(isAllowedPiazzaRequest({...request(origin+'/static/synthetic.js'),method,resourceType:'script',topLevel:false},[],'catalog',['/static/synthetic.js'])).toBe(false);
 });
 it.each(['fetch','xhr','websocket','image','stylesheet','font','other'])('blocks %s even on catalog and selected document paths',resourceType=>{
  expect(isAllowedPiazzaRequest({...request(origin+'/'),resourceType},[],'catalog')).toBe(false);
  expect(isAllowedPiazzaRequest({...request(origin+'/class/synthetic_1'),resourceType},['synthetic_1'],'collect')).toBe(false);
 });
 it('blocks frames and script top-level navigation',()=>{
  expect(isAllowedPiazzaRequest({...request(origin+'/'),topLevel:false},[],'catalog')).toBe(false);
  expect(isAllowedPiazzaRequest({...request(origin+'/static/synthetic.js'),resourceType:'script'},[],'catalog',['/static/synthetic.js'])).toBe(false);
 });
 it('permits only exact first-party scripts explicitly inventoried by application code',()=>{
  const script={...request(origin+'/javascripts/synthetic-shell.v1.js'),resourceType:'script',topLevel:false};
  expect(isAllowedPiazzaRequest(script,[],'catalog')).toBe(false);
  expect(isAllowedPiazzaRequest(script,[],'catalog',['/javascripts/synthetic-shell.v1.js'])).toBe(true);
  expect(isAllowedPiazzaRequest({...script,url:origin+'/javascripts/synthetic-shell.v2.js'},[],'catalog',['/javascripts/synthetic-shell.v1.js'])).toBe(false);
  expect(isAllowedPiazzaRequest({...script,url:'https://cdn.example/javascripts/synthetic-shell.v1.js'},[],'catalog',['/javascripts/synthetic-shell.v1.js'])).toBe(false);
 });
 it('permits an exact inventoried webpack tilde filename without widening script scope',()=>{
  const path='/packs/js/runtime~qa-synthetic-bundle.js';
  const script={...request(origin+path),resourceType:'script',topLevel:false};
  expect(isAllowedPiazzaRequest(script,[],'catalog',[path])).toBe(true);
  expect(isAllowedPiazzaRequest({...script,url:origin+'/packs/js/vendors~qa-other.js'},[],'catalog',[path])).toBe(false);
 });
 it.each(['/javascripts/*.js','https://piazza.com/static/synthetic.js','//piazza.com/static/synthetic.js','/static/../static/synthetic.js','/static/synthetic.js?v=1','/static/synthetic.js#x','/static/%73ynthetic.js','/static/synthetic.mjs'])('rejects unsupported script inventory entries: %s',entry=>{
  expect(isAllowedPiazzaRequest({...request(origin+'/static/synthetic.js'),resourceType:'script',topLevel:false},[],'catalog',[entry])).toBe(false);
 });
 it.each([
  'http://piazza.com/class/synthetic_1','https://www.piazza.com/class/synthetic_1','https://piazza.com.evil.example/class/synthetic_1',
  'https://user:password@piazza.com/class/synthetic_1','https://piazza.com:8443/class/synthetic_1',
  origin+'/class/synthetic_1?cid=22',origin+'/class/synthetic_1?',origin+'/class/synthetic_1#post',origin+'/class/synthetic_1#',
  origin+'/unused/../class/synthetic_1',origin+'/class/./synthetic_1',origin+'/class/%73ynthetic_1',
  origin+'/class/synthetic_1%2fposts',origin+'/class/synthetic_1%5cposts',origin+'/class/synthetic_1/posts',
  origin+'/class/synthetic_1/logout',origin+'/class\\synthetic_1',' '+origin+'/class/synthetic_1',
  origin+'/class/synthetic_1\n',origin+'/class/'+'a'.repeat(161),
 ])('rejects unsafe or unsupported class URLs: %s',url=>{
  expect(parsePiazzaCourseUrl(url)).toBeNull();
  expect(isAllowedPiazzaRequest(request(url),['synthetic_1'],'collect')).toBe(false);
 });
 it('blocks query-bearing scripts even when their path is inventoried',()=>{
  expect(isAllowedPiazzaRequest({...request(origin+'/static/synthetic.js?v=1'),resourceType:'script',topLevel:false},[],'catalog',['/static/synthetic.js'])).toBe(false);
 });
 it('canonicalizes a reviewed course identity without allowing path or term inference',()=>{
  expect(parsePiazzaCourseUrl('https://piazza.com:443/class/Synthetic_1-/')).toEqual({id:'Synthetic_1-',url:origin+'/class/Synthetic_1-'});
  expect(canonicalPiazzaCourseUrl('Synthetic_1-')).toBe(origin+'/class/Synthetic_1-');
  expect(()=>canonicalPiazzaCourseUrl('../unsafe')).toThrow(PiazzaCatalogError);
 });
 it.each(['?','#','?#'])('accepts only an empty rendered history suffix %s while keeping network/configured targets strict',suffix=>{
  const rendered=origin+'/class/synthetic_1'+suffix;
  expect(parsePiazzaRenderedCourseUrl(rendered)).toEqual({id:'synthetic_1',url:origin+'/class/synthetic_1'});
  expect(parsePiazzaCourseUrl(rendered)).toBeNull();
  expect(isAllowedPiazzaRequest(request(rendered),['synthetic_1'],'collect')).toBe(false);
 });
 it.each([
  '?cid=42','#post','?cid=42#','?#post','??','##','#?',
 ])('rejects rendered URL suffixes carrying post/query content: %s',suffix=>{
  expect(parsePiazzaRenderedCourseUrl(origin+'/class/synthetic_1'+suffix)).toBeNull();
 });
 it.each([
  'https://evil.example/class/synthetic_1?','https://user:secret@piazza.com/class/synthetic_1?',
  origin+'/unsafe/../class/synthetic_1?',origin+'/class/%73ynthetic_1?',origin+'/class/synthetic_1%3f',
 ])('retains all origin/credential/path guards for rendered URLs: %s',raw=>{
  expect(parsePiazzaRenderedCourseUrl(raw)).toBeNull();
 });
});
describe('Piazza catalog metadata normalization',()=>{
 it('deduplicates identical identities and keeps equal names on distinct identities',()=>{
  const rows=normalizePiazzaCatalog([candidate('synthetic_1','  Synthetic   Algorithms '),candidate('synthetic_1'),candidate('synthetic_2')]);
  expect(rows.map(row=>row.id)).toEqual(['synthetic_1','synthetic_2']);expect(rows[0].title).toBe('Synthetic Algorithms');
 });
 it.each([
  {rows:[candidate('synthetic_1'),candidate('synthetic_1','Different')]},
  {rows:[candidate('synthetic_1'),candidate('synthetic_1','Synthetic Algorithms','Fall 2025')]},
  {rows:[candidate('synthetic_1'),{url:origin+'/class/synthetic_1',title:'Synthetic Algorithms'}]},
 ])('rejects conflicting metadata for a stable class identity',({rows})=>{
  try{normalizePiazzaCatalog(rows);throw new Error('Expected conflict');}
  catch(error){expect(error).toBeInstanceOf(PiazzaCatalogError);expect((error as PiazzaCatalogError).code).toBe('conflict');}
 });
 it.each([
  {url:origin+'/class/synthetic_1',title:''},{url:origin+'/class/synthetic_1',title:'x'.repeat(301)},
  {url:origin+'/class/synthetic_1',title:'Course\u0000name'},{url:origin+'/class/synthetic_1',title:'Course',term:'x'.repeat(161)},
  {url:origin+'/class/synthetic_1',title:'Course',term:'Fall\n2026'},{url:origin+'/class/synthetic_1?cid=22',title:'Course'},
 ])('rejects invalid metadata rows',row=>expect(()=>normalizePiazzaCatalog([row])).toThrow(PiazzaCatalogError));
 it('accepts full course loads and fails explicitly above the bounded batch limit',()=>{
  const rows=Array.from({length:PIAZZA_CATALOG_BATCH_LIMIT},(_,index)=>candidate('synthetic_'+index));
  expect(normalizePiazzaCatalog(rows)).toHaveLength(PIAZZA_CATALOG_BATCH_LIMIT);
  try{normalizePiazzaCatalog([...rows,candidate('overflow')]);throw new Error('Expected overflow');}
  catch(error){expect(error).toBeInstanceOf(PiazzaCatalogError);expect((error as PiazzaCatalogError).code).toBe('overflow');}
 });
 it('filters Fall 2026 only from separate explicit term metadata',()=>{
  const rows=normalizePiazzaCatalog([
   candidate('current','Synthetic Algorithms',' Fall   2026 '),candidate('old','Fall 2026 Biology','Fall 2025'),
   {url:origin+'/class/unknown',title:'Fall 2026 Physics'},candidate('second','Synthetic Chemistry','fall 2026'),
   candidate('ambiguous','Synthetic Design','Fall 2026 (archived)'),
  ]);
  expect(filterPiazzaFall2026(rows).map(row=>row.id)).toEqual(['current','second']);
 });
});
