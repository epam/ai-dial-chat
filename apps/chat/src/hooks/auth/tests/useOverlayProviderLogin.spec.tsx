import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as UserContextModule from '../../../context/auth/UserContext';
import * as OverlayContextModule from '../../../context/overlay/OverlayContext';
import * as authApi from '../../../server-api/auth.api';
import { AuthStatus } from '../../../types/auth-status';
import { OVERLAY_AUTO_SIGN_IN_ATTEMPT_STORAGE_KEY } from '../../../utils/overlay-auto-sign-in';
import { useOverlayProviderLogin } from '../useOverlayProviderLogin';

vi.mock('../../../context/auth/UserContext');
vi.mock('../../../context/overlay/OverlayContext');

describe('useOverlayProviderLogin', () => {
  const openSpy = vi.fn();
  const assignSpy = vi.fn();
  const mockUseOptionalOverlay = vi.mocked(
    OverlayContextModule.useOptionalOverlay,
  );
  let locationHref = 'http://localhost:4207/conversation';

  const createOverlayContext = (
    authProviderUiModes: Record<string, string> | undefined,
    authAutoSignInProvider?: string,
  ): OverlayContextModule.OverlayContextType => ({
    registerActiveConversationBridge: vi.fn(),
    registerConversationListBridge: vi.fn(),
    pendingModelId: null,
    authProviderUiModes,
    authAutoSignInProvider,
    clearPendingModelId: vi.fn(),
    notifyConversationLoaded: vi.fn(),
    notifyConversationsUpdated: vi.fn(),
    notifyGenerationStart: vi.fn(),
    notifyGenerationEnd: vi.fn(),
    notifyStopGenerating: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    locationHref = 'http://localhost:4207/conversation';
    Object.defineProperty(window, 'location', {
      value: {
        assign: assignSpy,
        origin: 'http://localhost:4207',
        get href() {
          return locationHref;
        },
      },
      writable: true,
    });
    vi.spyOn(window, 'open').mockImplementation(openSpy);
    openSpy.mockReturnValue({
      closed: false,
      close: vi.fn(),
      opener: {},
    });
    vi.mocked(UserContextModule.useUser).mockReturnValue({
      status: AuthStatus.Unauthenticated,
      user: null,
      refresh: vi.fn().mockResolvedValue(AuthStatus.Unauthenticated),
      reset: vi.fn(),
    });
    mockUseOptionalOverlay.mockReturnValue(
      createOverlayContext({ keycloak: 'sameWindow' }),
    );
    vi.spyOn(authApi, 'getProviders').mockResolvedValue([
      { id: 'keycloak', label: 'Keycloak' },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  const keepProviderLoadPending = () => {
    vi.mocked(authApi.getProviders).mockReturnValue(
      new Promise(() => undefined),
    );
  };

  it('loads providers on mount when provider modes are configured', async () => {
    const { result } = renderHook(() => useOverlayProviderLogin());

    expect(result.current.isLoadingProviders).toBe(true);
    await waitFor(() => {
      expect(result.current.providers).toEqual([
        { id: 'keycloak', label: 'Keycloak' },
      ]);
    });
    expect(authApi.getProviders).toHaveBeenCalledOnce();
    expect(result.current.isLoadingProviders).toBe(false);
  });

  it('skips provider loading when no provider modes are configured', () => {
    mockUseOptionalOverlay.mockReturnValue(createOverlayContext(undefined));

    const { result } = renderHook(() => useOverlayProviderLogin());

    expect(result.current.hasProviderConfiguration).toBe(false);
    expect(authApi.getProviders).not.toHaveBeenCalled();
  });

  it('discards a provider result after unmount', async () => {
    let resolveProviders:
      ((value: { id: string; label: string }[]) => void) | undefined;
    vi.mocked(authApi.getProviders).mockReturnValue(
      new Promise((resolve) => {
        resolveProviders = resolve;
      }),
    );
    const { unmount } = renderHook(() => useOverlayProviderLogin());

    unmount();
    await act(async () => {
      resolveProviders?.([{ id: 'late', label: 'Late provider' }]);
      await Promise.resolve();
    });

    expect(authApi.getProviders).toHaveBeenCalledOnce();
  });

  it('exposes an error and retries provider loading', async () => {
    vi.mocked(authApi.getProviders)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([{ id: 'keycloak', label: 'Keycloak' }]);
    const { result } = renderHook(() => useOverlayProviderLogin());

    await waitFor(() => {
      expect(result.current.hasProviderError).toBe(true);
    });
    act(() => {
      result.current.retryLoadProviders();
    });
    await waitFor(() => {
      expect(result.current.providers).toEqual([
        { id: 'keycloak', label: 'Keycloak' },
      ]);
    });
    expect(authApi.getProviders).toHaveBeenCalledTimes(2);
  });

  it('navigates same-window providers without opening an external window', () => {
    keepProviderLoadPending();
    const { result } = renderHook(() => useOverlayProviderLogin());

    act(() => {
      result.current.openProviderLogin('keycloak');
    });

    expect(assignSpy).toHaveBeenCalledWith(
      '/api/v1/auth/login/keycloak?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Fconversation',
    );
    expect(openSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['explicit external mode', { keycloak: 'external' }, 'keycloak'],
    ['an unconfigured provider', { keycloak: 'sameWindow' }, 'entra'],
    ['an unrecognized mode', { keycloak: 'futureMode' }, 'keycloak'],
  ])('opens %s externally', (_, authProviderUiModes, providerId) => {
    keepProviderLoadPending();
    mockUseOptionalOverlay.mockReturnValue(
      createOverlayContext(authProviderUiModes),
    );
    const { result } = renderHook(() => useOverlayProviderLogin());

    act(() => {
      result.current.openProviderLogin(providerId);
    });

    expect(openSpy).toHaveBeenCalledWith(
      `/api/v1/auth/login/${providerId}?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Foverlay-close`,
      '_blank',
    );
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('encodes provider ids and callbacks without session data', () => {
    keepProviderLoadPending();
    mockUseOptionalOverlay.mockReturnValue(
      createOverlayContext({ 'provider/with space': 'external' }),
    );
    const { result } = renderHook(() => useOverlayProviderLogin());

    act(() => {
      result.current.openProviderLogin('provider/with space');
    });

    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain('/provider%2Fwith%20space?callbackUrl=');
    expect(url).not.toMatch(/token|session|cookie/i);
  });

  describe('automatic sign-in', () => {
    const LOGIN_URL =
      '/api/v1/auth/login/keycloak?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Fconversation';

    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    it('navigates automatically for a same-window provider', async () => {
      mockUseOptionalOverlay.mockReturnValue(
        createOverlayContext({ keycloak: 'sameWindow' }, 'keycloak'),
      );

      renderHook(() => useOverlayProviderLogin());

      await waitFor(() => {
        expect(assignSpy).toHaveBeenCalledWith(LOGIN_URL);
      });
      expect(openSpy).not.toHaveBeenCalled();
    });

    it('navigates once across re-renders', async () => {
      mockUseOptionalOverlay.mockReturnValue(
        createOverlayContext({ keycloak: 'sameWindow' }, 'keycloak'),
      );
      const { rerender } = renderHook(() => useOverlayProviderLogin());

      await waitFor(() => {
        expect(assignSpy).toHaveBeenCalledOnce();
      });
      rerender();
      rerender();

      expect(assignSpy).toHaveBeenCalledOnce();
    });

    it('does not navigate without an auto-sign-in provider', async () => {
      mockUseOptionalOverlay.mockReturnValue(
        createOverlayContext({ keycloak: 'sameWindow' }),
      );
      const { result } = renderHook(() => useOverlayProviderLogin());

      await waitFor(() => {
        expect(result.current.isLoadingProviders).toBe(false);
      });

      expect(assignSpy).not.toHaveBeenCalled();
      expect(openSpy).not.toHaveBeenCalled();
    });

    it('does not navigate for an external-mode provider', async () => {
      vi.spyOn(authApi, 'getProviders').mockResolvedValue([
        { id: 'azure-ad', label: 'Entra' },
      ]);
      mockUseOptionalOverlay.mockReturnValue(
        createOverlayContext({ 'azure-ad': 'external' }, 'azure-ad'),
      );
      const { result } = renderHook(() => useOverlayProviderLogin());

      await waitFor(() => {
        expect(result.current.isLoadingProviders).toBe(false);
      });

      expect(assignSpy).not.toHaveBeenCalled();
      expect(openSpy).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledOnce();
    });

    it('does not navigate for a provider missing from the mode map', async () => {
      mockUseOptionalOverlay.mockReturnValue(
        createOverlayContext({ 'azure-ad': 'external' }, 'keycloak'),
      );
      const { result } = renderHook(() => useOverlayProviderLogin());

      await waitFor(() => {
        expect(result.current.isLoadingProviders).toBe(false);
      });

      expect(assignSpy).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledOnce();
    });

    it('does not navigate when the mode map is absent entirely', () => {
      mockUseOptionalOverlay.mockReturnValue(
        createOverlayContext(undefined, 'keycloak'),
      );

      renderHook(() => useOverlayProviderLogin());

      expect(assignSpy).not.toHaveBeenCalled();
      expect(authApi.getProviders).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledOnce();
    });

    it('does not navigate for a provider the backend does not register', async () => {
      mockUseOptionalOverlay.mockReturnValue(
        createOverlayContext(
          { 'not-registered': 'sameWindow' },
          'not-registered',
        ),
      );
      const { result } = renderHook(() => useOverlayProviderLogin());

      await waitFor(() => {
        expect(result.current.isLoadingProviders).toBe(false);
      });

      expect(assignSpy).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledOnce();
    });

    it('does not navigate when provider discovery fails', async () => {
      vi.mocked(authApi.getProviders).mockRejectedValue(new Error('network'));
      mockUseOptionalOverlay.mockReturnValue(
        createOverlayContext({ keycloak: 'sameWindow' }, 'keycloak'),
      );
      const { result } = renderHook(() => useOverlayProviderLogin());

      await waitFor(() => {
        expect(result.current.hasProviderError).toBe(true);
      });

      expect(assignSpy).not.toHaveBeenCalled();
    });

    it('does not navigate again while a recent attempt is recorded', async () => {
      window.sessionStorage.setItem(
        OVERLAY_AUTO_SIGN_IN_ATTEMPT_STORAGE_KEY,
        JSON.stringify({
          href: 'http://localhost:4207/conversation',
          createdAt: Date.now(),
        }),
      );
      mockUseOptionalOverlay.mockReturnValue(
        createOverlayContext({ keycloak: 'sameWindow' }, 'keycloak'),
      );
      const { result } = renderHook(() => useOverlayProviderLogin());

      await waitFor(() => {
        expect(result.current.isLoadingProviders).toBe(false);
      });

      expect(assignSpy).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledOnce();
    });

    it('records the attempt before navigating', async () => {
      mockUseOptionalOverlay.mockReturnValue(
        createOverlayContext({ keycloak: 'sameWindow' }, 'keycloak'),
      );

      renderHook(() => useOverlayProviderLogin());

      await waitFor(() => {
        expect(assignSpy).toHaveBeenCalledWith(LOGIN_URL);
      });
      expect(
        window.sessionStorage.getItem(OVERLAY_AUTO_SIGN_IN_ATTEMPT_STORAGE_KEY),
      ).toContain('http://localhost:4207/conversation');
    });
  });
});
