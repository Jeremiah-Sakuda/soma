import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAccountSession, AccountSessionError } from '@/lib/server/account';
import { listAdaptationJobs, retryAdaptationJob } from '@/lib/server/adaptation-jobs';
import { apiError, requireSameOrigin } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const account = await verifyAccountSession(request); if (!account) throw new AccountSessionError('Sign in to view follow-up status.', 401, 'account_required');
    return NextResponse.json({ jobs: await listAdaptationJobs(account) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const account = await verifyAccountSession(request); if (!account) throw new AccountSessionError('Sign in to retry follow-up.', 401, 'account_required');
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return NextResponse.json({ error: 'JSON is required.' }, { status: 415 });
    const reader = request.body?.getReader(); if (!reader) return NextResponse.json({ error: 'Choose a saved follow-up.' }, { status: 400 });
    const chunks: Uint8Array[] = []; let bytes = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 1024) { await reader.cancel(); return NextResponse.json({ error: 'Request too large.' }, { status: 413 }); } chunks.push(value); }
    let raw:unknown;try{raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400});}
    const input = z.strictObject({ jobId: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse(raw);
    if (!input.success) return NextResponse.json({ error: 'Choose a valid saved follow-up.' }, { status: 400 });
    await retryAdaptationJob(account, input.data.jobId);
    return NextResponse.json({ jobs: await listAdaptationJobs(account) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
