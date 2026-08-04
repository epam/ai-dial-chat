import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ExternalServiceAuthType,
  ExternalServiceCredentialsLevel,
  getExternalService,
  signInExternalService,
  signOutExternalService,
} from '../../../server-api/external-services';
import {
  ToolsetOAuthInitiationResultType,
  ToolsetOAuthResultType,
} from '../../../constants/toolsets';
import {
  navigateToolsetOAuthPopup,
  openToolsetOAuthPopup,
  waitForToolsetOAuthResult,
} from '../../../utils/toolsets';
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

vi.mock('../../../utils/toolsets', () => ({
  navigateToolsetOAuthPopup: vi.fn(),
  openToolsetOAuthPopup: vi.fn(),
  waitForToolsetOAuthResult: vi.fn(),
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
        'USER',
        'external-service',
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
