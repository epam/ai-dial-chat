import { SchedulerServiceConsentStatus } from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mapOfflineCredentialsResponse } from '../map-offline-credentials-response';
import {
  OfflineCredentialsGateStatus,
  useOfflineCredentialsGate,
  type UseOfflineCredentialsGateOptions,
} from '../useOfflineCredentialsGate/useOfflineCredentialsGate';

const getOfflineCredentialsMock = vi.fn();

/*
 * The client pick the hook accepts; the fake passes the init overrides
 * through to the mock so the tests can observe the abort signal the hook
 * hands to the client.
 */
const offlineCredentialsClient = {
  getOfflineCredentials: (initOverrides?: { signal?: AbortSignal }) =>
    getOfflineCredentialsMock(initOverrides),
} as unknown as UseOfflineCredentialsGateOptions['offlineCredentialsClient'];

const makeStrictModeWrapper =
  () =>
  ({ children }: { children: ReactNode }) => (
    <StrictMode>{children}</StrictMode>
  );

describe('useOfflineCredentialsGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches status once on mount and reports available:true, connected:false as Available', async () => {
    getOfflineCredentialsMock.mockResolvedValue({
      available: true,
      connected: false,
    });

    const { result } = renderHook(() =>
      useOfflineCredentialsGate({ offlineCredentialsClient }),
    );

    expect(result.current.status).toBe(OfflineCredentialsGateStatus.Checking);
    await waitFor(() =>
      expect(result.current.status).toBe(
        OfflineCredentialsGateStatus.Available,
      ),
    );
    expect(getOfflineCredentialsMock).toHaveBeenCalledOnce();
  });

  it('reports Hidden when already connected', async () => {
    getOfflineCredentialsMock.mockResolvedValue({
      available: true,
      connected: true,
    });

    const { result } = renderHook(() =>
      useOfflineCredentialsGate({ offlineCredentialsClient }),
    );

    await waitFor(() =>
      expect(result.current.status).toBe(OfflineCredentialsGateStatus.Hidden),
    );
  });

  it('reports Unavailable when disconnected and the deployment offers no offline OAuth client', async () => {
    getOfflineCredentialsMock.mockResolvedValue({
      available: false,
      connected: false,
    });

    const { result } = renderHook(() =>
      useOfflineCredentialsGate({ offlineCredentialsClient }),
    );

    await waitFor(() =>
      expect(result.current.status).toBe(
        OfflineCredentialsGateStatus.Unavailable,
      ),
    );
  });

  it('sets Error and never falls back to Available on fetch failure', async () => {
    getOfflineCredentialsMock.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() =>
      useOfflineCredentialsGate({ offlineCredentialsClient }),
    );

    await waitFor(() =>
      expect(result.current.status).toBe(OfflineCredentialsGateStatus.Error),
    );
    expect(result.current.status).not.toBe(
      OfflineCredentialsGateStatus.Available,
    );
  });

  it('renders without duplicating status requests under React StrictMode', async () => {
    getOfflineCredentialsMock.mockResolvedValue({
      available: true,
      connected: false,
    });

    const { result } = renderHook(
      () => useOfflineCredentialsGate({ offlineCredentialsClient }),
      { wrapper: makeStrictModeWrapper() },
    );

    await waitFor(() =>
      expect(result.current.status).toBe(
        OfflineCredentialsGateStatus.Available,
      ),
    );

    /*
     * This test harness's React build does not itself double-invoke effects
     * under `StrictMode` (that double-invocation is a development-mode-only
     * behavior of certain React DOM builds/bundlers), so this asserts the
     * hook behaves correctly when merely rendered inside a `StrictMode`
     * subtree. The actual "single settled fetch despite a double-invoked
     * effect" guarantee — which this hook provides via `AbortController`
     * cleanup — is exercised directly by the next test, which simulates the
     * mount -> cleanup -> mount StrictMode performs.
     */
    expect(getOfflineCredentialsMock).toHaveBeenCalledOnce();
  });

  it('settles on exactly one non-aborted status request across a mount -> cleanup -> mount cycle (StrictMode shape)', async () => {
    const signals: AbortSignal[] = [];
    getOfflineCredentialsMock.mockImplementation((initOverrides) => {
      if (initOverrides?.signal) signals.push(initOverrides.signal);
      return Promise.resolve({ available: true, connected: false });
    });

    const { unmount: unmountFirst } = renderHook(() =>
      useOfflineCredentialsGate({ offlineCredentialsClient }),
    );
    unmountFirst();

    const { result: secondResult } = renderHook(() =>
      useOfflineCredentialsGate({ offlineCredentialsClient }),
    );

    await waitFor(() =>
      expect(secondResult.current.status).toBe(
        OfflineCredentialsGateStatus.Available,
      ),
    );

    expect(getOfflineCredentialsMock).toHaveBeenCalledTimes(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
  });

  it('aborts the in-flight request on unmount', async () => {
    let capturedSignal: AbortSignal | undefined;
    getOfflineCredentialsMock.mockImplementation(
      (initOverrides) =>
        new Promise((_resolve, reject) => {
          capturedSignal = initOverrides?.signal;
          capturedSignal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );

    const { unmount } = renderHook(() =>
      useOfflineCredentialsGate({ offlineCredentialsClient }),
    );

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });

  it('refetches and returns the freshly resolved result when refetch is called', async () => {
    getOfflineCredentialsMock
      .mockResolvedValueOnce({ available: true, connected: false })
      .mockResolvedValueOnce({ available: true, connected: true });

    const { result } = renderHook(() =>
      useOfflineCredentialsGate({ offlineCredentialsClient }),
    );

    await waitFor(() =>
      expect(result.current.status).toBe(
        OfflineCredentialsGateStatus.Available,
      ),
    );

    let refetched: ReturnType<typeof mapOfflineCredentialsResponse> | null =
      null;
    await act(async () => {
      refetched = await result.current.refetch();
    });

    expect(refetched).toEqual({
      available: true,
      connected: true,
      connect: undefined,
      schedulerServiceConsent: SchedulerServiceConsentStatus.Unknown,
    });
    expect(result.current.status).toBe(OfflineCredentialsGateStatus.Hidden);
  });

  it('reports connected:true once the check reports a stored grant', async () => {
    getOfflineCredentialsMock.mockResolvedValue({
      available: true,
      connected: true,
    });

    const { result } = renderHook(() =>
      useOfflineCredentialsGate({ offlineCredentialsClient }),
    );

    expect(result.current.connected).toBe(false);
    await waitFor(() => expect(result.current.connected).toBe(true));
  });

  it('updates connected across refetches', async () => {
    getOfflineCredentialsMock
      .mockResolvedValueOnce({ available: true, connected: true })
      .mockResolvedValueOnce({ available: true, connected: false });

    const { result } = renderHook(() =>
      useOfflineCredentialsGate({ offlineCredentialsClient }),
    );

    await waitFor(() => expect(result.current.connected).toBe(true));

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.status).toBe(OfflineCredentialsGateStatus.Available);
  });

  it('keeps the last resolved connected value when a check fails', async () => {
    getOfflineCredentialsMock
      .mockResolvedValueOnce({ available: true, connected: true })
      .mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() =>
      useOfflineCredentialsGate({ offlineCredentialsClient }),
    );

    await waitFor(() => expect(result.current.connected).toBe(true));

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.status).toBe(OfflineCredentialsGateStatus.Error);
    expect(result.current.connected).toBe(true);
  });
});
