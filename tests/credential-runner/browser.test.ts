import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext } from 'playwright-core';
import { createServer as createHttpsServer } from 'node:https';
import { createServer as createHttpServer } from 'node:http';
import { connect } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createLoginEngine } from '../../services/credential-runner/browser.mjs';

// Original synthetic pages, ephemeral test TLS key, and a loopback-only proxy.
// The proxy never resolves a provider hostname: only the two reviewed hostnames
// map to our local fixture. Everything else is denied. No real provider access.
describe.runIf(process.env.SOMA_CREDENTIAL_BROWSER_TESTS === 'true')('credential browser isolation — actual Chromium and HTTPS fixture', () => {
  let browser: Browser;
  let key: Buffer, cert: Buffer, directory: string;
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'soma-credential-test-'));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=synthetic.invalid',
      '-keyout', join(directory, 'key.pem'), '-out', join(directory, 'cert.pem')], { stdio: 'ignore' });
    key = await readFile(join(directory, 'key.pem')); cert = await readFile(join(directory, 'cert.pem'));
    browser = await chromium.launch({ headless: true });
  });
  afterAll(async () => { await browser?.close(); if (directory) await rm(directory, { recursive: true, force: true }); });
  const login = 'https://shib.bu.edu/idp/profile/SAML2/Redirect/SSO?execution=synthetic';
  const action = 'https://shib.bu.edu/idp/profile/SAML2/Redirect/SSO?execution=synthetic-submit';
  const credential = { identifier: 'synthetic', password: 'original-synthetic-canary-8s' };
  async function safeFailure(operation:Promise<unknown>,code:string) {
    const error=await operation.catch(error=>error);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({code,status:409,message:'Secure sign-in stopped at a reviewed safety check.'});
    const failure=error as Error&{code:string;status:number};
    const details=JSON.stringify({name:failure.name,message:failure.message,code:failure.code,status:failure.status,stack:failure.stack});
    expect(details).not.toContain(credential.password);
    expect(details).not.toContain(credential.identifier);
    expect(details).not.toContain(login);
    expect(details).not.toContain(action);
  }
  const form = (extra = '', script = '') => `<!doctype html><form method="post" action="${action}">
    <input name="j_username" type="text"><input name="j_password" type="password">
    <input name="csrf_token" type="hidden" value="original-synthetic-csrf">
    <button name="_eventId_proceed" ${extra}>Continue</button></form><script>${script}</script>`;

  async function fixture(html: string, redirectStatus = 303, redirectTarget = 'https://learn.bu.edu/synthetic-auth', responseBody = '', authenticatedHtml = '<!doctype html><h1>Original synthetic MFA step</h1>', inputState: any = null,transitionDelay = 0, requireNativeHeaders = false) {
    let context: BrowserContext;let importedState:any='not-started';
    const transmitted: { url: string; method: string; body: string; headers: Record<string, string | string[] | undefined>; dom?: unknown }[] = [];
    const sockets = new Set<any>();
    const domEvents: unknown[] = [];
    const tls = createHttpsServer({ key, cert }, async (request, response) => {
      const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(chunk);
      const url = 'https://' + request.headers.host + request.url;
      const body = Buffer.concat(chunks).toString('utf8');
      transmitted.push({ url, method: request.method!, body, headers: request.headers });
      if (url === 'https://learn.bu.edu/') { if(transitionDelay){response.writeHead(200,{'content-type':'text/html'});response.end(`<!doctype html><p>Original synthetic identity transition</p><script>setTimeout(()=>location.replace(${JSON.stringify(login)}),${transitionDelay})</script>`);}else{response.writeHead(302, { location: login });response.end();}return; }
      if (url.startsWith(login) && request.method === 'GET') { response.writeHead(200, { 'content-type': 'text/html', ...(requireNativeHeaders ? {'set-cookie':'JSESSIONID=original-synthetic-csrf-session; Path=/; Secure; HttpOnly; SameSite=Lax'} : {}) }); response.end(html); return; }
      if (url === action && request.method === 'POST') { if(requireNativeHeaders && (request.headers.origin !== 'https://shib.bu.edu' || request.headers.referer !== login || !request.headers.cookie?.includes('JSESSIONID=original-synthetic-csrf-session'))){response.writeHead(403,{'content-type':'text/html'});response.end('<h1>Original synthetic CSRF rejection</h1>');return;} response.writeHead(redirectStatus, { location: redirectTarget, 'content-type': 'text/html' }); response.end(responseBody); return; }
      if (url === 'https://learn.bu.edu/learn/api/v1/users/me') { response.writeHead(200, { 'content-type': 'application/json' }); response.end('{"id":"synthetic_student_1"}'); return; }
      if (url === 'https://learn.bu.edu/synthetic-auth') { response.writeHead(200, { 'content-type': 'text/html' }); response.end(authenticatedHtml); return; }
      response.writeHead(404); response.end();
    });
    tls.on('connection', (socket) => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
    await new Promise<void>((resolve) => tls.listen(0, '127.0.0.1', resolve));
    const tlsPort = (tls.address() as any).port;
    const proxy = createHttpServer((_request, response) => { response.writeHead(403); response.end(); });
    proxy.on('connect', (request, downstream, head) => {
      if (!['shib.bu.edu:443', 'learn.bu.edu:443'].includes(request.url!)) { downstream.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
      const upstream = connect({ host: '127.0.0.1', port: tlsPort }, () => {
        downstream.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream.write(head); downstream.pipe(upstream); upstream.pipe(downstream);
      });
      sockets.add(upstream); upstream.once('close', () => sockets.delete(upstream));
      upstream.on('error', () => downstream.destroy()); downstream.on('error', () => upstream.destroy());
      downstream.on('close', () => upstream.destroy());
    });
    proxy.on('connection', (socket) => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
    await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve));
    const proxyUrl = 'http://127.0.0.1:' + (proxy.address() as any).port;
    const upstream = { async start(options:any) {
      importedState=options.state;
      context = await browser.newContext({ serviceWorkers: 'block', proxy: { server: proxyUrl }, ignoreHTTPSErrors: true });
      await context.exposeBinding('syntheticObserve', (_source, value) => { domEvents.push(value); });
      await context.addInitScript(() => {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!;
        Object.defineProperty(HTMLInputElement.prototype, 'value', { ...descriptor, set(value) {
          if (['j_username','j_password'].includes(this.name) && value) (window as any).syntheticObserve({ event: 'dom-write', field: this.name });
          descriptor.set!.call(this, value);
        } });
        addEventListener('submit', () => { (window as any).syntheticObserve({ event: 'submit' }); }, true);
      });
      await context.newPage();
      return { context, connectUrl: 'ws://127.0.0.1:1', async pages() { return [{ id: 'synthetic-page', page: context.pages()[0] }]; },
        snapshot: () => context.storageState(), async view() { throw new Error('No synthetic viewer requested'); }, close: () => context.close() };
    } };
    const engine = createLoginEngine(upstream);
    try {
      const session = await engine.start({ state: inputState, proxyUrl });
      return { session, domEvents, get importedState(){return importedState;}, get context() { return context; }, transmitted, async close() {
        await session.close(); for (const socket of sockets) socket.destroy();
        await Promise.all([new Promise<void>((resolve) => tls.close(() => resolve())), new Promise<void>((resolve) => proxy.close(() => resolve()))]);
      } };
    } catch (error) {
      for (const socket of sockets) socket.destroy(); tls.close(); proxy.close(); throw error;
    }
  }

  it('waits for a delayed federated transition before inspecting the strict empty login form',async()=>{
    const test=await fixture(form(),303,'https://learn.bu.edu/synthetic-auth','','<!doctype html><h1>Original synthetic MFA step</h1>',null,250);
    try{expect(await test.session.inspect()).toEqual({reviewed:true});expect(test.transmitted.some(request=>request.url===login)).toBe(true);expect(test.transmitted.filter(request=>request.method==='POST')).toHaveLength(0);expect(test.domEvents).toEqual([]);}finally{await test.close();}
  });

  it('starts credential enrollment without importing previously saved private authorization',async()=>{
    const privateState={cookies:[{name:'synthetic_saved_auth',value:'original-private-state-canary',domain:'learn.bu.edu',secure:true,httpOnly:true}],origins:[{origin:'https://learn.bu.edu',localStorage:[{name:'private',value:'original-private-state-canary'}]}]};
    const test=await fixture(form(),303,'https://learn.bu.edu/synthetic-auth','','<!doctype html><h1>Original synthetic MFA step</h1>',privateState);
    try{expect(test.importedState).toBeNull();expect(await test.session.inspect()).toEqual({reviewed:true});expect(privateState.cookies[0].value).toBe('original-private-state-canary');}finally{await test.close();}
  });

  it('sends one checked POST through the proxy without inserting secrets or invoking hostile submit handlers', async () => {
    const test = await fixture(form('', `window.submits=0;document.forms[0].addEventListener('submit',()=>{window.submits++;document.forms[0].action='https://learn.bu.edu/exfil';});`));
    try {
      expect(await test.session.inspect()).toEqual({ reviewed: true });
      await test.session.fill(credential, async () => {});
      const posts = test.transmitted.filter((request) => request.method === 'POST');
      expect(posts).toHaveLength(1); expect(posts[0].url).toBe(action);
      const fields = new URLSearchParams(posts[0].body);
      expect(fields.get('j_password')).toBe(credential.password); expect(fields.get('csrf_token')).toBe('original-synthetic-csrf');
      expect(fields.has('_eventId_proceed')).toBe(true);
      expect(test.domEvents).toEqual([]);
      expect(test.transmitted.some((request) => request.url.includes(credential.password))).toBe(false);
      expect(await test.session.safeForViewer()).toBe(true);
    } finally { await test.close(); }
  });

  it('preserves the reviewed native-form origin, referrer and secure session cookie for CSRF validation', async () => {
    const test=await fixture(form(),303,'https://learn.bu.edu/synthetic-auth','','<!doctype html><h1>Original synthetic MFA step</h1>',null,0,true);
    try {
      await test.session.fill(credential,async()=>{});
      const posts=test.transmitted.filter(request=>request.method==='POST');
      expect(posts).toHaveLength(1);
      expect(posts[0].headers.origin).toBe('https://shib.bu.edu');
      expect(posts[0].headers.referer).toBe(login);
      expect(posts[0].headers.cookie).toContain('JSESSIONID=original-synthetic-csrf-session');
      expect(test.domEvents).toEqual([]);
    } finally {await test.close();}
  });

  it.each(['formmethod="get"', 'formtarget="_blank"', 'formenctype="text/plain"', 'formaction="https://learn.bu.edu/exfil"'])('rejects submitter override %s before any secret request', async (override) => {
    const test = await fixture(form(override));
    try {
      expect(await test.session.inspect()).toEqual({ reviewed: false });
      await safeFailure(test.session.fill(credential, async () => {}),'credential_form_fields');
      expect(test.transmitted.filter((request) => request.method === 'POST')).toHaveLength(0);
    } finally { await test.close(); }
  });

  it('reports a fixed response stage when the provider rejects the checked POST',async()=>{
    const test=await fixture(form(),403);
    try {
      await safeFailure(test.session.fill(credential,async()=>{}),'credential_submit_status');
      expect(test.transmitted.filter(request=>request.method==='POST')).toHaveLength(1);
    }finally{await test.close();}
  });

  it.each([1,2])('reports a fixed authorization stage when recheck %s denies without leaking its error',async(deniedCheck)=>{
    const test=await fixture(form());let checks=0;
    try {
      await safeFailure(test.session.fill(credential,async()=>{if(++checks===deniedCheck)throw new Error(credential.password+' '+action); }),'credential_submit_authorization');
      expect(test.transmitted.filter(request=>request.method==='POST')).toHaveLength(0);
    }finally{await test.close();}
  });

  it('rejects unreviewed hidden fields with a fixed field stage',async()=>{
    const test=await fixture(form().replace('</form>','<input type="hidden" name="unreviewed" value="original-synthetic-hidden"></form>'));
    try {
      await safeFailure(test.session.fill(credential,async()=>{}),'credential_form_fields');
      expect(test.transmitted.filter(request=>request.method==='POST')).toHaveLength(0);
    }finally{await test.close();}
  });

  it('cannot send to a form action swapped while authorization is pending', async () => {
    const test = await fixture(form());
    try {
      let swapped = false;
      await test.session.fill(credential, async () => { if (!swapped) { swapped = true; await test.context.pages()[0].evaluate(() => { document.forms[0].action = 'https://learn.bu.edu/exfil'; }); } });
      const posts = test.transmitted.filter((request) => request.method === 'POST');
      expect(posts).toHaveLength(1); expect(posts[0].url).toBe(action);
      expect(test.transmitted.some((request) => request.url.includes('/exfil'))).toBe(false);
    } finally { await test.close(); }
  });

  it('fails closed when authorization navigates to a new document before filling', async () => {
    const test = await fixture(form());
    try {
      await safeFailure(test.session.fill(credential, async () => { await test.context.pages()[0].goto(login + '&changed=true'); }),'credential_page_guard');
      expect(test.transmitted.filter((request) => request.method === 'POST')).toHaveLength(0);
    } finally { await test.close(); }
  });

  it('rejects an unreviewed iframe before secret filling', async () => {
    const test = await fixture(form() + '<iframe src="about:blank"></iframe>');
    try {
      expect(await test.session.inspect()).toEqual({ reviewed: false });
      await safeFailure(test.session.fill(credential, async () => {}),'credential_frame_guard');
      expect(test.transmitted.filter((request) => request.method === 'POST')).toHaveLength(0);
    } finally { await test.close(); }
  });

  it.each([301, 307, 308])('rejects HTTP %s without reposting a credential body', async (status) => {
    const test = await fixture(form(), status, 'https://learn.bu.edu/exfil');
    try {
      await safeFailure(test.session.fill(credential, async () => {}),'credential_submit_redirect');
      expect(test.transmitted.filter((request) => request.method === 'POST')).toHaveLength(1);
      expect(test.transmitted.some((request) => request.url.includes('/exfil'))).toBe(false);
    } finally { await test.close(); }
  });

  it('rejects a redirect that reflects a password using form-query plus encoding', async () => {
    const privateInput = { ...credential, password: 'synthetic space & canary' };
    const target = 'https://learn.bu.edu/synthetic-auth?' + new URLSearchParams({ marker: privateInput.password });
    const test = await fixture(form(), 303, target);
    try {
      await safeFailure(test.session.fill(privateInput, async () => {}),'credential_submit_reflection');
      expect(test.transmitted.some((request) => request.url === target)).toBe(false);
    } finally { await test.close(); }
  });

  it.each(['raw', 'encoded', 'base64'])('rejects a successful response reflecting a password (%s) before a viewer can display it', async (encoding) => {
    const privateInput = { ...credential, password: 'synthetic space&☃"canary' };
    const reflected = encoding === 'raw' ? privateInput.password : encoding === 'encoded' ? encodeURIComponent(privateInput.password) : Buffer.from(privateInput.password).toString('base64');
    const test = await fixture(form(), 200, 'https://learn.bu.edu/synthetic-auth', `<h1>prefix${reflected}suffix</h1>`);
    try { await safeFailure(test.session.fill(privateInput, async () => {}),'credential_submit_reflection'); }
    finally { await test.close(); }
  });

  it('blocks unreviewed passive assets without treating their denial as a credential navigation failure',async()=>{
    const html='<!doctype html><h1>Original synthetic MFA step</h1><img src="https://unreviewed.invalid/denied-image">';
    const test=await fixture(form(),303,'https://learn.bu.edu/synthetic-auth','',html);
    try {
      await test.session.fill(credential,async()=>{});
      expect(await test.session.safeForViewer()).toBe(true);
      expect(test.transmitted.some(request=>request.url.includes('unreviewed.invalid'))).toBe(false);
      expect(test.transmitted.filter(request=>request.method==='POST')).toHaveLength(1);
    }finally{await test.close();}
  });

  it('reports the frame boundary after a checked POST reaches an unreviewed MFA frame',async()=>{
    const test=await fixture(form(),303,'https://learn.bu.edu/synthetic-auth','','<!doctype html><iframe src="about:blank"></iframe>');
    try {
      await safeFailure(test.session.fill(credential,async()=>{}),'credential_frame_guard');
      expect(test.transmitted.filter(request=>request.method==='POST')).toHaveLength(1);
    }finally{await test.close();}
  });

  it('reports a remaining password page without making a second credential request',async()=>{
    const test=await fixture(form(),303,'https://learn.bu.edu/synthetic-auth','','<!doctype html><input type="password">');
    try {
      await safeFailure(test.session.fill(credential,async()=>{}),'credential_post_password');
      expect(test.transmitted.filter(request=>request.method==='POST')).toHaveLength(1);
    }finally{await test.close();}
  });

  it('reports the display guard if the next reviewed page reflects a credential',async()=>{
    const test=await fixture(form(),303,'https://learn.bu.edu/synthetic-auth','',`<!doctype html><h1>${credential.password}</h1>`);
    try {
      await safeFailure(test.session.fill(credential,async()=>{}),'credential_display_guard');
      expect(test.transmitted.filter(request=>request.method==='POST')).toHaveLength(1);
    }finally{await test.close();}
  });

  it('does not pass secret canaries into the provider JavaScript realm during reflection checks', async () => {
    const hostile = `<h1>Original synthetic provider page</h1><script>
      const originalSome = Array.prototype.some;
      Array.prototype.some = function(...args) { localStorage.setItem('synthetic-spy', JSON.stringify(this)); return originalSome.apply(this, args); };
    </script>`;
    const test = await fixture(form(), 303, 'https://learn.bu.edu/synthetic-auth', '', hostile);
    try {
      await test.session.fill(credential, async () => {});
      const observed = await test.context.pages()[0].evaluate(() => localStorage.getItem('synthetic-spy'));
      expect(observed ?? '').not.toContain(credential.password);
      expect(observed ?? '').not.toContain(Buffer.from(credential.password).toString('base64'));
    } finally { await test.close(); }
  });

  it('handoff excludes JS cookies, identity-provider cookies and web storage', async () => {
    const test = await fixture(form());
    try {
      await test.session.fill(credential, async () => {});
      await test.context.addCookies([
        { name: 'auth', value: 'synthetic-session', domain: 'learn.bu.edu', path: '/', secure: true, httpOnly: true },
        { name: 'js', value: credential.password, domain: 'learn.bu.edu', path: '/', secure: true, httpOnly: false },
        { name: 'idp', value: 'synthetic-idp', domain: 'shib.bu.edu', path: '/', secure: true, httpOnly: true },
      ]);
      await test.context.pages()[0].evaluate((password) => { localStorage.setItem('do-not-export', password); }, credential.password);
      const state = await test.session.snapshot();
      expect(state.origins).toEqual([]); expect(state.cookies.map((cookie: any) => cookie.name)).toEqual(['auth']);
      expect(JSON.stringify(state)).not.toContain(credential.password);
    } finally { await test.close(); }
  });
});
