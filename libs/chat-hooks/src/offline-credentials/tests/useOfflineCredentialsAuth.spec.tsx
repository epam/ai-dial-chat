import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OfflineCredentialsLogoutOutcomeType,
  useOfflineCredentialsAuth,
  type UseOfflineCredentialsAuthOptions,
} from '../useOfflineCredentialsAuth/useOfflineCredentialsAuth';
import type { OfflineCredentialsConnectSettings } from '../useOfflineCredentialsGate/useOfflineCredentialsGate';

const loginMock = vi.fn();
vi.mock('../useOfflineCredentialsLogin/useOfflineCredentialsLogin', () => ({
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
const offlineCredentialsClient = {
  signOutOfflineCredentials: () => signOutOfflineCredentialsMock(),
} as unknown as UseOfflineCredentialsAuthOptions['offlineCredentialsClient'];

const CONNECT = {
  clientId: 'dial-chat',
  authorizationEndpoint: 'https://identity.example.com/authorize',
  scopes: ['openid', 'offline_access'],
};

describe('useOfflineCredentialsAuth', () => {
  const refetch = vi.fn();

  const renderAuth = (connect: OfflineCredentialsConnectSettings | undefined) =>
    renderHook(() =>
      useOfflineCredentialsAuth({
        connect,
        refetch,
        offlineCredentialsClient,
        callbackPath: '/toolset-signin',
      }),
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not start a login while no connect settings are available', () => {
    const { result } = renderAuth(undefined);

    act(() => result.current.logIn());

    expect(loginMock).not.toHaveBeenCalled();
    expect(result.current.isLoggingIn).toBe(false);
    expect(result.current.loginOutcome).toBeUndefined();
  });

  it('drives the login hook with the connect settings and the gate refetch, tracking the in-flight state', async () => {
    let resolveLogin: (outcome: { type: string }) => void;
    loginMock.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );
    const { result } = renderAuth(CONNECT);

    act(() => result.current.logIn());

    expect(result.current.isLoggingIn).toBe(true);
    expect(result.current.loginOutcome).toBeUndefined();

    await act(async () => {
      resolveLogin({ type: 'success' });
    });

    expect(loginMock).toHaveBeenCalledOnce();
    expect(loginMock).toHaveBeenCalledWith(CONNECT, refetch);
    expect(result.current.isLoggingIn).toBe(false);
    expect(result.current.loginOutcome).toBe('success');
  });

  it.each(['success', 'popup-blocked', 'cancelled', 'timed-out', 'failure'])(
    'resolves a %s login outcome onto the outcome state',
    async (outcomeType) => {
      loginMock.mockResolvedValue({ type: outcomeType });
      const { result } = renderAuth(CONNECT);

      act(() => result.current.logIn());

      await waitFor(() =>
        expect(result.current.loginOutcome).toBe(outcomeType),
      );
    },
  );

  it('resets the outcome at the start of a new login attempt', async () => {
    loginMock.mockResolvedValue({ type: 'failure' });
    const { result } = renderAuth(CONNECT);

    act(() => result.current.logIn());
    await waitFor(() => expect(result.current.loginOutcome).toBe('failure'));

    /* A never-resolving promise: the login stays in flight for the test. */
    loginMock.mockReturnValue(new Promise(() => undefined));
    act(() => result.current.logIn());

    expect(result.current.isLoggingIn).toBe(true);
    expect(result.current.loginOutcome).toBeUndefined();
  });

  it('resolves Disconnected when a fresh refetch confirms the disconnection', async () => {
    signOutOfflineCredentialsMock.mockResolvedValue({ success: true });
    refetch.mockResolvedValue({ available: true, connected: false });
    const { result } = renderAuth(undefined);

    let outcome: OfflineCredentialsLogoutOutcomeType | undefined;
    await act(async () => {
      outcome = await result.current.logOut();
    });

    expect(outcome).toBe(OfflineCredentialsLogoutOutcomeType.Disconnected);
    expect(signOutOfflineCredentialsMock).toHaveBeenCalledOnce();
    expect(refetch).toHaveBeenCalledOnce();
    expect(result.current.isLoggingOut).toBe(false);
  });

  it('resolves NotDisconnected when the refetch still reports a connection', async () => {
    signOutOfflineCredentialsMock.mockResolvedValue({ success: true });
    refetch.mockResolvedValue({ available: true, connected: true });
    const { result } = renderAuth(undefined);

    let outcome: OfflineCredentialsLogoutOutcomeType | undefined;
    await act(async () => {
      outcome = await result.current.logOut();
    });

    expect(outcome).toBe(OfflineCredentialsLogoutOutcomeType.NotDisconnected);
  });

  it('resolves NotDisconnected when the refetch fails to resolve a status', async () => {
    signOutOfflineCredentialsMock.mockResolvedValue({ success: true });
    refetch.mockResolvedValue(null);
    const { result } = renderAuth(undefined);

    let outcome: OfflineCredentialsLogoutOutcomeType | undefined;
    await act(async () => {
      outcome = await result.current.logOut();
    });

    expect(outcome).toBe(OfflineCredentialsLogoutOutcomeType.NotDisconnected);
  });

  it('resolves Failed without refetching when the sign-out request itself throws', async () => {
    signOutOfflineCredentialsMock.mockRejectedValue(new Error('network'));
    const { result } = renderAuth(undefined);

    let outcome: OfflineCredentialsLogoutOutcomeType | undefined;
    await act(async () => {
      outcome = await result.current.logOut();
    });

    expect(outcome).toBe(OfflineCredentialsLogoutOutcomeType.Failed);
    expect(refetch).not.toHaveBeenCalled();
    expect(result.current.isLoggingOut).toBe(false);
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
    const { result } = renderAuth(undefined);

    let logOutPromise: Promise<OfflineCredentialsLogoutOutcomeType> | undefined;
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
