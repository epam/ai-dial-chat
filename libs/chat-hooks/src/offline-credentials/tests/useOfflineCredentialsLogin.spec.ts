import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitForToolsetOAuthResult } from '../../oauth/handshake';
import {
  navigateToolsetOAuthPopup,
  openToolsetOAuthPopup,
} from '../../oauth/popup';
import {
  OAuthResourceKind,
  ToolsetCredentialsLevel,
  ToolsetOAuthInitiationResultType,
  ToolsetOAuthResultType,
} from '../../oauth/types';
import {
  OfflineCredentialsLoginOutcomeType,
  useOfflineCredentialsLogin,
} from '../useOfflineCredentialsLogin/useOfflineCredentialsLogin';

vi.mock('../../oauth/popup', () => ({
  navigateToolsetOAuthPopup: vi.fn(),
  openToolsetOAuthPopup: vi.fn(),
}));

vi.mock('../../oauth/handshake', () => ({
  waitForToolsetOAuthResult: vi.fn(),
}));

const CALLBACK_PATH = '/toolset-signin';

const CONNECT = {
  clientId: 'dial-chat',
  authorizationEndpoint: 'https://identity.example.com/authorize',
  scopes: ['openid', 'offline_access'],
};

describe('useOfflineCredentialsLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns PopupBlocked without navigating or refetching when the popup is blocked', async () => {
    vi.mocked(openToolsetOAuthPopup).mockReturnValue(null);
    const refetch = vi.fn();
    const { result } = renderHook(() =>
      useOfflineCredentialsLogin({ callbackPath: CALLBACK_PATH }),
    );

    const outcome = await result.current.login(CONNECT, refetch);

    expect(outcome).toEqual({
      type: OfflineCredentialsLoginOutcomeType.PopupBlocked,
    });
    expect(navigateToolsetOAuthPopup).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('opens the popup synchronously and navigates it with the OfflineCredentials resource kind and the supplied callback path', async () => {
    const fakePopup = {} as Window;
    vi.mocked(openToolsetOAuthPopup).mockReturnValue(fakePopup);
    vi.mocked(navigateToolsetOAuthPopup).mockReturnValue({
      type: ToolsetOAuthInitiationResultType.Started,
      popup: fakePopup,
      flowId: 'flow-1',
    });
    vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
      type: ToolsetOAuthResultType.Success,
      toolsetId: 'offline-credentials',
      credentialsLevel: 'USER' as never,
    });
    const refetch = vi
      .fn()
      .mockResolvedValue({ available: true, connected: true });
    const { result } = renderHook(() =>
      useOfflineCredentialsLogin({ callbackPath: CALLBACK_PATH }),
    );

    await result.current.login(CONNECT, refetch);

    expect(openToolsetOAuthPopup).toHaveBeenCalledOnce();
    expect(navigateToolsetOAuthPopup).toHaveBeenCalledWith(
      fakePopup,
      expect.any(Object),
      'offline-credentials',
      CALLBACK_PATH,
      ToolsetCredentialsLevel.User,
      OAuthResourceKind.OfflineCredentials,
    );
  });

  it('reports Success only when the refetch confirms connected:true, even on a reported Success', async () => {
    const fakePopup = {} as Window;
    vi.mocked(openToolsetOAuthPopup).mockReturnValue(fakePopup);
    vi.mocked(navigateToolsetOAuthPopup).mockReturnValue({
      type: ToolsetOAuthInitiationResultType.Started,
      popup: fakePopup,
      flowId: 'flow-1',
    });
    vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
      type: ToolsetOAuthResultType.Success,
      toolsetId: 'offline-credentials',
      credentialsLevel: 'USER' as never,
    });
    const refetch = vi
      .fn()
      .mockResolvedValue({ available: true, connected: true });
    const { result } = renderHook(() =>
      useOfflineCredentialsLogin({ callbackPath: CALLBACK_PATH }),
    );

    const outcome = await result.current.login(CONNECT, refetch);

    expect(refetch).toHaveBeenCalledOnce();
    expect(outcome).toEqual({
      type: OfflineCredentialsLoginOutcomeType.Success,
    });
  });

  it('reports Failure when the callback reports Success but the refetch still shows disconnected', async () => {
    const fakePopup = {} as Window;
    vi.mocked(openToolsetOAuthPopup).mockReturnValue(fakePopup);
    vi.mocked(navigateToolsetOAuthPopup).mockReturnValue({
      type: ToolsetOAuthInitiationResultType.Started,
      popup: fakePopup,
      flowId: 'flow-1',
    });
    vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
      type: ToolsetOAuthResultType.Success,
      toolsetId: 'offline-credentials',
      credentialsLevel: 'USER' as never,
    });
    const refetch = vi
      .fn()
      .mockResolvedValue({ available: true, connected: false });
    const { result } = renderHook(() =>
      useOfflineCredentialsLogin({ callbackPath: CALLBACK_PATH }),
    );

    const outcome = await result.current.login(CONNECT, refetch);

    expect(outcome).toEqual({
      type: OfflineCredentialsLoginOutcomeType.Failure,
    });
  });

  it('reports Failure when the BFF sign-in call itself failed', async () => {
    const fakePopup = {} as Window;
    vi.mocked(openToolsetOAuthPopup).mockReturnValue(fakePopup);
    vi.mocked(navigateToolsetOAuthPopup).mockReturnValue({
      type: ToolsetOAuthInitiationResultType.Started,
      popup: fakePopup,
      flowId: 'flow-1',
    });
    vi.mocked(waitForToolsetOAuthResult).mockResolvedValue({
      type: ToolsetOAuthResultType.Failure,
      reason: 'login-request-failed' as never,
    });
    const refetch = vi
      .fn()
      .mockResolvedValue({ available: true, connected: false });
    const { result } = renderHook(() =>
      useOfflineCredentialsLogin({ callbackPath: CALLBACK_PATH }),
    );

    const outcome = await result.current.login(CONNECT, refetch);

    expect(refetch).toHaveBeenCalledOnce();
    expect(outcome).toEqual({
      type: OfflineCredentialsLoginOutcomeType.Failure,
    });
  });

  it('reports Cancelled when the flow is cancelled well before the timeout window', async () => {
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
    const refetch = vi
      .fn()
      .mockResolvedValue({ available: true, connected: false });
    const { result } = renderHook(() =>
      useOfflineCredentialsLogin({ callbackPath: CALLBACK_PATH }),
    );

    const outcome = await result.current.login(CONNECT, refetch);

    expect(outcome).toEqual({
      type: OfflineCredentialsLoginOutcomeType.Cancelled,
    });
  });

  it('returns Failure when navigation itself fails to start (invalid config)', async () => {
    const fakePopup = {} as Window;
    vi.mocked(openToolsetOAuthPopup).mockReturnValue(fakePopup);
    vi.mocked(navigateToolsetOAuthPopup).mockReturnValue({
      type: ToolsetOAuthInitiationResultType.InvalidConfig,
    });
    const refetch = vi.fn();
    const { result } = renderHook(() =>
      useOfflineCredentialsLogin({ callbackPath: CALLBACK_PATH }),
    );

    const outcome = await result.current.login(CONNECT, refetch);

    expect(outcome).toEqual({
      type: OfflineCredentialsLoginOutcomeType.Failure,
    });
    expect(waitForToolsetOAuthResult).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
  });
});
