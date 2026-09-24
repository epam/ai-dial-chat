import {
  navigateToolsetOAuthPopup,
  OAuthResourceKind,
  openToolsetOAuthPopup,
  ToolsetOAuthInitiationResultType,
  ToolsetOAuthResultType,
  waitForToolsetOAuthResult,
} from '@epam/ai-dial-chat-hooks';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ExternalServiceAuthType,
  ExternalServiceCredentialsLevel,
  getExternalService,
  signInExternalService,
  signOutExternalService,
} from '../../../server-api/external-services';
import { getOfflineCredentials } from '../../../server-api/offline-credentials';
import { ROUTES } from '../../../types/routes';
import {
  ExternalServiceLoginOutcomeType,
  useExternalServiceLogin,
} from '../useExternalServiceLogin';

const APP_ID = 'applications/public/finhub-via-openapi__1.0.0';
const SERVICE_ID = 'finhub-api2';
const SCOPE_ID = `${APP_ID}/external_services/${SERVICE_ID}`;

vi.mock('../../../server-api/external-services', () => ({
  ExternalServiceAuthType: {
    None: 'NONE',
    ApiKey: 'API_KEY',
    OAuth: 'OAUTH',
    DialNative: 'DIAL_NATIVE',
  },
  ExternalServiceCredentialsLevel: {
    Global: 'GLOBAL',
    Application: 'APPLICATION',
    User: 'USER',
  },
  getExternalService: vi.fn(),
  signInExternalService: vi.fn(),
  signOutExternalService: vi.fn(),
}));

vi.mock('../../../server-api/offline-credentials', () => ({
  getOfflineCredentials: vi.fn(),
}));

vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return {
    ...actual,
    navigateToolsetOAuthPopup: vi.fn(),
    openToolsetOAuthPopup: vi.fn(),
    waitForToolsetOAuthResult: vi.fn(),
  };
});

describe('useExternalServiceLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API key login', () => {
    it('logs in successfully without a prior logout when forceStale is not set', async () => {
      vi.mocked(signInExternalService).mockResolvedValue({ success: true });
      const { result } = renderHook(() => useExternalServiceLogin());

      const outcome = await result.current.login({
        appId: APP_ID,
        serviceId: SERVICE_ID,
        credentialsLevel: ExternalServiceCredentialsLevel.User,
        authenticationType: ExternalServiceAuthType.ApiKey,
        apiKey: 'secret',
      });

      expect(outcome).toEqual({
        type: ExternalServiceLoginOutcomeType.Success,
      });
      expect(signOutExternalService).not.toHaveBeenCalled();
      expect(signInExternalService).toHaveBeenCalledWith(APP_ID, SERVICE_ID, {
        credentialsLevel: ExternalServiceCredentialsLevel.User,
        authenticationType: ExternalServiceAuthType.ApiKey,
        apiKey: 'secret',
      });
    });

    it('logs out first when forceStale is true', async () => {
      vi.mocked(signOutExternalService).mockResolvedValue({ success: true });
      vi.mocked(signInExternalService).mockResolvedValue({ success: true });
      const { result } = renderHook(() => useExternalServiceLogin());

      await result.current.login({
        appId: APP_ID,
        serviceId: SERVICE_ID,
        credentialsLevel: ExternalServiceCredentialsLevel.User,
        authenticationType: ExternalServiceAuthType.ApiKey,
        apiKey: 'secret',
        forceStale: true,
      });

      expect(signOutExternalService).toHaveBeenCalledWith(APP_ID, SERVICE_ID, {
        credentialsLevel: ExternalServiceCredentialsLevel.User,
        authenticationType: ExternalServiceAuthType.ApiKey,
      });
      expect(signInExternalService).toHaveBeenCalledOnce();
    });

    it('returns Failure when the sign-in call rejects', async () => {
      vi.mocked(signInExternalService).mockRejectedValue(new Error('nope'));
      const { result } = renderHook(() => useExternalServiceLogin());

      const outcome = await result.current.login({
        appId: APP_ID,
        serviceId: SERVICE_ID,
        credentialsLevel: ExternalServiceCredentialsLevel.User,
        authenticationType: ExternalServiceAuthType.ApiKey,
        apiKey: 'secret',
      });

      expect(outcome).toEqual({
        type: ExternalServiceLoginOutcomeType.Failure,
      });
    });
  });

  describe('DIAL_NATIVE login', () => {
    const connect = {
      clientId: 'offline-client',
      authorizationEndpoint: 'https://identity.example.com/authorize',
      scopes: ['openid', 'offline_access'],
    };
    const params = {
      appId: APP_ID,
      serviceId: 'dial-native',
      credentialsLevel: ExternalServiceCredentialsLevel.User,
      authenticationType: ExternalServiceAuthType.DialNative,
      forceStale: true,
    };
    let popup: Window;

    beforeEach(() => {
      popup = { close: vi.fn() } as unknown as Window;
      vi.mocked(openToolsetOAuthPopup).mockReturnValue(popup);
      vi.mocked(getExternalService).mockResolvedValue({
        displayName: 'DIAL',
        authenticationType: ExternalServiceAuthType.DialNative,
        appLevelAuthStatus: 'SIGNED_IN',
      });
      vi.mocked(getOfflineCredentials).mockResolvedValue({
        available: true,
        connected: false,
        connect,
      });
      vi.mocked(navigateToolsetOAuthPopup).mockReturnValue({
        type: ToolsetOAuthInitiationResultType.Started,
        popup,
        flowId: 'offline-flow',
      });
      vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
        type: ToolsetOAuthResultType.Success,
        toolsetId: 'offline-credentials',
        credentialsLevel: 'USER' as never,
      });
    });

    it('opens offline OAuth synchronously and confirms connected status without per-service signin/signout', async () => {
      vi.mocked(getOfflineCredentials)
        .mockResolvedValueOnce({ available: true, connected: false, connect })
        .mockResolvedValueOnce({ available: true, connected: true });
      const { result } = renderHook(() => useExternalServiceLogin());

      const pending = result.current.login(params);
      expect(openToolsetOAuthPopup).toHaveBeenCalledOnce();
      expect(openToolsetOAuthPopup).toHaveBeenCalledBefore(
        vi.mocked(getExternalService),
      );
      expect(await pending).toEqual({
        type: ExternalServiceLoginOutcomeType.Success,
      });
      expect(navigateToolsetOAuthPopup).toHaveBeenCalledWith(
        popup,
        expect.objectContaining({ clientId: connect.clientId }),
        'offline-credentials',
        ROUTES.ToolsetSignIn,
        'USER',
        OAuthResourceKind.OfflineCredentials,
      );
      expect(getOfflineCredentials).toHaveBeenCalledTimes(2);
      expect(getExternalService).toHaveBeenCalledTimes(2);
      expect(signInExternalService).not.toHaveBeenCalled();
      expect(signOutExternalService).not.toHaveBeenCalled();
    });

    it.each(['SIGNED_OUT', undefined])(
      'does not grant success without confirmed administrator consent (%s)',
      async (appLevelAuthStatus) => {
        vi.mocked(getExternalService).mockResolvedValue({
          displayName: 'DIAL',
          authenticationType: ExternalServiceAuthType.DialNative,
          appLevelAuthStatus,
        });
        const { result } = renderHook(() => useExternalServiceLogin());
        expect((await result.current.login(params)).type).toBe(
          appLevelAuthStatus === 'SIGNED_OUT'
            ? ExternalServiceLoginOutcomeType.AdminConsentRequired
            : ExternalServiceLoginOutcomeType.Failure,
        );
        expect(popup.close).toHaveBeenCalledOnce();
        expect(getOfflineCredentials).not.toHaveBeenCalled();
        expect(signInExternalService).not.toHaveBeenCalled();
        expect(signOutExternalService).not.toHaveBeenCalled();
      },
    );

    it('reuses an existing offline connection without revoking credentials', async () => {
      vi.mocked(getOfflineCredentials).mockResolvedValue({
        available: true,
        connected: true,
      });
      const { result } = renderHook(() => useExternalServiceLogin());
      expect((await result.current.login(params)).type).toBe(
        ExternalServiceLoginOutcomeType.Success,
      );
      expect(popup.close).toHaveBeenCalledOnce();
      expect(navigateToolsetOAuthPopup).not.toHaveBeenCalled();
      expect(signOutExternalService).not.toHaveBeenCalled();
    });

    it('reports unavailable offline access and closes the reserved popup', async () => {
      vi.mocked(getOfflineCredentials).mockResolvedValue({
        available: false,
        connected: false,
      });
      const { result } = renderHook(() => useExternalServiceLogin());
      expect((await result.current.login(params)).type).toBe(
        ExternalServiceLoginOutcomeType.OfflineUnavailable,
      );
      expect(popup.close).toHaveBeenCalledOnce();
      expect(navigateToolsetOAuthPopup).not.toHaveBeenCalled();
    });

    it('does not trust popup success when offline credentials remain disconnected', async () => {
      const { result } = renderHook(() => useExternalServiceLogin());
      expect((await result.current.login(params)).type).toBe(
        ExternalServiceLoginOutcomeType.Failure,
      );
      expect(signInExternalService).not.toHaveBeenCalled();
    });

    it('checks administrator consent again after offline login', async () => {
      vi.mocked(getOfflineCredentials)
        .mockResolvedValueOnce({ available: true, connected: false, connect })
        .mockResolvedValueOnce({ available: true, connected: true });
      vi.mocked(getExternalService)
        .mockResolvedValueOnce({
          displayName: 'DIAL',
          authenticationType: ExternalServiceAuthType.DialNative,
          appLevelAuthStatus: 'SIGNED_IN',
        })
        .mockResolvedValueOnce({
          displayName: 'DIAL',
          authenticationType: ExternalServiceAuthType.DialNative,
          appLevelAuthStatus: 'SIGNED_OUT',
        });
      const { result } = renderHook(() => useExternalServiceLogin());
      expect((await result.current.login(params)).type).toBe(
        ExternalServiceLoginOutcomeType.AdminConsentRequired,
      );
    });

    it('handles a blocked popup without starting a request', async () => {
      vi.mocked(openToolsetOAuthPopup).mockReturnValue(null);
      const { result } = renderHook(() => useExternalServiceLogin());
      expect((await result.current.login(params)).type).toBe(
        ExternalServiceLoginOutcomeType.PopupBlocked,
      );
      expect(getOfflineCredentials).not.toHaveBeenCalled();
    });

    it('closes the popup when fetching offline settings fails', async () => {
      vi.mocked(getOfflineCredentials).mockRejectedValueOnce(
        new Error('unavailable'),
      );
      const { result } = renderHook(() => useExternalServiceLogin());
      expect((await result.current.login(params)).type).toBe(
        ExternalServiceLoginOutcomeType.Failure,
      );
      expect(popup.close).toHaveBeenCalledOnce();
    });
  });

  describe('OAuth login', () => {
    it('opens the popup synchronously, logs out when forceStale is set, then navigates it using the full scope id', async () => {
      const fakePopup = {} as Window;
      vi.mocked(openToolsetOAuthPopup).mockReturnValue(fakePopup);
      vi.mocked(signOutExternalService).mockResolvedValue({ success: true });
      vi.mocked(navigateToolsetOAuthPopup).mockReturnValue({
        type: ToolsetOAuthInitiationResultType.Started,
        popup: fakePopup,
        flowId: 'flow-1',
      });
      vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
        type: ToolsetOAuthResultType.Success,
        toolsetId: SCOPE_ID,
        credentialsLevel: 'USER' as never,
      });
      const { result } = renderHook(() => useExternalServiceLogin());

      const outcome = await result.current.login({
        appId: APP_ID,
        serviceId: SERVICE_ID,
        credentialsLevel: ExternalServiceCredentialsLevel.User,
        authenticationType: ExternalServiceAuthType.OAuth,
        forceStale: true,
      });

      expect(openToolsetOAuthPopup).toHaveBeenCalledOnce();
      expect(signOutExternalService).toHaveBeenCalledWith(
        APP_ID,
        SERVICE_ID,
        expect.objectContaining({ authenticationType: 'OAUTH' }),
      );
      expect(navigateToolsetOAuthPopup).toHaveBeenCalledWith(
        fakePopup,
        expect.any(Object),
        SCOPE_ID,
        ROUTES.ToolsetSignIn,
        'USER',
        'external-service',
        // Offline usage consent — undefined here because the caller did not ask for it.
        undefined,
      );
      expect(outcome).toEqual({
        type: ExternalServiceLoginOutcomeType.Success,
      });
    });

    it('returns PopupBlocked without logging out when the popup is blocked', async () => {
      vi.mocked(openToolsetOAuthPopup).mockReturnValue(null);
      const { result } = renderHook(() => useExternalServiceLogin());

      const outcome = await result.current.login({
        appId: APP_ID,
        serviceId: SERVICE_ID,
        credentialsLevel: ExternalServiceCredentialsLevel.User,
        authenticationType: ExternalServiceAuthType.OAuth,
        forceStale: true,
      });

      expect(outcome).toEqual({
        type: ExternalServiceLoginOutcomeType.PopupBlocked,
      });
      expect(signOutExternalService).not.toHaveBeenCalled();
    });

    it('re-verifies status on Cancelled via getExternalService and returns Success if actually signed in', async () => {
      const fakePopup = {} as Window;
      vi.mocked(openToolsetOAuthPopup).mockReturnValue(fakePopup);
      vi.mocked(navigateToolsetOAuthPopup).mockReturnValue({
        type: ToolsetOAuthInitiationResultType.Started,
        popup: fakePopup,
        flowId: 'flow-1',
      });
      vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
        type: ToolsetOAuthResultType.Cancelled,
      });
      vi.mocked(getExternalService).mockResolvedValue({
        displayName: 'FinHub API',
        authenticationType: ExternalServiceAuthType.OAuth,
        userLevelAuthStatus: 'SIGNED_IN',
      });
      const { result } = renderHook(() => useExternalServiceLogin());

      const outcome = await result.current.login({
        appId: APP_ID,
        serviceId: SERVICE_ID,
        credentialsLevel: ExternalServiceCredentialsLevel.User,
        authenticationType: ExternalServiceAuthType.OAuth,
      });

      await waitFor(() =>
        expect(outcome).toEqual({
          type: ExternalServiceLoginOutcomeType.Success,
        }),
      );
      expect(getExternalService).toHaveBeenCalledWith(APP_ID, SERVICE_ID);
    });

    it('returns Cancelled when re-verification shows the user is still signed out', async () => {
      const fakePopup = {} as Window;
      vi.mocked(openToolsetOAuthPopup).mockReturnValue(fakePopup);
      vi.mocked(navigateToolsetOAuthPopup).mockReturnValue({
        type: ToolsetOAuthInitiationResultType.Started,
        popup: fakePopup,
        flowId: 'flow-1',
      });
      vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
        type: ToolsetOAuthResultType.Cancelled,
      });
      vi.mocked(getExternalService).mockResolvedValue({
        displayName: 'FinHub API',
        authenticationType: ExternalServiceAuthType.OAuth,
        userLevelAuthStatus: 'SIGNED_OUT',
      });
      const { result } = renderHook(() => useExternalServiceLogin());

      const outcome = await result.current.login({
        appId: APP_ID,
        serviceId: SERVICE_ID,
        credentialsLevel: ExternalServiceCredentialsLevel.User,
        authenticationType: ExternalServiceAuthType.OAuth,
      });

      expect(outcome).toEqual({
        type: ExternalServiceLoginOutcomeType.Cancelled,
      });
    });
  });
});
