import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiEndpoints } from '../base';
import { rateMessage } from '../rate.api';

const makeResponse = (status: number, body: unknown = null): Response =>
  new Response(body === null ? null : JSON.stringify(body), { status });

describe('rateMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls POST to ApiEndpoints.RATE', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(makeResponse(204));
    global.fetch = fetchSpy;

    await rateMessage({
      conversationId: 'bucket/conv',
      responseId: 'msg-1',
      modelId: 'gpt-4o',
      rate: 'like',
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ApiEndpoints.RATE);
    expect(init.method).toBe('POST');
  });

  it('sends the correct body', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(makeResponse(204));
    global.fetch = fetchSpy;

    const body = {
      conversationId: 'bucket/conv',
      responseId: 'msg-1',
      modelId: 'gpt-4o',
      rate: 'dislike' as const,
    };
    await rateMessage(body);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject(body);
  });

  it('includes optional comment when provided', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(makeResponse(204));
    global.fetch = fetchSpy;

    await rateMessage({
      conversationId: 'bucket/conv',
      responseId: 'msg-1',
      modelId: 'gpt-4o',
      rate: 'like',
      comment: 'Very helpful',
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      comment: 'Very helpful',
    });
  });
});
