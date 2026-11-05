import { createServer as createHttpServer, request } from 'node:http';
import { createServer as createTcpServer, connect } from 'node:net';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isPublicAddress,
  resolveEgressTarget,
  startEgressProxy,
} from '../../services/browser-runner/egress.mjs';

// Redirect only the numeric public destination at the native transport boundary
// into a disposable local origin. The actual proxy/parser/DNS policy and streams
// execute unchanged; these are not claims of reaching a real public website.
const transport = vi.hoisted(() => ({
  httpPort: 0,
  tcpPort: 0,
  httpCalls: [] as any[],
  tcpCalls: [] as any[],
}));
vi.mock('node:http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:http')>();
  return {
    ...actual,
    request: (options: any, ...rest: any[]) => {
      if (transport.httpPort && options.hostname === '93.184.216.34') {
        transport.httpCalls.push(options);
        return (actual.request as any)(
          { ...options, hostname: '127.0.0.1', port: transport.httpPort },
          ...rest,
        );
      }
      return (actual.request as any)(options, ...rest);
    },
  };
});
vi.mock('node:net', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:net')>();
  return {
    ...actual,
    connect: (options: any, ...rest: any[]) => {
      if (transport.tcpPort && options.host === '93.184.216.34') {
        transport.tcpCalls.push(options);
        return (actual.connect as any)(
          { ...options, host: '127.0.0.1', port: transport.tcpPort },
          ...rest,
        );
      }
      return (actual.connect as any)(options, ...rest);
    },
  };
});
const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];
const proxyRequest = (url: string, target: string, headers: Record<string, string> = {}) =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    const proxy = new URL(url),
      upstream = new URL(target);
    const req = request(
      {
        hostname: proxy.hostname,
        port: proxy.port,
        path: target,
        method: 'GET',
        headers: { host: upstream.host, ...headers },
      },
      (response) => {
        const bytes: Buffer[] = [];
        response.on('data', (chunk) => bytes.push(chunk));
        response.on('end', () =>
          resolve({ status: response.statusCode!, body: Buffer.concat(bytes).toString() }),
        );
      },
    );
    req.on('error', reject);
    req.end();
  });
const rawRequest = (url: string, bytes: string) =>
  new Promise<string>((resolve, reject) => {
    const proxy = new URL(url),
      socket = connect({ host: proxy.hostname, port: Number(proxy.port) });
    let result = '';
    socket.setTimeout(2000, () => {
      socket.destroy();
      reject(new Error('Timed out'));
    });
    socket.on('connect', () => socket.write(bytes));
    socket.on('data', (chunk) => {
      result += chunk.toString();
    });
    socket.on('error', reject);
    socket.on('end', () => resolve(result));
  });
const listen = (server: ReturnType<typeof createHttpServer> | ReturnType<typeof createTcpServer>) =>
  new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
const close = (server: ReturnType<typeof createHttpServer> | ReturnType<typeof createTcpServer>) =>
  new Promise<void>((resolve) => server.close(() => resolve()));

afterEach(() => {
  transport.httpPort = 0;
  transport.tcpPort = 0;
  transport.httpCalls = [];
  transport.tcpCalls = [];
  vi.restoreAllMocks();
});

describe('browser destination policy', () => {
  it.each([
    '0.0.0.0',
    '10.9.8.7',
    '100.64.0.1',
    '100.100.100.200',
    '127.0.0.1',
    '169.254.169.254',
    '169.254.170.2',
    '172.16.1.1',
    '172.31.255.255',
    '192.0.0.192',
    '192.0.2.1',
    '192.168.1.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '255.255.255.255',
    '168.63.129.16',
    '::',
    '::1',
    'fc00::1',
    'fd00:ec2::254',
    'fe80::1',
    'fe80::1%eth0',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:8.8.8.8',
    '::8.8.8.8',
    '64:ff9b::a00:1',
    '2001::1',
    '2001:2::1',
    '2001:db8::1',
    '2002:a00:1::',
    '3fff::1',
    'not-an-address',
  ])('denies nonpublic or mapped destination %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '93.184.216.34',
    '172.32.0.1',
    '192.169.1.1',
    '2606:4700:4700::1111',
    '2001:4860:4860::8888',
    '2a00:1450:4001::1',
  ])('accepts public unicast %s', (address) => expect(isPublicAddress(address)).toBe(true));

  it('rejects any unsafe DNS answer, pins one checked address and rechecks every request', async () => {
    const mixed = vi.fn(async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '::ffff:169.254.169.254', family: 6 },
    ]);
    await expect(
      resolveEgressTarget({ host: 'public.example.com', port: 443 }, { lookup: mixed }),
    ).rejects.toMatchObject({ code: 'egress_denied' });
    const lookup = vi
      .fn()
      .mockResolvedValueOnce([
        { address: '2606:4700:4700::1111', family: 6 },
        { address: '93.184.216.34', family: 4 },
      ])
      .mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);
    expect(
      await resolveEgressTarget({ host: 'Public.Example.com.', port: 443 }, { lookup }),
    ).toEqual({ host: 'public.example.com', port: 443, address: '93.184.216.34', family: 4 });
    await expect(
      resolveEgressTarget({ host: 'public.example.com', port: 443 }, { lookup }),
    ).rejects.toMatchObject({ code: 'egress_denied' });
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup.mock.calls[0]).toEqual(['public.example.com', { all: true, verbatim: true }]);
  });

  it('denies metadata, state storage, control-service hosts, invalid names and unsafe ports before DNS', async () => {
    const lookup = vi.fn(publicLookup);
    for (const host of [
      'metadata.google.internal',
      'storage.googleapis.com',
      'private-bucket.storage.googleapis.com',
      'runner.example.com',
      'sub.runner.example.com',
      'LOCALHOST.',
      'name.local',
      'service.internal',
      'a@public.example.com',
      'a\\public.example.com',
      'public.example.com/path',
    ]) {
      await expect(
        resolveEgressTarget(
          { host, port: 443 },
          { blockedHosts: ['https://runner.example.com'], lookup },
        ),
      ).rejects.toMatchObject({ code: 'egress_denied' });
    }
    await expect(
      resolveEgressTarget({ host: 'public.example.com', port: 8443 }, { lookup }),
    ).rejects.toMatchObject({ code: 'egress_denied' });
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe('loopback forward and CONNECT proxy', () => {
  it('rejects unsafe destinations, Host mismatches, URL credentials and proxy upgrades without leaking auth in responses/logs', async () => {
    const lookup = vi.fn(publicLookup),
      log = vi.spyOn(console, 'log'),
      error = vi.spyOn(console, 'error');
    const proxy = await startEgressProxy({ lookup, blockedHosts: ['runner.example.com'] });
    try {
      for (const [target, headers] of [
        ['http://127.0.0.1/', {}],
        ['http://[::ffff:7f00:1]/', {}],
        ['http://169.254.169.254/latest/meta-data/', {}],
        ['http://runner.example.com/', {}],
        ['http://public.example.com:8080/', {}],
        ['http://user:synthetic-password@public.example.com/', {}],
        ['http://public.example.com/', { host: 'metadata.google.internal' }],
      ] as [string, Record<string, string>][]) {
        const response = await proxyRequest(proxy.url, target, {
          authorization: 'Bearer synthetic-browser-token',
          'proxy-authorization': 'Basic synthetic-proxy-token',
          ...headers,
        });
        expect(response.status).toBe(403);
        expect(response.body).toBe('Browser network request unavailable.');
      }
      for (const wire of [
        'CONNECT 169.254.169.254:443 HTTP/1.1\r\nHost: 169.254.169.254:443\r\n\r\n',
        'CONNECT public.example.com:8443 HTTP/1.1\r\nHost: public.example.com:8443\r\n\r\n',
        'CONNECT public.example.com:443 HTTP/1.1\r\nHost: other.example.com:443\r\n\r\n',
        'GET http://public.example.com/ HTTP/1.1\r\nHost: public.example.com\r\nHost: metadata.google.internal\r\n\r\n',
        'GET http://public.example.com/ HTTP/1.1\r\nHost: public.example.com\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n',
      ])
        expect(await rawRequest(proxy.url, wire)).toMatch(/HTTP\/1\.1 403 /);
      expect(lookup).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      await proxy.close();
    }
  });

  it('forwards HTTP to the checked numeric address, preserves origin auth, and strips proxy/hop credentials', async () => {
    let received: any;
    const origin = createHttpServer((req, res) => {
      received = { url: req.url, headers: req.headers };
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('fixture-origin');
    });
    transport.httpPort = await listen(origin);
    const lookup = vi.fn(publicLookup),
      proxy = await startEgressProxy({ lookup });
    try {
      const response = await proxyRequest(proxy.url, 'http://public.example.com/path?fixture=yes', {
        authorization: 'Bearer original-synthetic-origin-token',
        cookie: 'fixture=original-synthetic-cookie',
        'proxy-authorization': 'Basic excluded-proxy-token',
        'proxy-connection': 'keep-alive',
        connection: 'keep-alive, x-private-hop',
        'x-private-hop': 'excluded-hop-token',
      });
      expect(response).toEqual({ status: 200, body: 'fixture-origin' });
      expect(transport.httpCalls).toHaveLength(1);
      expect(transport.httpCalls[0]).toMatchObject({
        hostname: '93.184.216.34',
        family: 4,
        port: 80,
        path: '/path?fixture=yes',
      });
      expect(transport.httpCalls[0].lookup).toBeUndefined();
      expect(lookup).toHaveBeenCalledTimes(1);
      expect(received).toMatchObject({
        url: '/path?fixture=yes',
        headers: {
          host: 'public.example.com',
          authorization: 'Bearer original-synthetic-origin-token',
          cookie: 'fixture=original-synthetic-cookie',
        },
      });
      expect(received.headers['proxy-authorization']).toBeUndefined();
      expect(received.headers['proxy-connection']).toBeUndefined();
      expect(received.headers['x-private-hop']).toBeUndefined();
    } finally {
      await proxy.close();
      await close(origin);
    }
  });

  it('tunnels CONNECT and already-buffered bytes only to the pinned numeric HTTPS destination', async () => {
    const origin = createTcpServer((socket) => {
      socket.on('data', (bytes) => socket.end(`echo:${bytes.toString()}`));
    });
    transport.tcpPort = await listen(origin);
    const lookup = vi.fn(publicLookup),
      proxy = await startEgressProxy({ lookup });
    try {
      const response = await rawRequest(
        proxy.url,
        'CONNECT public.example.com:443 HTTP/1.1\r\nHost: public.example.com:443\r\nProxy-Authorization: Basic excluded-proxy-token\r\n\r\nhello-fixture',
      );
      expect(response).toContain('200 Connection Established');
      expect(response).toContain('echo:hello-fixture');
      expect(response).not.toContain('excluded-proxy-token');
      expect(transport.tcpCalls).toEqual([{ host: '93.184.216.34', family: 4, port: 443 }]);
      expect(lookup).toHaveBeenCalledTimes(1);
    } finally {
      await proxy.close();
      await close(origin);
    }
  });
});
