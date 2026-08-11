import type { DialToolsetDto } from '@epam/ai-dial-chat-api-client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps, Ref } from 'react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TOOLSET_REDIRECT_STATE_KEY,
  ToolsetCredentialsLevel,
} from '../../../constants/toolsets';
import * as UserContextModule from '../../../context/auth/UserContext';
import * as ThemeContextModule from '../../../context/ThemeContext';
import * as deploymentsApi from '../../../server-api/deployments';
import * as toolsetsApi from '../../../server-api/toolsets';
import { AppsEditorEvent } from '../../../types/apps-editor';
import { AuthStatus } from '../../../types/auth-status';
import { emitToolsetLoginSuccess } from '../../../utils/toolset-login-events';
import { getToolsetOAuthChannelName } from '../../../utils/toolsets';
import type { AppEditorIframeHandle } from '../AppEditorIframe';
import AppEditorIframe from '../AppEditorIframe';

vi.mock('../../../context/auth/UserContext');
vi.mock('../../../context/ThemeContext');
vi.mock('../../../server-api/toolsets', () => ({
  getToolset: vi.fn(),
  logoutToolset: vi.fn(),
}));
vi.mock('../../../server-api/deployments', () => ({
  getDeploymentDetails: vi.fn(),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  Spinner: ({ ariaLabel }: { ariaLabel?: string }) => (
    <div role="status" aria-label={ariaLabel ?? 'Loading'} />
  ),
}));

const mockUseUser = vi.mocked(UserContextModule.useUser);
const mockUseTheme = vi.mocked(ThemeContextModule.useTheme);

const SCHEMA = {
  id: 'quickapps2-schema',
  displayName: 'QuickApp',
  editorUrl: 'https://editor.example.com',
};

const DEFAULT_PROPS = {
  schema: SCHEMA,
  appId: 'abc',
  onUpdated: vi.fn(),
};

const renderIframe = (
  props?: Partial<ComponentProps<typeof AppEditorIframe>>,
  ref?: Ref<AppEditorIframeHandle>,
) => render(<AppEditorIframe {...DEFAULT_PROPS} {...props} ref={ref} />);

describe('AppEditorIframe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'local', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      setTheme: vi.fn(),
      isLoading: false,
    });
  });

  it('builds iframe src with correct auth params', () => {
    renderIframe();
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    const url = new URL(iframe.src);
    expect(url.searchParams.get('authProvider')).toBe('local');
    expect(url.searchParams.get('id')).toBe('abc');
    expect(url.searchParams.get('theme')).toBe('dark');
  });

  it('shows spinner on mount', () => {
    renderIframe();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('hides spinner after iframe load event', () => {
    renderIframe();
    const iframe = screen.getByTitle('QuickApp');
    fireEvent.load(iframe);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hides spinner after readyToInteract postMessage', () => {
    renderIframe();
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToInteract}`,
        },
        origin: 'https://editor.example.com',
      }),
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('calls onUpdated when updatedApplicationSuccess message arrives', () => {
    const onUpdated = vi.fn();
    renderIframe({ onUpdated });
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.UpdatedSuccess}`,
        },
        origin: 'https://editor.example.com',
      }),
    );
    expect(onUpdated).toHaveBeenCalledOnce();
  });

  it('calls onSaveSuccess with hasChanges: true when the SaveSuccess message carries it', () => {
    const onSaveSuccess = vi.fn();
    renderIframe({ onSaveSuccess });
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: AppsEditorEvent.SaveSuccess, hasChanges: true },
        origin: 'https://editor.example.com',
      }),
    );
    expect(onSaveSuccess).toHaveBeenCalledWith(true);
  });

  it('calls onSaveSuccess with hasChanges: false when the SaveSuccess message carries it', () => {
    const onSaveSuccess = vi.fn();
    renderIframe({ onSaveSuccess });
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: AppsEditorEvent.SaveSuccess, hasChanges: false },
        origin: 'https://editor.example.com',
      }),
    );
    expect(onSaveSuccess).toHaveBeenCalledWith(false);
  });

  it('normalizes a missing hasChanges field on SaveSuccess to false', () => {
    const onSaveSuccess = vi.fn();
    renderIframe({ onSaveSuccess });
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: AppsEditorEvent.SaveSuccess },
        origin: 'https://editor.example.com',
      }),
    );
    expect(onSaveSuccess).toHaveBeenCalledWith(false);
  });

  it('ignores messages from a different origin', () => {
    const onUpdated = vi.fn();
    renderIframe({ onUpdated });
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToInteract}`,
        },
        origin: 'https://evil.example.com',
      }),
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('removes message listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderIframe();
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'message',
      expect.any(Function),
    );
  });
});

describe('AppEditorIframe — ready-to-save readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'local', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      setTheme: vi.fn(),
      isLoading: false,
    });
  });

  it('does not report ready when only readyToInteract arrives', () => {
    const onReadyChange = vi.fn();
    renderIframe({ onReadyChange });
    onReadyChange.mockClear();

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToInteract}`,
        },
        origin: 'https://editor.example.com',
      }),
    );

    expect(onReadyChange).not.toHaveBeenCalledWith(true);
  });

  it('reports ready once readyToSave arrives', () => {
    const onReadyChange = vi.fn();
    renderIframe({ onReadyChange });

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToSave}`,
        },
        origin: 'https://editor.example.com',
      }),
    );

    expect(onReadyChange).toHaveBeenCalledWith(true);
  });

  it('re-gates readiness to false when the iframe reloads for a different app', () => {
    const onReadyChange = vi.fn();
    const { rerender } = render(
      <AppEditorIframe {...DEFAULT_PROPS} onReadyChange={onReadyChange} />,
    );

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToSave}`,
        },
        origin: 'https://editor.example.com',
      }),
    );
    expect(onReadyChange).toHaveBeenCalledWith(true);
    onReadyChange.mockClear();

    rerender(
      <AppEditorIframe
        {...DEFAULT_PROPS}
        appId="different-app"
        onReadyChange={onReadyChange}
      />,
    );

    expect(onReadyChange).toHaveBeenCalledWith(false);
  });

  it('ignores a readyToSave message from a different origin', () => {
    const onReadyChange = vi.fn();
    renderIframe({ onReadyChange });

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToSave}`,
        },
        origin: 'https://evil.example.com',
      }),
    );

    expect(onReadyChange).not.toHaveBeenCalledWith(true);
  });

  it('reports logged out once a loggedOut message arrives', () => {
    const onLoggedOutChange = vi.fn();
    renderIframe({ onLoggedOutChange });

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.LoggedOut}`,
        },
        origin: 'https://editor.example.com',
      }),
    );

    expect(onLoggedOutChange).toHaveBeenCalledWith(true);
  });

  it('ignores a loggedOut message from a different origin', () => {
    const onLoggedOutChange = vi.fn();
    renderIframe({ onLoggedOutChange });

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.LoggedOut}`,
        },
        origin: 'https://evil.example.com',
      }),
    );

    expect(onLoggedOutChange).not.toHaveBeenCalledWith(true);
  });

  it('re-gates logged-out to false when the iframe reloads for a different app', () => {
    const onLoggedOutChange = vi.fn();
    const { rerender } = render(
      <AppEditorIframe
        {...DEFAULT_PROPS}
        onLoggedOutChange={onLoggedOutChange}
      />,
    );

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.LoggedOut}`,
        },
        origin: 'https://editor.example.com',
      }),
    );
    expect(onLoggedOutChange).toHaveBeenCalledWith(true);
    onLoggedOutChange.mockClear();

    rerender(
      <AppEditorIframe
        {...DEFAULT_PROPS}
        appId="different-app"
        onLoggedOutChange={onLoggedOutChange}
      />,
    );

    expect(onLoggedOutChange).toHaveBeenCalledWith(false);
  });
});

describe('AppEditorIframe — triggerSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'local', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      setTheme: vi.fn(),
      isLoading: false,
    });
  });

  it('posts TriggerSave with the given general payload', () => {
    const ref = createRef<AppEditorIframeHandle>();
    renderIframe({}, ref);
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

    ref.current?.triggerSave({ name: 'My App', description: 'desc' });

    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        type: AppsEditorEvent.TriggerSave,
        general: { name: 'My App', description: 'desc' },
      },
      'https://editor.example.com',
    );
  });

  it('posts TriggerSave with no general payload when none is passed', () => {
    const ref = createRef<AppEditorIframeHandle>();
    renderIframe({}, ref);
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );

    ref.current?.triggerSave();

    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: AppsEditorEvent.TriggerSave, general: undefined },
      'https://editor.example.com',
    );
  });
});

describe('AppEditorIframe — toolset login request', () => {
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

  const postOAuthResult = (
    flowId: string,
    message: Record<string, unknown>,
  ) => {
    const channel = new BroadcastChannel(getToolsetOAuthChannelName(flowId));
    channel.postMessage(message);
    channel.close();
  };

  const sendLoginRequest = (toolsetId: string) => {
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: AppsEditorEvent.RequestToolsetLogin, toolsetId },
        origin: 'https://editor.example.com',
      }),
    );
  };

  let capturedPopup: ReturnType<typeof makeFakePopup> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'local', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      setTheme: vi.fn(),
      isLoading: false,
    });
    capturedPopup = undefined;
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: vi.fn(() => {
        capturedPopup = makeFakePopup();
        return capturedPopup;
      }),
    });
    // Best-effort credentials refresh: default to failing harmlessly unless a test opts in.
    vi.mocked(deploymentsApi.getDeploymentDetails).mockRejectedValue(
      new Error('not mocked'),
    );
  });

  const renderAndSpyOnIframe = () => {
    renderIframe();
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    return vi.spyOn(iframe.contentWindow as Window, 'postMessage');
  };

  it('posts popup-blocked without calling getToolset when the browser blocks the popup', async () => {
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: vi.fn(() => null),
    });
    const postMessageSpy = renderAndSpyOnIframe();

    sendLoginRequest('toolsets/b/my__1.0.0');

    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AppsEditorEvent.ToolsetLoginResult,
          toolsetId: 'toolsets/b/my__1.0.0',
          success: false,
          reason: 'popup-blocked',
        }),
        'https://editor.example.com',
      ),
    );
    expect(toolsetsApi.getToolset).not.toHaveBeenCalled();
  });

  it('closes the popup and posts not-oauth when the toolset does not use OAuth', async () => {
    vi.mocked(toolsetsApi.getToolset).mockResolvedValue({
      id: 't',
      toolset: 't',
      authSettings: { authenticationType: 'API_KEY' },
    } as DialToolsetDto);
    const postMessageSpy = renderAndSpyOnIframe();

    sendLoginRequest('toolsets/b/my__1.0.0');

    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AppsEditorEvent.ToolsetLoginResult,
          success: false,
          reason: 'not-oauth',
        }),
        'https://editor.example.com',
      ),
    );
    expect(capturedPopup?.close).toHaveBeenCalledOnce();
  });

  it('percent-encodes the raw toolsetId before calling getToolset, but echoes the raw id back to the iframe', async () => {
    vi.mocked(toolsetsApi.getToolset).mockResolvedValue({
      id: 't',
      toolset: 't',
      authSettings: { authenticationType: 'API_KEY' },
    } as DialToolsetDto);
    const postMessageSpy = renderAndSpyOnIframe();

    sendLoginRequest('toolsets/b/My Toolset__1.0.0');

    await waitFor(() =>
      expect(toolsetsApi.getToolset).toHaveBeenCalledWith(
        'toolsets/b/My%20Toolset__1.0.0',
      ),
    );
    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toolsetId: 'toolsets/b/My Toolset__1.0.0',
          success: false,
          reason: 'not-oauth',
        }),
        'https://editor.example.com',
      ),
    );
  });

  it('closes the popup and posts toolset-fetch-failed when getToolset rejects', async () => {
    vi.mocked(toolsetsApi.getToolset).mockRejectedValue(new Error('boom'));
    const postMessageSpy = renderAndSpyOnIframe();

    sendLoginRequest('toolsets/b/my__1.0.0');

    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          reason: 'toolset-fetch-failed',
        }),
        'https://editor.example.com',
      ),
    );
    expect(capturedPopup?.close).toHaveBeenCalledOnce();
  });

  it('opens a popup, logs in via OAuth, and posts a success result once the flow channel reports success', async () => {
    vi.mocked(toolsetsApi.getToolset).mockResolvedValue({
      id: 't',
      toolset: 't',
      authSettings: {
        authenticationType: 'OAUTH',
        clientId: 'client',
        authorizationEndpoint: 'https://auth.example.com/authorize',
      },
    } as DialToolsetDto);
    const postMessageSpy = renderAndSpyOnIframe();

    sendLoginRequest('toolsets/b/my__1.0.0');

    await waitFor(() => expect(capturedPopup).toBeDefined());
    const flowId = JSON.parse(
      capturedPopup?.sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY) ?? '{}',
    ).state;

    postOAuthResult(flowId, {
      type: 'success',
      toolsetId: 'toolsets/b/my__1.0.0',
      credentialsLevel: 'USER',
    });

    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AppsEditorEvent.ToolsetLoginResult,
          toolsetId: 'toolsets/b/my__1.0.0',
          success: true,
          credentialsLevel: 'USER',
        }),
        'https://editor.example.com',
      ),
    );
  });

  it('refetches toolset details the same way Catalog does and includes credentials in the success result', async () => {
    vi.mocked(toolsetsApi.getToolset).mockResolvedValue({
      id: 't',
      toolset: 't',
      authSettings: {
        authenticationType: 'OAUTH',
        clientId: 'client',
        authorizationEndpoint: 'https://auth.example.com/authorize',
      },
    } as DialToolsetDto);
    vi.mocked(deploymentsApi.getDeploymentDetails).mockResolvedValue({
      id: 'toolsets/b/my__1.0.0',
      type: 'toolset',
      toolsetDetails: {
        authSettings: { userLevelAuthStatus: 'SIGNED_IN' },
      },
    } as never);
    const postMessageSpy = renderAndSpyOnIframe();

    sendLoginRequest('toolsets/b/my__1.0.0');

    await waitFor(() => expect(capturedPopup).toBeDefined());
    const flowId = JSON.parse(
      capturedPopup?.sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY) ?? '{}',
    ).state;

    postOAuthResult(flowId, {
      type: 'success',
      toolsetId: 'toolsets/b/my__1.0.0',
      credentialsLevel: 'USER',
    });

    await waitFor(() =>
      expect(deploymentsApi.getDeploymentDetails).toHaveBeenCalledWith(
        'toolsets/b/my__1.0.0',
      ),
    );
    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          credentials: expect.objectContaining({
            userStatus: 'SIGNED_IN',
          }),
        }),
        'https://editor.example.com',
      ),
    );
  });

  it('posts a failure result with the reported reason when the OAuth login fails', async () => {
    vi.mocked(toolsetsApi.getToolset).mockResolvedValue({
      id: 't',
      toolset: 't',
      authSettings: {
        authenticationType: 'OAUTH',
        clientId: 'client',
        authorizationEndpoint: 'https://auth.example.com/authorize',
      },
    } as DialToolsetDto);
    const postMessageSpy = renderAndSpyOnIframe();

    sendLoginRequest('toolsets/b/my__1.0.0');

    await waitFor(() => expect(capturedPopup).toBeDefined());
    const flowId = JSON.parse(
      capturedPopup?.sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY) ?? '{}',
    ).state;

    postOAuthResult(flowId, {
      type: 'failure',
      reason: 'login-request-failed',
    });

    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          reason: 'login-request-failed',
        }),
        'https://editor.example.com',
      ),
    );
  });

  it('recovers a login that actually succeeded but was reported as Cancelled by a lost broadcast message', async () => {
    vi.mocked(toolsetsApi.getToolset)
      .mockResolvedValueOnce({
        id: 't',
        toolset: 't',
        authSettings: {
          authenticationType: 'OAUTH',
          clientId: 'client',
          authorizationEndpoint: 'https://auth.example.com/authorize',
        },
      } as DialToolsetDto)
      .mockResolvedValueOnce({
        id: 't',
        toolset: 't',
        authSettings: { userLevelAuthStatus: 'SIGNED_IN' },
      } as DialToolsetDto);
    const postMessageSpy = renderAndSpyOnIframe();

    sendLoginRequest('toolsets/b/my__1.0.0');

    await waitFor(() => expect(capturedPopup).toBeDefined());
    if (capturedPopup) capturedPopup.closed = true;
    window.dispatchEvent(new Event('focus'));

    await waitFor(
      () =>
        expect(postMessageSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            credentialsLevel: 'USER',
          }),
          'https://editor.example.com',
        ),
      { timeout: 2000 },
    );
  });

  it('posts a cancelled failure when the recheck finds the toolset still signed out', async () => {
    vi.mocked(toolsetsApi.getToolset)
      .mockResolvedValueOnce({
        id: 't',
        toolset: 't',
        authSettings: {
          authenticationType: 'OAUTH',
          clientId: 'client',
          authorizationEndpoint: 'https://auth.example.com/authorize',
        },
      } as DialToolsetDto)
      .mockResolvedValueOnce({
        id: 't',
        toolset: 't',
        authSettings: { userLevelAuthStatus: 'SIGNED_OUT' },
      } as DialToolsetDto);
    const postMessageSpy = renderAndSpyOnIframe();

    sendLoginRequest('toolsets/b/my__1.0.0');

    await waitFor(() => expect(capturedPopup).toBeDefined());
    if (capturedPopup) capturedPopup.closed = true;
    window.dispatchEvent(new Event('focus'));

    await waitFor(
      () =>
        expect(postMessageSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            reason: 'cancelled',
          }),
          'https://editor.example.com',
        ),
      { timeout: 2000 },
    );
  });
});

describe('AppEditorIframe — toolset logout request', () => {
  const sendLogoutRequest = (toolsetId: string) => {
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: AppsEditorEvent.RequestToolsetLogout, toolsetId },
        origin: 'https://editor.example.com',
      }),
    );
  };

  const renderAndSpyOnIframe = () => {
    renderIframe();
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    return vi.spyOn(iframe.contentWindow as Window, 'postMessage');
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'local', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      setTheme: vi.fn(),
      isLoading: false,
    });
    vi.mocked(deploymentsApi.getDeploymentDetails).mockRejectedValue(
      new Error('not mocked'),
    );
  });

  it('percent-encodes the raw toolsetId, calls logoutToolset without authenticationType, and posts a success result echoing the raw id', async () => {
    vi.mocked(toolsetsApi.logoutToolset).mockResolvedValue({ success: true });
    const postMessageSpy = renderAndSpyOnIframe();

    sendLogoutRequest('toolsets/b/My Toolset__1.0.0');

    await waitFor(() =>
      expect(toolsetsApi.logoutToolset).toHaveBeenCalledWith(
        'toolsets/b/My%20Toolset__1.0.0',
        {
          url: 'toolsets/b/My%20Toolset__1.0.0',
          credentialsLevel: 'USER',
        },
      ),
    );
    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AppsEditorEvent.ToolsetLogoutResult,
          toolsetId: 'toolsets/b/My Toolset__1.0.0',
          success: true,
          credentialsLevel: 'USER',
        }),
        'https://editor.example.com',
      ),
    );
  });

  it('includes refreshed credentials from getDeploymentDetails in the success result', async () => {
    vi.mocked(toolsetsApi.logoutToolset).mockResolvedValue({ success: true });
    vi.mocked(deploymentsApi.getDeploymentDetails).mockResolvedValue({
      id: 'toolsets/b/my__1.0.0',
      type: 'toolset',
      toolsetDetails: {
        authSettings: { userLevelAuthStatus: 'SIGNED_OUT' },
      },
    } as never);
    const postMessageSpy = renderAndSpyOnIframe();

    sendLogoutRequest('toolsets/b/my__1.0.0');

    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          credentials: expect.objectContaining({
            userStatus: 'SIGNED_OUT',
          }),
        }),
        'https://editor.example.com',
      ),
    );
  });

  it('posts a logout-failed result when logoutToolset rejects', async () => {
    vi.mocked(toolsetsApi.logoutToolset).mockRejectedValue(
      new Error('network error'),
    );
    const postMessageSpy = renderAndSpyOnIframe();

    sendLogoutRequest('toolsets/b/my__1.0.0');

    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AppsEditorEvent.ToolsetLogoutResult,
          toolsetId: 'toolsets/b/my__1.0.0',
          success: false,
          reason: 'logout-failed',
        }),
        'https://editor.example.com',
      ),
    );
  });

  it('ignores a logout request from a different origin', async () => {
    renderIframe();
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: AppsEditorEvent.RequestToolsetLogout,
          toolsetId: 'toolsets/b/my__1.0.0',
        },
        origin: 'https://evil.example.com',
      }),
    );
    expect(toolsetsApi.logoutToolset).not.toHaveBeenCalled();
  });
});

describe('AppEditorIframe — toolset login broadcast', () => {
  const renderAndSpyOnIframe = () => {
    renderIframe();
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    return vi.spyOn(iframe.contentWindow as Window, 'postMessage');
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'local', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      setTheme: vi.fn(),
      isLoading: false,
    });
    vi.mocked(deploymentsApi.getDeploymentDetails).mockRejectedValue(
      new Error('not mocked'),
    );
  });

  it('posts a ToolsetLoginResult with refreshed credentials when a login succeeds elsewhere in the app', async () => {
    vi.mocked(deploymentsApi.getDeploymentDetails).mockResolvedValue({
      id: 'toolsets/b/My%20Toolset__1.0.0',
      type: 'toolset',
      toolsetDetails: {
        authSettings: { userLevelAuthStatus: 'SIGNED_IN' },
      },
    } as never);
    const postMessageSpy = renderAndSpyOnIframe();

    emitToolsetLoginSuccess({
      toolsetId: 'toolsets/b/My%20Toolset__1.0.0',
      credentialsLevel: ToolsetCredentialsLevel.User,
    });

    await waitFor(() =>
      expect(deploymentsApi.getDeploymentDetails).toHaveBeenCalledWith(
        'toolsets/b/My%20Toolset__1.0.0',
      ),
    );
    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          type: AppsEditorEvent.ToolsetLoginResult,
          toolsetId: 'toolsets/b/My Toolset__1.0.0',
          success: true,
          credentialsLevel: ToolsetCredentialsLevel.User,
          credentials: expect.objectContaining({ userStatus: 'SIGNED_IN' }),
        },
        'https://editor.example.com',
      ),
    );
  });

  it('still posts a success result when the credentials refresh fails', async () => {
    const postMessageSpy = renderAndSpyOnIframe();

    emitToolsetLoginSuccess({
      toolsetId: 'toolsets/b/my__1.0.0',
      credentialsLevel: ToolsetCredentialsLevel.Global,
    });

    await waitFor(() =>
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          type: AppsEditorEvent.ToolsetLoginResult,
          toolsetId: 'toolsets/b/my__1.0.0',
          success: true,
          credentialsLevel: ToolsetCredentialsLevel.Global,
          credentials: undefined,
        },
        'https://editor.example.com',
      ),
    );
  });

  it('unsubscribes on unmount and does not post after the iframe is gone', async () => {
    const { unmount } = renderIframe();
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    const postMessageSpy = vi.spyOn(
      iframe.contentWindow as Window,
      'postMessage',
    );
    unmount();

    emitToolsetLoginSuccess({
      toolsetId: 'toolsets/b/my__1.0.0',
      credentialsLevel: ToolsetCredentialsLevel.User,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(postMessageSpy).not.toHaveBeenCalled();
  });
});
