import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAccountSession, AccountSessionError } from '@/lib/server/account';
import { listPreparationJobs, runPreparationJob } from '@/lib/server/jobs';
import { requireSameOrigin, apiError, workspaceResponse } from '@/lib/server/http';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: Request) {
  try {
    const account = await verifyAccountSession(request);
    if (!account) throw new AccountSessionError('Sign in to view your preparations.', 401, 'account_required');
    return NextResponse.json({ jobs: await listPreparationJobs(account), scheduling: 'explicit-worker' }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const account = await verifyAccountSession(request);
    if (!account) throw new AccountSessionError('Sign in to prepare from your material.', 401, 'account_required');
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return NextResponse.json({ error: 'JSON is required.' }, { status: 415 });
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'Preparation ID is required.' }, { status: 400 });
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > 1024) { await reader.cancel(); return NextResponse.json({ error: 'Request is too large.' }, { status: 413 }); } chunks.push(value); }
    let input: unknown;
    try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
    const parsed = z.strictObject({ jobId: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse(input);
    if (!parsed.success) return NextResponse.json({ error: 'Valid preparation ID is required.' }, { status: 400 });
    const workspace = await runPreparationJob(account, parsed.data.jobId);
    return workspace ? workspaceResponse(workspace, 'Saved the source investigation or prepared activity.') : NextResponse.json({ jobs: await listPreparationJobs(account) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
