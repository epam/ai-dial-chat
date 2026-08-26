import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUserUsage } from '../../server-api/user-limits';
import { useUsageData } from '../useUsageData';

vi.mock('../../server-api/user-limits', () => ({
  getUserUsage: vi.fn(),
}));

const mockGetUserUsage = vi.mocked(getUserUsage);

describe('useUsageData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns usage when the call succeeds', async () => {
    const usage = { deployments: { 'gpt-4o': {} } };
    mockGetUserUsage.mockResolvedValue(usage);

    const { result } = renderHook(() => useUsageData());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.usage).toEqual(usage);
    expect(result.current.usageError).toBeUndefined();
  });

  it('reports the error and leaves usage undefined when the call rejects', async () => {
    mockGetUserUsage.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUsageData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.usage).toBeUndefined();
    expect(result.current.usageError).toBeInstanceOf(Error);
  });

  it('does not update state after unmount', async () => {
    let resolveUsage: (value: {
      deployments: Record<string, never>;
    }) => void = () => undefined;
    const usagePromise = new Promise<{ deployments: Record<string, never> }>(
      (resolve) => {
        resolveUsage = resolve;
      },
    );
    mockGetUserUsage.mockImplementation(() => usagePromise);

    const { result, unmount } = renderHook(() => useUsageData());
    unmount();
    resolveUsage({ deployments: {} });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.isLoading).toBe(true);
  });

  it('does not fetch and returns the disabled-state shape when enabled is false', async () => {
    const { result } = renderHook(() => useUsageData(false));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockGetUserUsage).not.toHaveBeenCalled();
    expect(result.current).toEqual({
      usage: undefined,
      isLoading: false,
      usageError: undefined,
    });
  });

  it('fetches once enabled transitions from false to true', async () => {
    const usage = { deployments: { 'gpt-4o': {} } };
    mockGetUserUsage.mockResolvedValue(usage);

    const { result, rerender } = renderHook(
      ({ enabled }) => useUsageData(enabled),
      { initialProps: { enabled: false } },
    );

    expect(mockGetUserUsage).not.toHaveBeenCalled();

    rerender({ enabled: true });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.usage).toEqual(usage));

    expect(mockGetUserUsage).toHaveBeenCalledOnce();
    expect(result.current.isLoading).toBe(false);
  });
});
