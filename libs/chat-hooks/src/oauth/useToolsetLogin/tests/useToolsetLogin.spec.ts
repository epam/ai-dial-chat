import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emitToolsetLoginSuccess } from '../../../shared/toolset-login-events';
import { waitForToolsetOAuthResult } from '../../handshake';
import {
  initiateOAuthLogin,
  navigateToolsetOAuthPopup,
  openToolsetOAuthPopup,
} from '../../popup';
import {
  OAuthResourceKind,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthInitiationResultType,
  ToolsetOAuthResultType,
} from '../../types';
import {
  ToolsetLoginOutcomeType,
  useToolsetLogin,
  type UseToolsetLoginParams,
} from '../useToolsetLogin';

vi.mock('../../popup', () => ({
  initiateOAuthLogin: vi.fn(),
  navigateToolsetOAuthPopup: vi.fn(),
  openToolsetOAuthPopup: vi.fn(),
}));

vi.mock('../../handshake', () => ({
  waitForToolsetOAuthResult: vi.fn(),
}));

vi.mock('../../../shared/toolset-login-events', () => ({
  emitToolsetLoginSuccess: vi.fn(),
}));

const CALLBACK_PATH = '/auth/toolset-signin';
const TOOLSET_ID = 'toolsets/b/my-toolset';

const loginToolset = vi.fn();
const logoutToolset = vi.fn();
const getToolset = vi.fn();

const renderToolsetLogin = (overrides?: Partial<UseToolsetLoginParams>) =>
  renderHook(() =>
    useToolsetLogin({
      callbackPath: CALLBACK_PATH,
      loginToolset,
      logoutToolset,
      getToolset,
      ...overrides,
    }),
  );

describe('useToolsetLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps `login` stable across re-renders with unchanged callbacks', () => {
    const { result, rerender } = renderToolsetLogin();
    const first = result.current.login;

    rerender();

    expect(result.current.login).toBe(first);
  });

  describe('API key login', () => {
    it('submits the trimmed key at the requested level without a prior logout', async () => {
      loginToolset.mockResolvedValue({ success: true });
      const { result } = renderToolsetLogin();

      const outcome = await result.current.login({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.ApiKey,
        apiKey: '  secret  ',
      });

      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.Success });
      expect(logoutToolset).not.toHaveBeenCalled();
      expect(loginToolset).toHaveBeenCalledWith(TOOLSET_ID, {
        url: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.ApiKey,
        apiKey: 'secret',
      });
      expect(emitToolsetLoginSuccess).toHaveBeenCalledWith({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
      });
    });

    it('opens no popup for API-key authentication', async () => {
      loginToolset.mockResolvedValue({ success: true });
      const { result } = renderToolsetLogin();

      await result.current.login({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.ApiKey,
        apiKey: 'secret',
      });

      expect(openToolsetOAuthPopup).not.toHaveBeenCalled();
      expect(initiateOAuthLogin).not.toHaveBeenCalled();
    });

    it('logs out the target level first when its cached status is failed', async () => {
      logoutToolset.mockResolvedValue({ success: true });
      loginToolset.mockResolvedValue({ success: true });
      const { result } = renderToolsetLogin();

      await result.current.login({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.Global,
        authenticationType: ToolsetAuthTypes.ApiKey,
        apiKey: 'secret',
        isCurrentlyFailed: true,
      });

      expect(logoutToolset).toHaveBeenCalledWith(TOOLSET_ID, {
        url: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.Global,
        authenticationType: ToolsetAuthTypes.ApiKey,
      });
      expect(loginToolset).toHaveBeenCalledOnce();
    });

    it('logs out first when forceStale is set even though the cached status is not failed', async () => {
      logoutToolset.mockResolvedValue({ success: true });
      loginToolset.mockResolvedValue({ success: true });
      const { result } = renderToolsetLogin();

      await result.current.login({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.ApiKey,
        apiKey: 'secret',
        isCurrentlyFailed: false,
        forceStale: true,
      });

      expect(logoutToolset).toHaveBeenCalledOnce();
    });

    it('still attempts the login when the pre-emptive logout rejects', async () => {
      logoutToolset.mockRejectedValue(new Error('logout failed'));
      loginToolset.mockResolvedValue({ success: true });
      const { result } = renderToolsetLogin();

      const outcome = await result.current.login({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.ApiKey,
        apiKey: 'secret',
        isCurrentlyFailed: true,
      });

      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.Success });
      expect(loginToolset).toHaveBeenCalledOnce();
    });

    it('classifies a rejected login as failure rather than throwing', async () => {
      loginToolset.mockRejectedValue(new Error('nope'));
      const { result } = renderToolsetLogin();

      const outcome = await result.current.login({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.ApiKey,
        apiKey: 'secret',
      });

      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.Failure });
      expect(emitToolsetLoginSuccess).not.toHaveBeenCalled();
    });
  });

  describe('OAuth login', () => {
    const startFlow = () => {
      vi.mocked(initiateOAuthLogin).mockReturnValue({
        type: ToolsetOAuthInitiationResultType.Started,
        popup: {} as Window,
        flowId: 'flow-1',
      });
    };

    it('resolves success and never logs out first when forceStale is not set', async () => {
      startFlow();
      vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
        type: ToolsetOAuthResultType.Success,
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
      });
      const { result } = renderToolsetLogin();

      const outcome = await result.current.login({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.OAuth,
      });

      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.Success });
      expect(logoutToolset).not.toHaveBeenCalled();
      expect(emitToolsetLoginSuccess).toHaveBeenCalledWith({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
      });
    });

    it('passes the injected callback path to the flow and the handshake', async () => {
      startFlow();
      vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
        type: ToolsetOAuthResultType.Success,
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
      });
      const { result } = renderToolsetLogin({
        callbackPath: '/some/other/callback',
      });

      await result.current.login({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.OAuth,
        oauthSettings: { clientId: 'client' },
      });

      expect(initiateOAuthLogin).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'client' }),
        TOOLSET_ID,
        '/some/other/callback',
        ToolsetCredentialsLevel.User,
        // Offline usage consent — undefined here because the caller did not ask for it.
        undefined,
      );
      expect(waitForToolsetOAuthResult).toHaveBeenCalledWith(
        expect.anything(),
        'flow-1',
        expect.objectContaining({ callbackPath: '/some/other/callback' }),
      );
    });

    it('opens the popup synchronously, then logs out, then navigates it when forceStale is set', async () => {
      const fakePopup = {} as Window;
      vi.mocked(openToolsetOAuthPopup).mockReturnValue(fakePopup);
      logoutToolset.mockResolvedValue({ success: true });
      vi.mocked(navigateToolsetOAuthPopup).mockReturnValue({
        type: ToolsetOAuthInitiationResultType.Started,
        popup: fakePopup,
        flowId: 'flow-1',
      });
      vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
        type: ToolsetOAuthResultType.Success,
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
      });
      const { result } = renderToolsetLogin();

      const outcome = await result.current.login({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.OAuth,
        forceStale: true,
      });

      expect(openToolsetOAuthPopup).toHaveBeenCalledOnce();
      expect(logoutToolset).toHaveBeenCalledOnce();
      expect(navigateToolsetOAuthPopup).toHaveBeenCalledWith(
        fakePopup,
        expect.any(Object),
        TOOLSET_ID,
        CALLBACK_PATH,
        ToolsetCredentialsLevel.User,
        OAuthResourceKind.Toolset,
        undefined,
      );
      expect(initiateOAuthLogin).not.toHaveBeenCalled();
      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.Success });
    });

    it('resolves popup-blocked without logging out when a forced re-login is blocked', async () => {
      vi.mocked(openToolsetOAuthPopup).mockReturnValue(null);
      const { result } = renderToolsetLogin();

      const outcome = await result.current.login({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.OAuth,
        forceStale: true,
      });

      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.PopupBlocked });
      expect(logoutToolset).not.toHaveBeenCalled();
    });

    it('resolves popup-blocked and issues no request when the browser blocks the popup', async () => {
      vi.mocked(initiateOAuthLogin).mockReturnValue({
        type: ToolsetOAuthInitiationResultType.Blocked,
      });
      const { result } = renderToolsetLogin();

      const outcome = await result.current.login({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.OAuth,
      });

      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.PopupBlocked });
      expect(loginToolset).not.toHaveBeenCalled();
      expect(waitForToolsetOAuthResult).not.toHaveBeenCalled();
    });

    it('resolves failure and never starts the handshake for an unusable OAuth configuration', async () => {
      vi.mocked(initiateOAuthLogin).mockReturnValue({
        type: ToolsetOAuthInitiationResultType.InvalidConfig,
      });
      const { result } = renderToolsetLogin();

      const outcome = await result.current.login({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.OAuth,
      });

      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.Failure });
      expect(waitForToolsetOAuthResult).not.toHaveBeenCalled();
    });

    it('resolves failure when the handshake reports a failure', async () => {
      startFlow();
      vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
        type: ToolsetOAuthResultType.Failure,
        reason: 'login-request-failed' as never,
      });
      const { result } = renderToolsetLogin();

      const outcome = await result.current.login({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.OAuth,
      });

      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.Failure });
      expect(getToolset).not.toHaveBeenCalled();
    });

    it('upgrades a reported cancellation to success when the backend shows the level signed in', async () => {
      startFlow();
      vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
        type: ToolsetOAuthResultType.Cancelled,
      });
      getToolset.mockResolvedValue({
        authSettings: { userLevelAuthStatus: 'SIGNED_IN' },
      });
      const { result } = renderToolsetLogin();

      const outcome = await result.current.login({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.OAuth,
      });

      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.Success });
      expect(emitToolsetLoginSuccess).toHaveBeenCalledWith({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
      });
    });

    it('re-verifies the global status for a GLOBAL-level login', async () => {
      startFlow();
      vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
        type: ToolsetOAuthResultType.Cancelled,
      });
      getToolset.mockResolvedValue({
        authSettings: {
          globalAuthStatus: 'SIGNED_IN',
          userLevelAuthStatus: 'SIGNED_OUT',
        },
      });
      const { result } = renderToolsetLogin();

      const outcome = await result.current.login({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.Global,
        authenticationType: ToolsetAuthTypes.OAuth,
      });

      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.Success });
    });

    it('stays cancelled when the backend still shows the level signed out', async () => {
      startFlow();
      vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
        type: ToolsetOAuthResultType.Cancelled,
      });
      getToolset.mockResolvedValue({
        authSettings: { userLevelAuthStatus: 'SIGNED_OUT' },
      });
      const { result } = renderToolsetLogin();

      const outcome = await result.current.login({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.OAuth,
      });

      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.Cancelled });
      expect(emitToolsetLoginSuccess).not.toHaveBeenCalled();
    });

    it('stays cancelled when the verification request rejects', async () => {
      startFlow();
      vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
        type: ToolsetOAuthResultType.Cancelled,
      });
      getToolset.mockRejectedValue(new Error('offline'));
      const { result } = renderToolsetLogin();

      const outcome = await result.current.login({
        toolsetId: TOOLSET_ID,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.OAuth,
      });

      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.Cancelled });
    });
  });
});
