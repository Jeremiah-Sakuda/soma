import { MetaClientError, type MetaErrorCode, type MetaUsage } from './meta-client';

/** Structured, text-free execution facts. Display narratives never control recovery. */
export type ExecutionFailure =
  | { kind: 'provider'; code: MetaErrorCode; requestSent: boolean; usage: MetaUsage | null }
  | { kind: 'validation'; code: 'tool' | 'incomplete' | 'declined' }
  | { kind: 'limit'; code: 'calls' | 'time' };

/** A known application boundary, distinct from an unexpected implementation error. */
export class ExecutionBoundaryError extends Error {
  constructor(public readonly failure: Exclude<ExecutionFailure, { kind: 'provider' }>, message: string) {
    super(message); this.name = 'ExecutionBoundaryError';
  }
}

/** Copy only known provider fields; never copy payloads, reasons or raw transport text. */
export function executionFailure(error: unknown): ExecutionFailure | undefined {
  if (error instanceof MetaClientError) return { kind: 'provider', code: error.code, requestSent: error.requestSent, usage: error.usage ? { ...error.usage } : null };
  if (error instanceof ExecutionBoundaryError) return { ...error.failure };
  return undefined;
}

/** Preserve existing transport categories; no new HTTP status policy or implicit retries. */
export function retryableExecutionFailure(failure?: ExecutionFailure): boolean {
  return failure?.kind === 'provider' && ['network', 'timeout', 'http'].includes(failure.code);
}
