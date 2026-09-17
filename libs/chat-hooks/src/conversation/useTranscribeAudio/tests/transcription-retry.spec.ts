import { ResponseError } from '@epam/ai-dial-chat-api-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AudioTranscriptionError,
  AudioTranscriptionErrorReason,
} from '../audio-transcription-error';
import { withTranscriptionRetry } from '../transcription-retry';

/* A minimal stand-in for a raw (non-generated-client) request error, matching
 * the `{ response: Response }` shape every recognition path can throw. */
class RawRequestError extends Error {
  constructor(readonly response: Response) {
    super('Request failed');
  }
}

const unavailable = (status = 503, retryAfter?: string) =>
  new ResponseError(
    new Response(null, {
      status,
      headers: retryAfter ? { 'Retry-After': retryAfter } : {},
    }),
  );

describe('withTranscriptionRetry', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('honors Retry-After and returns a recovered result once', async () => {
    const recognize = vi
      .fn()
      .mockRejectedValueOnce(unavailable(502, '3'))
      .mockResolvedValue('hello');
    const pending = withTranscriptionRetry(
      recognize,
      new AbortController().signal,
    );
    await vi.advanceTimersByTimeAsync(2999);
    expect(recognize).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBe('hello');
    expect(recognize).toHaveBeenCalledTimes(2);
  });

  it.each([429, 503])(
    'reports HTTP %i immediately without retrying',
    async (status) => {
      const recognize = vi.fn().mockRejectedValue(unavailable(status, '30'));
      await expect(
        withTranscriptionRetry(recognize, new AbortController().signal),
      ).rejects.toMatchObject({ reason: AudioTranscriptionErrorReason.Busy });
      expect(recognize).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('caps gateway retries at two with six seconds of total waiting', async () => {
    const recognize = vi.fn().mockRejectedValue(unavailable(504));
    const pending = expect(
      withTranscriptionRetry(recognize, new AbortController().signal),
    ).rejects.toMatchObject({ reason: AudioTranscriptionErrorReason.Busy });
    await vi.advanceTimersByTimeAsync(1999);
    expect(recognize).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(recognize).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4000);
    await pending;
    expect(recognize).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels the delay immediately without another request', async () => {
    const controller = new AbortController();
    const recognize = vi.fn().mockRejectedValue(unavailable(502));
    const pending = expect(
      withTranscriptionRetry(recognize, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(100);
    controller.abort();
    await pending;
    expect(vi.getTimerCount()).toBe(0);
    expect(recognize).toHaveBeenCalledOnce();
  });

  it.each([400, 401, 403, 404, 413, 500])(
    'does not retry permanent HTTP %i failures',
    async (status) => {
      const error = unavailable(status);
      const recognize = vi.fn().mockRejectedValue(error);
      await expect(
        withTranscriptionRetry(recognize, new AbortController().signal),
      ).rejects.toBe(error);
      expect(recognize).toHaveBeenCalledOnce();
    },
  );

  it('handles the selected-deployment raw request errors too', async () => {
    const recognize = vi
      .fn()
      .mockRejectedValueOnce(
        new RawRequestError(new Response(null, { status: 502 })),
      )
      .mockResolvedValue('hello');
    const pending = withTranscriptionRetry(
      recognize,
      new AbortController().signal,
    );
    await vi.advanceTimersByTimeAsync(2000);
    await expect(pending).resolves.toBe('hello');
  });

  it('accepts HTTP-date Retry-After', async () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00Z'));
    const recognize = vi
      .fn()
      .mockRejectedValueOnce(unavailable(504, 'Wed, 09 Sep 2026 10:00:04 GMT'))
      .mockResolvedValue('hello');
    const pending = withTranscriptionRetry(
      recognize,
      new AbortController().signal,
    );
    await vi.advanceTimersByTimeAsync(3999);
    expect(recognize).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBe('hello');
  });

  it('never retries earlier than a Retry-After exceeding the wait budget', async () => {
    const recognize = vi.fn().mockRejectedValue(unavailable(502, '120'));
    await expect(
      withTranscriptionRetry(recognize, new AbortController().signal),
    ).rejects.toBeInstanceOf(AudioTranscriptionError);
    expect(recognize).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
