import type { IncomingHttpHeaders } from 'node:http';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { type Dispatcher, request } from 'undici';

/* Statuses whose Response must be constructed without a body. */
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

type UndiciBody = string | Buffer | Uint8Array | Readable | null;

const toUndiciBody = (body: RequestInit['body']): UndiciBody => {
  if (body == null) return null;
  if (typeof body === 'string' || body instanceof Uint8Array) return body;
  if (body instanceof Readable) return body;
  if (body instanceof ReadableStream) {
    return Readable.fromWeb(body as NodeWebReadableStream<Uint8Array>);
  }
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }
  throw new TypeError(
    'streamingFetch supports string, binary and stream bodies only',
  );
};

const toResponseHeaders = (headers: IncomingHttpHeaders): Headers => {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      value.forEach((item) => result.append(name, item));
    } else if (value != null) {
      result.set(name, value);
    }
  }
  return result;
};

const toUrl = (input: Parameters<typeof fetch>[0]): string => {
  if (input instanceof Request) return input.url;
  if (input instanceof URL) return input.href;
  return input;
};

type UndiciResponseBody = Dispatcher.ResponseData['body'];

/*
 * Pull-based web view of the undici body. `Readable.toWeb()` is avoided on
 * purpose: cancelling its stream while data is still arriving throws
 * ERR_INVALID_STATE ("Controller is already closed") from a socket callback
 * and crashes the process. Cancelling destroys the body, closing the socket.
 */
const toWebBody = (body: UndiciResponseBody): ReadableStream<Uint8Array> => {
  const iterator = body[Symbol.asyncIterator]() as AsyncIterator<Buffer>;
  return new ReadableStream<Uint8Array>({
    pull: async (controller) => {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(
        new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
      );
    },
    cancel: () => {
      /* destroy() emits an AbortError; the listener keeps it from going uncaught. */
      body.on('error', () => undefined);
      body.destroy();
    },
  });
};

/**
 * A `fetch`-compatible transport built on `undici.request`.
 *
 * Native `fetch` (undici's fetch, Node 24) reads a streamed request body as
 * fast as the producer yields it and queues the bytes until the socket drains,
 * so an upload to a slower DIAL Core buffers the whole file in the BFF
 * (issue #9398: a 420 MB upload OOM-kills a 512 Mi pod). `undici.request`
 * writes the body with socket backpressure, keeping memory bounded by a few
 * chunks. Use this transport for large request bodies; keep native `fetch`
 * for everything else.
 *
 * Accepts `fetch(url, init)` and `fetch(request)` — the form `openapi-fetch`
 * (the DIAL SDK) uses, so it can be passed to `createSDK({ fetch })` or as a
 * per-call `fetch` override. Supported bodies: string, Buffer/typed
 * array/ArrayBuffer, Node `Readable` and web `ReadableStream` (including a
 * `Request` body). `duplex` is accepted and ignored. Redirects are not
 * followed (DIAL Core uploads never redirect).
 */
export const streamingFetch: typeof fetch = async (input, init) => {
  const url = toUrl(input);
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );
  const method = (init?.method ??
    (input instanceof Request ? input.method : 'GET')) as Dispatcher.HttpMethod;

  const response = await request(url, {
    method,
    headers: Object.fromEntries(headers),
    body: toUndiciBody(
      init?.body ?? (input instanceof Request ? input.body : null),
    ),
    signal:
      init?.signal ?? (input instanceof Request ? input.signal : undefined),
  });

  const hasBody = !NULL_BODY_STATUSES.has(response.statusCode);
  if (!hasBody) {
    await response.body.dump();
  }

  return new Response(hasBody ? toWebBody(response.body) : null, {
    status: response.statusCode,
    headers: toResponseHeaders(response.headers),
  });
};
