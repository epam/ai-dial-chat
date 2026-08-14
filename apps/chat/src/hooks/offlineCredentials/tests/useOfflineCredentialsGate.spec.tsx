import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode, StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOfflineCredentials } from '../../../server-api/offline-credentials';
import {
  OfflineCredentialsGateStatus,
  useOfflineCredentialsGate,
} from '../useOfflineCredentialsGate';

vi.mock('../../../server-api/offline-credentials', () => ({
  getOfflineCredentials: vi.fn(),
}));

const makeWrapper =
  (initialPath = '/scheduled-tasks') =>
  ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={children} />
      </Routes>
    </MemoryRouter>
  );

const makeStrictModeWrapper =
  (initialPath = '/scheduled-tasks') =>
  ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="*" element={children} />
        </Routes>
      </MemoryRouter>
    </StrictMode>
  );

describe('useOfflineCredentialsGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches status once on mount and reports available:true, connected:false as Available', async () => {
    vi.mocked(getOfflineCredentials).mockResolvedValue({
      available: true,
      connected: false,
    });

    const { result } = renderHook(() => useOfflineCredentialsGate(), {
      wrapper: makeWrapper(),
    });

    expect(result.current.status).toBe(OfflineCredentialsGateStatus.Checking);
    await waitFor(() =>
      expect(result.current.status).toBe(
        OfflineCredentialsGateStatus.Available,
      ),
    );
    expect(getOfflineCredentials).toHaveBeenCalledOnce();
  });

  it('reports Hidden when already connected', async () => {
    vi.mocked(getOfflineCredentials).mockResolvedValue({
      available: true,
      connected: true,
    });

    const { result } = renderHook(() => useOfflineCredentialsGate(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() =>
      expect(result.current.status).toBe(OfflineCredentialsGateStatus.Hidden),
    );
  });

  it('reports Hidden when not available', async () => {
    vi.mocked(getOfflineCredentials).mockResolvedValue({
      available: false,
      connected: false,
    });

    const { result } = renderHook(() => useOfflineCredentialsGate(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() =>
      expect(result.current.status).toBe(OfflineCredentialsGateStatus.Hidden),
    );
  });

  it('sets Error and never falls back to Available on fetch failure', async () => {
    vi.mocked(getOfflineCredentials).mockRejectedValue(
      new Error('network down'),
    );

    const { result } = renderHook(() => useOfflineCredentialsGate(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() =>
      expect(result.current.status).toBe(OfflineCredentialsGateStatus.Error),
    );
    expect(result.current.status).not.toBe(
      OfflineCredentialsGateStatus.Available,
    );
  });

  it('renders without duplicating status requests under React StrictMode', async () => {
    vi.mocked(getOfflineCredentials).mockResolvedValue({
      available: true,
      connected: false,
    });

    const { result } = renderHook(() => useOfflineCredentialsGate(), {
      wrapper: makeStrictModeWrapper(),
    });

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
    expect(getOfflineCredentials).toHaveBeenCalledOnce();
  });

  it('settles on exactly one non-aborted status request across a mount -> cleanup -> mount cycle (StrictMode shape)', async () => {
    const signals: AbortSignal[] = [];
    vi.mocked(getOfflineCredentials).mockImplementation((signal) => {
      if (signal) signals.push(signal);
      return Promise.resolve({ available: true, connected: false });
    });

    const first = renderHook(() => useOfflineCredentialsGate(), {
      wrapper: makeWrapper(),
    });
    first.unmount();

    const second = renderHook(() => useOfflineCredentialsGate(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() =>
      expect(second.result.current.status).toBe(
        OfflineCredentialsGateStatus.Available,
      ),
    );

    expect(getOfflineCredentials).toHaveBeenCalledTimes(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
  });

  it('aborts the in-flight request on unmount', async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(getOfflineCredentials).mockImplementation(
      (signal) =>
        new Promise((_resolve, reject) => {
          capturedSignal = signal;
          signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );

    const { unmount } = renderHook(() => useOfflineCredentialsGate(), {
      wrapper: makeWrapper(),
    });

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });

  it('refetches and returns the freshly resolved result when refetch is called', async () => {
    vi.mocked(getOfflineCredentials)
      .mockResolvedValueOnce({ available: true, connected: false })
      .mockResolvedValueOnce({ available: true, connected: true });

    const { result } = renderHook(() => useOfflineCredentialsGate(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() =>
      expect(result.current.status).toBe(
        OfflineCredentialsGateStatus.Available,
      ),
    );

    let refetched: { available: boolean; connected: boolean } | null = null;
    await act(async () => {
      refetched = await result.current.refetch();
    });

    expect(refetched).toEqual({ available: true, connected: true });
    expect(result.current.status).toBe(OfflineCredentialsGateStatus.Hidden);
  });
});
