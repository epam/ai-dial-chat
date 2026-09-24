import type { ApplicationExternalServiceDto } from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useApplicationCredentials } from '../useApplicationCredentials';

const keyService: ApplicationExternalServiceDto = {
  id: 'key',
  displayName: 'Key service',
  authenticationType: 'API_KEY',
};
const nativeService: ApplicationExternalServiceDto = {
  id: 'native',
  displayName: 'Native service',
  authenticationType: 'DIAL_NATIVE',
};
const clients = () => ({
  externalServicesClient: {
    listExternalServices: vi.fn().mockResolvedValue([keyService]),
  },
  offlineCredentialsClient: {
    getOfflineCredentials: vi
      .fn()
      .mockResolvedValue({ connected: true, available: true }),
  },
});

describe('useApplicationCredentials', () => {
  it('omits services without authentication and does not query offline credentials for ordinary services', async () => {
    const api = clients();
    api.externalServicesClient.listExternalServices.mockResolvedValue([
      keyService,
      { id: 'public', authenticationType: 'NONE' },
    ]);
    const { result } = renderHook(() =>
      useApplicationCredentials({ appId: 'app', ...api }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.services).toEqual([keyService]);
    expect(
      api.offlineCredentialsClient.getOfflineCredentials,
    ).not.toHaveBeenCalled();
  });

  it('uses the error/retry state for an offline-status failure and reloads fresh native status', async () => {
    const api = clients();
    api.externalServicesClient.listExternalServices.mockResolvedValue([
      nativeService,
    ]);
    api.offlineCredentialsClient.getOfflineCredentials.mockRejectedValueOnce(
      new Error('Unavailable'),
    );
    const { result } = renderHook(() =>
      useApplicationCredentials({ appId: 'app', ...api }),
    );
    await waitFor(() => expect(result.current.hasError).toBe(true));
    await act(async () => result.current.refresh());
    expect(result.current.hasError).toBe(false);
    expect(result.current.isOfflineConnected).toBe(true);
    expect(result.current.services).toEqual([nativeService]);
  });

  it('ignores a previous application response and its old refresh callback', async () => {
    const api = clients();
    let resolveOld!: (data: ApplicationExternalServiceDto[]) => void;
    api.externalServicesClient.listExternalServices.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    const { result, rerender } = renderHook(
      ({ appId }) => useApplicationCredentials({ appId, ...api }),
      { initialProps: { appId: 'old' } },
    );
    const oldRefresh = result.current.refresh;
    rerender({ appId: 'new' });
    await waitFor(() => expect(result.current.services).toEqual([keyService]));
    await act(async () => {
      resolveOld([]);
      await oldRefresh();
    });
    expect(result.current.services).toEqual([keyService]);
    expect(
      api.externalServicesClient.listExternalServices,
    ).toHaveBeenCalledTimes(2);
  });

  it('does not start another request after unmount', async () => {
    const api = clients();
    const { result, unmount } = renderHook(() =>
      useApplicationCredentials({ appId: 'app', ...api }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const refresh = result.current.refresh;
    unmount();
    await refresh();
    expect(
      api.externalServicesClient.listExternalServices,
    ).toHaveBeenCalledTimes(1);
  });
});
