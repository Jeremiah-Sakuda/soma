import { describe, expect, it } from 'vitest';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { semesterMap } from '../../src/lib/domain/semester-map';
import type { Attempt, WorkspaceState } from '../../src/lib/domain/types';
const now = '2026-10-26T15:00:00.000Z';

const attempt = (lessonId: string, overrides: Partial<Attempt> = {}): Attempt => ({
  id: `a-${lessonId}-${Math.random()}`, lessonId, lessonVersion: 1, modelVersion: 'm', question: 'q', response: 'r',
  correct: true, assisted: false, assistance: [], createdAt: now, novel: true, feedback: '', ...overrides,
});
const station = (ws: WorkspaceState, lessonId: string) => semesterMap(ws).flatMap(line => line.stations).find(s => s.lessonId === lessonId)!;

describe('semester map projection', () => {
  it('draws one line per course and starts every untouched lesson as ready', () => {
    const ws = seedWorkspace('map-test', now);
    const lines = semesterMap(ws);
    expect(lines.map(line => line.courseId)).toEqual(ws.courses.map(course => course.id));
    const first = ws.lessons[0];
    expect(station(ws, first.id)).toMatchObject({ status: 'ready', word: 'Ready, not started', attempts: 0 });
  });

  it('never marks a station "on your own" from assisted, in-lab or unchecked work', () => {
    const ws = seedWorkspace('map-test', now);
    const id = ws.lessons[0].id;
    ws.attempts = [attempt(id, { assisted: true, exposure: 'fresh-no-diagram' }), attempt(id, { exposure: 'lab' }), attempt(id, { correct: null, exposure: 'fresh-no-diagram' })];
    expect(station(ws, id).status).toBe('help');
    ws.attempts = [attempt(id, { exposure: 'lab' })];
    expect(station(ws, id)).toMatchObject({ status: 'tried', word: 'Worked in the lesson' });
  });

  it('counts recorded assistance without an attempt as help, not understanding', () => {
    const ws = seedWorkspace('map-test', now);
    const id = ws.lessons[0].id;
    ws.assistance = { ...ws.assistance, [id]: ['exploration'] };
    expect(station(ws, id).status).toBe('help');
  });

  it('folds a fresh follow-up into its parent and lets an unassisted fresh success mark it on your own', () => {
    const ws = seedWorkspace('map-test', now);
    const parent = ws.lessons[0];
    const child = { ...parent, id: `${parent.id}-fresh`, parentLessonId: parent.id, exposure: 'fresh-no-diagram' as const };
    ws.lessons.push(child);
    ws.attempts = [attempt(child.id, { exposure: 'fresh-no-diagram' })];
    const stations = semesterMap(ws).flatMap(line => line.stations);
    expect(stations.some(s => s.lessonId === child.id)).toBe(false);
    expect(station(ws, parent.id)).toMatchObject({ status: 'own', attempts: 1 });
  });

  it('shows an unanswered diagnostic as two explanations and keeps correction responses out of the count', () => {
    const ws = seedWorkspace('map-test', now);
    const lesson = { ...ws.lessons[0], id: 'diag', diagnosticInvestigationId: 'inv-1' };
    ws.lessons.push(lesson);
    ws.attempts = [attempt('diag', { responseKind: 'correction', correct: null })];
    expect(station(ws, 'diag')).toMatchObject({ status: 'split', attempts: 0 });
  });

  it('labels evidence by who it came from and marks stale lessons without changing their status', () => {
    const ws = seedWorkspace('map-test', now);
    const lesson = ws.lessons[0];
    lesson.state = 'stale';
    const view = station(ws, lesson.id);
    expect(view.stale).toBe(true);
    expect(view.evidence.some(e => e.who === 'Soma' && e.text === lesson.reason)).toBe(true);
    expect(view.evidence.every(e => ['You', 'Soma', 'Source'].includes(e.who))).toBe(true);
  });
});
