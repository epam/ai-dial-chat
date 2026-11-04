import {
  type IncomingMessage,
  type Server,
  type ServerResponse,
  createServer,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { streamingFetch } from '../streaming-fetch';

const CHUNK_BYTES = 64 * 1024;
const MIB = 1024 * 1024;

let server: Server | undefined;

const listen = async (
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<string> => {
  server = createServer(handler);
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}/upload`;
};

const readAll = (req: IncomingMessage): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe('streamingFetch', () => {
  afterEach(async () => {
    server?.closeAllConnections();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;
  });

  it('stops pulling the body while the server is not reading it', async () => {
    const total = 64 * MIB;
    let produced = 0;
    async function* source(): AsyncGenerator<Buffer> {
      while (produced < total) {
        produced += CHUNK_BYTES;
        yield Buffer.alloc(CHUNK_BYTES);
      }
    }
    const url = await listen((req) => {
      /* Read one chunk, then stall: only socket buffers may hold more. */
      req.once('data', () => req.pause());
    });
    const controller = new AbortController();

    const pending = streamingFetch(url, {
      method: 'PUT',
      headers: { 'Content-Length': String(total) },
      body: Readable.toWeb(Readable.from(source())) as ReadableStream,
      signal: controller.signal,
      duplex: 'half',
    } as RequestInit).catch((err: unknown) => err);
    await delay(500);
    const producedWhileStalled = produced;
    controller.abort();

    /* Native fetch pulls the whole 64 MiB here; a backpressured write stops at socket buffers. */
    expect(producedWhileStalled).toBeLessThan(16 * MIB);
    expect(((await pending) as Error).name).toBe('AbortError');
  });

  it('sends a streamed body with method and headers and returns the response', async () => {
    let received: { method?: string; header?: string; body?: string } = {};
    const url = await listen(async (req, res) => {
      received = {
        method: req.method,
        header: req.headers['x-test'] as string,
        body: (await readAll(req)).toString(),
      };
      res.writeHead(201, { 'Content-Type': 'application/json', ETag: 'abc' });
      res.end('{"ok":true}');
    });

    const response = await streamingFetch(url, {
      method: 'PUT',
      headers: { 'X-Test': 'yes' },
      body: Readable.toWeb(
        Readable.from([Buffer.from('hello '), Buffer.from('world')]),
      ) as ReadableStream,
      duplex: 'half',
    } as RequestInit);

    expect(received).toEqual({
      method: 'PUT',
      header: 'yes',
      body: 'hello world',
    });
    expect(response.status).toBe(201);
    expect(response.ok).toBe(true);
    expect(response.headers.get('etag')).toBe('abc');
    expect(await response.json()).toEqual({ ok: true });
  });

  it('sends the body, method and headers of a Request passed as input', async () => {
    let received: { method?: string; header?: string; body?: string } = {};
    const url = await listen(async (req, res) => {
      received = {
        method: req.method,
        header: req.headers['x-test'] as string,
        body: (await readAll(req)).toString(),
      };
      res.writeHead(200).end();
    });
    const request = new Request(url, {
      method: 'PUT',
      headers: { 'X-Test': 'request' },
      body: Readable.toWeb(Readable.from([Buffer.from('from request')])),
      duplex: 'half',
    } as RequestInit);

    const response = await streamingFetch(request);

    expect(response.status).toBe(200);
    expect(received).toEqual({
      method: 'PUT',
      header: 'request',
      body: 'from request',
    });
  });

  it('accepts a string body', async () => {
    let body = '';
    const url = await listen(async (req, res) => {
      body = (await readAll(req)).toString();
      res.writeHead(200).end();
    });

    await streamingFetch(url, { method: 'POST', body: 'plain text' });

    expect(body).toBe('plain text');
  });

  it('returns a body-less response for 204', async () => {
    const url = await listen((req, res) => {
      req.resume();
      res.writeHead(204).end();
    });

    const response = await streamingFetch(url, { method: 'DELETE' });

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
  });

  it('returns non-2xx statuses without throwing', async () => {
    const url = await listen((req, res) => {
      req.resume();
      res.writeHead(412).end('precondition failed');
    });

    const response = await streamingFetch(url, { method: 'PUT', body: 'x' });

    expect(response.status).toBe(412);
    expect(response.ok).toBe(false);
    expect(await response.text()).toBe('precondition failed');
  });

  it('closes the connection when the response body is cancelled mid-stream', async () => {
    let isClosed = false;
    const url = await listen((req, res) => {
      req.resume();
      res.writeHead(413);
      const timer = setInterval(() => res.write(Buffer.alloc(CHUNK_BYTES)), 5);
      res.on('close', () => {
        clearInterval(timer);
        isClosed = true;
      });
    });

    const response = await streamingFetch(url, { method: 'PUT', body: 'x' });
    await response.body?.cancel();
    await delay(100);

    expect(response.status).toBe(413);
    expect(isClosed).toBe(true);
  });

  it('rejects with an AbortError when the signal is already aborted', async () => {
    const url = await listen((_req, res) => res.writeHead(200).end());

    const error = await streamingFetch(url, {
      signal: AbortSignal.abort(),
    }).catch((err: unknown) => err);

    expect((error as Error).name).toBe('AbortError');
  });
});
