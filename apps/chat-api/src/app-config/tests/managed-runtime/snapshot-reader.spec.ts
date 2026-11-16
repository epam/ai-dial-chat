import { describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../../dial/dial-client.service';
import {
  ManagedSnapshotReader,
  MAX_RUNTIME_READ_BYTES,
  RuntimeReadKind,
} from '../../managed-runtime/snapshot-reader';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const makeReader = (
  fetchCore: (input: string, init?: RequestInit) => Promise<Response>,
) => {
  const fetchSpy = vi.fn(fetchCore);
  const reader = new ManagedSnapshotReader({
    baseUrl: 'https://core.example.com/',
    fetchCore: fetchSpy,
  } as unknown as DialClientService);
  return { reader, fetchSpy };
};

const read = (
  reader: ManagedSnapshotReader,
  signal = new AbortController().signal,
) => reader.read('chat-dev', 'reader-key', signal);

describe('ManagedSnapshotReader', () => {
  it('reads the instance route with the reader key and no session credentials', async () => {
    const { reader, fetchSpy } = makeReader(async () =>
      json(200, { instanceId: 'chat-dev' }),
    );

    await expect(read(reader)).resolves.toEqual({
      kind: RuntimeReadKind.Candidate,
      body: { instanceId: 'chat-dev' },
    });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      'https://core.example.com/v1/deployments/chat-dev/route/v1/published',
    );
    const headers = new Headers(init?.headers);
    expect(headers.get('Api-Key')).toBe('reader-key');
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.has('Cookie')).toBe(false);
    expect(init?.method).toBe('GET');
  });

  it('encodes the instance ID as one path segment', async () => {
    const { reader, fetchSpy } = makeReader(async () => json(200, {}));
    await reader.read('chat.dev_1', 'k', new AbortController().signal);
    expect(fetchSpy.mock.calls[0][0]).toContain(
      '/v1/deployments/chat.dev_1/route/v1/published',
    );
  });

  it.each([
    [404, { code: 'not_published' }, RuntimeReadKind.NotPublished],
    [404, { statusCode: 404, message: 'Not Found' }, RuntimeReadKind.Denied],
    [401, {}, RuntimeReadKind.Denied],
    [403, {}, RuntimeReadKind.Denied],
    [502, { code: 'integrity_mismatch' }, RuntimeReadKind.IntegrityMismatch],
    [502, { message: 'Bad Gateway' }, RuntimeReadKind.Unavailable],
    [503, {}, RuntimeReadKind.Unavailable],
    [500, {}, RuntimeReadKind.Unavailable],
    [302, {}, RuntimeReadKind.Malformed],
    [400, {}, RuntimeReadKind.Malformed],
  ])('classifies %i %j as %s', async (status, body, kind) => {
    const { reader } = makeReader(async () => json(status, body));
    await expect(read(reader)).resolves.toMatchObject({ kind });
  });

  it('treats a non-JSON or non-object 200 body as malformed', async () => {
    const { reader } = makeReader(async () => new Response('<html/>'));
    await expect(read(reader)).resolves.toMatchObject({
      kind: RuntimeReadKind.Malformed,
    });
    const { reader: arrayReader } = makeReader(async () => json(200, []));
    await expect(read(arrayReader)).resolves.toMatchObject({
      kind: RuntimeReadKind.Malformed,
    });
  });

  it('stops reading an oversized body', async () => {
    const chunk = new Uint8Array(32_768).fill(0x20);
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull: (controller) => {
        pulled += 1;
        controller.enqueue(chunk);
      },
    });
    const { reader } = makeReader(async () => new Response(stream));

    await expect(read(reader)).resolves.toMatchObject({
      kind: RuntimeReadKind.Malformed,
    });
    expect(pulled * chunk.byteLength).toBeLessThanOrEqual(
      MAX_RUNTIME_READ_BYTES + 2 * chunk.byteLength,
    );
  });

  it('reports an unreachable Core as unavailable', async () => {
    const { reader } = makeReader(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(read(reader)).resolves.toEqual({
      kind: RuntimeReadKind.Unavailable,
    });
  });

  it('reports a read its caller aborted as aborted', async () => {
    const controller = new AbortController();
    const { reader } = makeReader(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const pending = read(reader, controller.signal);
    controller.abort();
    await expect(pending).resolves.toEqual({ kind: RuntimeReadKind.Aborted });
  });
});
