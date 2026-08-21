import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUserLimits, getUserUsage } from '../../server-api/user-limits';
import { useUsageData } from '../useUsageData';

vi.mock('../../server-api/user-limits', () => ({
  getUserLimits: vi.fn(),
  getUserUsage: vi.fn(),
}));

const mockGetUserLimits = vi.mocked(getUserLimits);
const mockGetUserUsage = vi.mocked(getUserUsage);

describe('useUsageData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns limits and usage when both calls succeed', async () => {
    const limits = { deployments: { 'gpt-4o': {} } };
    const usage = { deployments: {} };
    mockGetUserLimits.mockResolvedValue(limits);
    mockGetUserUsage.mockResolvedValue(usage);

    const { result } = renderHook(() => useUsageData());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.limits).toEqual(limits);
    expect(result.current.usage).toEqual(usage);
    expect(result.current.limitsError).toBeUndefined();
    expect(result.current.usageError).toBeUndefined();
  });

  it('keeps the successful half of the data when only usage rejects', async () => {
    const limits = { deployments: { 'gpt-4o': {} } };
    mockGetUserLimits.mockResolvedValue(limits);
    mockGetUserUsage.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUsageData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.limits).toEqual(limits);
    expect(result.current.usage).toBeUndefined();
    expect(result.current.limitsError).toBeUndefined();
    expect(result.current.usageError).toBeInstanceOf(Error);
  });

  it('keeps the successful half of the data when only limits rejects', async () => {
    const usage = { deployments: {} };
    mockGetUserLimits.mockRejectedValue(new Error('Network error'));
    mockGetUserUsage.mockResolvedValue(usage);

    const { result } = renderHook(() => useUsageData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.limits).toBeUndefined();
    expect(result.current.usage).toEqual(usage);
    expect(result.current.limitsError).toBeInstanceOf(Error);
    expect(result.current.usageError).toBeUndefined();
  });

  it('reports both errors independently when both calls reject', async () => {
    mockGetUserLimits.mockRejectedValue(new Error('Limits down'));
    mockGetUserUsage.mockRejectedValue(new Error('Usage down'));

    const { result } = renderHook(() => useUsageData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.limits).toBeUndefined();
    expect(result.current.usage).toBeUndefined();
    expect(result.current.limitsError).toBeInstanceOf(Error);
    expect(result.current.usageError).toBeInstanceOf(Error);
  });

  it('does not update state after unmount', async () => {
    let resolveLimits: (value: {
      deployments: Record<string, never>;
    }) => void = () => undefined;
    const limitsPromise = new Promise<{ deployments: Record<string, never> }>(
      (resolve) => {
        resolveLimits = resolve;
      },
    );
    mockGetUserLimits.mockImplementation(() => limitsPromise);
    mockGetUserUsage.mockResolvedValue({ deployments: {} });

    const { result, unmount } = renderHook(() => useUsageData());
    unmount();
    resolveLimits({ deployments: {} });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.isLoading).toBe(true);
  });

  it('does not fetch and returns the disabled-state shape when enabled is false', async () => {
    const { result } = renderHook(() => useUsageData(false));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockGetUserLimits).not.toHaveBeenCalled();
    expect(mockGetUserUsage).not.toHaveBeenCalled();
    expect(result.current).toEqual({
      limits: undefined,
      usage: undefined,
      isLoading: false,
      limitsError: undefined,
      usageError: undefined,
    });
  });

  it('fetches once enabled transitions from false to true', async () => {
    const limits = { deployments: { 'gpt-4o': {} } };
    const usage = { deployments: {} };
    mockGetUserLimits.mockResolvedValue(limits);
    mockGetUserUsage.mockResolvedValue(usage);

    const { result, rerender } = renderHook(
      ({ enabled }) => useUsageData(enabled),
      { initialProps: { enabled: false } },
    );

    expect(mockGetUserLimits).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetUserLimits).toHaveBeenCalledOnce();
    expect(mockGetUserUsage).toHaveBeenCalledOnce();
    expect(result.current.limits).toEqual(limits);
    expect(result.current.usage).toEqual(usage);
  });
});
