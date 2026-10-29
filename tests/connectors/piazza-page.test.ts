import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page } from 'playwright-core';
import { renderPiazzaCourse } from '../../src/lib/server/connectors/piazza-page';
import { isAllowedPiazzaRequest } from '../../src/lib/domain/piazza-navigation';

const qa = '/packs/js/qa-original_synthetic.chunk.js';
function fixture(sources: string[] = [qa]) {
  const state = { url: 'https://piazza.com/class/original-synthetic', password: 0, redirectedUrl: '', responseOk: true, sources, events: [] as string[], failedMarker: '', onInventory: () => undefined, onReload: () => undefined, onWait: (_selector: string) => undefined };
  const waitFor = (selector: string) => vi.fn(async () => { state.events.push(`wait:${selector}`); state.onWait(selector); if (state.failedMarker === selector) throw new Error('Synthetic absent marker'); });
  const dropdown = { waitFor: waitFor('#classDropdownMenuId') }, feed = { waitFor: waitFor('#feed_list li.feed_item'), first: () => feed };
  const inventory = { evaluateAll: vi.fn(async (callback: (nodes: unknown[]) => string[]) => {
    state.events.push('inventory'); state.onInventory();
    // Execute the actual inventory callback against raw DOM attribute values, not pre-filtered paths.
    return callback(state.sources.map(src => ({ getAttribute: (name: string) => name === 'src' ? src : null })));
  }) };
  const locator = vi.fn((selector: string) => {
    if (selector === 'input[type="password"]') return { count: vi.fn(async () => state.password) };
    if (selector === 'script[src]') return inventory;
    if (selector === '#classDropdownMenuId') return dropdown;
    if (selector === '#feed_list li.feed_item') return feed;
    throw new Error('Unexpected synthetic locator');
  });
  const reload = vi.fn(async () => { state.events.push('reload'); state.onReload(); if (state.redirectedUrl) state.url = state.redirectedUrl; return { ok: () => state.responseOk }; });
  const authorize = vi.fn((paths: readonly string[]) => { state.events.push('authorize');
    for (const path of paths) expect(isAllowedPiazzaRequest({ url: 'https://piazza.com' + path, method: 'GET', resourceType: 'script', topLevel: false }, ['original-synthetic'], 'collect', paths)).toBe(true);
  });
  return { state, page: { url: () => state.url, locator, reload } as unknown as Page, locator, reload, authorize, inventory, dropdown, feed };
}
beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(1000); vi.stubGlobal('location', { href: 'https://piazza.com/class/original-synthetic' }); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('selected Piazza application bootstrap (synthetic DOM attributes)', () => {
  it('canonicalizes observed absolute/root-relative app assets, deduplicates them, and authorizes before reload', async () => {
    const f = fixture([qa, `https://piazza.com${qa}`, '/packs/js/vendor-original.chunk.js', '/packs/js/runtime~qa-original.js', '/packs/js/vendors~qa-original.js', 'https://piazza.com/javascripts/pushstream.js', '/javascripts/highlightjs/highlight.pack.js']);
    await renderPiazzaCourse(f.page, 30000, f.authorize);
    expect(f.authorize).toHaveBeenCalledExactlyOnceWith([qa, '/packs/js/vendor-original.chunk.js', '/packs/js/runtime~qa-original.js', '/packs/js/vendors~qa-original.js', '/javascripts/pushstream.js', '/javascripts/highlightjs/highlight.pack.js']);
    expect(f.state.events).toEqual(['inventory', 'authorize', 'reload', 'wait:#classDropdownMenuId', 'wait:#feed_list li.feed_item']);
    expect(f.reload).toHaveBeenCalledWith({ waitUntil: 'domcontentloaded', timeout: 20000 });
    expect(f.dropdown.waitFor).toHaveBeenCalledWith({ state: 'attached', timeout: 8000 });
    expect(f.feed.waitFor).toHaveBeenCalledWith({ state: 'attached', timeout: 8000 });
  });
  it('never adds foreign, credential-bearing, queried, encoded, traversal or unreviewed script paths', async () => {
    const blocked = [
      'https://foreign.test/packs/js/qa-foreign.chunk.js', '//piazza.com/packs/js/qa-protocol.chunk.js',
      'https://user:secret@piazza.com/packs/js/qa-auth.chunk.js', 'https://piazza.com:8443/packs/js/qa-port.chunk.js',
      '/packs/js/qa-query.chunk.js?token=private', '/packs/js/qa-hash.chunk.js#secret',
      '/packs/js/../qa-traversal.chunk.js', '/packs/js/%71a-encoded.chunk.js', '/packs/js/qa-space.chunk.js ',
      'javascript:privateCode()', 'data:text/javascript,privateCode()', '',
      '/javascripts/private-action.js', '/javascripts/messaging-worker.js', '/modules/qa-private.chunk.js',
      '/packs/js/nested/qa-nested.chunk.js', '/packs/js/qa-suffix.chunk.js.json',
    ];
    const f = fixture([qa, ...blocked]);
    await renderPiazzaCourse(f.page, 30000, f.authorize);
    expect(f.authorize).toHaveBeenCalledExactlyOnceWith([qa]);
  });
  it.each([[], ['/packs/js/vendor-original.chunk.js'], ['/javascripts/pushstream.js'], ['/packs/js/qa-unrecognized.js']].map(sources => ({ sources })))('does not reload when the verified QA application bundle is absent: $sources', async ({ sources }) => {
    const f = fixture(sources);
    await expect(renderPiazzaCourse(f.page, 30000, f.authorize)).rejects.toMatchObject({ code: 'piazza_read_structure' });
    expect(f.authorize).not.toHaveBeenCalled(); expect(f.reload).not.toHaveBeenCalled();
  });
  it('permits at most one hundred distinct script paths and fails before granting an oversized inventory', async () => {
    const maximum = fixture([qa, ...Array.from({ length: 99 }, (_, index) => `/packs/js/vendor-${index}.js`)]);
    await renderPiazzaCourse(maximum.page, 30000, maximum.authorize);
    expect(maximum.authorize.mock.calls[0][0]).toHaveLength(100);
    const tooMany = fixture([qa, ...Array.from({ length: 100 }, (_, index) => `/packs/js/vendor-${index}.js`)]);
    await expect(renderPiazzaCourse(tooMany.page, 30000, tooMany.authorize)).rejects.toMatchObject({ code: 'piazza_script_capacity', status: 413 });
    expect(tooMany.authorize).not.toHaveBeenCalled(); expect(tooMany.reload).not.toHaveBeenCalled();
  });
  it('requires a supported selected-class URL and an already completed login', async () => {
    const wrong = fixture(); wrong.state.url = 'https://piazza.com/class/other?auth=private';
    await expect(renderPiazzaCourse(wrong.page, 30000, wrong.authorize)).rejects.toMatchObject({ code: 'piazza_read_scope' });
    expect(wrong.locator).not.toHaveBeenCalled();
    const login = fixture(); login.state.password = 1;
    await expect(renderPiazzaCourse(login.page, 30000, login.authorize)).rejects.toMatchObject({ code: 'browser_login_required' });
    expect(login.inventory.evaluateAll).not.toHaveBeenCalled(); expect(login.reload).not.toHaveBeenCalled();
  });
  it.each(['https://piazza.com/class/different-synthetic', 'https://piazza.com/account_login', 'https://foreign.test/class/original-synthetic'])('rejects a reload that leaves the selected class: %s', async redirectedUrl => {
    const f = fixture(); f.state.redirectedUrl = redirectedUrl;
    await expect(renderPiazzaCourse(f.page, 30000, f.authorize)).rejects.toMatchObject({ code: 'browser_login_required' });
    expect(f.dropdown.waitFor).not.toHaveBeenCalled(); expect(f.feed.waitFor).not.toHaveBeenCalled();
  });
  it.each(['?', '#', '?#', '/?'])('accepts only an empty rendered history delimiter after reload: %s', async suffix => {
    const f = fixture(); f.state.redirectedUrl = f.state.url + suffix;
    await expect(renderPiazzaCourse(f.page, 30000, f.authorize)).resolves.toBeUndefined();
    expect(f.feed.waitFor).toHaveBeenCalledOnce();
    // Rendering tolerance is not a permission to issue noncanonical document requests.
    expect(isAllowedPiazzaRequest({ url: f.state.redirectedUrl, method: 'GET', resourceType: 'document', topLevel: true }, ['original-synthetic'], 'collect')).toBe(false);
  });
  it.each(['?cid=12', '?cid=', '?&', '?=', '#post_12', '?cid=12#', '?%00='])('rejects nonempty query/fragment state after reload: %s', async suffix => {
    const f = fixture(); f.state.redirectedUrl = f.state.url + suffix;
    await expect(renderPiazzaCourse(f.page, 30000, f.authorize)).rejects.toMatchObject({ code: 'browser_login_required' });
    expect(f.dropdown.waitFor).not.toHaveBeenCalled(); expect(f.feed.waitFor).not.toHaveBeenCalled();
  });
  it.each(['?cid=12', '#post_12', '/different-class'])('revalidates history and course context after render markers finish: %s', async suffix => {
    const f = fixture();
    f.state.onWait = selector => { if (selector === '#feed_list li.feed_item') f.state.url += suffix; };
    await expect(renderPiazzaCourse(f.page, 30000, f.authorize)).rejects.toMatchObject({ code: 'browser_login_required' });
    expect(f.feed.waitFor).toHaveBeenCalledOnce();
  });
  it('rejects unsuccessful reloads and does not treat a partial application shell as a rendered feed', async () => {
    const failed = fixture(); failed.state.responseOk = false;
    await expect(renderPiazzaCourse(failed.page, 30000, failed.authorize)).rejects.toMatchObject({ code: 'browser_login_required' });
    for (const selector of ['#classDropdownMenuId', '#feed_list li.feed_item']) {
      const missing = fixture(); missing.state.failedMarker = selector;
      await expect(renderPiazzaCourse(missing.page, 30000, missing.authorize)).rejects.toMatchObject({ code: 'piazza_read_structure' });
    }
  });
  it('detects a same-URL login form returned by reload before accepting application markers', async () => {
    const f = fixture(); f.state.onReload = () => { f.state.password = 1; };
    await expect(renderPiazzaCourse(f.page, 30000, f.authorize)).rejects.toMatchObject({ code: 'browser_login_required' });
    expect(f.dropdown.waitFor).not.toHaveBeenCalled(); expect(f.feed.waitFor).not.toHaveBeenCalled();
  });
  it.each([Number.NaN, Number.POSITIVE_INFINITY])('rejects nonfinite deadline %s before DOM inspection', async deadline => {
    const f = fixture();
    await expect(renderPiazzaCourse(f.page, deadline, f.authorize)).rejects.toMatchObject({ code: 'browser_timeout' });
    expect(f.locator).not.toHaveBeenCalled(); expect(f.authorize).not.toHaveBeenCalled();
  });
  it('bounds each wait by the remaining shared deadline and authorizes nothing after inventory expires', async () => {
    const expired = fixture();
    await expect(renderPiazzaCourse(expired.page, 1000, expired.authorize)).rejects.toMatchObject({ code: 'browser_timeout' });
    expect(expired.locator).not.toHaveBeenCalled();
    const inventoryExpired = fixture(); inventoryExpired.state.onInventory = () => { vi.mocked(Date.now).mockReturnValue(30000); };
    await expect(renderPiazzaCourse(inventoryExpired.page, 30000, inventoryExpired.authorize)).rejects.toMatchObject({ code: 'browser_timeout' });
    expect(inventoryExpired.authorize).not.toHaveBeenCalled(); expect(inventoryExpired.reload).not.toHaveBeenCalled();
    vi.mocked(Date.now).mockReturnValue(1000);
    const short = fixture(); short.state.onReload = () => { vi.mocked(Date.now).mockReturnValue(2500); };
    await renderPiazzaCourse(short.page, 3000, short.authorize);
    expect(short.reload).toHaveBeenCalledWith({ waitUntil: 'domcontentloaded', timeout: 2000 });
    expect(short.feed.waitFor).toHaveBeenCalledWith({ state: 'attached', timeout: 500 });
  });
  it('does not reload if installing the exact observed-script policy fails', async () => {
    const f = fixture(); f.authorize.mockImplementation(() => { throw new Error('Original synthetic policy failure'); });
    await expect(renderPiazzaCourse(f.page, 30000, f.authorize)).rejects.toThrow('Original synthetic policy failure');
    expect(f.reload).not.toHaveBeenCalled();
  });
  it('reports shared deadline exhaustion during a marker wait as timeout rather than unsupported structure', async () => {
    for (const selector of ['#classDropdownMenuId', '#feed_list li.feed_item']) {
      vi.mocked(Date.now).mockReturnValue(1000);
      const f = fixture(); f.state.failedMarker = selector;
      f.state.onWait = current => { if (current === selector) vi.mocked(Date.now).mockReturnValue(3000); };
      await expect(renderPiazzaCourse(f.page, 3000, f.authorize)).rejects.toMatchObject({ code: 'browser_timeout' });
    }
  });
});
