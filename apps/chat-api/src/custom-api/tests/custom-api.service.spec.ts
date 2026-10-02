import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { gzipSync } from 'node:zlib';
import {
  BadGatewayException,
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DialClientService } from '../../dial/dial-client.service';
import type { CustomApiOperation } from '../custom-api-registry.service';
import {
  CLIENT_CLOSED_REQUEST_STATUS,
  CustomApiClientClosedException,
  CustomApiService,
} from '../custom-api.service';

const OPERATION: CustomApiOperation = {
  id: 'data-products',
  method: 'GET',
  corePath: '/data-products',
  timeoutMs: 10_000,
  maxResponseBytes: 1_048_576,
};

const bytesResponse = (
  text: string,
  init?: { status?: number; headers?: Record<string, string> },
): Response =>
  new Response(new TextEncoder().encode(text), {
    status: init?.status ?? 200,
    headers: init?.headers,
  });

/*
 * A 200 whose body sends one chunk and then stalls until `signal` aborts —
 * mirrors how undici errors an in-progress body read on abort.
 */
const stalledBodyResponse = (signal: AbortSignal): Response =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"items":['));
        signal.addEventListener('abort', () =>
          controller.error(
            Object.assign(new Error('aborted'), { name: 'AbortError' }),
          ),
        );
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const createService = async (fetchCore: typeof fetch) => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      CustomApiService,
      {
        provide: DialClientService,
        useValue: { baseUrl: 'https://core-api.com', fetchCore },
      },
    ],
  }).compile();

  return moduleRef.get(CustomApiService);
};

describe('CustomApiService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches GET to the exact resolved destination with the bearer header, no redirect follow', async () => {
    const fetchCore = vi.fn().mockResolvedValue(bytesResponse('[1,2,3]'));
    const service = await createService(fetchCore);

    await service.callOperation(OPERATION, 'user-access-token');

    expect(fetchCore).toHaveBeenCalledOnce();
    const [destination, init] = fetchCore.mock.calls[0];
    expect(String(destination)).toBe('https://core-api.com/data-products');
    expect(init).toMatchObject({ method: 'GET', redirect: 'manual' });
  });

  it('isolates headers: only Accept and Authorization are sent, never a caller-supplied header', async () => {
    const fetchCore = vi.fn().mockResolvedValue(bytesResponse('[1]'));
    const service = await createService(fetchCore);

    await service.callOperation(OPERATION, 'user-access-token');

    const [, init] = fetchCore.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer user-access-token',
    });
  });

  it('returns the parsed data and byte count on a 200 JSON response, preserving additive fields', async () => {
    const fetchCore = vi
      .fn()
      .mockResolvedValue(bytesResponse('{"id":"1","extraField":"kept"}'));
    const service = await createService(fetchCore);

    const result = await service.callOperation(OPERATION, 'token');

    expect(result.data).toEqual({ id: '1', extraField: 'kept' });
    expect(result.bytes).toBeGreaterThan(0);
  });

  it('maps a manual-redirect response to a sanitized 502 and sends no second request', async () => {
    const fetchCore = vi.fn().mockResolvedValue({
      type: 'opaqueredirect',
      status: 0,
      body: null,
      headers: new Headers(),
    } as unknown as Response);
    const service = await createService(fetchCore);

    await expect(service.callOperation(OPERATION, 'token')).rejects.toThrow(
      BadGatewayException,
    );
    expect(fetchCore).toHaveBeenCalledOnce();
  });

  it('maps an explicit 3xx response to a sanitized 502', async () => {
    const fetchCore = vi.fn().mockResolvedValue({
      type: 'default',
      status: 302,
      body: null,
      headers: new Headers(),
    } as unknown as Response);
    const service = await createService(fetchCore);

    await expect(service.callOperation(OPERATION, 'token')).rejects.toThrow(
      BadGatewayException,
    );
  });

  it.each([
    [401, UnauthorizedException],
    [403, ForbiddenException],
    [404, NotFoundException],
  ])('maps upstream %d to %s', async (status, ExceptionClass) => {
    const fetchCore = vi
      .fn()
      .mockResolvedValue(bytesResponse('{"error":"nope"}', { status }));
    const service = await createService(fetchCore);

    await expect(service.callOperation(OPERATION, 'token')).rejects.toThrow(
      ExceptionClass,
    );
  });

  it.each([
    [400, 400],
    [401, 401],
    [403, 403],
    [404, 404],
    [409, 409],
    [422, 422],
    [429, 429],
    [201, 502],
    [204, 502],
    [405, 502],
    [410, 502],
    [412, 502],
    [413, 502],
    [418, 502],
    [500, 502],
    [503, 502],
  ])(
    'maps upstream %d to BFF status %d with a generic message',
    async (upstream, expected) => {
      const fetchCore = vi
        .fn()
        .mockResolvedValue(
          new Response(
            upstream === 204 ? null : '{"error":"secret-internal-detail"}',
            { status: upstream },
          ),
        );
      const service = await createService(fetchCore);

      const thrown = await service
        .callOperation(OPERATION, 'token')
        .catch((error: unknown) => error);

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(expected);
      expect(
        JSON.stringify((thrown as HttpException).getResponse()),
      ).not.toContain('secret-internal-detail');
    },
  );

  it('maps upstream 5xx to a sanitized 502', async () => {
    const fetchCore = vi
      .fn()
      .mockResolvedValue(bytesResponse('oops', { status: 500 }));
    const service = await createService(fetchCore);

    await expect(service.callOperation(OPERATION, 'token')).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('maps an invalid JSON response to a sanitized 502 without leaking the body', async () => {
    const fetchCore = vi.fn().mockResolvedValue(bytesResponse('not-json'));
    const service = await createService(fetchCore);

    let thrown: unknown;
    try {
      await service.callOperation(OPERATION, 'token');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(BadGatewayException);
    expect(
      JSON.stringify((thrown as BadGatewayException).getResponse()),
    ).not.toContain('not-json');
  });

  it('maps its own deadline expiry to 504', async () => {
    const fetchCore = vi.fn().mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        }),
    );
    const service = await createService(fetchCore);

    await expect(service.callOperation(OPERATION, 'token')).rejects.toThrow(
      GatewayTimeoutException,
    );
  });

  it('aborts body consumption at the deadline and maps it to 504', async () => {
    const fetchCore = vi.fn((_url: unknown, init?: RequestInit) =>
      Promise.resolve(stalledBodyResponse(init?.signal as AbortSignal)),
    );
    const service = await createService(fetchCore);

    await expect(
      service.callOperation({ ...OPERATION, timeoutMs: 20 }, 'token'),
    ).rejects.toThrow(GatewayTimeoutException);
  });

  it('aborts the Core call when the client disconnects mid-body, without a timeout/5xx', async () => {
    let upstreamSignal: AbortSignal | undefined;
    const fetchCore = vi.fn((_url: unknown, init?: RequestInit) => {
      upstreamSignal = init?.signal as AbortSignal;
      return Promise.resolve(stalledBodyResponse(upstreamSignal));
    });
    const service = await createService(fetchCore);
    const client = new AbortController();

    const pending = service.callOperation(OPERATION, 'token', client.signal);
    await vi.waitFor(() => expect(upstreamSignal).toBeDefined());
    client.abort();

    const thrown = await pending.catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(CustomApiClientClosedException);
    expect((thrown as HttpException).getStatus()).toBe(
      CLIENT_CLOSED_REQUEST_STATUS,
    );
    expect(upstreamSignal?.aborted).toBe(true);
  });

  it('never dispatches when the client is already gone', async () => {
    const fetchCore = vi.fn();
    const service = await createService(fetchCore);
    const client = new AbortController();
    client.abort();

    await expect(
      service.callOperation(OPERATION, 'token', client.signal),
    ).rejects.toThrow(CustomApiClientClosedException);
    expect(fetchCore).not.toHaveBeenCalled();
  });

  it('applies the byte limit to the decompressed body of a gzip response', async () => {
    const decoded = JSON.stringify({ padding: 'x'.repeat(4096) });
    const compressed = gzipSync(decoded);
    const server = createServer((_req, res) => {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
        'Content-Length': compressed.byteLength,
      });
      res.end(compressed);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const { port } = server.address() as AddressInfo;

    try {
      const fetchCore = vi.fn((_url: unknown, init?: RequestInit) =>
        fetch(`http://127.0.0.1:${port}/data-products`, init),
      );
      const service = await createService(fetchCore);

      /* Compressed size fits the limit; only the decoded size exceeds it. */
      const maxResponseBytes = compressed.byteLength + 100;
      expect(decoded.length).toBeGreaterThan(maxResponseBytes);
      await expect(
        service.callOperation({ ...OPERATION, maxResponseBytes }, 'token'),
      ).rejects.toThrow(BadGatewayException);

      const result = await service.callOperation(OPERATION, 'token');
      expect(result.bytes).toBe(decoded.length);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('maps a network failure to 503', async () => {
    const fetchCore = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const service = await createService(fetchCore);

    await expect(service.callOperation(OPERATION, 'token')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
