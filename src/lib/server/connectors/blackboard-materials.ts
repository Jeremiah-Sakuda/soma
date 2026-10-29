import type { Page } from 'playwright-core';
import { canonicalBlackboardCourseUrl } from '../../domain/blackboard-navigation';
import { WorkspaceStoreError } from '../store';
import type { CollectedSource } from './ingest';
import { readBlackboardJson, validateBlackboardReadPath } from './blackboard-api';

export type BlackboardTraversal = { providerCourseId: string; pending: string[]; seen: string[]; materialIds: string[] };
const ID = /^[A-Za-z0-9_-]{1,160}$/;
const ORIGIN = 'https://learn.bu.edu';
const fail = (code = 'blackboard_read_response') => new WorkspaceStoreError('Blackboard material could not be read within the supported scope. Previous material was retained.', 422, code);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function coursePath(raw: string, courseId: string): string {
  if (/[\u0000-\u0020\u007f\\]|%2f|%5c|%2e/i.test(raw) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(raw)) throw fail('blackboard_read_scope');
  let url: URL; try { url = new URL(raw, ORIGIN); } catch { throw fail('blackboard_read_scope'); }
  if (url.origin !== ORIGIN || url.username || url.password || url.hash || (!raw.startsWith('/') && !raw.startsWith(`${ORIGIN}/`)) || raw.startsWith('//')) throw fail('blackboard_read_scope');
  if (![`/learn/api/v1/courses/${courseId}/`, `/learn/api/public/v1/courses/${courseId}/`].some(prefix => url.pathname.startsWith(prefix))) throw fail('blackboard_read_scope');
  return validateBlackboardReadPath(url.pathname + url.search, { courseIds: [courseId] });
}
function enforceCapacity(pending: string[], seen: Set<string>, materialIds: Set<string>) {
  if (pending.length + seen.size + materialIds.size > 2000) throw fail('blackboard_traversal_limit');
}
function traversal(courseId: string, cursor?: BlackboardTraversal) {
  if (!ID.test(courseId) || (cursor && cursor.providerCourseId !== courseId)) throw fail('blackboard_read_scope');
  if (cursor && (!Array.isArray(cursor.pending) || !Array.isArray(cursor.seen) || !Array.isArray(cursor.materialIds)
    || [...cursor.pending, ...cursor.seen, ...cursor.materialIds].some(item => typeof item !== 'string'))) throw fail('blackboard_read_scope');
  const pending = cursor ? cursor.pending.map(path => coursePath(path, courseId)) : [`/learn/api/v1/courses/${courseId}/contents?limit=20`, `/learn/api/v1/courses/${courseId}/announcements?limit=20`];
  const seen = new Set(cursor?.seen.map(path => coursePath(path, courseId)) ?? []), materialIds = new Set(cursor?.materialIds ?? []);
  for (const id of materialIds) {
    const prefix = [`${courseId}:content:`, `${courseId}:announcement:`].find(prefix => id.startsWith(prefix));
    if (!prefix || !ID.test(id.slice(prefix.length))) throw fail('blackboard_read_scope');
  }
  enforceCapacity(pending, seen, materialIds);
  return { pending: [...new Set(pending)].filter(path => !seen.has(path)), seen, materialIds };
}
async function plaintext(page: Pick<Page, 'evaluate'>, html: string): Promise<string> {
  return page.evaluate(value => {
    const template = document.createElement('template'); template.innerHTML = value;
    template.content.querySelectorAll('script,style,iframe,form,input,button,select,textarea,object,embed,link,meta,base').forEach(node => node.remove());
    template.content.querySelectorAll('br,p,div,li,tr,h1,h2,h3,h4,h5,h6').forEach(node => node.append(document.createTextNode('\n')));
    return (template.content.textContent ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }, html);
}

/** A bounded, resumable observation pass. Source interpretation and publication remain outside it. */
export async function collectBlackboardMaterials(page: Pick<Page, 'request' | 'evaluate'>, providerCourseId: string, cursor: BlackboardTraversal | undefined, deadline: number): Promise<{ records: CollectedSource[]; cursor?: BlackboardTraversal; complete: boolean; warnings: number; materialIds: string[] }> {
  const state = traversal(providerCourseId, cursor), records: CollectedSource[] = [], produced = new Map<string, string>();
  const retainedBeforeRun = new Set(state.materialIds);
  let warnings = 0, requests = 0;
  while (state.pending.length && requests < 4 && records.length < 40) {
    const path = state.pending.shift()!;
    if (state.seen.has(path)) continue;
    requests++;
    const raw = await readBlackboardJson(page.request, path, { courseIds: [providerCourseId] }, deadline);
    if (!object(raw) || !Array.isArray(raw.results) || (raw.courseId !== undefined && raw.courseId !== providerCourseId)) throw fail();
    if (raw.results.length > 2000) throw fail('blackboard_traversal_limit');
    // Omitted paging is not evidence that every item was returned.
    if (!object(raw.paging)) throw fail('blackboard_paging_unverified');
    let next: string | undefined;
    if (raw.paging !== undefined) {
      if (!object(raw.paging)) throw fail();
      if (raw.paging.nextPage !== undefined && raw.paging.nextPage !== null && raw.paging.nextPage !== '') {
        if (typeof raw.paging.nextPage !== 'string') throw fail();
        next = coursePath(raw.paging.nextPage, providerCourseId);
        if (next === path || state.seen.has(next)) throw fail('blackboard_paging_cycle');
      }
    }
    const announcement = new URL(path, ORIGIN).pathname.endsWith('/announcements');
    let finishedPage = true;
    for (const item of raw.results) {
      if (!object(item)) { warnings++; continue; }
      if (item.courseId !== undefined && item.courseId !== providerCourseId) throw fail('blackboard_read_scope');
      if (typeof item.id !== 'string' || !ID.test(item.id)) { warnings++; continue; }
      const id = `${providerCourseId}:${announcement ? 'announcement' : 'content'}:${item.id}`;
      if (retainedBeforeRun.has(id)) continue;
      if (records.length >= 40) { state.pending.unshift(path); finishedPage = false; break; }
      const handler = typeof item.contentHandler === 'string' ? item.contentHandler : object(item.contentHandler) && typeof item.contentHandler.id === 'string' ? item.contentHandler.id : undefined;
      if (handler && (/file|pdf|image|lti|external|link|test|assessment|assignment/i.test(handler) || !['resource/x-bb-document', 'resource/x-bb-folder', 'resource/x-bb-lesson'].includes(handler))) { warnings++; continue; }
      const folder = !announcement && (item.hasChildren === true || handler === 'resource/x-bb-folder' || handler === 'resource/x-bb-lesson');
      if (folder) {
        const children = `/learn/api/v1/courses/${providerCourseId}/contents/${item.id}/children?limit=20`;
        if (!state.seen.has(children) && !state.pending.includes(children)) state.pending.push(children);
      }
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      if (!title || title.length > 300 || /[\u0000-\u001f\u007f]/.test(title)) { warnings++; continue; }
      const html=typeof item.body==='string'?item.body:object(item.body)&&typeof item.body.rawText==='string'?item.body.rawText:undefined;
      if (!html?.trim()) { if (!folder) warnings++; continue; }
      let body: string;
      try { body = await plaintext(page, html); } catch { warnings++; continue; }
      if (!body || body.length > 48_000) { warnings++; continue; }
      const modifiedAt = typeof item.modifiedDate === 'string' && Number.isFinite(Date.parse(item.modifiedDate)) ? new Date(item.modifiedDate).toISOString() : undefined;
      const record: CollectedSource = { id, title, body, url: announcement ? `${ORIGIN}/ultra/courses/${providerCourseId}/announcements` : canonicalBlackboardCourseUrl(providerCourseId), kind: 'blackboard', ...(modifiedAt ? { modifiedAt } : {}) };
      const fingerprint = JSON.stringify(record), previous = produced.get(id);
      if (previous && previous !== fingerprint) throw fail('blackboard_material_conflict');
      if (!previous) { records.push(record); produced.set(id, fingerprint); state.materialIds.add(id); }
      enforceCapacity(state.pending, state.seen, state.materialIds);
    }
    if (finishedPage) {
      state.seen.add(path);
      if (next && !state.seen.has(next) && !state.pending.includes(next)) state.pending.push(next);
    }
    state.pending = state.pending.filter(path => !state.seen.has(path));
    enforceCapacity(state.pending, state.seen, state.materialIds);
  }
  const complete = state.pending.length === 0;
  return { records, ...(complete ? {} : { cursor: { providerCourseId, pending: state.pending, seen: [...state.seen], materialIds: [...state.materialIds] } }), complete, warnings, materialIds: [...state.materialIds] };
}
