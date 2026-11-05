import { NextResponse } from 'next/server';
import {
  assertExplorationOrigin,
  resolveExplorationPrincipal,
} from '@/lib/server/exploration-store';
import { ExplorationError } from '@/lib/server/exploration-types';
import {
  readVoiceBody,
  transcribeVoice,
  VoiceTranscriptionError,
} from '@/lib/server/voice-transcribe';
export const runtime = 'nodejs';
export const maxDuration = 40;
export async function POST(request: Request) {
  try {
    try {
      assertExplorationOrigin(request);
    } catch {
      throw new VoiceTranscriptionError('forbidden');
    }
    const { principal } = await resolveExplorationPrincipal(request, { createGuest: false });
    const bytes = await readVoiceBody(request);
    const result = await transcribeVoice(principal, bytes, request.signal);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const safe =
      error instanceof VoiceTranscriptionError || error instanceof ExplorationError
        ? error
        : new VoiceTranscriptionError('unavailable');
    return NextResponse.json(
      { error: safe.message, code: safe.code },
      { status: safe.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
