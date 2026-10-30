import { createHash, timingSafeEqual } from 'node:crypto';

declare const workerBrand: unique symbol;
export type TrustedWorker = Readonly<{ expiresAt: number; [workerBrand]: true }>;
const verified = new WeakSet<object>();
export class WorkerAccessError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super('Background worker authorization is unavailable or invalid.');
  }
}

/** No UID, account selector, or browser session can mint this server capability. */
export function verifyWorkerRequest(request: Request): TrustedWorker {
  const secret = process.env.SOMA_WORKER_SECRET ?? '';
  if (
    process.env.SOMA_WORKER_ENABLED !== 'true' ||
    secret.length < 32 ||
    secret.length > 256 ||
    /\s/.test(secret)
  )
    throw new WorkerAccessError(503, 'worker_unavailable');
  const authorization = request.headers.get('authorization') ?? '';
  const supplied = /^Bearer ([^\s]{1,256})$/.exec(authorization)?.[1] ?? '';
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(digest(supplied), digest(secret)))
    throw new WorkerAccessError(401, 'worker_unauthorized');
  const capability = Object.freeze({ expiresAt: Date.now() + 120_000 }) as TrustedWorker;
  verified.add(capability);
  return capability;
}

export function assertTrustedWorker(capability: TrustedWorker): void {
  if (!capability || !verified.has(capability) || capability.expiresAt <= Date.now())
    throw new WorkerAccessError(401, 'worker_unauthorized');
}

/** The voice relay receives a distinct capability, never the general worker key. */
export function verifyVoiceRelayRequest(request: Request): TrustedWorker {
  const secret = process.env.SOMA_VOICE_CONTROL_KEY ?? '';
  const supplied =
    /^Bearer ([^\s]{1,256})$/.exec(request.headers.get('authorization') ?? '')?.[1] ?? '';
  if (secret.length < 32 || secret.length > 256 || /\s/.test(secret))
    throw new WorkerAccessError(503, 'voice_unavailable');
  const digest = (v: string) => createHash('sha256').update(v).digest();
  if (!timingSafeEqual(digest(secret), digest(supplied)))
    throw new WorkerAccessError(401, 'voice_unauthorized');
  const capability = Object.freeze({ expiresAt: Date.now() + 90000 }) as TrustedWorker;
  verified.add(capability);
  return capability;
}
