import { NextResponse } from 'next/server';
import { verifyWorkerRequest, WorkerAccessError } from '@/lib/server/worker-auth';
import { runWorkerTick } from '@/lib/server/worker';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const capability = verifyWorkerRequest(request);
    // The endpoint never accepts an account UID, workspace, cursor, or adapter override.
    const reader = request.body?.getReader();
    if (reader) {
      let size = 0; const chunks: Uint8Array[] = [];
      while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 32) { await reader.cancel(); return NextResponse.json({ error: 'No worker parameters are accepted.' }, { status: 400 }); } chunks.push(value); }
      const body = Buffer.concat(chunks).toString('utf8').trim();
      if (body && body !== '{}') return NextResponse.json({ error: 'No worker parameters are accepted.' }, { status: 400 });
    }
    return NextResponse.json(await runWorkerTick(capability), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error instanceof WorkerAccessError ? error.status : 503;
    return NextResponse.json({ error: status === 401 ? 'Worker authorization required.' : 'Worker is unavailable; retry a later tick.' }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
