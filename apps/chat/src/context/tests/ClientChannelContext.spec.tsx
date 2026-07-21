import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  reportClientChannel,
  subscribeClientChannel,
  unsubscribeClientChannel,
} from '../../server-api/client-channel';
import { useFeatureFlag } from '../AppConfigContext';
import {
  ClientChannelProvider,
  useClientChannel,
} from '../ClientChannelContext';

vi.mock('../AppConfigContext', () => ({
  useFeatureFlag: vi.fn(),
}));

vi.mock('../../server-api/client-channel', () => ({
  ClientChannelReportResult: { Success: 'success', Denied: 'denied' },
  subscribeClientChannel: vi.fn(),
  reportClientChannel: vi.fn(),
  unsubscribeClientChannel: vi.fn(),
}));

const mockUseFeatureFlag = vi.mocked(useFeatureFlag);
const mockSubscribe = vi.mocked(subscribeClientChannel);
const mockReport = vi.mocked(reportClientChannel);
const mockUnsubscribe = vi.mocked(unsubscribeClientChannel);

const encoder = new TextEncoder();

/** A controllable SSE `ReadableStream` the test can push raw chunks into. */
const makeControllableStream = () => {
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
  });
  return {
    stream,
    push: (chunk: string) => controllerRef?.enqueue(encoder.encode(chunk)),
    close: () => controllerRef?.close(),
  };
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <ClientChannelProvider>{children}</ClientChannelProvider>
);

describe('ClientChannelProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnsubscribe.mockResolvedValue(undefined);
    mockReport.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not subscribe when the feature flag is disabled', () => {
    mockUseFeatureFlag.mockReturnValue(false);
    renderHook(() => useClientChannel(), { wrapper });

    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('subscribes and exposes the channel id when the flag is enabled', async () => {
    mockUseFeatureFlag.mockReturnValue(true);
    const { stream } = makeControllableStream();
    mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

    const { result } = renderHook(() => useClientChannel(), { wrapper });

    await waitFor(() => expect(result.current.channelId).toBe('channel-1'));
  });

  it('parses a toolset/signin event split across multiple network chunks', async () => {
    mockUseFeatureFlag.mockReturnValue(true);
    const { stream, push } = makeControllableStream();
    mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

    const { result } = renderHook(() => useClientChannel(), { wrapper });
    await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

    const frame =
      'data: {"id":"evt-1","method":"toolset/signin","params":{"toolsetId":"toolsets/b/my-toolset"}}\n\n';
    await act(async () => {
      push(frame.slice(0, 20));
      push(frame.slice(20));
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(result.current.pendingEvents).toEqual([
        { id: 'evt-1', toolsetId: 'toolsets/b/my-toolset' },
      ]),
    );
  });

  it('deduplicates a repeated event id', async () => {
    mockUseFeatureFlag.mockReturnValue(true);
    const { stream, push } = makeControllableStream();
    mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

    const { result } = renderHook(() => useClientChannel(), { wrapper });
    await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

    const frame =
      'data: {"id":"evt-1","method":"toolset/signin","params":{"toolsetId":"toolsets/b/my-toolset"}}\n\n';
    await act(async () => {
      push(frame);
      push(frame);
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.pendingEvents).toHaveLength(1));
  });

  it('removes the event after a successful report', async () => {
    mockUseFeatureFlag.mockReturnValue(true);
    const { stream, push } = makeControllableStream();
    mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

    const { result } = renderHook(() => useClientChannel(), { wrapper });
    await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

    const frame =
      'data: {"id":"evt-1","method":"toolset/signin","params":{"toolsetId":"toolsets/b/my-toolset"}}\n\n';
    await act(async () => {
      push(frame);
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.pendingEvents).toHaveLength(1));

    await act(async () => {
      await result.current.reportEvent('evt-1', 'success');
    });

    expect(mockReport).toHaveBeenCalledWith('channel-1', {
      id: 'evt-1',
      result: 'success',
    });
    expect(result.current.pendingEvents).toHaveLength(0);
  });

  it('keeps the event pending and rethrows when the report call fails', async () => {
    mockUseFeatureFlag.mockReturnValue(true);
    const { stream, push } = makeControllableStream();
    mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });
    mockReport.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useClientChannel(), { wrapper });
    await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

    const frame =
      'data: {"id":"evt-1","method":"toolset/signin","params":{"toolsetId":"toolsets/b/my-toolset"}}\n\n';
    await act(async () => {
      push(frame);
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.pendingEvents).toHaveLength(1));

    await expect(
      act(async () => {
        await result.current.reportEvent('evt-1', 'denied');
      }),
    ).rejects.toThrow('network error');

    expect(result.current.pendingEvents).toHaveLength(1);
  });

  it('unsubscribes and clears pending events when the flag flips to disabled', async () => {
    mockUseFeatureFlag.mockReturnValue(true);
    const { stream, push } = makeControllableStream();
    mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

    const { result, rerender } = renderHook(() => useClientChannel(), {
      wrapper,
    });
    await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

    const frame =
      'data: {"id":"evt-1","method":"toolset/signin","params":{"toolsetId":"toolsets/b/my-toolset"}}\n\n';
    await act(async () => {
      push(frame);
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.pendingEvents).toHaveLength(1));

    mockUseFeatureFlag.mockReturnValue(false);
    rerender();

    await waitFor(() => expect(result.current.channelId).toBeNull());
    expect(mockUnsubscribe).toHaveBeenCalledWith('channel-1');
    expect(result.current.pendingEvents).toHaveLength(0);
  });

  it('retries with capped backoff and stops after 5 attempts', async () => {
    vi.useFakeTimers();
    try {
      mockUseFeatureFlag.mockReturnValue(true);
      mockSubscribe.mockRejectedValue(new Error('unreachable'));

      renderHook(() => useClientChannel(), { wrapper });

      // Initial attempt happens synchronously on mount.
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockSubscribe).toHaveBeenCalledTimes(1);

      const delays = [1000, 2000, 4000, 8000, 16000];
      for (const [index, delay] of delays.entries()) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(delay);
        });
        expect(mockSubscribe).toHaveBeenCalledTimes(index + 2);
      }

      // Retries exhausted — advancing further schedules nothing new.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(mockSubscribe).toHaveBeenCalledTimes(delays.length + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws when used outside a ClientChannelProvider', () => {
    const { result } = renderHook(() => {
      try {
        return useClientChannel();
      } catch (err) {
        return err;
      }
    });
    expect(result.current).toBeInstanceOf(Error);
  });
});
