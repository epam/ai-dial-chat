import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToolsetAuthErrorReason } from '@/src/types/toolsets';

import { TOOLSET_AUTH_POPUP_NAME } from '@/src/constants/toolsets';

import {
  isToolsetAuthError,
  openToolsetAuthWindow,
  signInToolset,
} from '../auth-toolset';

const ORIGIN = 'https://chat.example.com';
const SIGN_IN_URL = 'https://provider.example.com/authorize';

/** Stands in for the login window the browser hands back from `window.open` */
const createFakeAuthWindow = () => {
  const state = { closed: false, href: 'about:blank' };

  const replace = vi.fn((url: string) => {
    state.href = url;
  });
  const close = vi.fn(() => {
    state.closed = true;
  });

  return {
    state,
    replace,
    close,
    get closed() {
      return state.closed;
    },
    location: {
      // Read fresh on every poll, so it reports the window's current href
      get href() {
        return state.href;
      },
      replace,
    },
  };
};

let authWindow: ReturnType<typeof createFakeAuthWindow>;

const asWindow = (value: ReturnType<typeof createFakeAuthWindow>) =>
  value as unknown as Window;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  authWindow = createFakeAuthWindow();

  Object.defineProperty(window, 'location', {
    value: { origin: ORIGIN, assign: vi.fn() },
    writable: true,
  });
  vi.spyOn(window, 'open').mockReturnValue(asWindow(authWindow));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('openToolsetAuthWindow', () => {
  it('opens a blank window so the user gesture is not spent on a URL', () => {
    expect(openToolsetAuthWindow()).toBe(asWindow(authWindow));
    expect(window.open).toHaveBeenCalledWith(
      '',
      TOOLSET_AUTH_POPUP_NAME,
      expect.any(String),
    );
  });

  it('returns null when the browser blocks the window', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);

    expect(openToolsetAuthWindow()).toBeNull();
  });
});

describe('signInToolset', () => {
  const flush = () => vi.advanceTimersByTimeAsync(0);

  const settleWithUrl = (url: string) => {
    authWindow.state.href = url;
    return vi.advanceTimersByTimeAsync(300);
  };

  it('navigates the reserved window instead of opening a new one', async () => {
    const signIn = signInToolset(SIGN_IN_URL, asWindow(authWindow));
    await flush();

    // Opening here would be blocked by Safari - the gesture is long gone
    expect(window.open).not.toHaveBeenCalled();
    expect(authWindow.replace).toHaveBeenCalledWith(SIGN_IN_URL);

    await settleWithUrl(`${ORIGIN}/auth/toolset-signin?login-complete=1`);
    await expect(signIn).resolves.toBe(true);
    expect(authWindow.close).toHaveBeenCalled();
  });

  it('redirects the current tab when no window was reserved', async () => {
    await expect(signInToolset(SIGN_IN_URL)).resolves.toBe(false);
    expect(window.location.assign).toHaveBeenCalledWith(SIGN_IN_URL);
  });

  it('redirects the current tab when the reserved window was discarded', async () => {
    authWindow.state.closed = true;

    await expect(
      signInToolset(SIGN_IN_URL, asWindow(authWindow)),
    ).resolves.toBe(false);
    expect(window.location.assign).toHaveBeenCalledWith(SIGN_IN_URL);
  });

  it('redirects the current tab when signing in in the same window', async () => {
    await expect(
      signInToolset(SIGN_IN_URL, asWindow(authWindow), true),
    ).resolves.toBe(false);
    expect(authWindow.replace).not.toHaveBeenCalled();
    expect(window.location.assign).toHaveBeenCalledWith(SIGN_IN_URL);
  });

  it('reports a failed sign in with its reason and trace id', async () => {
    const signIn = signInToolset(SIGN_IN_URL, asWindow(authWindow));
    const onRejected = vi.fn();
    void signIn.catch(onRejected);
    await flush();

    await settleWithUrl(
      `${ORIGIN}/auth/toolset-signin?login-complete=0&reason=sign-in-request-failed&trace-id=trace-1`,
    );

    expect(onRejected).toHaveBeenCalledTimes(1);
    const error = onRejected.mock.calls[0][0];
    expect(isToolsetAuthError(error)).toBe(true);
    expect(error.details).toMatchObject({
      reason: ToolsetAuthErrorReason.SignInRequestFailed,
      traceId: 'trace-1',
    });
  });

  it('reports an error the provider redirected back with', async () => {
    const signIn = signInToolset(SIGN_IN_URL, asWindow(authWindow));
    const onRejected = vi.fn();
    void signIn.catch(onRejected);
    await flush();

    await settleWithUrl(
      `${ORIGIN}/auth/toolset-signin?error=access_denied&error_description=Denied`,
    );

    expect(onRejected.mock.calls[0][0].details).toMatchObject({
      reason: ToolsetAuthErrorReason.ProviderError,
      code: 'access_denied',
      message: 'Denied',
    });
  });

  it('fails when the login window is closed before it reports back', async () => {
    const signIn = signInToolset(SIGN_IN_URL, asWindow(authWindow));
    const onRejected = vi.fn();
    void signIn.catch(onRejected);
    await flush();

    authWindow.state.closed = true;
    await vi.advanceTimersByTimeAsync(300);

    expect(onRejected.mock.calls[0][0].details).toMatchObject({
      reason: ToolsetAuthErrorReason.WindowClosed,
    });
  });

  it('fails when the login window never reports back', async () => {
    const signIn = signInToolset(SIGN_IN_URL, asWindow(authWindow));
    const onRejected = vi.fn();
    void signIn.catch(onRejected);
    await flush();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(onRejected.mock.calls[0][0].details).toMatchObject({
      reason: ToolsetAuthErrorReason.Timeout,
    });
  });

  it('keeps waiting while the provider pages are open', async () => {
    const signIn = signInToolset(SIGN_IN_URL, asWindow(authWindow));
    const onSettled = vi.fn();
    void signIn.then(onSettled, onSettled);
    await flush();

    await settleWithUrl('https://provider.example.com/consent');

    expect(onSettled).not.toHaveBeenCalled();

    await settleWithUrl(`${ORIGIN}/auth/toolset-signin?login-complete=1`);
    await expect(signIn).resolves.toBe(true);
  });
});
