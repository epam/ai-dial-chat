import { act, renderHook } from '@testing-library/react';
import type { AnimationItem } from 'lottie-web';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LottieScenePlayback } from '../../models/lottie-scene';
import {
  LottieDataOwnership,
  LottieScenePhase,
} from '../../types/lottie-scene';
import { loadLottiePlayer, type LottiePlayer } from '../../utils/lottie-player';
import { useLottieSceneSession } from '../useLottieSceneSession';

vi.mock('../../utils/lottie-player', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/lottie-player')>()),
  loadLottiePlayer: vi.fn(),
}));

interface Preparation {
  id: number;
}

const destroy = vi.fn();
const player: LottiePlayer = {
  loadAnimation: vi.fn(
    () =>
      ({
        isLoaded: true,
        setSubframe: vi.fn(),
        play: vi.fn(),
        destroy,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as AnimationItem,
  ),
};
const PLAYBACK: LottieScenePlayback<Preparation> = {
  timings: { loadTimeoutMs: 2000, readyTimeoutMs: 250, playbackMs: 16000 },
  ownership: LottieDataOwnership.Transferred,
  getAnimationData: () => ({ layers: [] }),
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.mocked(loadLottiePlayer).mockReset().mockResolvedValue(player);
});
afterEach(() => {
  vi.useRealTimers();
});

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
};
const deferPlayer = () => {
  let resolve: (value: LottiePlayer) => void = () => undefined;
  vi.mocked(loadLottiePlayer).mockReturnValue(
    new Promise<LottiePlayer>((complete) => {
      resolve = complete;
    }),
  );
  return () => resolve(player);
};
const strict = ({ children }: { children: ReactNode }) => (
  <StrictMode>{children}</StrictMode>
);
const renderSession = (
  enabled = true,
  prepare = vi.fn((): Preparation => ({ id: 1 })),
  wrapper?: typeof strict,
) => {
  const view = renderHook(
    ({ isEnabled, onPrepare }) =>
      useLottieSceneSession({
        enabled: isEnabled,
        playback: PLAYBACK,
        prepare: onPrepare,
      }),
    { initialProps: { isEnabled: enabled, onPrepare: prepare }, wrapper },
  );
  return { ...view, prepare };
};

describe('useLottieSceneSession', () => {
  it('imports the player and prepares once under StrictMode', async () => {
    const { result, prepare } = renderSession(true, undefined, strict);
    await flush();
    expect(loadLottiePlayer).toHaveBeenCalledOnce();
    expect(prepare).toHaveBeenCalledOnce();
    expect(result.current.phase).toBe(LottieScenePhase.Prepared);
    expect(result.current.preparation).toEqual({ id: 1 });
  });

  it('never calls the loader while disabled', async () => {
    const { result } = renderSession(false);
    await flush();
    act(() => vi.advanceTimersByTime(5000));
    expect(loadLottiePlayer).not.toHaveBeenCalled();
    expect(result.current.phase).toBe(LottieScenePhase.Idle);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('drops a disposed session preparation when disabled and re-enabled', async () => {
    const { result, rerender, prepare } = renderSession();
    await flush();
    expect(result.current.phase).toBe(LottieScenePhase.Prepared);
    rerender({ isEnabled: false, onPrepare: prepare });
    await flush();
    expect(result.current.phase).toBe(LottieScenePhase.Idle);
    expect(result.current.preparation).toBeNull();
    const resolve = deferPlayer();
    rerender({ isEnabled: true, onPrepare: vi.fn(() => ({ id: 2 })) });
    await flush();
    expect(result.current.phase).toBe(LottieScenePhase.Loading);
    expect(result.current.preparation).toBeNull();
    await act(async () => resolve());
    await flush();
    expect(result.current.phase).toBe(LottieScenePhase.Prepared);
    expect(result.current.preparation).toEqual({ id: 2 });
  });

  it('ends instead of falling back when cancelled during a pending import', async () => {
    const resolve = deferPlayer();
    const { result, prepare } = renderSession();
    await flush();
    act(() => result.current.cancel());
    await act(async () => resolve());
    expect(prepare).not.toHaveBeenCalled();
    expect(result.current.phase).toBe(LottieScenePhase.Ended);
  });

  it('keeps an ended scene ended when the load deadline later elapses', async () => {
    deferPlayer();
    const { result } = renderSession();
    await flush();
    act(() => result.current.cancel());
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.phase).toBe(LottieScenePhase.Ended);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ends the static fallback when cancelled after a failure', async () => {
    vi.mocked(loadLottiePlayer).mockRejectedValue(new Error('Chunk failed'));
    const { result } = renderSession();
    await flush();
    expect(result.current.phase).toBe(LottieScenePhase.Failed);
    act(() => result.current.cancel());
    expect(result.current.phase).toBe(LottieScenePhase.Ended);
  });

  it('does not restart or reset the load deadline when the caller re-renders with a new prepare function', async () => {
    deferPlayer();
    const { result, rerender } = renderSession();
    await flush();
    act(() => vi.advanceTimersByTime(1900));
    rerender({ isEnabled: true, onPrepare: vi.fn(() => ({ id: 2 })) });
    await flush();
    act(() => vi.advanceTimersByTime(99));
    expect(result.current.phase).toBe(LottieScenePhase.Loading);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.phase).toBe(LottieScenePhase.Failed);
    expect(loadLottiePlayer).toHaveBeenCalledOnce();
  });

  it('prepares with the latest prepare function', async () => {
    const resolve = deferPlayer();
    const latest = vi.fn(() => ({ id: 2 }));
    const { result, rerender, prepare } = renderSession();
    await flush();
    rerender({ isEnabled: true, onPrepare: latest });
    await act(async () => resolve());
    await flush();
    expect(prepare).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
    expect(result.current.preparation).toEqual({ id: 2 });
  });

  it('disposes the session on unmount without state updates or remaining timers', async () => {
    const resolve = deferPlayer();
    const error = vi.spyOn(console, 'error');
    const { unmount, prepare } = renderSession();
    await flush();
    unmount();
    await act(async () => resolve());
    act(() => vi.advanceTimersByTime(20000));
    expect(prepare).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(error).not.toHaveBeenCalled();
  });

  it('reports failure when the import rejects', async () => {
    vi.mocked(loadLottiePlayer).mockRejectedValue(new Error('Chunk failed'));
    const { result } = renderSession();
    await flush();
    expect(result.current.phase).toBe(LottieScenePhase.Failed);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps cancel referentially stable across renders', async () => {
    const { result, rerender } = renderSession();
    const { cancel } = result.current;
    rerender({ isEnabled: true, onPrepare: vi.fn(() => ({ id: 3 })) });
    await flush();
    expect(result.current.cancel).toBe(cancel);
  });
});
