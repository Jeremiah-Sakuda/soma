import { z } from 'zod';
import type { SourceRef, WorkspaceState } from './types';

const identifier = z.string().min(1).max(160);
const sourceRef = z.strictObject({ sourceId: identifier, version: z.number().int().positive() });
export const auditEventInputSchema = z.strictObject({
  actor: z.enum(['application', 'model']),
  kind: z.enum(['started', 'proposal', 'observation', 'validation', 'decision', 'publication', 'stopped', 'usage']),
  summary: z.string().trim().min(1).max(600),
  rationale: z.string().trim().min(1).max(800).optional(),
  evidence: z.array(sourceRef).max(30).optional(),
  visibility: z.enum(['public', 'protected']),
  usage: z.strictObject({ calls: z.number().int().nonnegative().max(100), costUsd: z.number().finite().nonnegative().max(100), elapsedMs: z.number().finite().nonnegative().max(3_600_000) }).optional(),
});
export type AuditEventInput = z.infer<typeof auditEventInputSchema>;
export type AuditEvent = AuditEventInput & { seq: number; at: string };
export const auditRunMetadataSchema = z.strictObject({
  kind: z.enum(['investigation', 'lesson-preparation', 'preparation', 'adaptation', 'source-refresh']),
  trigger: z.string().trim().min(1).max(300), mode: z.enum(['live', 'prepared', 'synthetic']),
  courseId: identifier.optional(), model: z.string().max(100).optional(),
  engineVersion: z.string().max(100).optional(), promptVersion: z.string().max(100).optional(),
});
export type AuditRunMetadata = z.infer<typeof auditRunMetadataSchema>;
export type AuditStatus = 'running' | 'proposed' | 'published' | 'failed' | 'blocked' | 'interrupted' | 'unchanged';
export type AuditRun = AuditRunMetadata & {
  id: string; workspaceId: string; contextRevision: number; sourceRefs: SourceRef[]; sourceRefsTruncated?: boolean;
  status: AuditStatus; startedAt: string; updatedAt: string; journalRevision: number;
  selectedLessonId?: string; publishedLessonId?: string; events: AuditEvent[];
};
export type AuditEventView = AuditEvent & { protected: boolean; rationaleStatus: 'recorded' | 'unrecorded' | 'protected' };
export type AuditRunView = Omit<AuditRun, 'events'> & { events: AuditEventView[] };
export type AuditFinish = { mode?: 'live' | 'prepared' | 'synthetic'; status: Exclude<AuditStatus, 'running'>; selectedLessonId?: string; publishedLessonId?: string };
export const auditFinishSchema = z.strictObject({ mode: z.enum(['live', 'prepared', 'synthetic']).optional(), status: z.enum(['proposed', 'published', 'failed', 'blocked', 'interrupted', 'unchanged']), selectedLessonId: identifier.optional(), publishedLessonId: identifier.optional() });

/** A projection only: protected originals are never replaced or reconstructed. */
export function auditRunView(run: AuditRun, state: WorkspaceState, now = Date.now()): AuditRunView {
  const interrupted = run.status === 'running' && now - Date.parse(run.updatedAt) > 5 * 60_000;
  const status = interrupted ? 'interrupted' : run.status;
  const terminal = ['published', 'unchanged'].includes(status);
  const lessonId = run.publishedLessonId ?? run.selectedLessonId;
  const lesson = lessonId ? state.lessons.find(item => item.id === lessonId) : undefined;
  const unlocked = terminal && (!lessonId || Boolean(lesson && (
    state.attempts.some(attempt => attempt.lessonId === lesson.id && attempt.lessonVersion === lesson.version) ||
    (state.assistance[lesson.id] ?? []).some(entry => Date.parse(entry.split(' · ')[0]) >= Date.parse(run.startedAt))
  )));
  return { ...run, status, events: run.events.map(event => {
    const hidden = (event.actor === 'model' || event.visibility === 'protected') && !unlocked;
    if (!hidden) return { ...event, protected: false, rationaleStatus: event.rationale ? 'recorded' : 'unrecorded' };
    return { seq: event.seq, at: event.at, actor: event.actor, kind: event.kind, visibility: event.visibility,
      summary: 'Model detail protected until this activity is attempted or help is recorded.',
      ...(event.usage ? { usage: event.usage } : {}), protected: true, rationaleStatus: 'protected' };
  }) };
}
