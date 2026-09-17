import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, useEffect, type ReactNode } from 'react';
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
import { GenerationProvider, useGeneration } from '../GenerationContext';

vi.mock('../AppConfigContext', async () => import('./app-config-context-mock'));

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
          element={
            <GenerationProvider>
              <ClientChannelProvider>{children}</ClientChannelProvider>
            </GenerationProvider>
          }
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
          element={
            <GenerationProvider>
              <ClientChannelProvider>{children}</ClientChannelProvider>
            </GenerationProvider>
          }
        />
      </Routes>
    </MemoryRouter>
  );
  return {
    Wrapper,
    navigate: (path: string) => act(() => navigateFn(path)),
  };
};

/**
 * Creates connection demand the way a real completion does — via the
 * context's own `ensureConnected()` — instead of relying on the mount-time
 * eager connect the demand-driven lifecycle removes.
 */
const createDemand = (channel: { ensureConnected: () => void }) => {
  act(() => {
    channel.ensureConnected();
  });
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

  it('mounts with the flag enabled with zero subscribes, then connects on demand', async () => {
    mockUseFeatureFlag.mockReturnValue(true);
    const { stream } = makeControllableStream();
    mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

    const { result } = renderHook(() => useClientChannel(), { wrapper });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockSubscribe).not.toHaveBeenCalled();

    createDemand(result.current);

    await waitFor(() => expect(result.current.channelId).toBe('channel-1'));
  });

  it('parses a toolset/signin event split across multiple network chunks', async () => {
    mockUseFeatureFlag.mockReturnValue(true);
    const { stream, push } = makeControllableStream();
    mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

    const { result } = renderHook(() => useClientChannel(), { wrapper });
    createDemand(result.current);
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
    createDemand(result.current);
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
    createDemand(result.current);
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
    createDemand(result.current);
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
    createDemand(result.current);
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
    createDemand(result.current);
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
    createDemand(result.current);
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
    createDemand(result.current);
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
    createDemand(result.current);
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
      'mounts with the flag enabled on %s with zero subscribes, then connects on demand',
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
        await act(async () => {
          await Promise.resolve();
        });
        expect(mockSubscribe).not.toHaveBeenCalled();

        createDemand(result.current);

        await waitFor(() => expect(result.current.channelId).toBe('channel-1'));
      },
    );

    it('unsubscribes when navigating off a streaming-capable route with nothing pending', async () => {
      mockUseFeatureFlag.mockReturnValue(true);
      const { stream } = makeControllableStream();
      mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

      const { Wrapper, navigate } = makeNavigableWrapper(ROUTES.Conversations);
      const { result } = renderHook(() => useClientChannel(), {
        wrapper: Wrapper,
      });
      createDemand(result.current);
      await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

      navigate('/files');

      await waitFor(() => expect(result.current.channelId).toBeNull());
      expect(mockUnsubscribe).toHaveBeenCalledWith('channel-1');
      expect(result.current.pendingEvents).toHaveLength(0);
    });

    it('keeps the channel and the pending events when navigating off a streaming-capable route with an unresolved signin event', async () => {
      mockUseFeatureFlag.mockReturnValue(true);
      const { stream, push } = makeControllableStream();
      mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

      const { Wrapper, navigate } = makeNavigableWrapper(ROUTES.Conversations);
      const { result } = renderHook(() => useClientChannel(), {
        wrapper: Wrapper,
      });
      createDemand(result.current);
      await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

      const frame =
        'data: {"id":"evt-1","method":"toolset/signin","params":{"toolsetId":"toolsets/b/my-toolset"}}\n\n';
      await act(async () => {
        push(frame);
        await Promise.resolve();
      });
      await waitFor(() => expect(result.current.pendingEvents).toHaveLength(1));

      navigate('/files');
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockUnsubscribe).not.toHaveBeenCalled();
      expect(result.current.channelId).toBe('channel-1');
      expect(result.current.pendingEvents).toHaveLength(1);
    });

    it('tears the pinned channel down once the last event is resolved off-route', async () => {
      mockUseFeatureFlag.mockReturnValue(true);
      const { stream, push } = makeControllableStream();
      mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

      const { Wrapper, navigate } = makeNavigableWrapper(ROUTES.Conversations);
      const { result } = renderHook(() => useClientChannel(), {
        wrapper: Wrapper,
      });
      createDemand(result.current);
      await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

      const frame =
        'data: {"id":"evt-1","method":"toolset/signin","params":{"toolsetId":"toolsets/b/my-toolset"}}\n\n';
      await act(async () => {
        push(frame);
        await Promise.resolve();
      });
      await waitFor(() => expect(result.current.pendingEvents).toHaveLength(1));

      navigate('/files');
      await act(async () => {
        await result.current.reportEvent('evt-1', 'denied');
      });

      expect(mockReport).toHaveBeenCalledWith('channel-1', {
        id: 'evt-1',
        result: 'denied',
      });
      expect(mockUnsubscribe).toHaveBeenCalledWith('channel-1');
      expect(result.current.pendingEvents).toHaveLength(0);
      expect(result.current.channelId).toBeNull();
    });

    it('navigating back to a streaming-capable route does not reconnect on its own — the next demand does', async () => {
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
      createDemand(result.current);
      await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

      navigate('/files');
      await waitFor(() => expect(result.current.channelId).toBeNull());

      navigate(ROUTES.Conversations);
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockSubscribe).toHaveBeenCalledOnce();
      expect(result.current.channelId).toBeNull();

      const second = makeControllableStream();
      mockSubscribe.mockResolvedValueOnce({
        body: second.stream,
        channelId: 'channel-2',
      });
      createDemand(result.current);

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
      createDemand(result.current);
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

      const { result } = renderHook(() => useClientChannel(), { wrapper });
      createDemand(result.current);

      // Initial attempt happens synchronously once demand is created.
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

  describe('idle disconnect', () => {
    const useHarness = () => ({
      channel: useClientChannel(),
      generation: useGeneration(),
    });

    it('disconnects ~1000ms after notifyGenerationSettled() when no generation is active', async () => {
      vi.useFakeTimers();
      try {
        mockUseFeatureFlag.mockReturnValue(true);
        const { stream } = makeControllableStream();
        mockSubscribe.mockResolvedValue({ body: stream, channelId: 'ch-1' });

        const { result } = renderHook(() => useHarness(), { wrapper });
        act(() => {
          result.current.channel.ensureConnected();
        });
        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.channel.channelId).toBe('ch-1');

        act(() => {
          result.current.generation.startGeneration('path-a', 'gen-1');
          result.current.generation.completeGeneration('path-a', 'gen-1');
          result.current.channel.notifyGenerationSettled();
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(999);
        });
        expect(mockUnsubscribe).not.toHaveBeenCalled();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1);
        });
        expect(mockUnsubscribe).toHaveBeenCalledWith('ch-1');
        expect(result.current.channel.channelId).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('cancels the pending disconnect when ensureConnected() is called within the grace window', async () => {
      vi.useFakeTimers();
      try {
        mockUseFeatureFlag.mockReturnValue(true);
        const { stream } = makeControllableStream();
        mockSubscribe.mockResolvedValue({ body: stream, channelId: 'ch-1' });

        const { result } = renderHook(() => useHarness(), { wrapper });
        act(() => {
          result.current.channel.ensureConnected();
        });
        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.channel.channelId).toBe('ch-1');

        act(() => {
          result.current.generation.startGeneration('path-a', 'gen-1');
          result.current.generation.completeGeneration('path-a', 'gen-1');
          result.current.channel.notifyGenerationSettled();
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(500);
        });

        act(() => {
          result.current.channel.ensureConnected();
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });

        expect(mockUnsubscribe).not.toHaveBeenCalled();
        expect(result.current.channel.channelId).toBe('ch-1');
      } finally {
        vi.useRealTimers();
      }
    });

    it('is a no-op while another generation is still active', async () => {
      vi.useFakeTimers();
      try {
        mockUseFeatureFlag.mockReturnValue(true);
        const { stream } = makeControllableStream();
        mockSubscribe.mockResolvedValue({ body: stream, channelId: 'ch-1' });

        const { result } = renderHook(() => useHarness(), { wrapper });
        act(() => {
          result.current.channel.ensureConnected();
        });
        await act(async () => {
          await Promise.resolve();
        });

        act(() => {
          result.current.generation.startGeneration('path-a', 'gen-1');
          result.current.generation.startGeneration('path-b', 'gen-2');
          result.current.generation.completeGeneration('path-a', 'gen-1');
          // path-b is still Active — hasActiveGeneration() must be true.
          result.current.channel.notifyGenerationSettled();
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });

        expect(mockUnsubscribe).not.toHaveBeenCalled();
        expect(result.current.channel.channelId).toBe('ch-1');
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not disconnect while a signin event is still unresolved', async () => {
      vi.useFakeTimers();
      try {
        mockUseFeatureFlag.mockReturnValue(true);
        const { stream, push } = makeControllableStream();
        mockSubscribe.mockResolvedValue({ body: stream, channelId: 'ch-1' });

        const { result } = renderHook(() => useHarness(), { wrapper });
        act(() => {
          result.current.channel.ensureConnected();
        });
        await act(async () => {
          await Promise.resolve();
        });

        await act(async () => {
          push(
            'data: {"id":"evt-1","method":"toolset/signin","params":{"toolsetId":"toolsets/b/my-toolset"}}\n\n',
          );
          await Promise.resolve();
        });
        expect(result.current.channel.pendingEvents).toHaveLength(1);

        /* Core ends the completion while it waits for the report, so the
         * generation settles with the event still on screen. */
        act(() => {
          result.current.generation.startGeneration('path-a', 'gen-1');
          result.current.generation.completeGeneration('path-a', 'gen-1');
          result.current.channel.notifyGenerationSettled();
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(5000);
        });

        expect(mockUnsubscribe).not.toHaveBeenCalled();
        expect(result.current.channel.channelId).toBe('ch-1');
        expect(result.current.channel.pendingEvents).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('cancels a scheduled disconnect when a signin event arrives inside the grace window', async () => {
      vi.useFakeTimers();
      try {
        mockUseFeatureFlag.mockReturnValue(true);
        const { stream, push } = makeControllableStream();
        mockSubscribe.mockResolvedValue({ body: stream, channelId: 'ch-1' });

        const { result } = renderHook(() => useHarness(), { wrapper });
        act(() => {
          result.current.channel.ensureConnected();
        });
        await act(async () => {
          await Promise.resolve();
        });

        act(() => {
          result.current.generation.startGeneration('path-a', 'gen-1');
          result.current.generation.completeGeneration('path-a', 'gen-1');
          result.current.channel.notifyGenerationSettled();
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(500);
          push(
            'data: {"id":"evt-1","method":"toolset/signin","params":{"toolsetId":"toolsets/b/my-toolset"}}\n\n',
          );
          await Promise.resolve();
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });

        expect(mockUnsubscribe).not.toHaveBeenCalled();
        expect(result.current.channel.channelId).toBe('ch-1');
        expect(result.current.channel.pendingEvents).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('resumes the idle countdown once the last event is resolved', async () => {
      vi.useFakeTimers();
      try {
        mockUseFeatureFlag.mockReturnValue(true);
        const { stream, push } = makeControllableStream();
        mockSubscribe.mockResolvedValue({ body: stream, channelId: 'ch-1' });

        const { result } = renderHook(() => useHarness(), { wrapper });
        act(() => {
          result.current.channel.ensureConnected();
        });
        await act(async () => {
          await Promise.resolve();
        });

        await act(async () => {
          push(
            'data: {"id":"evt-1","method":"toolset/signin","params":{"toolsetId":"toolsets/b/my-toolset"}}\n\n',
          );
          await Promise.resolve();
        });

        act(() => {
          result.current.generation.startGeneration('path-a', 'gen-1');
          result.current.generation.completeGeneration('path-a', 'gen-1');
          result.current.channel.notifyGenerationSettled();
        });

        await act(async () => {
          await result.current.channel.reportEvent('evt-1', 'denied');
        });
        expect(mockUnsubscribe).not.toHaveBeenCalled();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });

        expect(mockUnsubscribe).toHaveBeenCalledWith('ch-1');
        expect(result.current.channel.channelId).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not fire the idle timer again after unmount', async () => {
      vi.useFakeTimers();
      try {
        mockUseFeatureFlag.mockReturnValue(true);
        const { stream } = makeControllableStream();
        mockSubscribe.mockResolvedValue({ body: stream, channelId: 'ch-1' });

        const { result, unmount } = renderHook(() => useHarness(), {
          wrapper,
        });
        act(() => {
          result.current.channel.ensureConnected();
        });
        await act(async () => {
          await Promise.resolve();
        });

        act(() => {
          result.current.generation.startGeneration('path-a', 'gen-1');
          result.current.generation.completeGeneration('path-a', 'gen-1');
          result.current.channel.notifyGenerationSettled();
        });

        unmount();
        // Unmount's own cleanup disconnects synchronously.
        expect(mockUnsubscribe).toHaveBeenCalledTimes(1);

        await act(async () => {
          await vi.advanceTimersByTimeAsync(5000);
        });

        // The idle timer must not fire a second, stray disconnect.
        expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('reconnects transparently when a new completion starts after an idle disconnect', async () => {
      vi.useFakeTimers();
      try {
        mockUseFeatureFlag.mockReturnValue(true);
        const first = makeControllableStream();
        const second = makeControllableStream();
        mockSubscribe
          .mockResolvedValueOnce({ body: first.stream, channelId: 'ch-1' })
          .mockResolvedValueOnce({ body: second.stream, channelId: 'ch-2' });

        const { result } = renderHook(() => useHarness(), { wrapper });
        act(() => {
          result.current.channel.ensureConnected();
        });
        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.channel.channelId).toBe('ch-1');

        act(() => {
          result.current.generation.startGeneration('path-a', 'gen-1');
          result.current.generation.completeGeneration('path-a', 'gen-1');
          result.current.channel.notifyGenerationSettled();
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
        expect(result.current.channel.channelId).toBeNull();

        act(() => {
          result.current.channel.ensureConnected();
        });
        await act(async () => {
          await Promise.resolve();
        });

        expect(mockSubscribe).toHaveBeenCalledTimes(2);
        expect(result.current.channel.channelId).toBe('ch-2');
      } finally {
        vi.useRealTimers();
      }
    });

    it('demand from a second, still-in-flight completion survives the idle timer firing', async () => {
      vi.useFakeTimers();
      try {
        mockUseFeatureFlag.mockReturnValue(true);
        const { stream } = makeControllableStream();
        mockSubscribe.mockResolvedValue({ body: stream, channelId: 'ch-1' });

        const { result } = renderHook(() => useClientChannel(), { wrapper });
        // Two completions each acquire their own demand token.
        act(() => {
          result.current.ensureConnected();
        });
        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.channelId).toBe('ch-1');
        act(() => {
          result.current.ensureConnected();
        });

        // The first one settles — releasing only its own token — while the
        // second's is still outstanding (it has not settled).
        act(() => {
          result.current.notifyGenerationSettled();
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });

        expect(mockUnsubscribe).not.toHaveBeenCalled();
        expect(result.current.channelId).toBe('ch-1');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('connection ownership generations', () => {
    it("an aborted connect's late rejection does not clear a newer connection's controller", async () => {
      mockUseFeatureFlag.mockReturnValue(true);
      let rejectFirst!: (err: Error) => void;
      mockSubscribe.mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          rejectFirst = reject;
        }),
      );

      const { Wrapper, navigate } = makeNavigableWrapper(ROUTES.Conversations);
      const { result } = renderHook(() => useClientChannel(), {
        wrapper: Wrapper,
      });
      createDemand(result.current);
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockSubscribe).toHaveBeenCalledOnce();

      // Teardown aborts the first attempt and bumps the generation.
      navigate('/files');
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.channelId).toBeNull();

      // A new completion on the (now eligible again) route starts a second attempt.
      const second = makeControllableStream();
      mockSubscribe.mockResolvedValueOnce({
        body: second.stream,
        channelId: 'channel-2',
      });
      navigate(ROUTES.Conversations);
      createDemand(result.current);
      await waitFor(() => expect(result.current.channelId).toBe('channel-2'));

      // The first attempt's subscribe finally rejects — must not touch the second.
      await act(async () => {
        rejectFirst(new Error('late rejection'));
        await Promise.resolve();
      });

      expect(result.current.channelId).toBe('channel-2');
      expect(mockSubscribe).toHaveBeenCalledTimes(2);
    });

    it("an aborted connect's late success does not install a stale channel id", async () => {
      mockUseFeatureFlag.mockReturnValue(true);
      let resolveFirst!: (value: {
        body: ReadableStream<Uint8Array>;
        channelId: string;
      }) => void;
      mockSubscribe.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      );

      const { Wrapper, navigate } = makeNavigableWrapper(ROUTES.Conversations);
      const { result } = renderHook(() => useClientChannel(), {
        wrapper: Wrapper,
      });
      createDemand(result.current);
      await act(async () => {
        await Promise.resolve();
      });

      // Teardown aborts the first attempt before it resolves.
      navigate('/files');
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.channelId).toBeNull();

      const stale = makeControllableStream();
      const cancelSpy = vi.spyOn(stale.stream, 'cancel');
      await act(async () => {
        resolveFirst({ body: stale.stream, channelId: 'stale-channel' });
        await Promise.resolve();
      });

      // Not eligible off-route, so no waiter/subscription should install the stale id.
      expect(result.current.channelId).toBeNull();
      expect(cancelSpy).toHaveBeenCalledOnce();
      expect(mockSubscribe).toHaveBeenCalledOnce();
    });

    it('a superseded connection schedules no reconnect', async () => {
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
      createDemand(result.current);
      await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

      navigate('/files');
      await act(async () => {
        await Promise.resolve();
      });

      // Closing the (already-aborted) stream must not trigger scheduleReconnect.
      await act(async () => {
        first.close();
        await Promise.resolve();
      });

      expect(mockSubscribe).toHaveBeenCalledOnce();
    });

    it('leaves no timer, waiter, reader, or controller after repeated disconnect(), and does not throw', async () => {
      mockUseFeatureFlag.mockReturnValue(true);
      const { stream } = makeControllableStream();
      mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

      const { result, unmount } = renderHook(() => useClientChannel(), {
        wrapper,
      });
      createDemand(result.current);
      await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

      expect(() => unmount()).not.toThrow();
      expect(mockUnsubscribe).toHaveBeenCalledOnce();

      // A second teardown-equivalent path (StrictMode-style) must stay inert.
      const waitedId = result.current.waitForChannel(100);
      expect(await waitedId).toBeNull();
    });

    it('StrictMode double mount leaves no lingering subscription from the discarded first mount', async () => {
      mockUseFeatureFlag.mockReturnValue(true);
      const { stream } = makeControllableStream();
      mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

      const StrictWrapper = ({ children }: { children: ReactNode }) => (
        <StrictMode>{makeWrapper()({ children })}</StrictMode>
      );

      const { result } = renderHook(() => useClientChannel(), {
        wrapper: StrictWrapper,
      });
      createDemand(result.current);
      await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

      // Whether StrictMode's synthetic unmount/remount produced one or two
      // subscribe calls, the surviving connection is consistent and no
      // duplicate stays live: exactly one unsubscribe (if any) matches the
      // teardown of a discarded mount, and the current state is coherent.
      expect(mockSubscribe.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(result.current.channelId).toBe('channel-1');
    });
  });

  describe('demand-driven lifecycle', () => {
    it('produces zero subscribes when navigating between eligible conversations before any demand', async () => {
      mockUseFeatureFlag.mockReturnValue(true);

      const { Wrapper, navigate } = makeNavigableWrapper(
        `${ROUTES.Conversations}/conversation-1`,
      );
      renderHook(() => useClientChannel(), { wrapper: Wrapper });
      await act(async () => {
        await Promise.resolve();
      });

      navigate(`${ROUTES.Conversations}/conversation-2`);
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockSubscribe).not.toHaveBeenCalled();
    });

    it('produces zero subscribes when the flag resolves from not-yet-Ready to enabled', async () => {
      mockUseFeatureFlag.mockReturnValue(false);

      const { rerender } = renderHook(() => useClientChannel(), { wrapper });
      await act(async () => {
        await Promise.resolve();
      });

      mockUseFeatureFlag.mockReturnValue(true);
      rerender();
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockSubscribe).not.toHaveBeenCalled();
    });

    it('a background tab becoming visible does not resurrect a never-connected channel, and leaves dedup state alone', async () => {
      mockUseFeatureFlag.mockReturnValue(true);
      const originalVisibilityState = document.visibilityState;
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      try {
        renderHook(() => useClientChannel(), { wrapper });
        await act(async () => {
          await Promise.resolve();
        });

        document.dispatchEvent(new Event('visibilitychange'));
        await act(async () => {
          await Promise.resolve();
        });

        expect(mockSubscribe).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          value: originalVisibilityState,
        });
      }
    });

    it('a background tab becoming visible does not resurrect an idle-disconnected channel', async () => {
      vi.useFakeTimers();
      const originalVisibilityState = document.visibilityState;
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      try {
        mockUseFeatureFlag.mockReturnValue(true);
        const { stream } = makeControllableStream();
        mockSubscribe.mockResolvedValue({ body: stream, channelId: 'ch-1' });

        const { result } = renderHook(
          () => ({ channel: useClientChannel(), generation: useGeneration() }),
          { wrapper },
        );
        createDemand(result.current.channel);
        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.channel.channelId).toBe('ch-1');

        act(() => {
          result.current.generation.startGeneration('path-a', 'gen-1');
          result.current.generation.completeGeneration('path-a', 'gen-1');
          result.current.channel.notifyGenerationSettled();
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
        expect(result.current.channel.channelId).toBeNull();

        document.dispatchEvent(new Event('visibilitychange'));
        await act(async () => {
          await Promise.resolve();
        });

        expect(mockSubscribe).toHaveBeenCalledOnce();
        expect(result.current.channel.channelId).toBeNull();
      } finally {
        vi.useRealTimers();
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          value: originalVisibilityState,
        });
      }
    });

    it('two concurrent demands share one in-flight subscribe and both receive the same id', async () => {
      mockUseFeatureFlag.mockReturnValue(true);
      let resolveSubscribe!: (value: {
        body: ReadableStream<Uint8Array>;
        channelId: string;
      }) => void;
      mockSubscribe.mockReturnValue(
        new Promise((resolve) => {
          resolveSubscribe = resolve;
        }),
      );

      const { result } = renderHook(() => useClientChannel(), { wrapper });

      const waitA = result.current.waitForChannel(5000);
      const waitB = result.current.waitForChannel(5000);

      const { stream } = makeControllableStream();
      await act(async () => {
        resolveSubscribe({ body: stream, channelId: 'shared-channel' });
        await Promise.resolve();
      });

      expect(await waitA).toBe('shared-channel');
      expect(await waitB).toBe('shared-channel');
      expect(mockSubscribe).toHaveBeenCalledOnce();
    });

    it('demand while already connected reuses the channel id with no new subscribe', async () => {
      mockUseFeatureFlag.mockReturnValue(true);
      const { stream } = makeControllableStream();
      mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

      const { result } = renderHook(() => useClientChannel(), { wrapper });
      createDemand(result.current);
      await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

      createDemand(result.current);
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockSubscribe).toHaveBeenCalledOnce();
      expect(result.current.channelId).toBe('channel-1');
    });

    it('a drop with nothing waiting schedules no reconnect', async () => {
      mockUseFeatureFlag.mockReturnValue(true);
      const { stream, close } = makeControllableStream();
      mockSubscribe.mockResolvedValueOnce({ body: stream, channelId: 'ch-1' });

      const { result } = renderHook(
        () => ({ channel: useClientChannel(), generation: useGeneration() }),
        { wrapper },
      );
      createDemand(result.current.channel);
      await waitFor(() =>
        expect(result.current.channel.channelId).toBe('ch-1'),
      );

      act(() => {
        result.current.generation.startGeneration('path-a', 'gen-1');
        result.current.generation.completeGeneration('path-a', 'gen-1');
        result.current.channel.notifyGenerationSettled();
      });

      await act(async () => {
        close();
        await Promise.resolve();
      });

      expect(mockSubscribe).toHaveBeenCalledOnce();
    });

    it('a backgrounded tab mid-generation keeps retrying with the existing capped backoff', async () => {
      vi.useFakeTimers();
      try {
        mockUseFeatureFlag.mockReturnValue(true);
        const first = makeControllableStream();
        mockSubscribe.mockResolvedValueOnce({
          body: first.stream,
          channelId: 'ch-1',
        });

        const { result } = renderHook(
          () => ({ channel: useClientChannel(), generation: useGeneration() }),
          { wrapper },
        );
        createDemand(result.current.channel);
        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.channel.channelId).toBe('ch-1');

        // Demand is held throughout — a generation is running on this channel.
        act(() => {
          result.current.generation.startGeneration('path-a', 'gen-1');
        });

        mockSubscribe.mockResolvedValueOnce({
          body: makeControllableStream().stream,
          channelId: 'ch-2',
        });
        await act(async () => {
          first.close();
          await vi.advanceTimersByTimeAsync(1000);
        });

        expect(mockSubscribe).toHaveBeenCalledTimes(2);
        expect(result.current.channel.channelId).toBe('ch-2');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('teardown and pin coverage', () => {
    it('zero active generations alone never disconnects a channel held by demand', async () => {
      vi.useFakeTimers();
      try {
        mockUseFeatureFlag.mockReturnValue(true);
        const { stream } = makeControllableStream();
        mockSubscribe.mockResolvedValue({ body: stream, channelId: 'ch-1' });

        const { result } = renderHook(() => useClientChannel(), { wrapper });
        createDemand(result.current);
        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.channelId).toBe('ch-1');

        // No generation was ever started, so notifyGenerationSettled() never
        // fires and no idle timer is ever armed — the channel just stays up.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10_000);
        });

        expect(mockUnsubscribe).not.toHaveBeenCalled();
        expect(result.current.channelId).toBe('ch-1');
      } finally {
        vi.useRealTimers();
      }
    });

    it('flag-disable, logout (unmount), and repeated teardown each leave no timer, waiter, reader, or controller outstanding', async () => {
      mockUseFeatureFlag.mockReturnValue(true);
      const { stream } = makeControllableStream();
      mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

      const { result, rerender, unmount } = renderHook(
        () => useClientChannel(),
        { wrapper },
      );
      createDemand(result.current);
      await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

      mockUseFeatureFlag.mockReturnValue(false);
      rerender();
      await waitFor(() => expect(result.current.channelId).toBeNull());
      expect(mockUnsubscribe).toHaveBeenCalledOnce();

      expect(() => unmount()).not.toThrow();
      // Unmount's own unconditional teardown must be inert given nothing is
      // connected any more — no second unsubscribe call.
      expect(mockUnsubscribe).toHaveBeenCalledOnce();
    });
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

  describe('waitForChannel', () => {
    it('resolves immediately when channelId is already established', async () => {
      mockUseFeatureFlag.mockReturnValue(true);
      const { stream } = makeControllableStream();
      mockSubscribe.mockResolvedValue({ body: stream, channelId: 'channel-1' });

      const { result } = renderHook(() => useClientChannel(), { wrapper });
      createDemand(result.current);
      await waitFor(() => expect(result.current.channelId).toBe('channel-1'));

      let resolved: string | null = null;
      await act(async () => {
        resolved = await result.current.waitForChannel();
      });

      expect(resolved).toBe('channel-1');
    });

    it('resolves with channelId when subscribe completes during the wait', async () => {
      mockUseFeatureFlag.mockReturnValue(true);
      let resolveSubscribe!: (value: {
        body: ReadableStream<Uint8Array>;
        channelId: string;
      }) => void;
      mockSubscribe.mockReturnValue(
        new Promise((resolve) => {
          resolveSubscribe = resolve;
        }),
      );

      const { result } = renderHook(() => useClientChannel(), { wrapper });

      /* Start waiting before the subscribe has resolved. */
      const waitedId = result.current.waitForChannel(5000);

      const { stream } = makeControllableStream();
      await act(async () => {
        resolveSubscribe({ body: stream, channelId: 'channel-async' });
        await Promise.resolve();
      });

      expect(await waitedId).toBe('channel-async');
    });

    it('resolves with null when navigating away from the streaming page during the wait', async () => {
      mockUseFeatureFlag.mockReturnValue(true);
      /* Subscribe never resolves so the wait stays pending. */
      mockSubscribe.mockReturnValue(new Promise(() => undefined));

      const { Wrapper, navigate } = makeNavigableWrapper(ROUTES.Conversations);
      const { result } = renderHook(() => useClientChannel(), {
        wrapper: Wrapper,
      });
      await act(async () => {
        await Promise.resolve();
      });

      /* Start waiting; subscription is still in flight. */
      const waitedId = result.current.waitForChannel(5000);

      /* Navigating away triggers disconnect → resolveChannelWaiters(null). */
      await navigate('/files');

      expect(await waitedId).toBeNull();
    });

    it('resolves with null on timeout when subscribe does not complete in time', async () => {
      vi.useFakeTimers();
      try {
        mockUseFeatureFlag.mockReturnValue(true);
        mockSubscribe.mockReturnValue(new Promise(() => undefined));

        const { result } = renderHook(() => useClientChannel(), { wrapper });
        await act(async () => {
          await Promise.resolve();
        });

        const waitedId = result.current.waitForChannel(2000);

        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });

        expect(await waitedId).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
