import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  QUICKAPPS_TOOLSET_AUTH_POPUP_NAME,
  TOOLSET_REDIRECT_STATE_KEY,
} from '../../../constants/toolsets';
import * as toolsetsApi from '../../../server-api/toolsets';
import { ROUTES } from '../../../types/routes';
import type {
  ToolsetOAuthChannelMessage,
  ToolsetPopupState,
  ToolsetRedirectState,
} from '../../../types/toolsets';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthFailureReason,
  ToolsetOAuthResultType,
} from '../../../types/toolsets';
import { getToolsetOAuthChannelName } from '../../../utils/toolsets';
import ToolsetAuthCallback from '../ToolsetAuthCallback';

const encodeBase64Url = (payload: unknown): string => {
  const json = JSON.stringify(payload);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const validPopupState: ToolsetPopupState = {
  toolsetId: 'toolsets/b/my__1.0.0',
  credentialsLevel: ToolsetCredentialsLevel.User,
  originatingOrigin: 'https://quickapps.example.com',
  nonce: 'nonce-123',
};

const setRedirectState = (state: ToolsetRedirectState) =>
  sessionStorage.setItem(TOOLSET_REDIRECT_STATE_KEY, JSON.stringify(state));

/** Listens on the flow's channel and resolves with the first message posted to it. */
const listenForResult = (flowId: string): Promise<ToolsetOAuthChannelMessage> =>
  new Promise((resolve) => {
    const channel = new BroadcastChannel(getToolsetOAuthChannelName(flowId));
    channel.onmessage = (event) => {
      resolve(event.data as ToolsetOAuthChannelMessage);
      channel.close();
    };
  });

vi.mock('../../../server-api/toolsets', () => ({
  loginToolset: vi.fn(),
}));

vi.mock('../../../components/RouteFallback/RouteFallback', () => ({
  default: () => <div>Loading</div>,
}));

const renderCallback = (
  search = '?code=test-code',
  route = '/auth/toolset-signin',
) =>
  render(
    <MemoryRouter initialEntries={[`${route}${search}`]}>
      <Routes>
        <Route
          path="/auth/toolset-signin"
          element={<ToolsetAuthCallback />}
        />
        <Route
          path="/toolset-editor/callback"
          element={<ToolsetAuthCallback />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe('ToolsetAuthCallback', () => {
  const mockClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.spyOn(window, 'close').mockImplementation(mockClose);
  });

  it('closes the window when sessionStorage state is missing', async () => {
    renderCallback();
    await waitFor(() => expect(mockClose).toHaveBeenCalledOnce());
  });

  it('closes the window when the toolsetId in state is absent', async () => {
    setRedirectState({ toolsetId: '' });
    renderCallback();
    await waitFor(() => expect(mockClose).toHaveBeenCalledOnce());
  });

  it('closes the window when the code query param is absent', async () => {
    setRedirectState({ toolsetId: 'toolsets/b/my__1.0.0' });
    renderCallback('');
    await waitFor(() => expect(mockClose).toHaveBeenCalledOnce());
  });

  it('calls loginToolset with code and redirectUri, then closes the window', async () => {
    setRedirectState({
      toolsetId: 'toolsets/b/my__1.0.0',
      credentialsLevel: ToolsetCredentialsLevel.User,
      redirectUri: 'http://localhost/auth/toolset-signin',
    });
    vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });

    renderCallback('?code=auth-code-xyz');

    await waitFor(() =>
      expect(toolsetsApi.loginToolset).toHaveBeenCalledWith(
        'toolsets/b/my__1.0.0',
        expect.objectContaining({
          authenticationType: ToolsetAuthTypes.OAuth,
          code: 'auth-code-xyz',
          redirectUri: 'http://localhost/auth/toolset-signin',
        }),
      ),
    );
    await waitFor(() => expect(mockClose).toHaveBeenCalledOnce());
  });

  it('closes the window even when loginToolset throws', async () => {
    setRedirectState({ toolsetId: 'toolsets/b/my__1.0.0' });
    vi.mocked(toolsetsApi.loginToolset).mockRejectedValue(
      new Error('network error'),
    );

    renderCallback('?code=auth-code-xyz');

    await waitFor(() => expect(mockClose).toHaveBeenCalledOnce());
  });

  it('removes the redirect state from sessionStorage after running', async () => {
    setRedirectState({ toolsetId: 'toolsets/b/my__1.0.0' });
    vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });

    renderCallback('?code=any-code');

    await waitFor(() =>
      expect(sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY)).toBeNull(),
    );
  });

  it('posts a success message on the flow channel after a successful login', async () => {
    setRedirectState({
      toolsetId: 'toolsets/b/my__1.0.0',
      credentialsLevel: ToolsetCredentialsLevel.Global,
      state: 'flow-1',
    });
    vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });

    const resultPromise = listenForResult('flow-1');
    renderCallback('?code=auth-code-xyz&state=flow-1');

    await expect(resultPromise).resolves.toEqual({
      type: ToolsetOAuthResultType.Success,
      toolsetId: 'toolsets/b/my__1.0.0',
      credentialsLevel: ToolsetCredentialsLevel.Global,
    });
  });

  it('posts a failure message on the flow channel when the OAuth state mismatches', async () => {
    setRedirectState({ toolsetId: 'toolsets/b/my__1.0.0', state: 'flow-1' });

    const resultPromise = listenForResult('flow-1');
    renderCallback('?code=auth-code-xyz&state=different-flow');

    await expect(resultPromise).resolves.toEqual({
      type: ToolsetOAuthResultType.Failure,
      reason: ToolsetOAuthFailureReason.StateMismatch,
    });
  });

  it('posts a failure message on the flow channel when the code query param is missing', async () => {
    setRedirectState({ toolsetId: 'toolsets/b/my__1.0.0', state: 'flow-1' });

    const resultPromise = listenForResult('flow-1');
    renderCallback('?state=flow-1');

    await expect(resultPromise).resolves.toEqual({
      type: ToolsetOAuthResultType.Failure,
      reason: ToolsetOAuthFailureReason.MissingCode,
    });
  });

  it('posts a failure message on the flow channel when redirect state is missing', async () => {
    const resultPromise = listenForResult('flow-1');
    renderCallback('?code=auth-code-xyz&state=flow-1');

    await expect(resultPromise).resolves.toEqual({
      type: ToolsetOAuthResultType.Failure,
      reason: ToolsetOAuthFailureReason.MissingRedirectState,
    });
  });

  it('posts a failure message on the flow channel when loginToolset rejects', async () => {
    setRedirectState({ toolsetId: 'toolsets/b/my__1.0.0', state: 'flow-1' });
    vi.mocked(toolsetsApi.loginToolset).mockRejectedValue(
      new Error('network error'),
    );

    const resultPromise = listenForResult('flow-1');
    renderCallback('?code=auth-code-xyz&state=flow-1');

    await expect(resultPromise).resolves.toEqual({
      type: ToolsetOAuthResultType.Failure,
      reason: ToolsetOAuthFailureReason.LoginRequestFailed,
    });
  });
});

describe('ToolsetAuthCallback — popup flow', () => {
  let postMessage: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn<() => void>>;

  const closeWindow = (): void => close();

  const setPopupWindow = () => {
    postMessage = vi.fn();
    close = vi.fn<() => void>();
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: { postMessage },
    });
    Object.defineProperty(window, 'name', {
      configurable: true,
      value: QUICKAPPS_TOOLSET_AUTH_POPUP_NAME,
    });
    vi.spyOn(window, 'close').mockImplementation(closeWindow);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: null,
    });
    Object.defineProperty(window, 'name', { configurable: true, value: '' });
  });

  it('logs in, posts a success message, and closes the popup', async () => {
    setPopupWindow();
    vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });
    const state = encodeBase64Url(validPopupState);

    renderCallback(`?code=auth-code-xyz&state=${state}`, '/toolset-editor/callback');

    await waitFor(() =>
      expect(toolsetsApi.loginToolset).toHaveBeenCalledWith(
        validPopupState.toolsetId,
        expect.objectContaining({
          authenticationType: ToolsetAuthTypes.OAuth,
          credentialsLevel: validPopupState.credentialsLevel,
          code: 'auth-code-xyz',
          redirectUri: expect.stringContaining(ROUTES.ToolsetEditorCallback),
        }),
      ),
    );
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        {
          type: 'quickapps/TOOLSET_LOGIN_COMPLETE',
          payload: {
            toolsetId: validPopupState.toolsetId,
            credentialsLevel: validPopupState.credentialsLevel,
            success: true,
          },
        },
        validPopupState.originatingOrigin,
      ),
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it('posts a failure message without leaking credentials when login rejects', async () => {
    setPopupWindow();
    vi.mocked(toolsetsApi.loginToolset).mockRejectedValue(
      new Error('network error'),
    );
    const state = encodeBase64Url(validPopupState);

    renderCallback(`?code=auth-code-xyz&state=${state}`, '/toolset-editor/callback');

    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        {
          type: 'quickapps/TOOLSET_LOGIN_COMPLETE',
          payload: {
            toolsetId: validPopupState.toolsetId,
            credentialsLevel: validPopupState.credentialsLevel,
            success: false,
          },
        },
        validPopupState.originatingOrigin,
      ),
    );
    const [message] = postMessage.mock.calls[0] as [
      Record<string, unknown>,
      string,
    ];
    expect(JSON.stringify(message)).not.toContain('auth-code-xyz');
    expect(close).toHaveBeenCalledOnce();
  });

  it('does not call login or postMessage and shows the fallback for a malformed state', async () => {
    setPopupWindow();

    renderCallback(
      '?code=auth-code-xyz&state=not-a-valid-payload',
      '/toolset-editor/callback',
    );

    await waitFor(() =>
      expect(
        screen.getByText('toolsetEditor.popup.closeFallback'),
      ).toBeTruthy(),
    );
    expect(toolsetsApi.loginToolset).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('does not affect the existing admin flow, even when a popup window is open', async () => {
    setPopupWindow();
    vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });
    setRedirectState({ toolsetId: 'toolsets/b/my__1.0.0' });

    // window.name does not match the popup marker, so this is the admin branch.
    Object.defineProperty(window, 'name', { configurable: true, value: '' });
    renderCallback('?code=auth-code-xyz', '/toolset-editor/callback');

    await waitFor(() =>
      expect(toolsetsApi.loginToolset).toHaveBeenCalledWith(
        'toolsets/b/my__1.0.0',
        expect.objectContaining({ code: 'auth-code-xyz' }),
      ),
    );
    expect(postMessage).not.toHaveBeenCalled();
  });
});
