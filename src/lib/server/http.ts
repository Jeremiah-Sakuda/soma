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
  try { const parsed = new URL(origin || ''); matches = parsed.host === host && ['http:', 'https:'].includes(parsed.protocol) && parsed.origin === origin; } catch { /* invalid Origin */ }
  if (site === 'cross-site' || !matches) {
    throw Object.assign(new Error('This action must come from the Soma app.'), { status: 403 });
  }
}

export function apiError(error: unknown) {
  const candidate = error as { status?: number; code?: string; message?: string };
  const status = candidate.status === 503 ? 503 : candidate.status && candidate.status >= 400 && candidate.status < 500 ? candidate.status : 500;
  // Avoid echoing provider/SQL details, paths, or credentials into public responses.
  const message = status === 503 ? 'This service is not available right now. Your saved data was retained; please try again.' : status === 500 ? 'Soma could not save this change. Please try again.' : (candidate.message || 'This request could not be completed.');
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}
