import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUsageData } from '../useUsageData';

describe('useUsageData', () => {
  const mockGetUserUsage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns usage when the call succeeds', async () => {
    const usage = { deployments: { 'gpt-4o': {} } };
    mockGetUserUsage.mockResolvedValue(usage);

    const { result } = renderHook(() => useUsageData(mockGetUserUsage));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.usage).toEqual(usage);
    expect(result.current.usageError).toBeUndefined();
  });

  it('reports the error and leaves usage undefined when the call rejects', async () => {
    mockGetUserUsage.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUsageData(mockGetUserUsage));

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

    const { result, unmount } = renderHook(() =>
      useUsageData(mockGetUserUsage),
    );
    unmount();
    resolveUsage({ deployments: {} });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.isLoading).toBe(true);
  });

  it('does not fetch and returns the disabled-state shape when enabled is false', async () => {
    const { result } = renderHook(() => useUsageData(mockGetUserUsage, false));

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
      ({ enabled }) => useUsageData(mockGetUserUsage, enabled),
      { initialProps: { enabled: false } },
    );

    expect(mockGetUserUsage).not.toHaveBeenCalled();

    rerender({ enabled: true });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.usage).toEqual(usage));

    expect(mockGetUserUsage).toHaveBeenCalledOnce();
    expect(result.current.isLoading).toBe(false);
  });

  describe('refreshToken', () => {
    it('re-fetches when the token changes', async () => {
      const first = { deployments: { 'gpt-4o': {} } };
      const second = { deployments: { 'gpt-4o': {}, 'gpt-5.2': {} } };
      mockGetUserUsage
        .mockResolvedValueOnce(first)
        .mockResolvedValueOnce(second);

      const { result, rerender } = renderHook(
        ({ refreshToken }) =>
          useUsageData(mockGetUserUsage, true, refreshToken),
        { initialProps: { refreshToken: 0 } },
      );

      await waitFor(() => expect(result.current.usage).toEqual(first));
      expect(mockGetUserUsage).toHaveBeenCalledOnce();

      rerender({ refreshToken: 1 });

      await waitFor(() => expect(result.current.usage).toEqual(second));
      expect(mockGetUserUsage).toHaveBeenCalledTimes(2);
    });

    it('keeps the previous usage on screen while a refresh is in flight', async () => {
      const first = { deployments: { 'gpt-4o': {} } };
      let resolveSecond: (value: unknown) => void = () => undefined;
      mockGetUserUsage.mockResolvedValueOnce(first).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );

      const { result, rerender } = renderHook(
        ({ refreshToken }) =>
          useUsageData(mockGetUserUsage, true, refreshToken),
        { initialProps: { refreshToken: 0 } },
      );

      await waitFor(() => expect(result.current.usage).toEqual(first));

      rerender({ refreshToken: 1 });

      /* The refresh is in flight: the last resolved figures must still be there. */
      await waitFor(() => expect(result.current.isLoading).toBe(true));
      expect(result.current.usage).toEqual(first);

      const second = { deployments: { 'gpt-5.2': {} } };
      resolveSecond(second);

      await waitFor(() => expect(result.current.usage).toEqual(second));
    });

    it('keeps the previous usage when the refresh rejects', async () => {
      const first = { deployments: { 'gpt-4o': {} } };
      mockGetUserUsage
        .mockResolvedValueOnce(first)
        .mockRejectedValueOnce(new Error('refresh failed'));

      const { result, rerender } = renderHook(
        ({ refreshToken }) =>
          useUsageData(mockGetUserUsage, true, refreshToken),
        { initialProps: { refreshToken: 0 } },
      );

      await waitFor(() => expect(result.current.usage).toEqual(first));

      rerender({ refreshToken: 1 });

      await waitFor(() =>
        expect(result.current.usageError).toBeInstanceOf(Error),
      );
      expect(result.current.usage).toEqual(first);
    });

    it('does not fetch on a token change while disabled', async () => {
      const { rerender } = renderHook(
        ({ refreshToken }) =>
          useUsageData(mockGetUserUsage, false, refreshToken),
        { initialProps: { refreshToken: 0 } },
      );

      rerender({ refreshToken: 1 });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockGetUserUsage).not.toHaveBeenCalled();
    });
  });
});
