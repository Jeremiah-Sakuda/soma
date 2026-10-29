import { NextResponse } from 'next/server';
import type { WorkspaceResponse, WorkspaceState } from '../domain/types';
import { getPersistenceMode } from './store';
import { inferenceEnabled } from './budget';

export function workspaceResponse(workspace: WorkspaceState, notice?: string, selectedLessonId?: string) {
  const body: WorkspaceResponse = { workspace, capabilities: {
    spark: inferenceEnabled(),
    persistence: getPersistenceMode(), liveSources: [...new Set(workspace.sources.filter(source => source.origin === 'live' && source.status === 'current').map(source => source.kind))],
  }, ...(notice ? { notice } : {}), ...(selectedLessonId && workspace.lessons.some(lesson => lesson.id === selectedLessonId) ? { selectedLessonId } : {}) };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  // Next's internal URL may normalize loopback hostnames. The browser-controlled
  // Origin must match the actual HTTP Host; never trust forwarded-host here.
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.host;
  let matches = false;
  try { const parsed = new URL(origin || ''); matches = parsed.host === host && parsed.protocol === url.protocol && ['http:', 'https:'].includes(parsed.protocol) && parsed.origin === origin; } catch { /* invalid Origin */ }
  if (site === 'cross-site' || !matches) {
    throw Object.assign(new Error('This action must come from the Soma app.'), { status: 403 });
  }
}

export function apiError(error: unknown) {
  const candidate = error as { status?: number; code?: string; message?: string };
  const status = candidate.status === 503 ? 503 : candidate.status && candidate.status >= 400 && candidate.status < 500 ? candidate.status : 500;
  // Avoid echoing provider/SQL details, paths, or credentials into public responses.
  const message = status === 503 ? 'This service is not available right now. Your saved data was retained; please try again.' : status === 500 ? 'Soma could not save this change. Please try again.' : (candidate.message || 'This request could not be completed.');
  return NextResponse.json({ error: message, ...(candidate.code === 'deletion_pending' ? {code:'deletion_pending'} : {}) }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Enforce a byte ceiling while streaming, even without Content-Length. */
export async function readJsonBody(request: Request, maxBytes = 16_384): Promise<unknown> {
  const fail = (message: string, status: number) => Object.assign(new Error(message), {status});
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw fail('JSON is required.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw fail('A JSON request body is required.', 400);
  let size = 0; const chunks: Uint8Array[] = [];
  for (;;) {
    const {done,value} = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw fail('Source settings are too large.', 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw fail('Invalid JSON request.', 400); }
}
