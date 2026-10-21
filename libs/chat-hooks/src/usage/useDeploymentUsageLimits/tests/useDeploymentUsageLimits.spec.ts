import type { DeploymentLimitsResponseDto } from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AccountUsage,
  type UsageLimitsApi,
  useDeploymentUsageLimits,
} from '../useDeploymentUsageLimits';

const mockGetDeploymentUsage =
  vi.fn<(deploymentId: string) => Promise<DeploymentLimitsResponseDto>>();
const mockGetAccountUsage = vi.fn<() => Promise<AccountUsage>>();

const api: UsageLimitsApi = {
  getDeploymentUsage: mockGetDeploymentUsage,
  getAccountUsage: mockGetAccountUsage,
};

const ACCOUNT: AccountUsage = { weekCostStats: { used: 132.24, total: 200 } };

describe('useDeploymentUsageLimits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccountUsage.mockResolvedValue(ACCOUNT);
  });

  it('does not fetch without a deployment ID', () => {
    const { result } = renderHook(() =>
      useDeploymentUsageLimits(undefined, api),
    );

    expect(result.current).toMatchObject({
      sources: { deployment: undefined, account: undefined },
      isLoading: false,
      hasError: false,
    });
    expect(mockGetDeploymentUsage).not.toHaveBeenCalled();
    expect(mockGetAccountUsage).not.toHaveBeenCalled();
  });

  it('returns both sources for the selected deployment', async () => {
    const deployment = { dayTokenStats: { used: 2500, total: 10000 } };
    mockGetDeploymentUsage.mockResolvedValue(deployment);

    const { result } = renderHook(() =>
      useDeploymentUsageLimits('gpt-4o', api),
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetDeploymentUsage).toHaveBeenCalledWith('gpt-4o');
    expect(mockGetAccountUsage).toHaveBeenCalledOnce();
    expect(result.current.sources).toEqual({ deployment, account: ACCOUNT });
    expect(result.current.hasError).toBe(false);
  });

  it('stays loading until both calls settle', async () => {
    let resolveAccount!: (value: AccountUsage) => void;
    mockGetDeploymentUsage.mockResolvedValue({});
    mockGetAccountUsage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAccount = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useDeploymentUsageLimits('gpt-4o', api),
    );
    await waitFor(() => expect(mockGetDeploymentUsage).toHaveBeenCalledOnce());
    expect(result.current.isLoading).toBe(true);

    resolveAccount(ACCOUNT);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('surfaces a non-blocking error and keeps the source that loaded', async () => {
    mockGetDeploymentUsage.mockRejectedValue(new Error('Not Found'));

    const { result } = renderHook(() =>
      useDeploymentUsageLimits('gpt-4o', api),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasError).toBe(true);
    expect(result.current.sources).toEqual({
      deployment: undefined,
      account: ACCOUNT,
    });
  });

  it('re-fetches both sources when the deployment changes', async () => {
    mockGetDeploymentUsage.mockResolvedValue({
      monthTokenStats: { used: 100, total: 1000 },
    });

    const { rerender } = renderHook(
      ({ id }: { id: string }) => useDeploymentUsageLimits(id, api),
      { initialProps: { id: 'gpt-4o' } },
    );

    await waitFor(() =>
      expect(mockGetDeploymentUsage).toHaveBeenCalledWith('gpt-4o'),
    );

    rerender({ id: 'claude-3' });

    await waitFor(() =>
      expect(mockGetDeploymentUsage).toHaveBeenCalledWith('claude-3'),
    );
    expect(mockGetAccountUsage).toHaveBeenCalledTimes(2);
  });

  it('clears the deployment source and keeps the account source on a deployment change', async () => {
    let resolveSecond!: (value: DeploymentLimitsResponseDto) => void;
    mockGetDeploymentUsage
      .mockResolvedValueOnce({ monthTokenStats: { used: 100, total: 1000 } })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useDeploymentUsageLimits(id, api),
      { initialProps: { id: 'gpt-4o' } },
    );
    await waitFor(() =>
      expect(result.current.sources.deployment).toBeDefined(),
    );

    rerender({ id: 'claude-3' });

    expect(result.current.sources.deployment).toBeUndefined();
    expect(result.current.sources.account).toEqual(ACCOUNT);

    resolveSecond({ monthTokenStats: { used: 5, total: 1000 } });
    await waitFor(() =>
      expect(result.current.sources.deployment).toEqual({
        monthTokenStats: { used: 5, total: 1000 },
      }),
    );
  });

  it('discards a stale response after the deployment changes', async () => {
    let resolveFirst!: (value: DeploymentLimitsResponseDto) => void;
    let resolveSecond!: (value: DeploymentLimitsResponseDto) => void;

    mockGetDeploymentUsage
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

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useDeploymentUsageLimits(id, api),
      { initialProps: { id: 'first' } },
    );

    rerender({ id: 'second' });
    resolveFirst({ monthTokenStats: { used: 100, total: 1000 } });
    resolveSecond({ monthTokenStats: { used: 900, total: 1000 } });

    await waitFor(() =>
      expect(result.current.sources.deployment).toBeDefined(),
    );
    expect(result.current.sources.deployment).toEqual({
      monthTokenStats: { used: 900, total: 1000 },
    });
  });

  it('refreshes both sources while idle and ignores refresh while loading', async () => {
    let resolveFirst!: (value: DeploymentLimitsResponseDto) => void;
    mockGetDeploymentUsage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useDeploymentUsageLimits('gpt-4o', api),
    );

    act(() => result.current.refresh());
    expect(mockGetDeploymentUsage).toHaveBeenCalledOnce();

    resolveFirst({ monthTokenStats: { used: 100, total: 1000 } });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockGetDeploymentUsage.mockResolvedValue({
      monthTokenStats: { used: 200, total: 1000 },
    });
    act(() => result.current.refresh());

    await waitFor(() =>
      expect(mockGetDeploymentUsage).toHaveBeenCalledTimes(2),
    );
    expect(mockGetAccountUsage).toHaveBeenCalledTimes(2);
  });

  it('keeps the failed source’s last value while the other source updates', async () => {
    mockGetDeploymentUsage.mockResolvedValue({
      monthTokenStats: { used: 100, total: 1000 },
    });

    const { result } = renderHook(() =>
      useDeploymentUsageLimits('gpt-4o', api),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const refreshedAccount: AccountUsage = {
      weekCostStats: { used: 140, total: 200 },
    };
    mockGetDeploymentUsage.mockRejectedValueOnce(new Error('Refresh failed'));
    mockGetAccountUsage.mockResolvedValueOnce(refreshedAccount);
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.hasError).toBe(true));

    expect(result.current.sources).toEqual({
      deployment: { monthTokenStats: { used: 100, total: 1000 } },
      account: refreshedAccount,
    });
  });
});

describe('useDeploymentUsageLimits api identity', () => {
  it('does not re-fetch when the caller passes a new api object each render', async () => {
    const fetchUsage = vi.fn().mockResolvedValue({
      monthTokenStats: { used: 1, total: 10 },
    });
    const fetchAccount = vi.fn().mockResolvedValue(ACCOUNT);

    const { result, rerender } = renderHook(() =>
      useDeploymentUsageLimits('gpt-4o', {
        getDeploymentUsage: (id: string) => fetchUsage(id),
        getAccountUsage: () => fetchAccount(),
      }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender();
    rerender();

    expect(fetchUsage).toHaveBeenCalledOnce();
    expect(fetchAccount).toHaveBeenCalledOnce();
  });
});
