import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCsrfToken } from '../base';
import { stopCompletion } from '../chat-stream.api';

describe('chat-stream api', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    setCsrfToken(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when stopCompletion receives a non-OK response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    await expect(
      stopCompletion({
        generationId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        path: 'gpt-4o__Hello__uuid',
      }),
    ).rejects.toThrow('stopCompletion failed: 500');
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
});
