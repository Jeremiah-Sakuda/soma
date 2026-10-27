import { z } from 'zod';
import type { WorkspaceAction } from '../domain/types';

const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const circuit = z.strictObject({
  topology: z.enum(['series', 'parallel']),
  voltage: z.number().finite().min(0).max(24),
  r1: z.number().finite().min(1).max(100),
  r2: z.number().finite().min(1).max(100),
});

/** Untrusted actions never carry workspace, owner, scoring, or evidence fields. */
export const workspaceActionSchema: z.ZodType<WorkspaceAction> = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('refresh') }),
  z.strictObject({ type: z.literal('scenario'), scenario: z.enum(['exam-moved', 'scope-change', 'source-revised', 'source-expired', 'reconnect', 'injection', 'commitment-overlap', 'commitment-no-overlap', 'commitment-tentative', 'commitment-duplicate']) }),
  z.strictObject({ type: z.literal('assistance'), lessonId: id, kind: z.enum(['hint', 'explanation', 'exploration']) }),
  z.strictObject({ type: z.literal('correct-learning'), lessonId: id, note: z.string().trim().min(1).max(1000), revisionOf: id.optional() }),
  z.strictObject({ type: z.literal('attempt'), lessonId: id, optionIndex: z.number().int().min(0).max(15), revisionOf: id.optional() }),
  z.strictObject({ type: z.literal('request-lesson'), courseId: id, topic: z.string().trim().min(1).max(300) }),
  z.strictObject({ type: z.literal('save-inputs'), lessonId: id, inputs: circuit }),
  z.strictObject({ type: z.literal('preference'), sessionMinutes: z.number().int().min(5).max(120).optional(), workedExamples: z.boolean().optional() }).refine(value => value.sessionMinutes !== undefined || value.workedExamples !== undefined, 'Supply a preference'),
  z.strictObject({ type: z.literal('review'), lessonId: id, rating: z.enum(['Again', 'Hard', 'Good', 'Easy']) }),
  z.strictObject({ type: z.literal('select-session'), minutes: z.union([z.literal(10), z.literal(20), z.literal(45)]) }),
  z.strictObject({ type: z.literal('focus-window'), startAt: z.iso.datetime({ offset: true }), endAt: z.iso.datetime({ offset: true }), timezone: z.string().min(1).max(80) }),
  z.strictObject({ type: z.literal('correct-commitment'), commitmentId: id, status: z.enum(['confirmed', 'tentative', 'cancelled']).optional(), startAt: z.iso.datetime({ offset: true }).optional(), endAt: z.iso.datetime({ offset: true }).optional(), timezone: z.string().min(1).max(80).optional(), note: z.string().trim().min(1).max(500) }).refine(value => value.status !== undefined || value.startAt !== undefined || value.endAt !== undefined || value.timezone !== undefined, 'Supply a correction'),
  z.strictObject({ type: z.literal('prediction'), lessonId: id, optionIndex: z.number().int().min(0).max(2) }),
  z.strictObject({ type: z.literal('reveal-prediction'), lessonId: id }),
  z.strictObject({ type: z.literal('explore-lesson'), lessonId: id }),
  z.strictObject({ type: z.literal('fresh-question'), lessonId: id, when: z.enum(['now', 'later']) }),
  z.strictObject({ type: z.literal('reset') }),
]);

export const actionSchema = workspaceActionSchema;
export const workspaceActionRequestSchema = z.strictObject({
  action: workspaceActionSchema,
  expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});
