import {
  navigateToolsetOAuthPopup,
  openToolsetOAuthPopup,
  ToolsetOAuthInitiationResultType,
  ToolsetOAuthResultType,
  waitForToolsetOAuthResult,
  ExternalServiceLoginOutcomeType,
  ExternalServiceAuthType,
  ExternalServiceCredentialsLevel,
} from '@epam/ai-dial-chat-hooks';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getExternalService,
  signInExternalService,
  signOutExternalService,
} from '../../../server-api/external-services';
import { getOfflineCredentials } from '../../../server-api/offline-credentials';
import { ROUTES } from '../../../types/routes';
import { useExternalServiceLogin } from '../useExternalServiceLogin';

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

vi.mock(
  '../../../../../../libs/chat-hooks/src/oauth/popup',
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    navigateToolsetOAuthPopup: vi.fn(),
    openToolsetOAuthPopup: vi.fn(),
  }),
);
vi.mock(
  '../../../../../../libs/chat-hooks/src/oauth/handshake',
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    waitForToolsetOAuthResult: vi.fn(),
  }),
);

/*
 * The app login wiring is the test seam for the DIAL-native path: the shared
 * offline-credentials login is covered by the lib's own spec, so this spec
 * drives its terminal outcomes directly.
 */
const loginOfflineCredentialsMock = vi.fn();
vi.mock('../../offlineCredentials/useOfflineCredentialsLogin', () => ({
  useOfflineCredentialsLogin: () => ({
    login: loginOfflineCredentialsMock,
  }),
}));

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
        schedulerServiceConsent: 'signed_in',
      });
    });

    it('reserves the popup during the click and drives the shared offline login with the connect settings, the status check, and the reserved popup', async () => {
      loginOfflineCredentialsMock.mockResolvedValue({ type: 'success' });
      const { result } = renderHook(() => useExternalServiceLogin());

      const pending = result.current.login(params);
      expect(openToolsetOAuthPopup).toHaveBeenCalledOnce();
      expect(openToolsetOAuthPopup).toHaveBeenCalledBefore(
        vi.mocked(getExternalService),
      );
      expect(await pending).toEqual({
        type: ExternalServiceLoginOutcomeType.Success,
      });
      expect(loginOfflineCredentialsMock).toHaveBeenCalledWith(
        connect,
        getOfflineCredentials,
        popup,
      );
      expect(getOfflineCredentials).toHaveBeenCalledOnce();
      expect(getExternalService).toHaveBeenCalledTimes(2);
      expect(signInExternalService).not.toHaveBeenCalled();
      expect(signOutExternalService).not.toHaveBeenCalled();
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
  });
});
