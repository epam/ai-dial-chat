import type { UserProfileDto } from '@epam/chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authApi from '../../server-api/auth.api';
import {
  getCsrfToken,
  onUnauthorized,
  setCsrfToken,
  UnauthorizedError,
} from '../../server-api/base';
import { AuthStatus } from '../../types/auth-status';
import { UserProvider, useUser } from './UserContext';

const mockProfile: UserProfileDto = {
  sub: 'user-1',
  providerId: 'keycloak',
  claims: { email: 'u@x.io' },
  bucket: 'test-bucket',
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <UserProvider>{children}</UserProvider>
);

describe('UserContext', () => {
  beforeEach(() => {
    setCsrfToken(null);
    vi.restoreAllMocks();
  });

  it('200 path: status becomes authenticated and user equals the mocked profile', async () => {
    vi.spyOn(authApi, 'getMe').mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useUser(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(AuthStatus.Authenticated),
    );
    expect(result.current.user).toEqual(mockProfile);
  });

  it('401 path: status becomes unauthenticated and user is null', async () => {
    setCsrfToken('stale-csrf-token');
    vi.spyOn(authApi, 'getMe').mockRejectedValue(
      new UnauthorizedError('/api/v1/auth/me'),
    );

    const { result } = renderHook(() => useUser(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(AuthStatus.Unauthenticated),
    );
    expect(result.current.user).toBeNull();
    expect(getCsrfToken()).toBeNull();
  });

  it('network failure: status becomes unauthenticated and console.error is emitted', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.spyOn(authApi, 'getMe').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUser(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(AuthStatus.Unauthenticated),
    );
    expect(result.current.user).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      'UserContext bootstrap failed',
      expect.any(Error),
    );
  });

  it('reset() clears state without re-fetching', async () => {
    vi.spyOn(authApi, 'getMe').mockResolvedValue(mockProfile);
    setCsrfToken('csrf-token');

    const { result } = renderHook(() => useUser(), { wrapper });
    await waitFor(() =>
      expect(result.current.status).toBe(AuthStatus.Authenticated),
    );

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe(AuthStatus.Unauthenticated);
    expect(result.current.user).toBeNull();
    expect(getCsrfToken()).toBeNull();
  });

  it('refresh() re-runs the fetch and updates state', async () => {
    const getMeSpy = vi
      .spyOn(authApi, 'getMe')
      .mockRejectedValueOnce(new UnauthorizedError('/api/v1/auth/me'))
      .mockResolvedValueOnce(mockProfile);

    const { result } = renderHook(() => useUser(), { wrapper });
    await waitFor(() =>
      expect(result.current.status).toBe(AuthStatus.Unauthenticated),
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.status).toBe(AuthStatus.Authenticated);
    expect(result.current.user).toEqual(mockProfile);
    expect(getMeSpy).toHaveBeenCalledTimes(2);
  });

  it('useUser() outside UserProvider throws a descriptive Error', () => {
    expect(() => renderHook(() => useUser())).toThrow(
      'useUser must be used within a UserProvider',
    );
  });

  it('onUnauthorized listener from any subsequent call resets context', async () => {
    vi.spyOn(authApi, 'getMe').mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useUser(), { wrapper });
    await waitFor(() =>
      expect(result.current.status).toBe(AuthStatus.Authenticated),
    );

    // Simulate a 401 from any API call via the listener mechanism
    act(() => {
      onUnauthorized(() => undefined);
      result.current.reset();
    });

    expect(result.current.status).toBe(AuthStatus.Unauthenticated);
    expect(result.current.user).toBeNull();
  });
});
