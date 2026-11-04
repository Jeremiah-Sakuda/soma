import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { META_ENDPOINT, META_MAX_OUTPUT_TOKENS, META_MAX_RESPONSE_BYTES, MetaClientError, parseMetaResponse, requestMetaResponse, type MetaRequest } from '../../src/lib/server/meta-client';

const tool = { type: 'function', name: 'read_source', description: 'Read one scoped source.', parameters: { type: 'object', properties: { sourceId: { type: 'string' } }, required: ['sourceId'], additionalProperties: false }, strict: true };
const request = (changes: Partial<MetaRequest> = {}): MetaRequest => ({ instructions: 'Read only an authorized source.', input: [{ role: 'user', content: 'Original synthetic course request' }], tools: [tool], deadlineMs: 1000, ...changes });
const call = { type: 'function_call', id: 'fc_fixture', name: 'read_source', call_id: 'call_fixture', arguments: '{"sourceId":"original-source"}', status: 'completed' };
const usage = { input_tokens: 123, output_tokens: 45 };
const payload = (changes: Record<string, unknown> = {}) => ({ status: 'completed', output: [call], usage, ...changes });
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

async function failure(operation: Promise<unknown>): Promise<MetaClientError> {
  try { await operation; throw new Error('Expected client rejection'); }
  catch (error) { expect(error).toBeInstanceOf(MetaClientError); return error as MetaClientError; }
}

describe('bounded Meta Responses boundary', () => {
  beforeEach(() => { vi.stubEnv('MODEL_API_KEY', 'original-fixture-key'); vi.stubEnv('META_API_BASE_URL', 'https://api.meta.ai/v1'); vi.stubEnv('META_MODEL_ID', 'muse-spark-1.3'); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('sends only the fixed model/endpoint, disables storage and returns tools without provider text/reasoning', async () => {
    const fetcher = vi.fn(async () => response(payload({ output: [{ type: 'reasoning', encrypted_content: 'fixture-private-reasoning' }, { type: 'message', content: [{ type: 'output_text', text: 'fixture-private-message' }] }, call] })));
    vi.stubGlobal('fetch', fetcher);
    const result = await requestMetaResponse(request());
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(META_ENDPOINT); expect(options.redirect).toBe('error');
    const sent = JSON.parse(options.body as string);
    expect(sent).toMatchObject({ model: 'muse-spark-1.3', store: false, stream: false, background: false, parallel_tool_calls: false, max_output_tokens: META_MAX_OUTPUT_TOKENS });
    expect(sent).not.toHaveProperty('previous_response_id');
    expect(result.tools[0].parsedArguments).toEqual({ sourceId: 'original-source' });
    expect(result.usage).toEqual(usage);
    expect(JSON.stringify(result)).not.toContain('fixture-private');
  });

  it('rejects endpoint redirection, built-in tools, reasoning replay and orphaned tool results before sending', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('META_API_BASE_URL', 'https://untrusted.example');
    expect(await failure(requestMetaResponse(request()))).toMatchObject({ code: 'configuration', requestSent: false, usage: null });
    vi.stubEnv('META_API_BASE_URL', 'https://api.meta.ai/v1');
    for (const invalid of [request({ tools: [{ type: 'web_search' }] }), request({ input: [{ type: 'reasoning', encrypted_content: 'fixture' }] }), request({ input: [{ type: 'function_call_output', call_id: 'orphan', output: '{}' }] })]) {
      expect(await failure(requestMetaResponse(invalid))).toMatchObject({ code: 'request_invalid', requestSent: false });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('enforces serialized UTF-8 byte limits before a billable call', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const error = await failure(requestMetaResponse(request({ input: [{ role: 'user', content: '界'.repeat(8100) }] })));
    expect(error).toMatchObject({ code: 'request_limit', usage: null, requestSent: false });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('accepts correlated tool replay but rejects repeated call identities', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(payload())));
    const replay = { type: 'function_call', name: 'read_source', arguments: '{"sourceId":"first"}', call_id: 'prior' };
    const answer = { type: 'function_call_output', call_id: 'prior', output: '{"body":"Original synthetic content"}' };
    expect((await requestMetaResponse(request({ input: [replay, answer] }))).status).toBe('completed');
    expect(await failure(requestMetaResponse(request({ input: [replay, answer, replay, answer] })))).toMatchObject({ code: 'request_invalid', requestSent: false });
  });

  it('returns usage from incomplete output without exposing or executing truncated arguments', () => {
    expect(parseMetaResponse(payload({ status: 'incomplete', output: [{ ...call, arguments: '{"sourceId":' }] }), ['read_source'])).toEqual({ status: 'incomplete', tools: [], usage });
  });

  it.each([
    { output: [{ ...call, name: 'send_email' }] },
    { output: [{ ...call, arguments: '[]' }] },
    { output: [{ ...call, arguments: '{"__proto__":{"admin":true}}' }] },
    { output: [call, { ...call, call_id: 'second' }] },
    { output: [{ ...call, status: 'in_progress' }] },
  ])('preserves trustworthy billing when a completed tool decision is unsafe (%j)', async changes => {
    vi.stubGlobal('fetch', vi.fn(async () => response(payload(changes))));
    expect(await failure(requestMetaResponse(request()))).toMatchObject({ code: 'tool_invalid', usage, requestSent: true });
  });

  it('distinguishes unknown usage from malformed completion with reported usage', async () => {
    for (const invalid of [undefined, { input_tokens: -1, output_tokens: 10 }, { input_tokens: 12, output_tokens: '10' }]) {
      vi.stubGlobal('fetch', vi.fn(async () => response(payload({ usage: invalid }))));
      expect(await failure(requestMetaResponse(request()))).toMatchObject({ code: 'usage_unavailable', usage: null, requestSent: true });
    }
    vi.stubGlobal('fetch', vi.fn(async () => response(payload({ status: 'untrusted-status-containing-private-text' }))));
    const error = await failure(requestMetaResponse(request()));
    expect(error).toMatchObject({ code: 'response_invalid', usage });
    expect(error.message).not.toContain('private-text');
  });

  it('never exposes provider error details and preserves any valid error-response usage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ error: { message: 'PRIVATE fixture key and source text' }, usage }, 429)));
    const error = await failure(requestMetaResponse(request()));
    expect(error).toMatchObject({ code: 'http', httpStatus: 429, usage, requestSent: true });
    expect(JSON.stringify(error)).not.toContain('PRIVATE');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('PRIVATE fixture network details'); }));
    expect(await failure(requestMetaResponse(request()))).toMatchObject({ code: 'network', usage: null, requestSent: true });
  });

  it.each([401, 503])('retains HTTP %s when the bounded error body is not JSON, without leaking its text or retrying', async status => {
    const fetcher = vi.fn(async () => new Response('<html>PRIVATE provider error and source context</html>', { status }));
    vi.stubGlobal('fetch', fetcher);
    const error = await failure(requestMetaResponse(request()));
    expect(error).toMatchObject({ code: 'http', httpStatus: status, usage: null, requestSent: true });
    expect(`${error.message}${JSON.stringify(error)}`).not.toContain('PRIVATE');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retains the HTTP status without weakening the error-body size bound', async () => {
    let cancelled = false;
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(META_MAX_RESPONSE_BYTES + 1)); },
      cancel() { cancelled = true; },
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(stream, { status: 502 })));
    expect(await failure(requestMetaResponse(request()))).toMatchObject({ code: 'response_limit', httpStatus: 502, usage: null, requestSent: true });
    expect(cancelled).toBe(true);
  });

  it('accepts only sanitized HTTP-status metadata and does not infer status from a body', async () => {
    for (const value of [0, 99, 600, 503.5, NaN, '503' as unknown as number])
      expect(new MetaClientError('http', null, true, value).httpStatus).toBeUndefined();
    expect(new MetaClientError('http', null, true, 503).httpStatus).toBe(503);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('503 PRIVATE malformed successful response')));
    const error = await failure(requestMetaResponse(request()));
    expect(error).toMatchObject({ code: 'response_invalid', usage: null, requestSent: true });
    expect(error.httpStatus).toBeUndefined();
  });

  it('bounds streamed bodies even with absent or dishonest Content-Length', async () => {
    let cancelled = false;
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(META_MAX_RESPONSE_BYTES)); controller.enqueue(new Uint8Array(1)); }, cancel() { cancelled = true; } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(stream, { headers: { 'content-length': '1' } })));
    expect(await failure(requestMetaResponse(request()))).toMatchObject({ code: 'response_limit', usage: null, requestSent: true });
    expect(cancelled).toBe(true);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{invalid-json')));
    expect(await failure(requestMetaResponse(request()))).toMatchObject({ code: 'response_invalid', usage: null });
  });

  it('enforces the deadline through stalled bodies and distinguishes pre-request cancellation', async () => {
    let cancelled = false;
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); }, cancel() { cancelled = true; } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(stream)));
    expect(await failure(requestMetaResponse(request({ deadlineMs: 15 })))).toMatchObject({ code: 'timeout', usage: null, requestSent: true });
    expect(cancelled).toBe(true);
    const controller = new AbortController(); controller.abort('private abort reason');
    expect(await failure(requestMetaResponse(request({ signal: controller.signal })))).toMatchObject({ code: 'timeout', requestSent: false });
  });
});

it('accepts schema-constrained JSON data without inventing a tool call, only when explicitly requested', async () => {
  vi.stubEnv('MODEL_API_KEY','synthetic-key');vi.stubEnv('META_API_BASE_URL','https://api.meta.ai/v1');vi.stubEnv('META_MODEL_ID','muse-spark-1.3');
  const raw=payload({output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'{"verdict":"approve","findings":[]}'}]}]});
  const fetcher=vi.fn(async(_url:unknown,_init?:RequestInit)=>response(raw));vi.stubGlobal('fetch',fetcher);
  const plain=await requestMetaResponse(request());expect(plain).not.toHaveProperty('structured');expect(plain.tools).toEqual([]);
  const format={name:'review',schema:{type:'object',properties:{verdict:{type:'string'},findings:{type:'array',items:{type:'string'}}},required:['verdict','findings'],additionalProperties:false}};
  const structured=await requestMetaResponse(request({structuredOutput:format}));expect(structured.tools).toEqual([]);expect(structured.structured).toEqual({verdict:'approve',findings:[]});
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).text.format).toMatchObject({type:'json_schema',strict:true,name:'review'});
  const fallback=await requestMetaResponse(request({jsonFallback:true}));expect(fallback.structured).toEqual({verdict:'approve',findings:[]});expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body))).not.toHaveProperty('text');

});

it('rejects prose or ambiguous messages in structured mode while retaining known billing', async () => {
  vi.stubEnv('MODEL_API_KEY','synthetic-key');vi.stubEnv('META_API_BASE_URL','https://api.meta.ai/v1');vi.stubEnv('META_MODEL_ID','muse-spark-1.3');
  const message={type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'Looks good to me.'}]};
  vi.stubGlobal('fetch',vi.fn(async()=>response(payload({output:[message]}))));
  await expect(requestMetaResponse(request({structuredOutput:{name:'review',schema:{type:'object'}}}))).rejects.toMatchObject({code:'response_invalid',usage,requestSent:true});
});

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
