import { z } from 'zod';
import { parseScreenshotDataUrl } from './image-source';
import {
  META_ENDPOINT,
  META_MODEL,
  META_REVIEW_MODEL,
  type MetaModel,
  META_MAX_RESPONSE_BYTES,
  MetaClientError,
  parseMetaResponse,
  parseMetaStructuredResult,
  type MetaResult,
} from './meta-client';

export type MetaVisionRequest = {
  instructions: string;
  input: readonly unknown[];
  tools: readonly unknown[];
  deadlineMs: number;
  signal?: AbortSignal;
  maxOutputTokens?: number;
  reasoningEffort?: 'minimal' | 'low';
  maxImages?: number;
  /** Spark by default; Wonder for an independent check of the same image. */
  model?: MetaModel;
  structuredOutput?: { name: string; schema: Record<string, unknown> };
};
const name = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  callId = z.string().regex(/^[A-Za-z0-9_.:-]{1,256}$/);
const call = z.strictObject({
  type: z.literal('function_call'),
  name,
  arguments: z.string().max(24_576),
  call_id: callId,
});
const output = z.strictObject({
  type: z.literal('function_call_output'),
  call_id: callId,
  output: z.string().max(24_576),
});
const text = z.strictObject({
  type: z.literal('input_text'),
  text: z.string().min(1).max(32_768),
});
const image = z.strictObject({
  type: z.literal('input_image'),
  image_url: z.string().max(700_000),
});
const message = z.strictObject({
  role: z.literal('user'),
  content: z.union([
    z.string().min(1).max(32_768),
    z
      .array(z.union([text, image]))
      .min(1)
      .max(6),
  ]),
});
const tool = z.strictObject({
  type: z.literal('function'),
  name,
  description: z.string().max(2000),
  parameters: z.record(z.string(), z.unknown()),
  strict: z.literal(true),
});
function encode(request: MetaVisionRequest) {
  let raw: {
    body: string;
    names: string[];
    textBytes: number;
    images: number;
    maxTokens: number;
  };
  try {
    const input = z
      .array(z.union([message, call, output]))
      .min(1)
      .max(12)
      .parse(request.input);
    const tools = z
        .array(tool)
        .min(request.structuredOutput ? 0 : 1)
        .max(4)
        .parse(request.tools),
      names = tools.map((item) => item.name);
    if (
      new Set(names).size !== names.length ||
      tools.some((item) => item.parameters.type !== 'object')
    )
      throw new Error();
    const instructions = z.string().min(1).max(12_000).parse(request.instructions);
    const maxTokens = z
      .number()
      .int()
      .min(1)
      .max(6144)
      .parse(request.maxOutputTokens ?? 4096);
    const pending = new Set<string>(),
      seen = new Set<string>();
    let images = 0;
    const stripped = input.map((item) => {
      if ('role' in item && Array.isArray(item.content))
        return {
          ...item,
          content: item.content.map((block) => {
            if (block.type === 'input_image') {
              images++;
              parseScreenshotDataUrl(block.image_url);
              return { ...block, image_url: '[transient screenshot]' };
            }
            return block;
          }),
        };
      if ('type' in item && item.type === 'function_call') {
        if (!names.includes(item.name) || seen.has(item.call_id)) throw new Error();
        seen.add(item.call_id);
        pending.add(item.call_id);
        const parsed: unknown = JSON.parse(item.arguments);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      }
      if (
        'type' in item &&
        item.type === 'function_call_output' &&
        !pending.delete(item.call_id)
      )
        throw new Error();
      return item;
    });
    if (
      images >
        z
          .number()
          .int()
          .min(1)
          .max(3)
          .parse(request.maxImages ?? 1) ||
      pending.size ||
      !Number.isFinite(request.deadlineMs) ||
      request.deadlineMs <= 0
    )
      throw new Error();
    const format =
      request.structuredOutput === undefined
        ? undefined
        : z
            .strictObject({
              name: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
              schema: z
                .record(z.string(), z.unknown())
                .refine((value) => value.type === 'object'),
            })
            .parse(request.structuredOutput);
    const common = {
      ...(format
        ? {
            text: {
              format: {
                type: 'json_schema',
                name: format.name,
                schema: format.schema,
                strict: true,
              },
            },
          }
        : {}),
      model: z.enum([META_MODEL, META_REVIEW_MODEL]).parse(request.model ?? META_MODEL),
      instructions,
      tools,
      store: false,
      stream: false,
      background: false,
      parallel_tool_calls: false,
      reasoning: { effort: z.enum(['minimal', 'low']).parse(request.reasoningEffort ?? 'low') },
      max_output_tokens: maxTokens,
    };
    const body = JSON.stringify({ ...common, input }),
      textBytes = Buffer.byteLength(JSON.stringify({ ...common, input: stripped }));
    if (Buffer.byteLength(body) > 2300 * 1024 || textBytes > 100_000)
      throw new MetaClientError('request_limit');
    raw = { body, names, textBytes, images, maxTokens };
  } catch (error) {
    if (error instanceof MetaClientError) throw error;
    throw new MetaClientError('request_invalid');
  }
  return raw;
}
/** Bytes upper-bound text tokens; image allowance deliberately exceeds the
 * documented ~1,300–1,500 tokens at1280px for this1600px input ceiling. Actual
 * usage always settles the shared reservation. No input content is logged. */
export function visionRequestUpperBoundUsd(request: MetaVisionRequest): number {
  const info = encode(request);
  const [input, output] = request.model === META_REVIEW_MODEL ? [4, 20] : [1.25, 4.25];
  return ((info.textBytes + info.images * 8192) * input + info.maxTokens * output) / 1_000_000;
}
/** Isolated image profile: v1 text callers retain their original byte/schema
 * bounds. Only inline PNG/JPEG is accepted; no URL fetch or provider file ID. */
export async function requestMetaVisionResponse(
  request: MetaVisionRequest,
): Promise<MetaResult> {
  if (
    !process.env.MODEL_API_KEY ||
    (process.env.META_API_BASE_URL || 'https://api.meta.ai/v1') !== 'https://api.meta.ai/v1' ||
    (process.env.META_MODEL_ID || META_MODEL) !== META_MODEL
  )
    throw new MetaClientError('configuration');
  const encoded = encode(request);
  if (request.signal?.aborted) throw new MetaClientError('timeout');
  const controller = new AbortController(),
    abort = () => controller.abort();
  request.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, Math.min(45_000, request.deadlineMs));
  let timedOut: () => void = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    timedOut = () => reject(new MetaClientError('timeout', null, true));
    controller.signal.addEventListener('abort', timedOut, { once: true });
  });
  try {
    return await Promise.race([
      interrupted,
      (async () => {
        const response = await fetch(META_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.MODEL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: encoded.body,
          signal: controller.signal,
          cache: 'no-store',
          redirect: 'error',
        });
        const declared = response.headers.get('content-length');
        if (
          declared &&
          (!/^\d+$/.test(declared) || Number(declared) > META_MAX_RESPONSE_BYTES)
        ) {
          await response.body?.cancel();
          throw new MetaClientError('response_limit', null, true);
        }
        const reader = response.body?.getReader();
        if (!reader) throw new MetaClientError('response_invalid', null, true);
        const chunks: Uint8Array[] = [];
        let size = 0;
        const cancel = () => {
          void reader.cancel().catch(() => undefined);
        };
        controller.signal.addEventListener('abort', cancel, { once: true });
        try {
          for (;;) {
            if (controller.signal.aborted) throw new MetaClientError('timeout', null, true);
            const next = await reader.read();
            if (next.done) break;
            size += next.value.byteLength;
            if (size > META_MAX_RESPONSE_BYTES) {
              await reader.cancel();
              throw new MetaClientError('response_limit', null, true);
            }
            chunks.push(next.value);
          }
        } finally {
          controller.signal.removeEventListener('abort', cancel);
          reader.releaseLock();
        }
        let value: unknown;
        try {
          value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          throw new MetaClientError('response_invalid', null, true);
        }
        const result = parseMetaResponse(value, encoded.names, response.ok, 'vision');
        return request.structuredOutput
          ? parseMetaStructuredResult(value, result, 'vision')
          : result;
      })(),
    ]);
  } catch (error) {
    if (error instanceof MetaClientError) throw error;
    throw new MetaClientError(controller.signal.aborted ? 'timeout' : 'network', null, true);
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener('abort', timedOut);
    request.signal?.removeEventListener('abort', abort);
  }
}
