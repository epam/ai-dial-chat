import { act, renderHook, waitFor } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import {
  MemoryRouter,
  type NavigateFunction,
  Route,
  Routes,
  useNavigate,
} from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  reportClientChannel,
  subscribeClientChannel,
  unsubscribeClientChannel,
} from '../../server-api/client-channel';
import { ROUTES } from '../../types/routes';
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

/** Renders the provider under a given initial route, since it derives `isStreamingCapablePage` via `useMatch`. */
const makeWrapper =
  (initialPath: string = ROUTES.Conversations) =>
  ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="*"
          element={<ClientChannelProvider>{children}</ClientChannelProvider>}
        />
      </Routes>
    </MemoryRouter>
  );

const wrapper = makeWrapper();

const NavigateCapture = ({
  onReady,
}: {
  onReady: (navigate: NavigateFunction) => void;
}) => {
  const navigate = useNavigate();
  useEffect(() => {
    onReady(navigate);
  }, [navigate, onReady]);
  return null;
};

/** Like `makeWrapper`, but also exposes a `navigate` function tests can call to simulate route changes without remounting the provider. */
const makeNavigableWrapper = (initialPath: string) => {
  let navigateFn: NavigateFunction = () => undefined;
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>
      <NavigateCapture
        onReady={(navigate) => {
          navigateFn = navigate;
        }}
      />
      <Routes>
        <Route
          path="*"
          element={<ClientChannelProvider>{children}</ClientChannelProvider>}
        />
      </Routes>
    </MemoryRouter>
  );
  return {
    Wrapper,
    navigate: (path: string) => act(() => navigateFn(path)),
  };
};

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
        { kind: 'toolset', id: 'evt-1', toolsetId: 'toolsets/b/my-toolset' },
      ]),
    );
  });

  it('parses an external-service/signin event, splitting url into appId and serviceName', async () => {
    mockUseFeatureFlag.mockReturnValue(true);
    const { stream, push } = makeControllableStream();
    mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

    const { result } = renderHook(() => useClientChannel(), { wrapper });
    await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

    const frame =
      'data: {"id":"evt-2","method":"external-service/signin","params":{"url":"applications/public/finhub-via-openapi__1.0.0/external_services/finhub-api2"}}\n\n';
    await act(async () => {
      push(frame);
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(result.current.pendingEvents).toEqual([
        {
          kind: 'external-service',
          id: 'evt-2',
          appId: 'applications/public/finhub-via-openapi__1.0.0',
          serviceName: 'finhub-api2',
        },
      ]),
    );
  });

  it('ignores an external-service/signin event whose url has no external_services segment', async () => {
    mockUseFeatureFlag.mockReturnValue(true);
    const { stream, push } = makeControllableStream();
    mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

    const { result } = renderHook(() => useClientChannel(), { wrapper });
    await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

    const frame =
      'data: {"id":"evt-2","method":"external-service/signin","params":{"url":"applications/public/my-app__1.0"}}\n\n';
    await act(async () => {
      push(frame);
      await Promise.resolve();
    });

    // Give any (incorrect) async handling a tick to run before asserting absence.
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.pendingEvents).toEqual([]);
  });

  it('keeps a toolset event and an external-service event addressable independently', async () => {
    mockUseFeatureFlag.mockReturnValue(true);
    const { stream, push } = makeControllableStream();
    mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

    const { result } = renderHook(() => useClientChannel(), { wrapper });
    await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

    await act(async () => {
      push(
        'data: {"id":"evt-1","method":"toolset/signin","params":{"toolsetId":"toolsets/b/my-toolset"}}\n\n',
      );
      push(
        'data: {"id":"evt-2","method":"external-service/signin","params":{"url":"app/external_services/svc"}}\n\n',
      );
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.pendingEvents).toHaveLength(2));
    expect(result.current.pendingEvents).toEqual(
      expect.arrayContaining([
        { kind: 'toolset', id: 'evt-1', toolsetId: 'toolsets/b/my-toolset' },
        {
          kind: 'external-service',
          id: 'evt-2',
          appId: 'app',
          serviceName: 'svc',
        },
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

  it('shows the dialog again for a new completion that reuses a previously-declined event id', async () => {
    /*
     * Core's RPC `id` is not globally unique across completions (e.g. it
     * can be scoped to a per-conversation tool-call counter), so declining
     * an event must not permanently suppress that id for the rest of the
     * session — only for duplicate deliveries of the same occurrence.
     */
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
      await result.current.reportEvent('evt-1', 'denied');
    });
    expect(result.current.pendingEvents).toHaveLength(0);

    // A new completion starts — the frontend nudges the channel via ensureConnected().
    act(() => {
      result.current.ensureConnected();
    });

    await act(async () => {
      push(frame);
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(result.current.pendingEvents).toEqual([
        { kind: 'toolset', id: 'evt-1', toolsetId: 'toolsets/b/my-toolset' },
      ]),
    );
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

  describe('page scoping', () => {
    it.each([['/files'], ['/']])(
      'does not subscribe when the flag is enabled but the route (%s) is not streaming-capable',
      async (path) => {
        mockUseFeatureFlag.mockReturnValue(true);

        renderHook(() => useClientChannel(), {
          wrapper: makeWrapper(path),
        });
        await act(async () => {
          await Promise.resolve();
        });

        expect(mockSubscribe).not.toHaveBeenCalled();
      },
    );

    it.each([[ROUTES.Conversations], [ROUTES.AppsEditor]])(
      'subscribes when the flag is enabled and the route is %s',
      async (path) => {
        mockUseFeatureFlag.mockReturnValue(true);
        const { stream } = makeControllableStream();
        mockSubscribe.mockResolvedValue({
          body: stream,
          channelId: 'channel-1',
        });

        const { result } = renderHook(() => useClientChannel(), {
          wrapper: makeWrapper(path),
        });

        await waitFor(() => expect(result.current.channelId).toBe('channel-1'));
      },
    );

    it('unsubscribes and clears pending events when navigating off a streaming-capable route', async () => {
      mockUseFeatureFlag.mockReturnValue(true);
      const { stream, push } = makeControllableStream();
      mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

      const { Wrapper, navigate } = makeNavigableWrapper(ROUTES.Conversations);
      const { result } = renderHook(() => useClientChannel(), {
        wrapper: Wrapper,
      });
      await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

      const frame =
        'data: {"id":"evt-1","method":"toolset/signin","params":{"toolsetId":"toolsets/b/my-toolset"}}\n\n';
      await act(async () => {
        push(frame);
        await Promise.resolve();
      });
      await waitFor(() => expect(result.current.pendingEvents).toHaveLength(1));

      navigate('/files');

      await waitFor(() => expect(result.current.channelId).toBeNull());
      expect(mockUnsubscribe).toHaveBeenCalledWith('channel-1');
      expect(result.current.pendingEvents).toHaveLength(0);
    });

    it('reconnects when navigating back to a streaming-capable route', async () => {
      mockUseFeatureFlag.mockReturnValue(true);
      const first = makeControllableStream();
      mockSubscribe.mockResolvedValueOnce({
        body: first.stream,
        channelId: 'channel-1',
      });

      const { Wrapper, navigate } = makeNavigableWrapper(ROUTES.Conversations);
      const { result } = renderHook(() => useClientChannel(), {
        wrapper: Wrapper,
      });
      await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

      navigate('/files');
      await waitFor(() => expect(result.current.channelId).toBeNull());

      const second = makeControllableStream();
      mockSubscribe.mockResolvedValueOnce({
        body: second.stream,
        channelId: 'channel-2',
      });

      navigate(ROUTES.Conversations);

      await waitFor(() => expect(result.current.channelId).toBe('channel-2'));
    });

    it('does not disconnect or reconnect when navigating between conversation sub-paths', async () => {
      mockUseFeatureFlag.mockReturnValue(true);
      const { stream } = makeControllableStream();
      mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

      const { Wrapper, navigate } = makeNavigableWrapper(
        `${ROUTES.Conversations}/conversation-1`,
      );
      const { result } = renderHook(() => useClientChannel(), {
        wrapper: Wrapper,
      });
      await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

      navigate(`${ROUTES.Conversations}/conversation-2`);
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockUnsubscribe).not.toHaveBeenCalled();
      expect(mockSubscribe).toHaveBeenCalledOnce();
      expect(result.current.channelId).toBe('channel-1');
    });
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
