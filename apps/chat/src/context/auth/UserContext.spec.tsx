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

  /*
   * Session invalidation/identity adoption no longer touches localStorage —
   * Catalog filter preferences are plain UI state, not identity-scoped data,
   * so they must survive every path exercised in this file unchanged.
   */
  const expectCatalogFilterPreferencesUntouched = () => {
    expect(localStorage.getItem('catalogFilterTopics')).toBe('["billing"]');
    expect(localStorage.getItem('catalogIsMyAppsActive')).toBe('true');
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
    expectCatalogFilterPreferencesUntouched();
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

    let refreshedStatus: AuthStatus | undefined;
    await act(async () => {
      refreshedStatus = await result.current.refresh();
    });

    expect(result.current.status).toBe(AuthStatus.Authenticated);
    expect(refreshedStatus).toBe(AuthStatus.Authenticated);
    expect(result.current.user).toEqual(mockProfile);
    expect(getMeSpy).toHaveBeenCalledTimes(2);
  });

  it('refresh({ setLoading: false }) keeps the previous status while the fetch is pending', async () => {
    let resolveRefresh: (profile: UserProfileDto) => void = () => undefined;
    vi.spyOn(authApi, 'getMe')
      .mockRejectedValueOnce(new UnauthorizedError('/api/v1/auth/me'))
      .mockImplementationOnce(
        () =>
          new Promise<UserProfileDto>((resolve) => {
            resolveRefresh = resolve;
          }),
      );

    const { result } = renderHook(() => useUser(), { wrapper });
    await waitFor(() =>
      expect(result.current.status).toBe(AuthStatus.Unauthenticated),
    );

    let refreshPromise = Promise.resolve(AuthStatus.Loading);
    act(() => {
      refreshPromise = result.current.refresh({ setLoading: false });
    });

    expect(result.current.status).toBe(AuthStatus.Unauthenticated);

    await act(async () => {
      resolveRefresh(mockProfile);
      await expect(refreshPromise).resolves.toBe(AuthStatus.Authenticated);
    });

    expect(result.current.status).toBe(AuthStatus.Authenticated);
    expect(result.current.user).toEqual(mockProfile);
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

    it('adopts the new identity in place when the revalidated sub differs from the held identity', async () => {
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

      await waitFor(() => expect(result.current.user).toEqual(secondProfile));
      // The browser session is already validly authenticated as the new
      // identity — no forced logout/login screen, and the protected tree is
      // never unmounted for this path.
      expect(result.current.status).toBe(AuthStatus.Authenticated);
      expect(getCsrfToken()).toBeNull();
      expectCatalogFilterPreferencesUntouched();
    });

    it('invalidates the session when revalidation returns 401 and the recovery probe also fails', async () => {
      const getMeSpy = vi
        .spyOn(authApi, 'getMe')
        .mockResolvedValueOnce(mockProfile);

      const { result } = renderHook(() => useUser(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(AuthStatus.Authenticated),
      );

      getMeSpy
        .mockRejectedValueOnce(new UnauthorizedError('/api/v1/auth/me'))
        .mockRejectedValueOnce(new UnauthorizedError('/api/v1/auth/me'));

      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });

      await waitFor(() =>
        expect(result.current.status).toBe(AuthStatus.Unauthenticated),
      );
      expect(result.current.user).toBeNull();
    });

    it('recovers without invalidating when revalidation 401s but the immediate retry succeeds', async () => {
      const getMeSpy = vi
        .spyOn(authApi, 'getMe')
        .mockResolvedValueOnce(mockProfile);

      const { result } = renderHook(() => useUser(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(AuthStatus.Authenticated),
      );

      getMeSpy
        .mockRejectedValueOnce(new UnauthorizedError('/api/v1/auth/me'))
        .mockResolvedValueOnce(mockProfile);

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await waitFor(() => expect(getMeSpy).toHaveBeenCalledTimes(3));
      expect(result.current.status).toBe(AuthStatus.Authenticated);
      expect(result.current.user).toEqual(mockProfile);
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

  describe('notifyUnauthorized recovery probe', () => {
    it('invalidates when the session was already Authenticated and the recovery probe also 401s', async () => {
      const getMeSpy = vi
        .spyOn(authApi, 'getMe')
        .mockResolvedValueOnce(mockProfile);
      setCsrfToken('csrf-token');
      seedCatalogPreferences();

      const { result } = renderHook(() => useUser(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(AuthStatus.Authenticated),
      );

      getMeSpy.mockRejectedValueOnce(new UnauthorizedError('/api/v1/auth/me'));

      // Simulate a 401 from any API call via the listener mechanism
      await act(async () => {
        notifyUnauthorized('/api/test');
      });

      await waitFor(() =>
        expect(result.current.status).toBe(AuthStatus.Unauthenticated),
      );
      expect(result.current.user).toBeNull();
      expect(getCsrfToken()).toBeNull();
      expectCatalogFilterPreferencesUntouched();
    });

    it('recovers without invalidating when the recovery probe succeeds (lost refresh-token race)', async () => {
      const getMeSpy = vi
        .spyOn(authApi, 'getMe')
        .mockResolvedValueOnce(mockProfile);

      const { result } = renderHook(() => useUser(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(AuthStatus.Authenticated),
      );

      getMeSpy.mockResolvedValueOnce(mockProfile);

      await act(async () => {
        notifyUnauthorized('/api/test');
      });

      await waitFor(() => expect(getMeSpy).toHaveBeenCalledTimes(2));
      expect(result.current.status).toBe(AuthStatus.Authenticated);
      expect(result.current.user).toEqual(mockProfile);
    });

    it('reproduces issue #8150 Case 2: a duplicate-tab-style false 401 never reaches the redirect-attempt bookkeeping', async () => {
      /*
       * This is what makes Case 2 (duplicate tab redirected to login)
       * possible: useAuthRedirect's sessionStorage de-dup key is only ever
       * written once status actually transitions to Unauthenticated. As long
       * as the recovery probe here keeps status Authenticated, that key must
       * never be touched — regardless of which tab or request triggered the
       * original 401.
       */
      const { AUTH_REDIRECT_ATTEMPT_STORAGE_KEY } =
        await import('../../hooks/auth/useAuthRedirect');

      const getMeSpy = vi
        .spyOn(authApi, 'getMe')
        .mockResolvedValueOnce(mockProfile);

      const { result } = renderHook(() => useUser(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(AuthStatus.Authenticated),
      );

      // Simulates a duplicated tab's bootstrap racing the original tab's
      // refresh and losing — the backend/pod-level race is out of scope
      // here, only the frontend's reaction to the resulting 401 is under
      // test — followed by the browser cookie having already caught up by
      // the time this probe fires.
      getMeSpy.mockResolvedValueOnce(mockProfile);

      await act(async () => {
        notifyUnauthorized('/api/v1/auth/me');
      });

      await waitFor(() => expect(getMeSpy).toHaveBeenCalledTimes(2));
      expect(result.current.status).toBe(AuthStatus.Authenticated);
      expect(
        window.sessionStorage.getItem(AUTH_REDIRECT_ATTEMPT_STORAGE_KEY),
      ).toBeNull();
    });

    it('invalidates immediately without probing when a 401 arrives while unauthenticated', async () => {
      const getMeSpy = vi
        .spyOn(authApi, 'getMe')
        .mockRejectedValue(new UnauthorizedError('/api/v1/auth/me'));

      const { result } = renderHook(() => useUser(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(AuthStatus.Unauthenticated),
      );

      getMeSpy.mockClear();

      act(() => {
        notifyUnauthorized('/api/test');
      });

      expect(result.current.status).toBe(AuthStatus.Unauthenticated);
      expect(getMeSpy).not.toHaveBeenCalled();
    });
  });
});
