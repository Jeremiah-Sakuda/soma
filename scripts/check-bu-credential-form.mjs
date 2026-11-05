import { chromium } from 'playwright-core';
import { createChromiumEngine } from '../services/browser-runner/engine.mjs';
import { startEgressProxy } from '../services/credential-runner/egress.mjs';
import { createLoginEngine } from '../services/credential-runner/browser.mjs';
import { ALLOWED_HOSTS } from '../services/credential-runner/policy.mjs';
// Empty, unauthenticated form review only. Never loads saved state, decrypts a
// credential, fills a field, submits login, reads courses or creates a cloud job.
let proxy,
  session,
  underlying,
  stage = 'configuration';
try {
  const diagnose = process.argv.includes('--diagnose-structure');
  if (process.argv.slice(2).some((arg) => arg !== '--diagnose-structure'))
    throw new Error('Unsupported option.');
  stage = 'proxy';
  proxy = await startEgressProxy({ allowedHosts: ALLOWED_HOSTS });
  const base = createChromiumEngine({
    async launchPersistentContext(directory, options) {
      return chromium.launchPersistentContext(directory, {
        ...options,
        proxy: { server: proxy.url },
      });
    },
  });
  const capture = {
    async start(options) {
      underlying = await base.start(options);
      return underlying;
    },
  };
  stage = 'browser';
  session = await createLoginEngine(capture).start({ state: null, proxyUrl: proxy.url });
  stage = 'inspect';
  await underlying.context
    .pages()[0]
    ?.waitForSelector('input[type=password]', { state: 'attached', timeout: 10000 })
    .catch(() => undefined);
  const result = await session.inspect();
  const output = {
    mode: 'empty-official-BU-form-review',
    reviewed: result.reviewed,
    credentialsEntered: false,
    interpretation: result.reviewed
      ? 'Current empty BU login form matches the reviewed contract. Submission and MFA remain unverified.'
      : 'Current form does not match the reviewed contract. Autofill remains unavailable; no credentials were entered.',
  };
  if (diagnose) {
    stage = 'structure';
    const pages = underlying.context.pages();
    output.structure = {
      pageCount: pages.length,
      pages: await Promise.all(
        pages.slice(0, 3).map(async (page) => ({
          frameCount: page.frames().length,
          ...(await page.evaluate(() => {
            const label = (value) =>
              typeof value === 'string' && /^[A-Za-z_][-A-Za-z0-9_]{0,63}$/.test(value)
                ? value
                : 'other';
            const address = (value) => {
              try {
                const url = new URL(value, location.href);
                return {
                  origin: url.origin,
                  path: /^\/(?:idp\/profile\/SAML2\/(?:Redirect|POST)\/SSO|ultra(?:\/authentication)?|webapps\/login)\/?$/.test(
                    url.pathname,
                  )
                    ? url.pathname
                    : 'other-public-path',
                };
              } catch {
                return { origin: 'unavailable', path: 'unavailable' };
              }
            };
            return {
              location: address(location.href),
              forms: [...document.forms].slice(0, 5).map((form) => ({
                method: form.method,
                target: form.target ? 'nonempty' : '',
                action: address(form.getAttribute('action') || location.href),
                inputs: [...form.querySelectorAll('input')]
                  .slice(0, 20)
                  .map((input) => ({ name: label(input.name), type: label(input.type) })),
                buttons: [...form.querySelectorAll('button,input[type=submit]')]
                  .slice(0, 10)
                  .map((button) => ({
                    name: label(button.name),
                    type: label(button.type),
                    overrides: ['formaction', 'formmethod', 'formtarget', 'formenctype'].filter(
                      (name) => button.hasAttribute(name),
                    ),
                  })),
              })),
            };
          })),
        })),
      ),
    };
  }
  console.log(JSON.stringify(output, null, 2));
  if (!result.reviewed) process.exitCode = 2;
} catch {
  console.error(
    JSON.stringify({
      error: 'Empty BU form review could not complete. No credentials were entered.',
      stage,
    }),
  );
  process.exitCode = 1;
} finally {
  await session?.close().catch(() => undefined);
  await proxy?.close().catch(() => undefined);
}
