import type { DialToolsetDto } from '@epam/chat-api-client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TOOLSET_REDIRECT_STATE_KEY } from '../../../constants/toolsets';
import * as UserContextModule from '../../../context/auth/UserContext';
import * as ThemeContextModule from '../../../context/ThemeContext';
import * as deploymentsApi from '../../../server-api/deployments';
import * as toolsetsApi from '../../../server-api/toolsets';
import { AppsEditorEvent } from '../../../types/apps-editor';
import { AuthStatus } from '../../../types/auth-status';
import { getToolsetOAuthChannelName } from '../../../utils/toolsets';
import AppEditorIframe from '../AppEditorIframe';

vi.mock('../../../context/auth/UserContext');
vi.mock('../../../context/ThemeContext');
vi.mock('../../../server-api/toolsets', () => ({
  getToolset: vi.fn(),
}));
vi.mock('../../../server-api/deployments', () => ({
  getDeploymentDetails: vi.fn(),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DialSpinner: ({ ariaLabel }: { ariaLabel?: string }) => (
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

const renderIframe = (props?: Partial<typeof DEFAULT_PROPS>) =>
  render(<AppEditorIframe {...DEFAULT_PROPS} {...props} />);

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

  const postOAuthResult = (flowId: string, message: Record<string, unknown>) => {
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
      capturedPopup?.sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY) ??
        '{}',
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
      capturedPopup?.sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY) ??
        '{}',
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
