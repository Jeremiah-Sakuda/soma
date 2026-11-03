import { z } from 'zod';

// Meta Responses contract verified against https://dev.meta.ai/docs/protocols/responses
// and https://dev.meta.ai/docs/tool-calling. Application tools execute elsewhere.
export const META_ENDPOINT = 'https://api.meta.ai/v1/responses';
export const META_MODEL = 'muse-spark-1.3';
export const META_REVIEW_MODEL = 'muse-wonder-1.0';
export type MetaModel = typeof META_MODEL | typeof META_REVIEW_MODEL;
export const META_MAX_REQUEST_BYTES = 24_000;
export const META_MAX_RESPONSE_BYTES = 131_072;
export const META_MAX_OUTPUT_TOKENS = 2048;
export type MetaUsage = { input_tokens: number; output_tokens: number };
export type MetaToolCall = { type: 'function_call'; name: string; arguments: string; call_id: string; parsedArguments: Record<string, unknown> };
export type MetaStatus = 'completed' | 'incomplete' | 'failed' | 'cancelled' | 'in_progress' | 'queued';
export type MetaResult = { status: MetaStatus; tools: MetaToolCall[]; usage: MetaUsage; structured?: Record<string, unknown> };
export type MetaErrorCode = 'configuration' | 'request_invalid' | 'request_limit' | 'timeout' | 'network' | 'http' | 'response_limit' | 'response_invalid' | 'usage_unavailable' | 'tool_invalid';
export class MetaClientError extends Error {
  constructor(public readonly code: MetaErrorCode, public readonly usage: MetaUsage | null = null, public readonly requestSent = false) {
    super(`Meta request stopped: ${code}.`); this.name = 'MetaClientError';
  }
}
const nameSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?$/);
const callIdSchema = z.string().min(1).max(256).regex(/^[A-Za-z0-9_.:-]+$/);
const toolDefinition = z.strictObject({ type: z.literal('function'), name: nameSchema, description: z.string().max(2000), parameters: z.record(z.string(), z.unknown()).refine(value => value.type === 'object'), strict: z.literal(true) });
const callInput = z.strictObject({ type: z.literal('function_call'), name: nameSchema, arguments: z.string().max(8000), call_id: callIdSchema });
const inputSchema = z.array(z.union([
  z.strictObject({ role: z.literal('user'), content: z.string().max(20_000) }),
  callInput,
  z.strictObject({ type: z.literal('function_call_output'), call_id: callIdSchema, output: z.string().max(20_000) }),
])).min(1).max(16);
const usageSchema = z.object({ input_tokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), output_tokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) });
const statusSchema = z.enum(['completed', 'incomplete', 'failed', 'cancelled', 'in_progress', 'queued']);
const functionOutput = callInput.extend({ id: z.string().max(256).optional(), status: z.literal('completed').optional() });
const visualFunctionOutput = functionOutput.extend({arguments:z.string().max(24_576)});

function plainObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function argumentsObject(raw: string, maxNodes = 500): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw); let nodes = 0;
  function check(value: unknown, depth: number) {
    if (++nodes > maxNodes || depth > 16) throw new Error();
    if (Array.isArray(value)) for (const item of value) check(item, depth + 1);
    else if (plainObject(value)) for (const [key, item] of Object.entries(value)) { if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error(); check(item, depth + 1); }
  }
  if (!plainObject(parsed)) throw new Error(); check(parsed, 0); return parsed;
}

/** Extract billing before validating completion/output; never retain provider text or reasoning. */
export function parseMetaResponse(raw: unknown, allowedTools: readonly string[], httpOk = true, profile: 'text' | 'vision' = 'text'): MetaResult {
  const usageResult = usageSchema.safeParse(plainObject(raw) ? raw.usage : undefined);
  const usage = usageResult.success ? usageResult.data : null;
  if (!httpOk) throw new MetaClientError('http', usage, true);
  if (!usage) throw new MetaClientError('usage_unavailable', null, true);
  if (!plainObject(raw)) throw new MetaClientError('response_invalid', usage, true);
  const status = statusSchema.safeParse(raw.status);
  if (!status.success || !Array.isArray(raw.output) || raw.output.length > 32) throw new MetaClientError('response_invalid', usage, true);
  // Incomplete calls may contain truncated JSON; bill them, but never execute them.
  if (status.data !== 'completed') return { status: status.data, tools: [], usage };
  const tools: MetaToolCall[] = []; const seen = new Set<string>();
  for (const item of raw.output) {
    if (!plainObject(item) || typeof item.type !== 'string') throw new MetaClientError('response_invalid', usage, true);
    if (item.type === 'reasoning' || item.type === 'message') continue;
    if (item.type !== 'function_call') throw new MetaClientError('tool_invalid', usage, true);
    const parsed = (profile === 'vision' ? visualFunctionOutput : functionOutput).safeParse(item);
    if (!parsed.success || !allowedTools.includes(parsed.data.name) || seen.has(parsed.data.call_id) || tools.length >= 1) throw new MetaClientError('tool_invalid', usage, true);
    try {
      const { name, arguments: args, call_id } = parsed.data;
      tools.push({ type: 'function_call', name, arguments: args, call_id, parsedArguments: argumentsObject(args,profile === 'vision' ? 2000 : 500) }); seen.add(call_id);
    } catch { throw new MetaClientError('tool_invalid', usage, true); }
  }
  return { status: status.data, tools, usage };
}

export function parseMetaStructuredResult(raw: unknown, result: MetaResult, profile: 'text' | 'vision' = 'text'): MetaResult {
  if (result.status !== 'completed' || result.tools.length) return result;
  try {
    const messages = (raw as { output: unknown[] }).output.filter((item): item is Record<string, unknown> => plainObject(item) && item.type === 'message');
    if (messages.length !== 1 || messages[0].role !== 'assistant' ||
      (messages[0].status !== undefined && messages[0].status !== 'completed') ||
      !Array.isArray(messages[0].content) || messages[0].content.length !== 1) throw new Error();
    const content = messages[0].content[0];
    if (!plainObject(content) || content.type !== 'output_text' || typeof content.text !== 'string' ||
      content.text.length > (profile === 'vision' ? 24576 : 8000)) throw new Error();
    return { ...result, structured: argumentsObject(content.text, profile === 'vision' ? 2000 : 500) };
  } catch { throw new MetaClientError('response_invalid', result.usage, true); }
}

export type MetaRequest = { instructions: string; input: readonly unknown[]; tools: readonly unknown[]; deadlineMs: number; signal?: AbortSignal; model?: MetaModel; maxOutputTokens?: number; reasoningEffort?: 'minimal' | 'low'; structuredOutput?: { name: string; schema: Record<string, unknown> }; jsonFallback?: boolean };

async function readBody(response: Response, signal: AbortSignal): Promise<unknown> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > META_MAX_RESPONSE_BYTES) { await response.body?.cancel(); throw new MetaClientError('response_limit', null, true); }
  const reader = response.body?.getReader();
  if (!reader) throw new MetaClientError('response_invalid', null, true);
  const chunks: Uint8Array[] = []; let size = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new MetaClientError('timeout', null, true);
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > META_MAX_RESPONSE_BYTES) { await reader.cancel(); throw new MetaClientError('response_limit', null, true); }
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new MetaClientError('response_invalid', null, true); }
  } finally { signal.removeEventListener('abort', cancel); reader.releaseLock(); }
}

/** deadlineMs is a per-call duration, capped at 45 seconds. No retries occur here. */
export async function requestMetaResponse(request: MetaRequest): Promise<MetaResult> {
  const key = process.env.MODEL_API_KEY;
  if (!key || (process.env.META_API_BASE_URL || 'https://api.meta.ai/v1') !== 'https://api.meta.ai/v1' || (process.env.META_MODEL_ID || META_MODEL) !== META_MODEL) throw new MetaClientError('configuration');
  const model = request.model ?? META_MODEL;
  if (model !== META_MODEL && model !== META_REVIEW_MODEL) throw new MetaClientError('configuration');
  let body: string; let allowedTools: string[];
  try {
    const input = inputSchema.parse(request.input);
    const tools = z.array(toolDefinition).min(request.structuredOutput ? 0 : 1).max(8).parse(request.tools);
    const instructions = z.string().min(1).max(8000).parse(request.instructions);
    if (!Number.isFinite(request.deadlineMs) || request.deadlineMs <= 0) throw new Error();
    allowedTools = tools.map(tool => tool.name);
    if (new Set(allowedTools).size !== tools.length) throw new Error();
    const pending = new Set<string>(); const completed = new Set<string>();
    for (const item of input) {
      if ('type' in item && item.type === 'function_call') { if (!allowedTools.includes(item.name) || pending.has(item.call_id) || completed.has(item.call_id)) throw new Error(); argumentsObject(item.arguments); pending.add(item.call_id); }
      if ('type' in item && item.type === 'function_call_output') { if (!pending.delete(item.call_id)) throw new Error(); completed.add(item.call_id); }
    }
    if (pending.size) throw new Error();
    const effort = z.enum(['minimal','low']).parse(request.reasoningEffort ?? 'low');
    const maxOutputTokens = z.number().int().min(1).max(META_MAX_OUTPUT_TOKENS).parse(request.maxOutputTokens ?? META_MAX_OUTPUT_TOKENS);
    const format = request.structuredOutput === undefined ? undefined : z.strictObject({
      name: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
      schema: z.record(z.string(), z.unknown()).refine(value => value.type === 'object'),
    }).parse(request.structuredOutput);
    body = JSON.stringify({ model, instructions, input, tools, store: false, stream: false, background: false, parallel_tool_calls: false, reasoning: { effort }, max_output_tokens: maxOutputTokens,
      ...(format ? { text: { format: { type: 'json_schema', name: format.name, schema: format.schema, strict: true } } } : {}),
    });
  } catch { throw new MetaClientError('request_invalid'); }
  if (Buffer.byteLength(body) > META_MAX_REQUEST_BYTES) throw new MetaClientError('request_limit');
  if (request.signal?.aborted) throw new MetaClientError('timeout');
  const controller = new AbortController(); const abort = () => controller.abort();
  request.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, Math.min(45_000, request.deadlineMs));
  let rejectAbort: () => void = () => {};
  const interrupted = new Promise<never>((_, reject) => { rejectAbort = () => reject(new MetaClientError('timeout', null, true)); controller.signal.addEventListener('abort', rejectAbort, { once: true }); });
  try {
    const operation = async () => {
      const response = await fetch(META_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body, signal: controller.signal, cache: 'no-store', redirect: 'error' });
      const raw = await readBody(response, controller.signal);
      const result = parseMetaResponse(raw, allowedTools, response.ok);
      if ((!request.structuredOutput && !request.jsonFallback) || result.status !== 'completed' || result.tools.length)
        return result;
      return parseMetaStructuredResult(raw, result);
    };
    return await Promise.race([operation(), interrupted]);
  } catch (error) {
    if (error instanceof MetaClientError) throw error;
    throw new MetaClientError(controller.signal.aborted ? 'timeout' : 'network', null, true);
  } finally { clearTimeout(timer); controller.signal.removeEventListener('abort', rejectAbort); request.signal?.removeEventListener('abort', abort); }
}
