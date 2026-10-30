import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readJsonBody } from '@/lib/server/http';
import {
  resolveExplorationPrincipal,
  assertExplorationOrigin,
} from '@/lib/server/exploration-store';
import { explorationService, explorationViewStateSchema } from '@/lib/server/exploration';
import { ExplorationError } from '@/lib/server/exploration-types';

export const runtime = 'nodejs';
export const maxDuration = 100;
function response(body: unknown, setCookie?: string) {
  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'private, no-store',
      ...(setCookie ? { 'Set-Cookie': setCookie } : {}),
    },
  });
}
function failure(error: unknown) {
  const status = (error as { status?: number })?.status;
  const safe =
    error instanceof ExplorationError
      ? error
      : new ExplorationError(
          status === 401
            ? 'account_required'
            : status === 403
              ? 'forbidden'
              : status === 413
                ? 'image_invalid'
                : status === 400 || status === 415
                  ? 'invalid_request'
                  : 'unavailable',
        );
  return NextResponse.json(
    { error: safe.message, code: safe.code },
    { status: safe.status, headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function GET(request: Request) {
  try {
    const { principal, setCookie } = await resolveExplorationPrincipal(request, {
      createGuest: true,
    });
    const query = new URL(request.url).searchParams,
      artifactId = query.get('artifactId'),
      rawVersion = query.get('version');
    if (
      (artifactId && !z.uuid().safeParse(artifactId).success) ||
      (rawVersion !== null &&
        (!artifactId || !/^\d{1,8}$/.test(rawVersion) || Number(rawVersion) < 1))
    )
      throw new ExplorationError('invalid_request');
    const result = await explorationService.initialize(principal);
    return response(
      artifactId
        ? await explorationService.read(
            principal,
            artifactId,
            rawVersion === null ? undefined : Number(rawVersion),
          )
        : result,
      setCookie,
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertExplorationOrigin(request);
    const { principal } = await resolveExplorationPrincipal(request);
    const body = await readJsonBody(request, 730_000);
    const action = z
      .object({
        action: z.enum(['generate', 'cancel', 'example', 'recording', 'prediction', 'application']),
      })
      .safeParse(body);
    if (!action.success) throw new ExplorationError('invalid_request');
    if (action.data.action === 'recording') {
      if (!z.strictObject({ action: z.literal('recording') }).safeParse(body).success)
        throw new ExplorationError('invalid_request');
      return response(await explorationService.recording(principal));
    }
    if (action.data.action === 'application')
      return response(await explorationService.application(principal, body));
    if (action.data.action === 'prediction')
      return response(await explorationService.prediction(principal, body));
    if (action.data.action === 'example') {
      if (
        !z
          .strictObject({
            action: z.literal('example'),
            weighted: z.boolean().optional(),
          })
          .safeParse(body).success
      )
        throw new ExplorationError('invalid_request');
      return response(
        await explorationService.example(
          principal,
          (body as { weighted?: boolean }).weighted === true,
        ),
      );
    }
    if (action.data.action === 'cancel') {
      const parsed = z
        .strictObject({ action: z.literal('cancel'), requestId: z.uuid() })
        .safeParse(body);
      if (!parsed.success) throw new ExplorationError('invalid_request');
      return response(await explorationService.cancel(principal, parsed.data.requestId));
    }
    return response(await explorationService.generate(principal, body, request.signal));
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request) {
  try {
    assertExplorationOrigin(request);
    const { principal } = await resolveExplorationPrincipal(request);
    const parsed = z
      .strictObject({
        action: z.literal('save'),
        artifactId: z.uuid(),
        version: z.number().int().positive(),
        state: explorationViewStateSchema,
      })
      .safeParse(await readJsonBody(request));
    if (!parsed.success) throw new ExplorationError('invalid_request');
    return response(
      await explorationService.save(
        principal,
        parsed.data.artifactId,
        parsed.data.version,
        parsed.data.state,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertExplorationOrigin(request);
    const { principal } = await resolveExplorationPrincipal(request);
    const parsed = z
      .strictObject({ artifactId: z.uuid().optional() })
      .safeParse(await readJsonBody(request));
    if (!parsed.success) throw new ExplorationError('invalid_request');
    return response(await explorationService.remove(principal, parsed.data.artifactId));
  } catch (error) {
    return failure(error);
  }
}
