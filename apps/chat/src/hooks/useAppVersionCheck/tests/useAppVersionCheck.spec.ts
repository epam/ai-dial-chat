import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkHealth } from '../../../server-api/health.api';
import { useAppVersionCheck } from '../useAppVersionCheck';

vi.mock('../../../server-api/health.api', () => ({
  checkHealth: vi.fn(),
}));

const POLL_INTERVAL_MS = 5 * 60 * 1000;

const flushMicrotasks = () => act(() => Promise.resolve());

describe('useAppVersionCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('captures the baseline buildId on mount without flagging a new version', async () => {
    vi.mocked(checkHealth).mockResolvedValue({
      status: 'ok',
      timestamp: '',
      version: '1.0.0',
      buildId: 'build-1',
    });

    const { result } = renderHook(() => useAppVersionCheck());
    await flushMicrotasks();

    expect(checkHealth).toHaveBeenCalledOnce();
    expect(result.current.isNewVersionAvailable).toBe(false);
  });

  it('flags a new version when a poll returns a different buildId', async () => {
    vi.mocked(checkHealth)
      .mockResolvedValueOnce({
        status: 'ok',
        timestamp: '',
        version: '1.0.0',
        buildId: 'build-1',
      })
      .mockResolvedValueOnce({
        status: 'ok',
        timestamp: '',
        version: '1.0.0',
        buildId: 'build-2',
      });

    const { result } = renderHook(() => useAppVersionCheck());
    await flushMicrotasks();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(result.current.isNewVersionAvailable).toBe(true);
  });

  it('keeps polling when the buildId is unchanged', async () => {
    vi.mocked(checkHealth).mockResolvedValue({
      status: 'ok',
      timestamp: '',
      version: '1.0.0',
      buildId: 'build-1',
    });

    const { result } = renderHook(() => useAppVersionCheck());
    await flushMicrotasks();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(checkHealth).toHaveBeenCalledTimes(2);
    expect(result.current.isNewVersionAvailable).toBe(false);
  });

  it('does not flag a new version when a poll fails', async () => {
    vi.mocked(checkHealth)
      .mockResolvedValueOnce({
        status: 'ok',
        timestamp: '',
        version: '1.0.0',
        buildId: 'build-1',
      })
      .mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useAppVersionCheck());
    await flushMicrotasks();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(result.current.isNewVersionAvailable).toBe(false);
  });

  it('stops polling after unmount', async () => {
    vi.mocked(checkHealth).mockResolvedValue({
      status: 'ok',
      timestamp: '',
      version: '1.0.0',
      buildId: 'build-1',
    });

    const { unmount } = renderHook(() => useAppVersionCheck());
    await flushMicrotasks();

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    });

    expect(checkHealth).toHaveBeenCalledOnce();
  });
});
