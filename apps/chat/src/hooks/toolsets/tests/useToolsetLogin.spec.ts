import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthInitiationResultType,
  ToolsetOAuthResultType,
} from '../../../constants/toolsets';
import {
  getToolset,
  loginToolset,
  logoutToolset,
} from '../../../server-api/toolsets';
import { emitToolsetLoginSuccess } from '../../../utils/toolset-login-events';
import {
  initiateOAuthLogin,
  navigateToolsetOAuthPopup,
  openToolsetOAuthPopup,
  waitForToolsetOAuthResult,
} from '../../../utils/toolsets';
import { ToolsetLoginOutcomeType, useToolsetLogin } from '../useToolsetLogin';

vi.mock('../../../server-api/toolsets', () => ({
  getToolset: vi.fn(),
  loginToolset: vi.fn(),
  logoutToolset: vi.fn(),
}));

vi.mock('../../../utils/toolsets', () => ({
  initiateOAuthLogin: vi.fn(),
  navigateToolsetOAuthPopup: vi.fn(),
  openToolsetOAuthPopup: vi.fn(),
  waitForToolsetOAuthResult: vi.fn(),
}));

vi.mock('../../../utils/toolset-login-events', () => ({
  emitToolsetLoginSuccess: vi.fn(),
}));

describe('useToolsetLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API key login', () => {
    it('logs in successfully without a prior logout when not failed', async () => {
      vi.mocked(loginToolset).mockResolvedValue({ success: true });
      const { result } = renderHook(() => useToolsetLogin());

      const outcome = await result.current.login({
        toolsetId: 'toolsets/b/my-toolset',
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.ApiKey,
        apiKey: 'secret',
      });

      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.Success });
      expect(logoutToolset).not.toHaveBeenCalled();
      expect(loginToolset).toHaveBeenCalledWith('toolsets/b/my-toolset', {
        url: 'toolsets/b/my-toolset',
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.ApiKey,
        apiKey: 'secret',
      });
      expect(emitToolsetLoginSuccess).toHaveBeenCalledWith({
        toolsetId: 'toolsets/b/my-toolset',
        credentialsLevel: ToolsetCredentialsLevel.User,
      });
    });

    it('logs out first when isCurrentlyFailed is true', async () => {
      vi.mocked(logoutToolset).mockResolvedValue({ success: true });
      vi.mocked(loginToolset).mockResolvedValue({ success: true });
      const { result } = renderHook(() => useToolsetLogin());

      await result.current.login({
        toolsetId: 'toolsets/b/my-toolset',
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.ApiKey,
        apiKey: 'secret',
        isCurrentlyFailed: true,
      });

      expect(logoutToolset).toHaveBeenCalledOnce();
      expect(loginToolset).toHaveBeenCalledOnce();
    });

    it('logs out first when forceStale is true even if not currently failed', async () => {
      vi.mocked(logoutToolset).mockResolvedValue({ success: true });
      vi.mocked(loginToolset).mockResolvedValue({ success: true });
      const { result } = renderHook(() => useToolsetLogin());

      await result.current.login({
        toolsetId: 'toolsets/b/my-toolset',
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.ApiKey,
        apiKey: 'secret',
        isCurrentlyFailed: false,
        forceStale: true,
      });

      expect(logoutToolset).toHaveBeenCalledOnce();
    });

    it('returns Failure when the login call rejects', async () => {
      vi.mocked(loginToolset).mockRejectedValue(new Error('nope'));
      const { result } = renderHook(() => useToolsetLogin());

      const outcome = await result.current.login({
        toolsetId: 'toolsets/b/my-toolset',
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.ApiKey,
        apiKey: 'secret',
      });

      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.Failure });
      expect(emitToolsetLoginSuccess).not.toHaveBeenCalled();
    });
  });

  describe('OAuth login', () => {
    it('never logs out first when forceStale is not set (matches pre-refactor Catalog behavior)', async () => {
      vi.mocked(initiateOAuthLogin).mockReturnValue({
        type: ToolsetOAuthInitiationResultType.Started,
        popup: {} as Window,
        flowId: 'flow-1',
      });
      vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
        type: ToolsetOAuthResultType.Success,
        toolsetId: 'toolsets/b/my-toolset',
        credentialsLevel: ToolsetCredentialsLevel.User,
      });
      const { result } = renderHook(() => useToolsetLogin());

      const outcome = await result.current.login({
        toolsetId: 'toolsets/b/my-toolset',
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.OAuth,
      });

      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.Success });
      expect(logoutToolset).not.toHaveBeenCalled();
      expect(emitToolsetLoginSuccess).toHaveBeenCalledWith({
        toolsetId: 'toolsets/b/my-toolset',
        credentialsLevel: ToolsetCredentialsLevel.User,
      });
    });

    it('opens the popup synchronously, then logs out, then navigates it when forceStale is set', async () => {
      const fakePopup = {} as Window;
      vi.mocked(openToolsetOAuthPopup).mockReturnValue(fakePopup);
      vi.mocked(logoutToolset).mockResolvedValue({ success: true });
      vi.mocked(navigateToolsetOAuthPopup).mockReturnValue({
        type: ToolsetOAuthInitiationResultType.Started,
        popup: fakePopup,
        flowId: 'flow-1',
      });
      vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
        type: ToolsetOAuthResultType.Success,
        toolsetId: 'toolsets/b/my-toolset',
        credentialsLevel: ToolsetCredentialsLevel.User,
      });
      const { result } = renderHook(() => useToolsetLogin());

      const outcome = await result.current.login({
        toolsetId: 'toolsets/b/my-toolset',
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.OAuth,
        forceStale: true,
      });

      expect(openToolsetOAuthPopup).toHaveBeenCalledOnce();
      expect(logoutToolset).toHaveBeenCalledOnce();
      expect(navigateToolsetOAuthPopup).toHaveBeenCalledWith(
        fakePopup,
        expect.any(Object),
        'toolsets/b/my-toolset',
        ToolsetCredentialsLevel.User,
      );
      expect(initiateOAuthLogin).not.toHaveBeenCalled();
      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.Success });
    });

    it('returns PopupBlocked without logging out when the popup is blocked and forceStale is set', async () => {
      vi.mocked(openToolsetOAuthPopup).mockReturnValue(null);
      const { result } = renderHook(() => useToolsetLogin());

      const outcome = await result.current.login({
        toolsetId: 'toolsets/b/my-toolset',
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.OAuth,
        forceStale: true,
      });

      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.PopupBlocked });
      expect(logoutToolset).not.toHaveBeenCalled();
    });

    it('returns PopupBlocked when the popup is blocked', async () => {
      vi.mocked(initiateOAuthLogin).mockReturnValue({
        type: ToolsetOAuthInitiationResultType.Blocked,
      });
      const { result } = renderHook(() => useToolsetLogin());

      const outcome = await result.current.login({
        toolsetId: 'toolsets/b/my-toolset',
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.OAuth,
      });

      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.PopupBlocked });
    });

    it('re-verifies status on Cancelled and returns Success if actually signed in', async () => {
      vi.mocked(initiateOAuthLogin).mockReturnValue({
        type: ToolsetOAuthInitiationResultType.Started,
        popup: {} as Window,
        flowId: 'flow-1',
      });
      vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
        type: ToolsetOAuthResultType.Cancelled,
      });
      vi.mocked(getToolset).mockResolvedValue({
        id: 'toolsets/b/my-toolset',
        toolset: 'my-toolset',
        authSettings: { userLevelAuthStatus: 'SIGNED_IN' },
      } as never);
      const { result } = renderHook(() => useToolsetLogin());

      const outcome = await result.current.login({
        toolsetId: 'toolsets/b/my-toolset',
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.OAuth,
      });

      await waitFor(() =>
        expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.Success }),
      );
      expect(emitToolsetLoginSuccess).toHaveBeenCalledWith({
        toolsetId: 'toolsets/b/my-toolset',
        credentialsLevel: ToolsetCredentialsLevel.User,
      });
    });

    it('returns Cancelled when re-verification shows the user is still signed out', async () => {
      vi.mocked(initiateOAuthLogin).mockReturnValue({
        type: ToolsetOAuthInitiationResultType.Started,
        popup: {} as Window,
        flowId: 'flow-1',
      });
      vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
        type: ToolsetOAuthResultType.Cancelled,
      });
      vi.mocked(getToolset).mockResolvedValue({
        id: 'toolsets/b/my-toolset',
        toolset: 'my-toolset',
        authSettings: { userLevelAuthStatus: 'SIGNED_OUT' },
      } as never);
      const { result } = renderHook(() => useToolsetLogin());

      const outcome = await result.current.login({
        toolsetId: 'toolsets/b/my-toolset',
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthTypes.OAuth,
      });

      expect(outcome).toEqual({ type: ToolsetLoginOutcomeType.Cancelled });
      expect(emitToolsetLoginSuccess).not.toHaveBeenCalled();
    });
  });
});
