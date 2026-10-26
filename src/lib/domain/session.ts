import { selectAvailability } from './commitments';
import type { WorkspaceState } from './types';

export type SessionItem = { id: string; lessonId: string; title: string; kind: 'lesson' | 'prediction' | 'practice'; minutes: number };
export type SessionPlan = { minutes: number; requestedMinutes: 10 | 20 | 45; items: SessionItem[]; omittedItems: SessionItem[]; omittedMinutes: number; longerThanAvailable: boolean; availableMinutes: number | null; status: 'known' | 'uncertain' | 'stale' | 'missing' };

/** An explicit authored sequence, not a claim that less study covers the same material. */
export function planSession(state: WorkspaceState, requested: 10 | 20 | 45 = state.selectedSessionMinutes ?? state.sessionRecommendation?.minutes ?? 20): SessionPlan {
  const ready = state.lessons.filter(lesson => lesson.state === 'ready' && lesson.exposure !== 'fresh-no-diagram');
  const first = ready.find(lesson => lesson.courseId === 'circuits' && lesson.circuit.topology === 'parallel') ?? ready[0];
  const availability = selectAvailability(state);
  const full: SessionItem[] = [];
  if (first) {
    full.push({ id: `${first.id}-explore`, lessonId: first.id, title: first.title, kind: 'lesson', minutes: 8 });
    full.push({ id: `${first.id}-predict`, lessonId: first.id, title: first.kind === 'circuit' ? 'Optional prediction and reflection' : 'Check the source reasoning', kind: first.kind === 'circuit' ? 'prediction' : 'practice', minutes: 2 });
    full.push({ id: `${first.id}-fresh`, lessonId: first.id, title: 'Fresh application and reflection', kind: 'practice', minutes: 10 });
    const alternatives = ready.filter(item => item.id !== first.id);
    const series = alternatives.find(item => item.courseId === first.courseId && item.kind === 'circuit' && item.circuit.topology === 'series');
    const probability = alternatives.find(item => item.courseId === 'probability');
    const writing = alternatives.find(item => item.courseId === 'writing');
    const used = new Set([first.id]);
    for (const [preferred, minutes] of [[series, 8], [probability, 9], [writing, 8]] as const) {
      const lesson = preferred && !used.has(preferred.id) ? preferred : alternatives.find(item => !used.has(item.id));
      if (lesson) { used.add(lesson.id); full.push({ id: `${lesson.id}-practice`, lessonId: lesson.id, title: lesson.title, kind: lesson.kind === 'circuit' ? 'lesson' : 'practice', minutes }); }
    }
  }
  const items: SessionItem[] = [], omittedItems: SessionItem[] = [];
  let minutes = 0;
  for (const item of full) {
    if (minutes + item.minutes <= requested) { items.push(item); minutes += item.minutes; }
    else omittedItems.push(item);
  }
  return { minutes, requestedMinutes: requested, items, omittedItems, omittedMinutes: omittedItems.reduce((sum, item) => sum + item.minutes, 0),
    longerThanAvailable: availability.availableMinutes !== null && requested > availability.availableMinutes,
    availableMinutes: availability.availableMinutes, status: availability.status };
}
