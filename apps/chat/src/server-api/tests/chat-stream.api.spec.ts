import { getBrowserTimezone } from '@epam/ai-dial-chat-hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCsrfToken } from '../base';
import { stopCompletion, streamCompletion } from '../chat-stream.api';

vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return {
    ...actual,
    getBrowserTimezone: vi.fn(() => undefined),
  };
});

describe('chat-stream api', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    vi.mocked(getBrowserTimezone).mockReset();
    vi.mocked(getBrowserTimezone).mockReturnValue(undefined);
    setCsrfToken(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the stop request body to the completion stop endpoint', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await stopCompletion({
      generationId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
      path: 'gpt-4o__Hello__uuid',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/conversations/completions/stop',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          generationId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
          path: 'gpt-4o__Hello__uuid',
        }),
      }),
    );
  });

  const emptyStream = (): ReadableStream<Uint8Array> =>
    new ReadableStream({
      start(controller) {
        controller.close();
      },
    });

  const completeStreamRequest = (): Promise<void> =>
    new Promise<void>((resolve) => {
      streamCompletion('gpt-4o__Hello__uuid', 'hello', 'gpt-4o', {
        onChunk: vi.fn(),
        onComplete: resolve,
        onError: () => resolve(),
      });
    });

  it('sends the current browser timezone with each completion request', async () => {
    fetchMock.mockResolvedValue(
      new Response(emptyStream(), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    vi.mocked(getBrowserTimezone)
      .mockReturnValueOnce('Europe/Warsaw')
      .mockReturnValueOnce('Asia/Tokyo');

    await completeStreamRequest();
    await completeStreamRequest();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/conversations/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Timezone': 'Europe/Warsaw',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/conversations/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Timezone': 'Asia/Tokyo' }),
      }),
    );
    expect(getBrowserTimezone).toHaveBeenCalledTimes(2);
  });

  it('preserves CSRF and request body behavior when adding the timezone', async () => {
    fetchMock.mockResolvedValue(
      new Response(emptyStream(), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    setCsrfToken('csrf-token');
    vi.mocked(getBrowserTimezone).mockReturnValue('America/New_York');

    await completeStreamRequest();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/conversations/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-CSRF-Token': 'csrf-token',
          'X-Timezone': 'America/New_York',
        }),
        body: expect.stringContaining('"model":"gpt-4o"'),
      }),
    );
  });
});
