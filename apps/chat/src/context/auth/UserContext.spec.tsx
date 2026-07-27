import type { UserProfileDto } from '@epam/chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authApi from '../../server-api/auth.api';
import {
  getCsrfToken,
  notifyUnauthorized,
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
  isAdmin: false,
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <UserProvider>{children}</UserProvider>
);

describe('UserContext', () => {
  beforeEach(() => {
    setCsrfToken(null);
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const seedCatalogPreferences = () => {
    localStorage.setItem('catalogFilterTopics', '["billing"]');
    localStorage.setItem('catalogIsMyAppsActive', 'true');
    localStorage.setItem('catalogSortKey', '"recentlyUpdated"');
  };

  const expectCatalogFilterPreferencesCleared = () => {
    expect(localStorage.getItem('catalogFilterTopics')).toBeNull();
    expect(localStorage.getItem('catalogIsMyAppsActive')).toBeNull();
    expect(localStorage.getItem('catalogSortKey')).toBe('"recentlyUpdated"');
  };

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
    seedCatalogPreferences();

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
    expectCatalogFilterPreferencesCleared();
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

  describe('identity revalidation on focus/visibility regain', () => {
    const secondProfile: UserProfileDto = {
      ...mockProfile,
      sub: 'user-2',
    };

    it('updates user in place and keeps status authenticated when sub is unchanged', async () => {
      const getMeSpy = vi
        .spyOn(authApi, 'getMe')
        .mockResolvedValue(mockProfile);

      const { result } = renderHook(() => useUser(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(AuthStatus.Authenticated),
      );

      const refreshedProfile = {
        ...mockProfile,
        claims: { email: 'new@x.io' },
      };
      getMeSpy.mockResolvedValueOnce(refreshedProfile);

      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });

      await waitFor(() =>
        expect(result.current.user).toEqual(refreshedProfile),
      );
      expect(result.current.status).toBe(AuthStatus.Authenticated);
    });

    it('invalidates the session when the revalidated sub differs from the held identity', async () => {
      const getMeSpy = vi
        .spyOn(authApi, 'getMe')
        .mockResolvedValueOnce(mockProfile);

      const { result } = renderHook(() => useUser(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(AuthStatus.Authenticated),
      );

      setCsrfToken('csrf-token');
      seedCatalogPreferences();
      getMeSpy.mockResolvedValueOnce(secondProfile);

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await waitFor(() =>
        expect(result.current.status).toBe(AuthStatus.Unauthenticated),
      );
      expect(result.current.user).toBeNull();
      expect(getCsrfToken()).toBeNull();
      expectCatalogFilterPreferencesCleared();
    });

    it('invalidates the session when revalidation returns 401', async () => {
      const getMeSpy = vi
        .spyOn(authApi, 'getMe')
        .mockResolvedValueOnce(mockProfile);

      const { result } = renderHook(() => useUser(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(AuthStatus.Authenticated),
      );

      getMeSpy.mockRejectedValueOnce(new UnauthorizedError('/api/v1/auth/me'));

      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });

      await waitFor(() =>
        expect(result.current.status).toBe(AuthStatus.Unauthenticated),
      );
      expect(result.current.user).toBeNull();
    });

    it('does not issue a revalidation request while status is loading', async () => {
      let resolveBootstrap: ((v: UserProfileDto) => void) | undefined;
      const getMeSpy = vi.spyOn(authApi, 'getMe').mockReturnValue(
        new Promise<UserProfileDto>((res) => {
          resolveBootstrap = res;
        }),
      );

      renderHook(() => useUser(), { wrapper });
      await waitFor(() => expect(getMeSpy).toHaveBeenCalledOnce());
      getMeSpy.mockClear();

      act(() => {
        window.dispatchEvent(new Event('focus'));
      });

      expect(getMeSpy).not.toHaveBeenCalled();

      await act(async () => {
        resolveBootstrap?.(mockProfile);
      });
    });

    it('does not issue a revalidation request while unauthenticated', async () => {
      const getMeSpy = vi
        .spyOn(authApi, 'getMe')
        .mockRejectedValue(new UnauthorizedError('/api/v1/auth/me'));

      const { result } = renderHook(() => useUser(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(AuthStatus.Unauthenticated),
      );

      getMeSpy.mockClear();

      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });

      expect(getMeSpy).not.toHaveBeenCalled();
    });

    it('does not stack a second revalidation request while one is already in flight', async () => {
      const getMeSpy = vi
        .spyOn(authApi, 'getMe')
        .mockResolvedValueOnce(mockProfile);

      const { result } = renderHook(() => useUser(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(AuthStatus.Authenticated),
      );

      let resolveSecond: ((v: UserProfileDto) => void) | undefined;
      getMeSpy.mockImplementationOnce(
        () =>
          new Promise<UserProfileDto>((res) => {
            resolveSecond = res;
          }),
      );
      getMeSpy.mockClear();

      act(() => {
        window.dispatchEvent(new Event('focus'));
      });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(getMeSpy).toHaveBeenCalledOnce();

      await act(async () => {
        resolveSecond?.(mockProfile);
      });
    });
  });

  it('notifyUnauthorized from any subsequent call resets context', async () => {
    vi.spyOn(authApi, 'getMe').mockResolvedValue(mockProfile);
    setCsrfToken('csrf-token');
    seedCatalogPreferences();

    const { result } = renderHook(() => useUser(), { wrapper });
    await waitFor(() =>
      expect(result.current.status).toBe(AuthStatus.Authenticated),
    );

    // Simulate a 401 from any API call via the listener mechanism
    act(() => {
      notifyUnauthorized('/api/test');
    });

    expect(result.current.status).toBe(AuthStatus.Unauthenticated);
    expect(result.current.user).toBeNull();
    expect(getCsrfToken()).toBeNull();
    expectCatalogFilterPreferencesCleared();
  });
});
