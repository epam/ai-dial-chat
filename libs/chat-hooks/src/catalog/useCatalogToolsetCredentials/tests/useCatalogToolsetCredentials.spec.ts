import type { CatalogItem } from '@epam/ai-dial-catalog';
import {
  CredentialsLevel,
  ToolsetAuthenticationType,
} from '@epam/ai-dial-catalog';
import type { DialToolsetDto } from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getToolsetOAuthChannelName } from '../../../oauth/handshake';
import {
  ToolsetOAuthCallbackQuery,
  ToolsetOAuthResultType,
} from '../../../oauth/types';
import {
  ToolsetLoginOutcomeType,
  useToolsetLogin,
} from '../../../oauth/useToolsetLogin/useToolsetLogin';
import type { ToolsetCredentialsLabels } from '../useCatalogToolsetCredentials';
import { useCatalogToolsetCredentials } from '../useCatalogToolsetCredentials';

/*
 * Real by default (every OAuth-flow test below relies on the genuine
 * popup/broadcast handshake); overridden with `mockReturnValueOnce` only in
 * the dedicated Cancelled-outcome test.
 */
vi.mock(
  '../../../oauth/useToolsetLogin/useToolsetLogin',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../oauth/useToolsetLogin/useToolsetLogin')
      >();
    return { ...actual, useToolsetLogin: vi.fn(actual.useToolsetLogin) };
  },
);

/** Minimal fake popup `Window` — enough surface for `initiateOAuthLogin`/`waitForToolsetOAuthResult`. */
const makeFakePopup = () => {
  const store = new Map<string, string>();
  return {
    sessionStorage: {
      setItem: (key: string, value: string) => store.set(key, value),
      getItem: (key: string) => store.get(key) ?? null,
    },
    location: { href: '' },
    opener: window,
    closed: false,
    close: vi.fn(),
  };
};

const postOAuthResult = (flowId: string, message: Record<string, unknown>) => {
  const channel = new BroadcastChannel(getToolsetOAuthChannelName(flowId));
  channel.postMessage(message);
  channel.close();
};

const CALLBACK_PATH = '/toolsets/sign-in';

const formatUser = (params: { name: string; version?: string }) =>
  `user:${params.name}:${params.version}`;
const formatOrg = (params: { name: string; version?: string }) =>
  `org:${params.name}:${params.version}`;
const formatGlobal = (params: { name: string; version?: string }) =>
  `global:${params.name}:${params.version}`;

const labels: ToolsetCredentialsLabels = {
  loginSuccessTitle: 'login-success-title',
  loginSuccess: { user: formatUser, org: formatOrg, global: formatGlobal },
  apiKeyAddedSuccessTitle: 'api-key-added-title',
  apiKeyAddedSuccess: {
    user: formatUser,
    org: formatOrg,
    global: formatGlobal,
  },
  logoutSuccessTitle: 'logout-success-title',
  logoutSuccess: { user: formatUser, org: formatOrg, global: formatGlobal },
  apiKeyDeletedSuccessTitle: 'api-key-deleted-title',
  apiKeyDeletedSuccess: {
    user: formatUser,
    org: formatOrg,
    global: formatGlobal,
  },
  popupBlockedError: 'popup-blocked-error',
  loginFailedError: 'login-failed-error',
  logoutFailedError: 'logout-failed-error',
};

const makeCatalogItem = (overrides?: Partial<CatalogItem>): CatalogItem => ({
  id: 'toolsets/public/search__0.0.1',
  type: CatalogEntityType.Toolset,
  name: 'Search',
  version: '1.0.0',
  lastUsed: 'now',
  description: '',
  folder: [],
  topics: [],
  isMyApp: true,
  credentials: { authenticationType: ToolsetAuthenticationType.ApiKey },
  ...overrides,
});

describe('useCatalogToolsetCredentials', () => {
  let capturedPopup: ReturnType<typeof makeFakePopup> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedPopup = undefined;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { origin: 'http://localhost', href: 'http://localhost/' },
    });
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: vi.fn(() => {
        capturedPopup = makeFakePopup();
        return capturedPopup;
      }),
    });
  });

  const renderCredentials = (
    overrides: Partial<Parameters<typeof useCatalogToolsetCredentials>[0]> = {},
  ) => {
    const onNotify = vi.fn();
    const refetchToolsets = vi.fn().mockResolvedValue(undefined);
    const loginToolset = vi.fn().mockResolvedValue({ success: true });
    const logoutToolset = vi.fn().mockResolvedValue({ success: true });
    const getToolset = vi.fn();
    const view = renderHook(() =>
      useCatalogToolsetCredentials({
        isAdmin: false,
        toolsets: [],
        refetchToolsets,
        callbackPath: CALLBACK_PATH,
        loginToolset,
        logoutToolset,
        getToolset,
        labels,
        onNotify,
        ...overrides,
      }),
    );
    return {
      ...view,
      onNotify,
      refetchToolsets,
      loginToolset,
      logoutToolset,
      getToolset,
    };
  };

  it('calls loginToolset with credentialsLevel USER for a USER-level login and refetches toolsets', async () => {
    const toolsets: DialToolsetDto[] = [
      {
        id: 'toolsets/public/search__0.0.1',
        toolset: 'toolsets/public/search__0.0.1',
        displayName: 'Search',
        authSettings: { authenticationType: 'API_KEY' },
      } as DialToolsetDto,
    ];
    const { result, loginToolset, refetchToolsets } = renderCredentials({
      toolsets,
    });

    await act(async () => {
      await result.current.handleLogin(makeCatalogItem(), {
        level: CredentialsLevel.User,
        apiKey: 'k',
      });
    });

    expect(loginToolset).toHaveBeenCalledWith(
      'toolsets/public/search__0.0.1',
      expect.objectContaining({ credentialsLevel: 'USER', apiKey: 'k' }),
    );
    expect(refetchToolsets).toHaveBeenCalledOnce();
  });

  it('calls loginToolset with credentialsLevel GLOBAL for a GLOBAL-level login', async () => {
    const toolsets: DialToolsetDto[] = [
      {
        id: 'toolsets/public/search__0.0.1',
        toolset: 'toolsets/public/search__0.0.1',
        displayName: 'Search',
        authSettings: { authenticationType: 'API_KEY' },
      } as DialToolsetDto,
    ];
    const { result, loginToolset } = renderCredentials({ toolsets });

    await act(async () => {
      await result.current.handleLogin(makeCatalogItem(), {
        level: CredentialsLevel.Global,
        apiKey: 'k',
      });
    });

    expect(loginToolset).toHaveBeenCalledWith(
      'toolsets/public/search__0.0.1',
      expect.objectContaining({ credentialsLevel: 'GLOBAL' }),
    );
  });

  it('shows the API-key-added success notification, formatted for the requested level', async () => {
    const toolsets: DialToolsetDto[] = [
      {
        id: 'toolsets/public/search__0.0.1',
        toolset: 'toolsets/public/search__0.0.1',
        displayName: 'Search',
        authSettings: { authenticationType: 'API_KEY' },
      } as DialToolsetDto,
    ];
    const { result, onNotify } = renderCredentials({ toolsets });

    await act(async () => {
      await result.current.handleLogin(makeCatalogItem(), {
        level: CredentialsLevel.User,
        apiKey: 'k',
      });
    });

    expect(onNotify).toHaveBeenCalledWith({
      variant: NotificationVariant.Success,
      title: 'api-key-added-title',
      message: 'user:Search:1.0.0',
    });
  });

  it('calls logoutToolset with the requested level and refetches toolsets', async () => {
    const { result, logoutToolset, refetchToolsets } = renderCredentials();

    await act(async () => {
      await result.current.handleLogout(makeCatalogItem(), {
        level: CredentialsLevel.User,
      });
    });

    expect(logoutToolset).toHaveBeenCalledWith(
      'toolsets/public/search__0.0.1',
      expect.objectContaining({ credentialsLevel: 'USER' }),
    );
    expect(refetchToolsets).toHaveBeenCalledOnce();
  });

  it('shows the API-key-deleted success notification on logout', async () => {
    const { result, onNotify } = renderCredentials();

    await act(async () => {
      await result.current.handleLogout(makeCatalogItem(), {
        level: CredentialsLevel.Global,
      });
    });

    expect(onNotify).toHaveBeenCalledWith({
      variant: NotificationVariant.Success,
      title: 'api-key-deleted-title',
      message: 'global:Search:1.0.0',
    });
  });

  it('shows an error notification when loginToolset rejects', async () => {
    const toolsets: DialToolsetDto[] = [
      {
        id: 'toolsets/public/search__0.0.1',
        toolset: 'toolsets/public/search__0.0.1',
        displayName: 'Search',
        authSettings: { authenticationType: 'API_KEY' },
      } as DialToolsetDto,
    ];
    const loginToolset = vi.fn().mockRejectedValue(new Error('network error'));
    const { result, onNotify } = renderCredentials({
      toolsets,
      loginToolset,
    });

    await act(async () => {
      await result.current.handleLogin(makeCatalogItem(), {
        level: CredentialsLevel.User,
        apiKey: 'k',
      });
    });

    expect(onNotify).toHaveBeenCalledWith({
      variant: NotificationVariant.Error,
      message: 'login-failed-error',
    });
  });

  it('shows an error notification when logoutToolset rejects', async () => {
    const logoutToolset = vi.fn().mockRejectedValue(new Error('network error'));
    const { result, onNotify } = renderCredentials({ logoutToolset });

    await act(async () => {
      await result.current.handleLogout(makeCatalogItem(), {
        level: CredentialsLevel.User,
      });
    });

    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: NotificationVariant.Error,
        message: 'logout-failed-error',
      }),
    );
  });

  it('returns silently, calling no notification and no refetch, on a Cancelled login outcome', async () => {
    vi.mocked(useToolsetLogin).mockReturnValueOnce({
      login: vi
        .fn()
        .mockResolvedValue({ type: ToolsetLoginOutcomeType.Cancelled }),
    });
    const { result, onNotify, refetchToolsets } = renderCredentials();

    await act(async () => {
      await result.current.handleLogin(makeCatalogItem(), {
        level: CredentialsLevel.User,
        apiKey: 'k',
      });
    });

    expect(onNotify).not.toHaveBeenCalled();
    expect(refetchToolsets).not.toHaveBeenCalled();
  });

  describe('OAuth login', () => {
    const oauthToolset = {
      id: 'toolsets/public/oauth-tool__0.0.1',
      toolset: 'toolsets/public/oauth-tool__0.0.1',
      displayName: 'OAuth Tool',
      authSettings: {
        authenticationType: 'OAUTH' as const,
        clientId: 'client-id',
        authorizationEndpoint: 'https://auth.example.com/authorize',
      },
    };

    const oauthCatalogItem = makeCatalogItem({
      id: oauthToolset.id,
      credentials: { authenticationType: ToolsetAuthenticationType.OAuth },
    });

    it('opens a popup and, on a success result, refetches toolsets and shows a success notification', async () => {
      const toolsets: DialToolsetDto[] = [oauthToolset as DialToolsetDto];
      const { result, onNotify, refetchToolsets } = renderCredentials({
        toolsets,
      });

      const loginPromise = act(async () => {
        await result.current.handleLogin(oauthCatalogItem, {
          level: CredentialsLevel.User,
        });
      });

      await waitFor(() => expect(capturedPopup).toBeDefined());
      const flowId = JSON.parse(
        capturedPopup?.sessionStorage.getItem('toolset-redirect-state') ?? '{}',
      ).state;

      postOAuthResult(flowId, {
        type: ToolsetOAuthResultType.Success,
        toolsetId: oauthToolset.id,
        credentialsLevel: 'USER',
      });

      await loginPromise;

      expect(refetchToolsets).toHaveBeenCalledOnce();
      expect(onNotify).toHaveBeenCalledWith(
        expect.objectContaining({ variant: NotificationVariant.Success }),
      );
    });

    it('shows the success notification on the first attempt when the channel event is missed', async () => {
      const toolsets: DialToolsetDto[] = [oauthToolset as DialToolsetDto];
      const { result, onNotify, refetchToolsets, getToolset } =
        renderCredentials({ toolsets });

      const loginPromise = act(async () => {
        await result.current.handleLogin(oauthCatalogItem, {
          level: CredentialsLevel.User,
        });
      });

      await waitFor(() => expect(capturedPopup).toBeDefined());
      const callbackUrl = new URL(CALLBACK_PATH, window.location.origin);
      callbackUrl.searchParams.set(
        ToolsetOAuthCallbackQuery.Result,
        ToolsetOAuthResultType.Success,
      );
      if (capturedPopup) capturedPopup.location.href = callbackUrl.toString();

      await loginPromise;

      expect(onNotify).toHaveBeenCalledWith(
        expect.objectContaining({ variant: NotificationVariant.Success }),
      );
      expect(refetchToolsets).toHaveBeenCalledOnce();
      expect(getToolset).not.toHaveBeenCalled();
    });

    it('shows an error notification and does not refetch when the OAuth result is a failure', async () => {
      const toolsets: DialToolsetDto[] = [oauthToolset as DialToolsetDto];
      const { result, onNotify, refetchToolsets } = renderCredentials({
        toolsets,
      });

      const loginPromise = act(async () => {
        await result.current.handleLogin(oauthCatalogItem, {
          level: CredentialsLevel.Global,
        });
      });

      await waitFor(() => expect(capturedPopup).toBeDefined());
      const flowId = JSON.parse(
        capturedPopup?.sessionStorage.getItem('toolset-redirect-state') ?? '{}',
      ).state;

      postOAuthResult(flowId, {
        type: 'failure',
        reason: 'login-request-failed',
      });

      await loginPromise;

      expect(onNotify).toHaveBeenCalledWith(
        expect.objectContaining({ variant: NotificationVariant.Error }),
      );
      expect(refetchToolsets).not.toHaveBeenCalled();
    });

    it('recovers a login that actually succeeded but was reported as Cancelled by a lost broadcast message', async () => {
      const toolsets: DialToolsetDto[] = [oauthToolset as DialToolsetDto];
      const getToolset = vi.fn().mockResolvedValue({
        ...oauthToolset,
        authSettings: {
          ...oauthToolset.authSettings,
          userLevelAuthStatus: 'SIGNED_IN',
        },
      });
      const { result, onNotify, refetchToolsets } = renderCredentials({
        toolsets,
        getToolset,
      });

      const loginPromise = act(async () => {
        await result.current.handleLogin(oauthCatalogItem, {
          level: CredentialsLevel.User,
        });
      });

      await waitFor(() => expect(capturedPopup).toBeDefined());
      if (capturedPopup) capturedPopup.closed = true;
      window.dispatchEvent(new Event('focus'));

      await loginPromise;

      expect(onNotify).toHaveBeenCalledWith(
        expect.objectContaining({ variant: NotificationVariant.Success }),
      );
      expect(refetchToolsets).toHaveBeenCalledOnce();
    });

    it('shows a popup-blocked error notification without waiting for a result', async () => {
      vi.mocked(window.open).mockReturnValueOnce(null);
      const toolsets: DialToolsetDto[] = [oauthToolset as DialToolsetDto];
      const { result, onNotify } = renderCredentials({ toolsets });

      await act(async () => {
        await result.current.handleLogin(oauthCatalogItem, {
          level: CredentialsLevel.User,
        });
      });

      expect(onNotify).toHaveBeenCalledWith({
        variant: NotificationVariant.Error,
        message: 'popup-blocked-error',
      });
    });
  });
});
