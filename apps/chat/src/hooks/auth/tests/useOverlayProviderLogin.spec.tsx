import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as UserContextModule from '../../../context/auth/UserContext';
import * as OverlayContextModule from '../../../context/overlay/OverlayContext';
import * as authApi from '../../../server-api/auth.api';
import { AuthStatus } from '../../../types/auth-status';
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
  ): OverlayContextModule.OverlayContextType => ({
    registerActiveConversationBridge: vi.fn(),
    registerConversationListBridge: vi.fn(),
    pendingModelId: null,
    authProviderUiModes,
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
      | ((value: { id: string; label: string }[]) => void)
      | undefined;
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
});
