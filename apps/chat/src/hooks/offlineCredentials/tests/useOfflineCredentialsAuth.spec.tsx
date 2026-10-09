import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduledTasksI18nKeys } from '../../../constants/translation-keys';
import { useOfflineCredentialsAuth } from '../useOfflineCredentialsAuth';
import { OfflineCredentialsLoginOutcomeType } from '../useOfflineCredentialsLogin';

const loginMock = vi.fn();
vi.mock('../useOfflineCredentialsLogin', () => ({
  OfflineCredentialsLoginOutcomeType: {
    Success: 'success',
    Failure: 'failure',
    PopupBlocked: 'popup-blocked',
    Cancelled: 'cancelled',
    TimedOut: 'timed-out',
  },
  useOfflineCredentialsLogin: () => ({ login: loginMock }),
}));

const signOutOfflineCredentialsMock = vi.fn();
vi.mock('../../../server-api/offline-credentials', () => ({
  signOutOfflineCredentials: () => signOutOfflineCredentialsMock(),
}));

const CONNECT = {
  clientId: 'dial-chat',
  authorizationEndpoint: 'https://identity.example.com/authorize',
  scopes: ['openid', 'offline_access'],
};

describe('useOfflineCredentialsAuth', () => {
  const refetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not start a login while no connect settings are available', () => {
    const { result } = renderHook(() =>
      useOfflineCredentialsAuth({ connect: undefined, refetch }),
    );

    act(() => result.current.logIn());

    expect(loginMock).not.toHaveBeenCalled();
    expect(result.current.isLoggingIn).toBe(false);
    expect(result.current.loginOutcome).toBeUndefined();
    expect(result.current.liveAnnouncement).toBe('');
  });

  it('drives the login hook with the connect settings and the gate refetch, tracking the in-flight state', async () => {
    let resolveLogin: (outcome: { type: string }) => void;
    loginMock.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );
    const { result } = renderHook(() =>
      useOfflineCredentialsAuth({ connect: CONNECT, refetch }),
    );

    act(() => result.current.logIn());

    expect(result.current.isLoggingIn).toBe(true);
    expect(result.current.loginOutcome).toBeUndefined();

    await act(async () => {
      resolveLogin({ type: OfflineCredentialsLoginOutcomeType.Success });
    });

    expect(loginMock).toHaveBeenCalledOnce();
    expect(loginMock).toHaveBeenCalledWith(CONNECT, refetch);
    expect(result.current.isLoggingIn).toBe(false);
    expect(result.current.loginOutcome).toBe(
      OfflineCredentialsLoginOutcomeType.Success,
    );
  });

  it.each([
    [
      OfflineCredentialsLoginOutcomeType.Success,
      ScheduledTasksI18nKeys.OfflineCredentialsBannerSuccessAnnouncement,
    ],
    [
      OfflineCredentialsLoginOutcomeType.PopupBlocked,
      ScheduledTasksI18nKeys.OfflineCredentialsBannerPopupBlockedMessage,
    ],
    [
      OfflineCredentialsLoginOutcomeType.Cancelled,
      ScheduledTasksI18nKeys.OfflineCredentialsBannerCancelledMessage,
    ],
    [
      OfflineCredentialsLoginOutcomeType.TimedOut,
      ScheduledTasksI18nKeys.OfflineCredentialsBannerTimeoutMessage,
    ],
    [
      OfflineCredentialsLoginOutcomeType.Failure,
      ScheduledTasksI18nKeys.OfflineCredentialsBannerFailedMessage,
    ],
  ])(
    'resolves a %s login outcome onto the outcome state and its announcement',
    async (outcomeType, expectedAnnouncement) => {
      loginMock.mockResolvedValue({ type: outcomeType });
      const { result } = renderHook(() =>
        useOfflineCredentialsAuth({ connect: CONNECT, refetch }),
      );

      act(() => result.current.logIn());

      await waitFor(() =>
        expect(result.current.loginOutcome).toBe(outcomeType),
      );

      expect(result.current.liveAnnouncement).toBe(expectedAnnouncement);
    },
  );

  it('resets the outcome and the announcement at the start of a new login attempt', async () => {
    loginMock.mockResolvedValue({
      type: OfflineCredentialsLoginOutcomeType.Failure,
    });
    const { result } = renderHook(() =>
      useOfflineCredentialsAuth({ connect: CONNECT, refetch }),
    );

    act(() => result.current.logIn());
    await waitFor(() =>
      expect(result.current.loginOutcome).toBe(
        OfflineCredentialsLoginOutcomeType.Failure,
      ),
    );

    /* A never-resolving promise: the login stays in flight for the test. */
    loginMock.mockReturnValue(new Promise(() => undefined));
    act(() => result.current.logIn());

    expect(result.current.isLoggingIn).toBe(true);
    expect(result.current.loginOutcome).toBeUndefined();
    expect(result.current.liveAnnouncement).toBe('');
  });

  it('resolves a confirmed disconnection from the fresh refetch and announces it', async () => {
    signOutOfflineCredentialsMock.mockResolvedValue({ success: true });
    refetch.mockResolvedValue({ available: true, connected: false });
    const { result } = renderHook(() =>
      useOfflineCredentialsAuth({ connect: undefined, refetch }),
    );

    let isLoggedOut: boolean | undefined;
    await act(async () => {
      isLoggedOut = await result.current.logOut();
    });

    expect(isLoggedOut).toBe(true);
    expect(signOutOfflineCredentialsMock).toHaveBeenCalledOnce();
    expect(refetch).toHaveBeenCalledOnce();
    expect(result.current.isLoggingOut).toBe(false);
    expect(result.current.liveAnnouncement).toBe(
      ScheduledTasksI18nKeys.DisconnectSuccessAnnouncement,
    );
  });

  it('treats a refetch that still reports connected as a failed logout', async () => {
    signOutOfflineCredentialsMock.mockResolvedValue({ success: true });
    refetch.mockResolvedValue({ available: true, connected: true });
    const { result } = renderHook(() =>
      useOfflineCredentialsAuth({ connect: undefined, refetch }),
    );

    let isLoggedOut: boolean | undefined;
    await act(async () => {
      isLoggedOut = await result.current.logOut();
    });

    expect(isLoggedOut).toBe(false);
    expect(result.current.liveAnnouncement).toBe(
      ScheduledTasksI18nKeys.DisconnectFailedMessage,
    );
  });

  it('treats a thrown sign-out request as a failed logout', async () => {
    signOutOfflineCredentialsMock.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() =>
      useOfflineCredentialsAuth({ connect: undefined, refetch }),
    );

    let isLoggedOut: boolean | undefined;
    await act(async () => {
      isLoggedOut = await result.current.logOut();
    });

    expect(isLoggedOut).toBe(false);
    expect(refetch).not.toHaveBeenCalled();
    expect(result.current.isLoggingOut).toBe(false);
    expect(result.current.liveAnnouncement).toBe(
      ScheduledTasksI18nKeys.DisconnectFailedMessage,
    );
  });

  it('tracks the in-flight state while the logout request is running', async () => {
    /* The deferred resolve keeps the promise's own signature — the untyped
       `new Promise` resolve takes a `value` argument, so a zero-arg variable
       type would reject the assignment. */
    let resolveSignOut: (value?: unknown) => void;
    signOutOfflineCredentialsMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSignOut = resolve;
      }),
    );
    const { result } = renderHook(() =>
      useOfflineCredentialsAuth({ connect: undefined, refetch }),
    );

    let logOutPromise: Promise<boolean> | undefined;
    act(() => {
      logOutPromise = result.current.logOut();
    });

    expect(result.current.isLoggingOut).toBe(true);

    await act(async () => {
      resolveSignOut();
      await logOutPromise;
    });

    expect(result.current.isLoggingOut).toBe(false);
  });
});
