import { randomBytes, randomUUID, createHash } from 'node:crypto';
import https from 'node:https';
import { pathToFileURL } from 'node:url';

const assertion = (condition, message) => {
  if (!condition) throw new Error(message);
};
/** Bounded hosted negative checks only. No password, real user identity, cloud
 * resource mutation, model call or selected-course read is performed. */
export async function checkCredentialService({
  origin,
  controlKey,
  brokerDenial = false,
  fetchImpl = fetch,
  upgradeImpl = upgradeDenied,
  now = Date.now,
}) {
  const url = new URL(origin);
  assertion(
    url.protocol === 'https:' &&
      url.origin === origin &&
      !url.port &&
      !url.username &&
      !url.password &&
      url.hostname.endsWith('.run.app'),
    'A canonical HTTPS Cloud Run origin is required.',
  );
  const results = [];
  const id = randomUUID();
  async function http(
    name,
    path,
    { method = 'GET', body, headers = {}, expected = [401, 404], validate } = {},
  ) {
    const response = await fetchImpl(origin + path, {
      method,
      headers: {
        ...headers,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text();
    assertion(text.length <= 65536, 'Hosted response exceeded the diagnostic bound.');
    assertion(
      expected.includes(response.status),
      `${name}: unexpected HTTP status ${response.status}.`,
    );
    if (validate) assertion(validate(text, response), `${name}: response contract failed.`);
    results.push({ check: name, status: response.status, passed: true });
    return response;
  }
  await http('isolated-service-health', '/health', {
    expected: [200],
    validate: (text) => {
      try {
        const value = JSON.parse(text);
        return value.status === 'ok' && value.protocol === 'credential-login-v1';
      } catch {
        return false;
      }
    },
  });
  await http('unauthorized-broker-grant', '/v1/grants', {
    method: 'POST',
    body: {},
    expected: [401],
  });
  await http('unauthorized-session-status', `/v1/sessions/${id}`, { expected: [401] });
  await http('human-status-without-cookie', `/login/${id}/status`, {
    method: 'POST',
    body: {},
    headers: { origin },
    expected: [401],
  });
  await http('invalid-human-entry-capability', `/login/${id}/bootstrap`, {
    method: 'POST',
    body: { token: randomBytes(32).toString('base64url') },
    headers: { origin },
    expected: [401, 404],
  });
  await upgradeImpl(origin, `/login/${id}/socket`, { origin });
  results.push({ check: 'viewer-without-cookie', passed: true });
  await upgradeImpl(origin, `/cdp/${id}`, { origin });
  results.push({ check: 'generic-browser-control-rejected', passed: true });
  if (brokerDenial) {
    assertion(
      typeof controlKey === 'string' && /^[A-Za-z0-9_-]{40,256}$/.test(controlKey),
      'A distinct credential service control key is required for the bounded broker-denial check.',
    );
    const workspaceId = randomUUID(),
      owner = createHash('sha256').update(`${workspaceId}:browser-blackboard`).digest('hex'),
      authorizationId = randomUUID();
    const headers = { authorization: `Bearer ${controlKey}`, 'x-soma-owner': owner };
    const grant = {
      uid: 'original-synthetic-hosted-credential-check',
      workspaceId,
      workspaceGeneration: workspaceId,
      provider: 'blackboard',
      contextId: randomUUID(),
      connectionVersion: 1,
      recentAuthAt: Math.floor(now() / 1000),
      authorizationId,
    };
    // No Firebase account, workspace, authorization record or context is created.
    // The app callback must deny this well-shaped but nonexistent principal before
    // consuming a grant, claiming state, starting Chromium or touching the vault.
    await http('nonexistent-principal-callback-denial', '/v1/grants', {
      method: 'POST',
      body: grant,
      headers,
      expected: [403],
      validate: (text) => {
        try {
          return JSON.parse(text).code === 'credential_authorization';
        } catch {
          return false;
        }
      },
    });
    await http('denied-grant-has-no-live-session', `/v1/sessions/${authorizationId}`, {
      headers,
      expected: [404],
    });
    await http('broker-key-does-not-enable-CDP', `/cdp/${authorizationId}`, {
      headers,
      expected: [404],
    });
    await upgradeImpl(origin, `/cdp/${authorizationId}`, { ...headers, origin });
    results.push({ check: 'broker-key-websocket-control-rejected', passed: true });
  }
  return {
    mode: brokerDenial ? 'public-and-synthetic-broker-denial' : 'public-negative-checks',
    checks: results.length,
    results,
    limits:
      'No positive login, one-use exchange, KMS operation or real provider compatibility is established by these checks.',
  };
}
function upgradeDenied(origin, path, headers) {
  return new Promise((resolve, reject) => {
    const request = https.request(origin + path, {
      method: 'GET',
      headers: {
        ...headers,
        connection: 'Upgrade',
        upgrade: 'websocket',
        'sec-websocket-version': '13',
        'sec-websocket-key': randomBytes(16).toString('base64'),
      },
      signal: AbortSignal.timeout(10_000),
    });
    request.once('response', (response) => {
      response.resume();
      if ([401, 403, 404].includes(response.statusCode)) resolve();
      else reject(new Error('Unexpected WebSocket rejection status.'));
    });
    request.once('upgrade', (_response, socket) => {
      socket.destroy();
      reject(new Error('A forbidden browser socket was accepted.'));
    });
    request.once('error', () =>
      reject(new Error('Hosted socket verification could not complete.')),
    );
    request.end();
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    assertion(
      process.argv.slice(2).every((arg) => arg === '--broker-denial'),
      'Only --broker-denial is supported.',
    );
    console.log(
      JSON.stringify(
        await checkCredentialService({
          origin: process.env.SOMA_CREDENTIAL_RUNNER_URL,
          controlKey: process.env.SOMA_CREDENTIAL_RUNNER_CONTROL_KEY,
          brokerDenial: process.argv.includes('--broker-denial'),
        }),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(
      typeof error?.message === 'string'
        ? error.message
        : 'Credential service verification failed.',
    );
    process.exitCode = 1;
  }
}
