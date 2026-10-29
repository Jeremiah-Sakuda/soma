import { afterEach, describe, expect, it, vi } from 'vitest';
import { logBrowserReadFailure, type BrowserReadPhase } from '../../src/lib/server/connectors/browser-diagnostics';

afterEach(() => vi.restoreAllMocks());
describe('safe browser operation diagnostics', () => {
  it('logs only a fixed event, known phase and allowlisted error type', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    logBrowserReadFailure('cdp-connect', new TypeError('Private provider exception'));
    expect(warn).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ event: 'browser_read_failed', phase: 'cdp-connect', errorType: 'TypeError' }));
  });
  it.each(['Error', 'TypeError', 'ReferenceError', 'TimeoutError'])('allows the fixed error type %s without its contents', name => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = Object.assign(new Error('Private course body'), { name, code: 'secret-code', stack: 'secret-stack' });
    logBrowserReadFailure('source-read', error);
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toEqual({ event: 'browser_read_failed', phase: 'source-read', errorType: name });
  });
  it('does not log tainted error names, messages, codes, stacks, causes or custom serialization', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = Object.assign(new Error('synthetic-secret-message'), {
      name: 'synthetic-secret-name', code: 'synthetic-secret-code', stack: 'synthetic-secret-stack',
      cause: { password: 'synthetic-secret-password' }, toJSON: () => ({ authorization: 'synthetic-secret-serialization' }),
    });
    logBrowserReadFailure('source-publication', error);
    expect(warn).toHaveBeenCalledExactlyOnceWith('{"event":"browser_read_failed","phase":"source-publication","errorType":"unknown"}');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('synthetic-secret');
  });
  it('does not trust exception-shaped objects or access their other properties', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = { name: 'TypeError', get message() { throw new Error('Private property'); }, get constructor() { throw new Error('Private constructor'); }, toJSON() { throw new Error('Private serializer'); } };
    logBrowserReadFailure('request', error);
    expect(JSON.parse(warn.mock.calls[0][0] as string).errorType).toBe('unknown');
  });
  it('safely handles a hostile name getter and an invalid runtime phase', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = new Error(); Object.defineProperty(error, 'name', { get() { throw new Error('Private getter'); } });
    expect(() => logBrowserReadFailure('synthetic-secret-phase' as BrowserReadPhase, error)).not.toThrow();
    expect(warn).toHaveBeenCalledExactlyOnceWith('{"event":"browser_read_failed","phase":"request","errorType":"unknown"}');
  });
  it('reads a dynamic error name once so validation and logging cannot observe different values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let reads = 0;
    const error = new Error(); Object.defineProperty(error, 'name', { get() { return ++reads === 1 ? 'Error' : 'synthetic-secret-name'; } });
    logBrowserReadFailure('session-read', error);
    expect(reads).toBe(1);
    expect(warn).toHaveBeenCalledExactlyOnceWith('{"event":"browser_read_failed","phase":"session-read","errorType":"Error"}');
  });
  it('preserves the original failure path when the logging sink fails', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => { throw new Error('Logger unavailable'); });
    expect(() => logBrowserReadFailure('lease-persist', new Error('Private cause'))).not.toThrow();
  });
});
