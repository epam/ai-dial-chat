import { describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import {
  CoreResponseResultKind,
  CoreResponsesClient,
} from './core-responses.client';

const sdkResult = (status: number, data?: unknown, body?: ReadableStream) => ({
  data,
  response: new Response(body ?? null, { status }),
});

const makeClient = (sdk: Record<string, ReturnType<typeof vi.fn>>) =>
  new CoreResponsesClient({
    client: sdk,
  } as unknown as DialClientService);

describe('CoreResponsesClient', () => {
  it('encodes the response id and forwards the bearer token on retrieve', async () => {
    const getResponseItem = vi.fn(async () =>
      sdkResult(200, { id: 'dial_a/b', status: 'completed' }),
    );
    const client = makeClient({ getResponseItem });

    const result = await client.retrieveResponse('dial_a/b', 'tok');

    expect(getResponseItem).toHaveBeenCalledWith('dial_a%2Fb', {
      headers: { Authorization: 'Bearer tok' },
    });
    expect(result).toEqual({
      kind: CoreResponseResultKind.Ok,
      response: { id: 'dial_a/b', status: 'completed' },
    });
  });

  it('maps a retrieve answer without a body to an error', async () => {
    const client = makeClient({
      getResponseItem: vi.fn(async () => sdkResult(200)),
    });

    expect(await client.retrieveResponse('id', 'tok')).toEqual({
      kind: CoreResponseResultKind.Error,
    });
  });

  it('requests a replay with stream=true and an event-stream Accept header', async () => {
    const stream = new ReadableStream();
    const getResponseItem = vi.fn(async () =>
      sdkResult(200, undefined, stream),
    );
    const client = makeClient({ getResponseItem });
    const signal = new AbortController().signal;

    const result = await client.replayResponse('dial_x', 'tok', signal);

    expect(getResponseItem).toHaveBeenCalledWith('dial_x', {
      headers: { Authorization: 'Bearer tok', Accept: 'text/event-stream' },
      params: { query: { stream: true } },
      parseAs: 'stream',
      signal,
    });
    expect(result.kind).toBe(CoreResponseResultKind.Ok);
  });

  it.each([
    [404, CoreResponseResultKind.NotFound],
    [403, CoreResponseResultKind.Forbidden],
    [409, CoreResponseResultKind.Active],
    [503, CoreResponseResultKind.Error],
  ])('maps a %s answer to %s', async (status, kind) => {
    const client = makeClient({
      getResponseItem: vi.fn(async () => sdkResult(status)),
      cancelResponseItem: vi.fn(async () => sdkResult(status)),
      deleteResponseItem: vi.fn(async () => sdkResult(status)),
    });

    expect((await client.retrieveResponse('id', 'tok')).kind).toBe(kind);
    expect((await client.cancelResponse('id', 'tok')).kind).toBe(kind);
    expect(await client.deleteResponse('id', 'tok')).toBe(kind);
  });

  it('reports a transport failure as an error instead of throwing', async () => {
    const client = makeClient({
      cancelResponseItem: vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    });

    await expect(client.cancelResponse('id', 'tok')).resolves.toEqual({
      kind: CoreResponseResultKind.Error,
    });
  });

  it('returns the cancelled response on a successful cancel', async () => {
    const client = makeClient({
      cancelResponseItem: vi.fn(async () =>
        sdkResult(200, { id: 'id', status: 'cancelled', output: [] }),
      ),
    });

    const result = await client.cancelResponse('id', 'tok');

    expect(result).toEqual({
      kind: CoreResponseResultKind.Ok,
      response: { id: 'id', status: 'cancelled', output: [] },
    });
  });

  it('reports a successful delete as ok', async () => {
    const deleteResponseItem = vi.fn(async () => sdkResult(200));
    const client = makeClient({ deleteResponseItem });

    expect(await client.deleteResponse('id', 'tok')).toBe(
      CoreResponseResultKind.Ok,
    );
    expect(deleteResponseItem).toHaveBeenCalledWith('id', {
      headers: { Authorization: 'Bearer tok' },
      parseAs: 'text',
    });
  });
});
