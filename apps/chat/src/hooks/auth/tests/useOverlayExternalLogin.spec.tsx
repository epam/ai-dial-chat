import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as UserContextModule from '../../../context/auth/UserContext';
import { AuthStatus } from '../../../types/auth-status';
import {
  OverlayExternalLoginStatus,
  useOverlayExternalLogin,
} from '../useOverlayExternalLogin';

vi.mock('../../../context/auth/UserContext');

const mockUseUser = vi.mocked(UserContextModule.useUser);

interface MockAuthWindow {
  closed: boolean;
  close: ReturnType<typeof vi.fn>;
  opener: unknown;
}

const createMockAuthWindow = (): MockAuthWindow => ({
  closed: false,
  close: vi.fn(),
  opener: {},
});

describe('useOverlayExternalLogin', () => {
  const openSpy = vi.fn();
  const refreshSpy =
    vi.fn<(options?: { setLoading?: boolean }) => Promise<AuthStatus>>();
  let authWindow: MockAuthWindow;
  let clearTimeoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    refreshSpy.mockResolvedValue(AuthStatus.Unauthenticated);
    mockUseUser.mockReturnValue({
      status: AuthStatus.Unauthenticated,
      user: null,
      refresh: refreshSpy,
      reset: vi.fn(),
    });
    authWindow = createMockAuthWindow();
    openSpy.mockReturnValue(authWindow);
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:4207',
      },
      writable: true,
    });
    vi.spyOn(window, 'open').mockImplementation(openSpy);
    clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens the login flow in a new browser tab with /overlay-close callback', () => {
    const { result } = renderHook(() => useOverlayExternalLogin());

    act(() => {
      result.current.openLogin();
    });

    expect(result.current.status).toBe(OverlayExternalLoginStatus.Waiting);
    expect(openSpy).toHaveBeenCalledWith(
      'http://localhost:4207/login?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Foverlay-close',
      '_blank',
    );
    expect(authWindow.opener).toBeNull();
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('surfaces a blocked auth tab without entering the waiting state', () => {
    openSpy.mockReturnValue(null);
    const { result } = renderHook(() => useOverlayExternalLogin());

    act(() => {
      result.current.openLogin();
    });

    expect(result.current.status).toBe(OverlayExternalLoginStatus.Blocked);
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('waits one full interval before the first auth poll', async () => {
    const { result } = renderHook(() => useOverlayExternalLogin());

    act(() => {
      result.current.openLogin();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999);
    });
    expect(refreshSpy).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(refreshSpy).toHaveBeenCalledOnce();
    expect(refreshSpy).toHaveBeenCalledWith({ setLoading: false });
  });

  it('completes login when refresh reports an authenticated user on a poll tick', async () => {
    refreshSpy.mockResolvedValue(AuthStatus.Authenticated);
    const { result } = renderHook(() => useOverlayExternalLogin());

    act(() => {
      result.current.openLogin();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(authWindow.close).toHaveBeenCalledOnce();
    expect(result.current.status).toBe(OverlayExternalLoginStatus.Idle);
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('does not start another auth poll while the previous one is still pending', async () => {
    let resolveRefresh: (status: AuthStatus) => void = () => undefined;
    refreshSpy.mockImplementation(
      () =>
        new Promise<AuthStatus>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const { result } = renderHook(() => useOverlayExternalLogin());

    act(() => {
      result.current.openLogin();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(refreshSpy).toHaveBeenCalledOnce();

    await act(async () => {
      resolveRefresh(AuthStatus.Unauthenticated);
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999);
    });
    expect(refreshSpy).toHaveBeenCalledOnce();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(refreshSpy).toHaveBeenCalledTimes(2);
  });

  it('keeps polling after a long wait and leaves the auth tab open', async () => {
    const { result } = renderHook(() => useOverlayExternalLogin());

    act(() => {
      result.current.openLogin();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    expect(result.current.status).toBe(OverlayExternalLoginStatus.TakingLonger);
    expect(authWindow.close).not.toHaveBeenCalled();

    const pollsBeforeBackoffTick = refreshSpy.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(14_999);
    });
    expect(refreshSpy).toHaveBeenCalledTimes(pollsBeforeBackoffTick);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(refreshSpy).toHaveBeenCalledTimes(pollsBeforeBackoffTick + 1);
  });

  it('tears down the previous attempt before reopening a new one', () => {
    const secondAuthWindow = createMockAuthWindow();
    openSpy
      .mockReturnValueOnce(authWindow)
      .mockReturnValueOnce(secondAuthWindow);
    const { result } = renderHook(() => useOverlayExternalLogin());

    act(() => {
      result.current.openLogin();
    });

    act(() => {
      result.current.openLogin();
    });

    expect(authWindow.close).toHaveBeenCalledOnce();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(result.current.status).toBe(OverlayExternalLoginStatus.Waiting);
  });

  it('cancels polling and returns to idle when the user cancels login', async () => {
    let resolveRefresh: (status: AuthStatus) => void = () => undefined;
    refreshSpy.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const { result } = renderHook(() => useOverlayExternalLogin());

    act(() => {
      result.current.openLogin();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(refreshSpy).toHaveBeenCalledOnce();

    act(() => {
      result.current.cancelLogin();
    });

    expect(authWindow.close).toHaveBeenCalledOnce();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(result.current.status).toBe(OverlayExternalLoginStatus.Idle);

    await act(async () => {
      resolveRefresh(AuthStatus.Unauthenticated);
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(refreshSpy).toHaveBeenCalledOnce();
  });

  it('cleans up poll and long-wait timers on unmount', () => {
    const { result, unmount } = renderHook(() => useOverlayExternalLogin());
    act(() => {
      result.current.openLogin();
    });

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
