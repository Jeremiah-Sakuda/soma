import { createServer, request as httpRequest } from 'node:http';
import { connect, isIP } from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';

/** @typedef {(host:string,options:{all:true,verbatim:true})=>Promise<{address:string,family:number}[]>} EgressLookup */

export class EgressPolicyError extends Error {
  constructor() {
    super('Browser network destination is not permitted.');
    this.code = 'egress_denied';
  }
}
const denied = () => {
  throw new EgressPolicyError();
};
const IPV4_BLOCKS = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
  ['168.63.129.16', 32],
];
const ipv4 = (value) =>
  value.split('.').reduce((result, octet) => (result << 8n) | BigInt(octet), 0n);
function ipv6(value) {
  const halves = value.toLowerCase().split('::');
  const parse = (half) => (half ? half.split(':').map((item) => BigInt(`0x${item}`)) : []);
  const before = parse(halves[0]),
    after = halves.length === 2 ? parse(halves[1]) : [];
  const parts =
    halves.length === 2
      ? [...before, ...Array(8 - before.length - after.length).fill(0n), ...after]
      : before;
  return parts.reduce((result, part) => (result << 16n) | part, 0n);
}
function prefix(address, network, bits, size) {
  return address >> BigInt(size - bits) === network >> BigInt(size - bits);
}
/** Conservative globally routable unicast only. IPv4-mapped/compatible, NAT64,
 * 6to4, Teredo and scoped IPv6 are rejected rather than reinterpreted. */
export function isPublicAddress(address) {
  if (typeof address !== 'string' || address.includes('%')) return false;
  const family = isIP(address);
  if (family === 4) {
    const value = ipv4(address);
    return !IPV4_BLOCKS.some(([network, bits]) => prefix(value, ipv4(network), bits, 32));
  }
  if (family !== 6 || address.includes('.')) return false;
  const value = ipv6(address);
  return (
    prefix(value, ipv6('2000::'), 3, 128) &&
    ![
      ['2001::', 23],
      ['2001:db8::', 32],
      ['2002::', 16],
      ['3fff::', 20],
    ].some(([network, bits]) => prefix(value, ipv6(network), bits, 128))
  );
}
function canonicalHost(value) {
  if (typeof value !== 'string' || value.length > 255 || /[\s\\/@?#%\x00-\x1f\x7f]/.test(value))
    denied();
  let host = value.toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (isIP(host)) return host;
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (
    host.length > 253 ||
    !host.includes('.') ||
    !host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  )
    denied();
  return host;
}
function blockedSet(hosts = []) {
  return new Set(
    [
      'localhost',
      'metadata',
      'metadata.google.internal',
      'instance-data',
      'storage.googleapis.com',
      'storage.cloud.google.com',
      ...hosts,
    ].map((host) => {
      if (typeof host !== 'string') denied();
      try {
        return canonicalHost(host.includes('://') ? new URL(host).hostname : host);
      } catch {
        if (['localhost', 'metadata', 'instance-data'].includes(host)) return host;
        denied();
      }
    }),
  );
}
function blocked(host, hosts) {
  if (
    ['.localhost', '.local', '.internal', '.home.arpa', '.invalid', '.test', '.svc'].some(
      (suffix) => host.endsWith(suffix),
    )
  )
    return true;
  for (const deniedHost of hosts)
    if (host === deniedHost || host.endsWith(`.${deniedHost}`)) return true;
  return false;
}
function authority(value, scheme) {
  if (typeof value !== 'string' || !value || /[\s\\/@?#%\x00-\x1f\x7f]/.test(value)) denied();
  let url;
  try {
    url = new URL(`${scheme}//${value}`);
  } catch {
    denied();
  }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) denied();
  const expected = scheme === 'http:' ? 80 : 443;
  if (url.port && Number(url.port) !== expected) denied();
  return { host: canonicalHost(url.hostname), port: expected };
}
function hostHeader(headers) {
  if (typeof headers !== 'string') denied();
  return headers;
}
function matchAuthority(actual, expected, scheme) {
  const parsed = authority(hostHeader(actual), scheme);
  if (parsed.host !== expected.host || parsed.port !== expected.port) denied();
}
function timeout(operation, milliseconds) {
  let timer;
  return Promise.race([
    operation,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new EgressPolicyError()), milliseconds);
      timer.unref?.();
    }),
  ]).finally(() => clearTimeout(timer));
}
/** Resolve every request once, reject mixed answers, then hand transport the
 * selected numeric address. The transport never performs a second DNS lookup.
 * @param {{host:string,port:number}} destination
 * @param {{blockedHosts?:string[],lookup?:EgressLookup,allowedHosts?:string[]}} options
 */
export async function resolveEgressTarget(
  { host, port },
  { blockedHosts = [], lookup = dnsLookup, allowedHosts } = {},
) {
  if (![80, 443].includes(port)) denied();
  host = canonicalHost(host);
  if (
    allowedHosts !== undefined &&
    (!Array.isArray(allowedHosts) || !allowedHosts.includes(host) || port !== 443)
  )
    denied();
  if (blocked(host, blockedSet(blockedHosts))) denied();
  let addresses;
  if (isIP(host)) addresses = [{ address: host, family: isIP(host) }];
  else {
    try {
      addresses = await timeout(Promise.resolve(lookup(host, { all: true, verbatim: true })), 5000);
    } catch {
      denied();
    }
  }
  if (
    !Array.isArray(addresses) ||
    addresses.length < 1 ||
    addresses.length > 64 ||
    addresses.some(
      (item) => !item || !isPublicAddress(item.address) || item.family !== isIP(item.address),
    )
  )
    denied();
  const selected = addresses.find((item) => item.family === 4) ?? addresses[0];
  return { host, port, address: selected.address, family: selected.family };
}
function singleHost(request) {
  if (
    request.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === 'host')
      .length !== 1
  )
    denied();
  return request.headers.host;
}
function cleanHeaders(headers) {
  const forbidden = new Set([
    'proxy-authorization',
    'proxy-authenticate',
    'proxy-connection',
    'connection',
    'keep-alive',
    'upgrade',
    'te',
    'trailer',
    'transfer-encoding',
  ]);
  for (const name of String(headers.connection ?? '').split(','))
    if (name.trim()) forbidden.add(name.trim().toLowerCase());
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !forbidden.has(name.toLowerCase())),
  );
}
function forwardTarget(request) {
  if (
    typeof request.url !== 'string' ||
    !/^http:\/\//i.test(request.url) ||
    /[\\\x00-\x20\x7f]/.test(request.url)
  )
    denied();
  let url;
  try {
    url = new URL(request.url);
  } catch {
    denied();
  }
  if (
    url.protocol !== 'http:' ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== '80')
  )
    denied();
  const destination = { host: canonicalHost(url.hostname), port: 80 };
  matchAuthority(singleHost(request), destination, 'http:');
  return { ...destination, path: `${url.pathname}${url.search}`, hostHeader: url.host };
}
function tunnelTarget(request) {
  if (
    typeof request.url !== 'string' ||
    !/^(?:\[[a-fA-F0-9:]+\]|[a-zA-Z0-9.-]+):443$/.test(request.url)
  )
    denied();
  const destination = authority(request.url, 'https:');
  matchAuthority(singleHost(request), destination, 'https:');
  return destination;
}
const failureBody = 'Browser network request unavailable.';
function denyResponse(response, status = 403) {
  if (!response.headersSent)
    response.writeHead(status, {
      'content-type': 'text/plain',
      'cache-control': 'no-store',
      connection: 'close',
    });
  response.end(failureBody);
}
function denySocket(socket, status = 403) {
  if (!socket.destroyed)
    socket.end(
      `HTTP/1.1 ${status} Unavailable\r\nContent-Length: ${Buffer.byteLength(failureBody)}\r\nConnection: close\r\n\r\n${failureBody}`,
    );
}

/** Loopback-only explicit proxy. Chromium must disable implicit localhost
 * bypass/QUIC/non-proxied WebRTC; no destination, credentials or body is logged.
 * @param {{blockedHosts?:string[],lookup?:EgressLookup,allowedHosts?:string[]}} options
 */
export async function startEgressProxy({
  blockedHosts = [],
  lookup = dnsLookup,
  allowedHosts,
} = {}) {
  const hosts = [...blockedSet(blockedHosts)],
    sockets = new Set();
  const track = (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    return socket;
  };
  const server = createServer(async (request, response) => {
    let target;
    try {
      const destination = forwardTarget(request);
      target = {
        ...destination,
        ...(await resolveEgressTarget(destination, { blockedHosts: hosts, lookup, allowedHosts })),
      };
    } catch {
      request.resume();
      denyResponse(response);
      return;
    }
    if (request.destroyed) return;
    const headers = {
      ...cleanHeaders(request.headers),
      host: target.hostHeader,
      connection: 'close',
    };
    const upstream = httpRequest(
      {
        hostname: target.address,
        family: target.family,
        port: target.port,
        path: target.path,
        method: request.method,
        headers,
        agent: false,
        timeout: 30_000,
      },
      (remote) => {
        response.writeHead(remote.statusCode ?? 502, cleanHeaders(remote.headers));
        remote.pipe(response);
        remote.on('error', () => response.destroy());
      },
    );
    upstream.once('socket', track);
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => denyResponse(response, 502));
    response.on('close', () => upstream.destroy());
    request.on('aborted', () => upstream.destroy());
    request.on('error', () => upstream.destroy());
    request.pipe(upstream);
  });
  server.maxConnections = 256;
  server.headersTimeout = 15_000;
  server.requestTimeout = 60_000;
  server.keepAliveTimeout = 1000;
  server.on('connection', (socket) => {
    track(socket);
    socket.on('error', () => {});
  });
  server.on('clientError', (_error, socket) => denySocket(socket, 400));
  server.on('upgrade', (_request, socket) => denySocket(socket));
  server.on('connect', async (request, client, head) => {
    let target;
    try {
      target = await resolveEgressTarget(tunnelTarget(request), {
        blockedHosts: hosts,
        lookup,
        allowedHosts,
      });
    } catch {
      denySocket(client);
      return;
    }
    if (client.destroyed) return;
    const upstream = track(
      connect({ host: target.address, family: target.family, port: target.port }),
    );
    upstream.setTimeout(120_000, () => upstream.destroy());
    const connectionTimer = setTimeout(() => upstream.destroy(), 15_000);
    connectionTimer.unref?.();
    upstream.once('connect', () => {
      clearTimeout(connectionTimer);
      if (client.destroyed) {
        upstream.destroy();
        return;
      }
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      client.pipe(upstream);
      upstream.pipe(client);
    });
    upstream.on('error', () => {
      clearTimeout(connectionTimer);
      denySocket(client, 502);
    });
    upstream.on('close', () => {
      clearTimeout(connectionTimer);
      client.destroy();
    });
    client.on('error', () => upstream.destroy());
    client.on('close', () => upstream.destroy());
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
