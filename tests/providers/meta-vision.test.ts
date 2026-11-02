import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {requestMetaVisionResponse,visionRequestUpperBoundUsd,type MetaVisionRequest} from '../../src/lib/server/meta-vision';
import {parseMetaResponse,MetaClientError,META_MAX_RESPONSE_BYTES} from '../../src/lib/server/meta-client';
import {parseScreenshotDataUrl} from '../../src/lib/server/image-source';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0uoAAAAASUVORK5CYII=';
const tool={type:'function',name:'inspect_source',description:'Inspect original image.',parameters:{type:'object',properties:{},additionalProperties:false},strict:true};
const request=(overrides:Partial<MetaVisionRequest>={}):MetaVisionRequest=>({instructions:'Interpret only selected original example.',input:[{role:'user',content:[{type:'input_text',text:'What does this show?'},{type:'input_image',image_url:png}]}],tools:[tool],deadlineMs:1000,...overrides});
const call=(args='{}')=>({type:'function_call',name:'inspect_source',call_id:'original_call',arguments:args,status:'completed'});
const payload=(args='{}')=>({status:'completed',output:[{type:'reasoning',encrypted_content:'PRIVATE'},{type:'message',content:[{type:'output_text',text:'PRIVATE'}]},call(args)],usage:{input_tokens:200,output_tokens:70}});
beforeEach(()=>{vi.stubEnv('MODEL_API_KEY','original-synthetic-key');vi.stubEnv('META_API_BASE_URL','https://api.meta.ai/v1');vi.stubEnv('META_MODEL_ID','muse-spark-1.3');});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('bounded transient screenshot and vision profile',()=>{
 it('accepts canonical PNG metadata without changing the image and rejects fetchable/ambiguous input',()=>{
  expect(parseScreenshotDataUrl(png)).toMatchObject({width:1,height:1,mimeType:'image/png'});
  for(const value of ['https://example.com/private.png',png+'\n',png.replace('image/png','image/svg+xml'),'data:image/png;base64,AAAA',png.replace('base64,','charset=utf8;base64,')])expect(()=>parseScreenshotDataUrl(value)).toThrow();
  const bytes=Buffer.from(png.split(',')[1],'base64');bytes.writeUInt32BE(1601,16);expect(()=>parseScreenshotDataUrl('data:image/png;base64,'+bytes.toString('base64'))).toThrow();
 });
 it('sends the selected image to fixed Spark endpoint, disabling storage and hiding model text/reasoning',async()=>{
  const fetcher=vi.fn(async()=>new Response(JSON.stringify(payload())));vi.stubGlobal('fetch',fetcher);
  const result=await requestMetaVisionResponse(request());const [url,options]=fetcher.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toBe('https://api.meta.ai/v1/responses');expect(options.redirect).toBe('error');
  expect(JSON.parse(String(options.body))).toMatchObject({model:'muse-spark-1.3',store:false,parallel_tool_calls:false,max_output_tokens:4096,input:[{role:'user',content:[{type:'input_text'},{type:'input_image',image_url:png}]}]});
  expect(JSON.stringify(result)).not.toContain('PRIVATE');expect(visionRequestUpperBoundUsd(request())).toBeLessThan(.04);
 });
 it('rejects unsafe replay, external images, oversized tools and duplicate tool calls before a request',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  const invalid=[request({input:[{role:'user',content:[{type:'input_image',image_url:'https://private.example/image'}]}]}),request({input:[{type:'function_call_output',call_id:'orphan',output:'{}'}]}),request({tools:[{...tool,parameters:{type:'string'}}]}),request({instructions:'x'.repeat(16_001)}),request({input:[call(),{type:'function_call_output',call_id:'original_call',output:'{}'},call(),{type:'function_call_output',call_id:'original_call',output:'{}'}]})];
  for(const value of invalid)await expect(requestMetaVisionResponse(value)).rejects.toMatchObject({requestSent:false});expect(fetcher).not.toHaveBeenCalled();
 });
 it('allows bounded scene arguments only in vision profile while preserving text limits',()=>{
  const args=JSON.stringify({caption:'x'.repeat(9000)});expect(parseMetaResponse(payload(args),['inspect_source'],true,'vision').tools[0].parsedArguments).toHaveProperty('caption');expect(()=>parseMetaResponse(payload(args),['inspect_source'])).toThrow(MetaClientError);
  expect(()=>parseMetaResponse(payload(JSON.stringify({caption:'x'.repeat(25000)})),['inspect_source'],true,'vision')).toThrow();
 });
 it('retains unknown billing facts and never leaks provider failures',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:{message:'PRIVATE'},usage:{input_tokens:1,output_tokens:2}}),{status:429})));
  await expect(requestMetaVisionResponse(request())).rejects.toMatchObject({code:'http',requestSent:true,usage:{input_tokens:1,output_tokens:2}});
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({...payload(),usage:undefined}))));await expect(requestMetaVisionResponse(request())).rejects.toMatchObject({code:'usage_unavailable',requestSent:true,usage:null});
 });
 it('cancels outstanding calls and bounds dishonest streaming output',async()=>{
  const controller=new AbortController();vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(()=>{})));const pending=requestMetaVisionResponse(request({signal:controller.signal}));controller.abort();await expect(pending).rejects.toMatchObject({code:'timeout',requestSent:true});
  let cancelled=false;vi.stubGlobal('fetch',vi.fn(async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(META_MAX_RESPONSE_BYTES+1));},cancel(){cancelled=true;}}))));await expect(requestMetaVisionResponse(request())).rejects.toMatchObject({code:'response_limit',requestSent:true});expect(cancelled).toBe(true);
 });
});

it('decodes schema-constrained scene data without offering or fabricating a function call',async()=>{
 const fetcher=vi.fn(async(_url:unknown,_init?:RequestInit)=>new Response(JSON.stringify({status:'completed',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'{"spec":{"title":"Original synthetic scene"}}'}]}],usage:{input_tokens:100,output_tokens:40}})));
 vi.stubGlobal('fetch',fetcher);const reply=await requestMetaVisionResponse(request({tools:[],structuredOutput:{name:'scene',schema:{type:'object',properties:{spec:{type:'object'}},required:['spec'],additionalProperties:false}}}));
 expect(reply.tools).toEqual([]);expect(reply.structured).toEqual({spec:{title:'Original synthetic scene'}});const sent=JSON.parse(String(fetcher.mock.calls[0][1]?.body));expect(sent.tools).toEqual([]);expect(sent.text.format).toMatchObject({type:'json_schema',strict:true});
});


it('bounds the explicit mechanism output profile while preserving ordinary vision defaults', async () => {
  vi.stubEnv('MODEL_API_KEY', 'synthetic-test-key');
  const fetcher = vi.fn(async () => new Response(JSON.stringify(payload()))); vi.stubGlobal('fetch', fetcher);
  await requestMetaVisionResponse(request({ maxOutputTokens: 6144, reasoningEffort: 'minimal' }));
  expect(JSON.parse(String((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toMatchObject({ max_output_tokens: 6144, reasoning: { effort: 'minimal' } });
  // A whole 3D model may use up to 16k; beyond that is refused before any request.
  await expect(requestMetaVisionResponse(request({ maxOutputTokens: 16_385 }))).rejects.toMatchObject({ code: 'request_invalid', requestSent: false });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
