import { NextResponse } from 'next/server';
import {
  resolveExplorationPrincipal,
  readExistingExplorationSession,
} from '@/lib/server/exploration-store';
import { readExplorationAllowance } from '@/lib/server/exploration-allowance';
import { ExplorationError } from '@/lib/server/exploration-types';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

export async function GET(request: Request) {
  try {
    const { principal } = await resolveExplorationPrincipal(request, {
      createGuest: false,
      readOnly: true,
    });
    if (!(await readExistingExplorationSession(principal)))
      throw new ExplorationError('session_expired');
    return NextResponse.json(
      { kind: principal.kind, ...(await readExplorationAllowance(principal.key)) },
      { headers },
    );
  } catch (error) {
    const status = (error as { status?: number })?.status;
    const safe =
      error instanceof ExplorationError
        ? error
        : new ExplorationError(
            status === 401 ? 'account_required' : status === 403 ? 'forbidden' : 'unavailable',
          );
    return NextResponse.json(
      { error: safe.message, code: safe.code },
      { status: safe.status, headers },
    );
  }
}
