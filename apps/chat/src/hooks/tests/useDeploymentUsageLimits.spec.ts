import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDeploymentLimits } from '../../server-api/deployment-limits';
import { mapDeploymentLimitsToInput } from '../../utils/map-deployment-limits-to-input';
import { useDeploymentUsageLimits } from '../useDeploymentUsageLimits';

vi.mock('../../server-api/deployment-limits', () => ({
  getDeploymentLimits: vi.fn(),
}));

vi.mock('../../utils/map-deployment-limits-to-input', () => ({
  mapDeploymentLimitsToInput: vi.fn(() => ({
    used: 2500,
    total: 10000,
    remaining: 7500,
    usedPercent: 25,
  })),
}));

const mockGetDeploymentLimits = vi.mocked(getDeploymentLimits);
const mockMapDeploymentLimitsToInput = vi.mocked(mapDeploymentLimitsToInput);

describe('useDeploymentUsageLimits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch without a deployment ID', () => {
    const { result } = renderHook(() => useDeploymentUsageLimits(undefined));

    expect(result.current).toMatchObject({
      limit: undefined,
      isLoading: false,
      hasError: false,
    });
    expect(mockGetDeploymentLimits).not.toHaveBeenCalled();
  });

  it('fetches and maps the monthly limit', async () => {
    const dto = { monthTokenStats: { used: 2500, total: 10000 } };
    mockGetDeploymentLimits.mockResolvedValue(dto);

    const { result } = renderHook(() => useDeploymentUsageLimits('gpt-4o'));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetDeploymentLimits).toHaveBeenCalledWith('gpt-4o');
    expect(mockMapDeploymentLimitsToInput).toHaveBeenCalledWith(dto);
    expect(result.current.limit?.usedPercent).toBe(25);
  });

  it('surfaces a non-blocking request error', async () => {
    mockGetDeploymentLimits.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDeploymentUsageLimits('gpt-4o'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.limit).toBeUndefined();
    expect(result.current.hasError).toBe(true);
  });

  it('re-fetches when deployment changes', async () => {
    mockGetDeploymentLimits.mockResolvedValue({
      monthTokenStats: { used: 100, total: 1000 },
    });

    const { rerender } = renderHook(
      ({ id }: { id: string }) => useDeploymentUsageLimits(id),
      { initialProps: { id: 'gpt-4o' } },
    );

    await waitFor(() =>
      expect(mockGetDeploymentLimits).toHaveBeenCalledWith('gpt-4o'),
    );

    rerender({ id: 'claude-3' });

    await waitFor(() =>
      expect(mockGetDeploymentLimits).toHaveBeenCalledWith('claude-3'),
    );
  });

  it('discards a stale response after deployment changes', async () => {
    let resolveFirst!: (value: {
      monthTokenStats: { used: number; total: number };
    }) => void;
    let resolveSecond!: (value: {
      monthTokenStats: { used: number; total: number };
    }) => void;

    mockGetDeploymentLimits
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { rerender } = renderHook(
      ({ id }: { id: string }) => useDeploymentUsageLimits(id),
      { initialProps: { id: 'first' } },
    );

    rerender({ id: 'second' });
    resolveFirst({ monthTokenStats: { used: 100, total: 1000 } });
    resolveSecond({ monthTokenStats: { used: 900, total: 1000 } });

    await waitFor(() =>
      expect(mockMapDeploymentLimitsToInput).toHaveBeenCalledTimes(1),
    );
    expect(mockMapDeploymentLimitsToInput).toHaveBeenCalledWith({
      monthTokenStats: { used: 900, total: 1000 },
    });
  });

  it('refreshes while idle and ignores refresh while loading', async () => {
    let resolveFirst!: (value: {
      monthTokenStats: { used: number; total: number };
    }) => void;
    mockGetDeploymentLimits.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const { result } = renderHook(() => useDeploymentUsageLimits('gpt-4o'));

    act(() => result.current.refresh());
    expect(mockGetDeploymentLimits).toHaveBeenCalledTimes(1);

    resolveFirst({ monthTokenStats: { used: 100, total: 1000 } });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockGetDeploymentLimits.mockResolvedValue({
      monthTokenStats: { used: 200, total: 1000 },
    });
    act(() => result.current.refresh());

    await waitFor(() =>
      expect(mockGetDeploymentLimits).toHaveBeenCalledTimes(2),
    );
  });

  it('preserves the last limit when a refresh fails', async () => {
    mockGetDeploymentLimits.mockResolvedValueOnce({
      monthTokenStats: { used: 100, total: 1000 },
    });

    const { result } = renderHook(() => useDeploymentUsageLimits('gpt-4o'));
    await waitFor(() => expect(result.current.limit).toBeDefined());

    mockGetDeploymentLimits.mockRejectedValueOnce(new Error('Refresh failed'));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.hasError).toBe(true));

    expect(result.current.limit).toBeDefined();
  });
});
