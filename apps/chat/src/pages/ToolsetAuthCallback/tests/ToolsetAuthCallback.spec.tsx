import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUICKAPPS_TOOLSET_AUTH_POPUP_NAME } from '../../../constants/toolsets';
import * as toolsetsApi from '../../../server-api/toolsets';
import { ROUTES } from '../../../types/routes';
import type {
  ToolsetPopupState,
  ToolsetRedirectState,
} from '../../../types/toolsets';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
} from '../../../types/toolsets';
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

const validRedirectState: ToolsetRedirectState = {
  toolsetId: 'toolsets/b/my__1.0.0',
  credentialsLevel: ToolsetCredentialsLevel.User,
  csrfToken: 'csrf-123',
};

vi.mock('../../../server-api/toolsets', () => ({
  loginToolset: vi.fn(),
}));

vi.mock('../../../components/RouteFallback/RouteFallback', () => ({
  default: () => <div>Loading</div>,
}));

const renderCallback = (search = '?code=test-code') =>
  render(
    <MemoryRouter initialEntries={[`/toolset-editor/callback${search}`]}>
      <Routes>
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
    vi.spyOn(window, 'close').mockImplementation(mockClose);
  });

  it('closes the window when the state query param is missing', async () => {
    renderCallback('?code=test-code');
    await waitFor(() => expect(mockClose).toHaveBeenCalledOnce());
  });

  it('closes the window when state fails to decode', async () => {
    renderCallback('?code=test-code&state=not-a-valid-payload');
    await waitFor(() => expect(mockClose).toHaveBeenCalledOnce());
  });

  it('closes the window when the code query param is absent', async () => {
    renderCallback(`?state=${encodeBase64Url(validRedirectState)}`);
    await waitFor(() => expect(mockClose).toHaveBeenCalledOnce());
  });

  it('calls loginToolset with the decoded state, code, and redirectUri, then closes the window', async () => {
    vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });

    renderCallback(
      `?code=auth-code-xyz&state=${encodeBase64Url(validRedirectState)}`,
    );

    await waitFor(() =>
      expect(toolsetsApi.loginToolset).toHaveBeenCalledWith(
        'toolsets/b/my__1.0.0',
        expect.objectContaining({
          authenticationType: ToolsetAuthTypes.OAuth,
          credentialsLevel: validRedirectState.credentialsLevel,
          code: 'auth-code-xyz',
          redirectUri: expect.stringContaining(ROUTES.ToolsetEditorCallback),
        }),
      ),
    );
    await waitFor(() => expect(mockClose).toHaveBeenCalledOnce());
  });

  it('closes the window even when loginToolset throws', async () => {
    vi.mocked(toolsetsApi.loginToolset).mockRejectedValue(
      new Error('network error'),
    );

    renderCallback(
      `?code=auth-code-xyz&state=${encodeBase64Url(validRedirectState)}`,
    );

    await waitFor(() => expect(mockClose).toHaveBeenCalledOnce());
  });

  it('completes the admin flow even without window.opener, since noopener severs it', async () => {
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: null,
    });
    vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });

    renderCallback(
      `?code=auth-code-xyz&state=${encodeBase64Url(validRedirectState)}`,
    );

    await waitFor(() =>
      expect(toolsetsApi.loginToolset).toHaveBeenCalledWith(
        'toolsets/b/my__1.0.0',
        expect.objectContaining({ code: 'auth-code-xyz' }),
      ),
    );
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

    renderCallback(`?code=auth-code-xyz&state=${state}`);

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

    renderCallback(`?code=auth-code-xyz&state=${state}`);

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

    renderCallback('?code=auth-code-xyz&state=not-a-valid-payload');

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

    // window.name does not match the popup marker, so this is the admin branch.
    Object.defineProperty(window, 'name', { configurable: true, value: '' });
    renderCallback(
      `?code=auth-code-xyz&state=${encodeBase64Url(validRedirectState)}`,
    );

    await waitFor(() =>
      expect(toolsetsApi.loginToolset).toHaveBeenCalledWith(
        validRedirectState.toolsetId,
        expect.objectContaining({ code: 'auth-code-xyz' }),
      ),
    );
    expect(postMessage).not.toHaveBeenCalled();
  });
});
