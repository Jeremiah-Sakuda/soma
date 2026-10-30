import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readJsonBody } from '@/lib/server/http';
import {
  assertExplorationOrigin,
  resolveExplorationPrincipal,
} from '@/lib/server/exploration-store';
import { voiceSessions } from '@/lib/server/voice-session';
import { verifyVoiceRelayRequest } from '@/lib/server/worker-auth';
export const runtime = 'nodejs';
export const maxDuration = 20;
export async function POST(request: Request) {
  try {
    const body = z
      .discriminatedUnion('action', [
        z.strictObject({ action: z.literal('start') }),
        z.strictObject({
          action: z.enum(['claim', 'complete', 'cancel']),
          ticket: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      ])
      .parse(await readJsonBody(request, 1024));
    let result: unknown;
    if (request.headers.has('authorization')) {
      const cap = verifyVoiceRelayRequest(request);
      if (body.action === 'start') throw Object.assign(Error(), { status: 403 });
      result = await voiceSessions.relay(body.ticket, body.action, cap);
    } else {
      assertExplorationOrigin(request);
      const { principal } = await resolveExplorationPrincipal(request, { createGuest: false });
      if (body.action === 'start') result = await voiceSessions.start(principal);
      else if (body.action === 'cancel')
        result = await voiceSessions.cancel(principal, body.ticket);
      else throw Object.assign(Error(), { status: 403 });
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const e = error as { status?: number; code?: string };
    return NextResponse.json(
      {
        error: 'Streaming voice is unavailable. Record a question or type instead.',
        code: e.code ?? 'voice_stream_unavailable',
      },
      { status: e.status ?? 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
