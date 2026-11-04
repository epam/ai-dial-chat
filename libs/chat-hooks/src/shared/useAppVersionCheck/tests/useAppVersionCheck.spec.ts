import { act, fireEvent, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppVersionCheck, type AppBuildInfo } from '../useAppVersionCheck';

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const flush = () => act(() => Promise.resolve());

const checkHealth = vi.fn<(signal: AbortSignal) => Promise<AppBuildInfo>>();
const useHook = () => useAppVersionCheck({ checkHealth });

describe('useAppVersionCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    checkHealth.mockReset();
    checkHealth.mockResolvedValue({ buildId: 'build-1' });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('establishes a baseline and keeps the app when the build is unchanged', async () => {
    const { result } = renderHook(useHook);
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    expect(checkHealth).toHaveBeenCalledTimes(2);
    expect(result.current.isNewVersionAvailable).toBe(false);
  });

  it('detects a deployment during polling and stops all further checks', async () => {
    const { result } = renderHook(useHook);
    await flush();
    checkHealth.mockResolvedValue({ buildId: 'build-2' });
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    expect(result.current.isNewVersionAvailable).toBe(true);
    fireEvent.focus(window);
    fireEvent(document, new Event('visibilitychange'));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2));
    expect(checkHealth).toHaveBeenCalledTimes(2);
  });

  it.each(['visibilitychange', 'focus', 'pageshow'])(
    'checks immediately on %s without waiting for the poll',
    async (event) => {
      const { result } = renderHook(useHook);
      await flush();
      checkHealth.mockResolvedValue({ buildId: 'build-2' });
      fireEvent(
        event === 'visibilitychange' ? document : window,
        new Event(event),
      );
      await flush();

      expect(result.current.isNewVersionAvailable).toBe(true);
      expect(checkHealth).toHaveBeenCalledTimes(2);
    },
  );

  it('does not poll hidden tabs, then checks when the tab becomes visible', async () => {
    const { result } = renderHook(useHook);
    await flush();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    expect(checkHealth).toHaveBeenCalledOnce();

    checkHealth.mockResolvedValue({ buildId: 'build-2' });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    fireEvent(document, new Event('visibilitychange'));
    await flush();
    expect(result.current.isNewVersionAvailable).toBe(true);
  });

  it.each(['pointerdown', 'keydown'])(
    'checks on the first %s after idle even when timers were suspended',
    async (event) => {
      const { result } = renderHook(useHook);
      await flush();
      checkHealth.mockResolvedValue({ buildId: 'build-2' });
      vi.setSystemTime(Date.now() + POLL_INTERVAL_MS);
      fireEvent(window, new Event(event));
      await flush();

      expect(result.current.isNewVersionAvailable).toBe(true);
    },
  );

  it('does not request health on every keystroke or click', async () => {
    renderHook(useHook);
    await flush();
    fireEvent.keyDown(window);
    fireEvent.pointerDown(window);
    await flush();

    expect(checkHealth).toHaveBeenCalledOnce();
  });

  it('ignores missing build IDs and network failures and retries', async () => {
    checkHealth.mockResolvedValueOnce({});
    const { result } = renderHook(useHook);
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    expect(result.current.isNewVersionAvailable).toBe(false);

    checkHealth.mockRejectedValueOnce(new Error('offline'));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    expect(result.current.isNewVersionAvailable).toBe(false);

    checkHealth.mockResolvedValue({ buildId: 'build-2' });
    fireEvent.focus(window);
    await flush();
    expect(result.current.isNewVersionAvailable).toBe(true);
  });

  it('deduplicates concurrent checks without replacing the original baseline', async () => {
    let resolveHealth!: (value: AppBuildInfo) => void;
    checkHealth.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveHealth = resolve;
        }),
    );
    const { result } = renderHook(useHook);
    fireEvent.focus(window);
    fireEvent(document, new Event('visibilitychange'));
    expect(checkHealth).toHaveBeenCalledOnce();

    await act(async () => resolveHealth({ buildId: 'build-1' }));
    checkHealth.mockResolvedValue({ buildId: 'build-2' });
    fireEvent.focus(window);
    await flush();
    expect(result.current.isNewVersionAvailable).toBe(true);
  });

  it('aborts a hung request and allows the next check to retry', async () => {
    checkHealth.mockImplementationOnce(
      (signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const { result } = renderHook(useHook);
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    fireEvent.focus(window);
    await flush();

    expect(checkHealth).toHaveBeenCalledTimes(2);
    expect(result.current.isNewVersionAvailable).toBe(false);
  });

  it('captures the baseline immediately under StrictMode effect replay', async () => {
    const { result } = renderHook(useHook, { wrapper: StrictMode });
    await flush();
    checkHealth.mockResolvedValue({ buildId: 'build-2' });
    fireEvent.focus(window);
    await flush();

    expect(result.current.isNewVersionAvailable).toBe(true);
  });

  it('shows recovery immediately when Vite cannot load a chunk', async () => {
    const { result } = renderHook(useHook);
    await flush();
    const event = new Event('vite:preloadError', { cancelable: true });
    fireEvent(window, event);

    expect(event.defaultPrevented).toBe(true);
    expect(result.current.isNewVersionAvailable).toBe(true);
  });

  it('keeps checking when the host passes a new checkHealth on every render', async () => {
    const { rerender } = renderHook(() =>
      useAppVersionCheck({ checkHealth: (signal) => checkHealth(signal) }),
    );
    await flush();
    rerender();
    rerender();

    expect(checkHealth).toHaveBeenCalledOnce();
  });

  it('aborts in-flight requests and removes listeners and timers on unmount', async () => {
    const { unmount } = renderHook(useHook);
    const [signal] = checkHealth.mock.calls[0];
    unmount();

    expect(signal.aborted).toBe(true);
    fireEvent.focus(window);
    fireEvent(document, new Event('visibilitychange'));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2));
    fireEvent.keyDown(window);
    expect(checkHealth).toHaveBeenCalledOnce();
  });
});
