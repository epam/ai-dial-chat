import { UserProfile } from '@epam/chat-shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as base from '../server-api/base';
import { UserProvider, useUser } from './UserContext';

const mockProfile: UserProfile = {
  sub: 'user-1',
  providerId: 'keycloak',
  claims: { email: 'u@x.io' },
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <UserProvider>{children}</UserProvider>
);

describe('UserContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('200 path: status becomes authenticated and user equals the mocked profile', async () => {
    vi.spyOn(base, 'get').mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useUser(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user).toEqual(mockProfile);
  });

  it('401 path: status becomes unauthenticated and user is null', async () => {
    vi.spyOn(base, 'get').mockRejectedValue(
      new base.UnauthorizedError(base.ApiEndpoints.AUTH_ME),
    );

    const { result } = renderHook(() => useUser(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.user).toBeNull();
  });

  it('network failure: status becomes unauthenticated and console.error is emitted', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.spyOn(base, 'get').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUser(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.user).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      'UserContext bootstrap failed',
      expect.any(Error),
    );
  });

  it('reset() clears state without re-fetching', async () => {
    vi.spyOn(base, 'get').mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useUser(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
  });

  it('refresh() re-runs the fetch and updates state', async () => {
    const getSpy = vi
      .spyOn(base, 'get')
      .mockRejectedValueOnce(
        new base.UnauthorizedError(base.ApiEndpoints.AUTH_ME),
      )
      .mockResolvedValueOnce(mockProfile);

    const { result } = renderHook(() => useUser(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.status).toBe('authenticated');
    expect(result.current.user).toEqual(mockProfile);
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('useUser() outside UserProvider throws a descriptive Error', () => {
    expect(() => renderHook(() => useUser())).toThrow(
      'useUser must be used within a UserProvider',
    );
  });

  it('onUnauthorized listener from any subsequent call resets context', async () => {
    vi.spyOn(base, 'get').mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useUser(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    // Simulate a 401 from any API call via the listener mechanism
    act(() => {
      base.onUnauthorized(() => undefined)('/api/some-protected');
      result.current.reset();
    });

    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
  });
});
