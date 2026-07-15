import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TOOLSET_REDIRECT_STATE_KEY } from '../../../constants/toolsets';
import * as toolsetsApi from '../../../server-api/toolsets';
import type { ToolsetRedirectState } from '../../../types/toolsets';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
} from '../../../types/toolsets';
import ToolsetEditorCallback from '../ToolsetEditorCallback';

vi.mock('../../../server-api/toolsets', () => ({
  loginToolset: vi.fn(),
}));

vi.mock('../../../components/RouteFallback/RouteFallback', () => ({
  default: () => <div>Loading</div>,
}));

const setRedirectState = (state: ToolsetRedirectState) =>
  sessionStorage.setItem(TOOLSET_REDIRECT_STATE_KEY, JSON.stringify(state));

const renderCallback = (
  search = '?code=test-code',
  route = '/auth/toolset-signin',
) =>
  render(
    <MemoryRouter initialEntries={[`${route}${search}`]}>
      <Routes>
        <Route
          path="/auth/toolset-signin"
          element={<ToolsetEditorCallback />}
        />
        <Route
          path="/toolset-editor/callback"
          element={<ToolsetEditorCallback />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe('ToolsetEditorCallback', () => {
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
    setRedirectState({
      toolsetId: 'toolsets/b/my__1.0.0',
    });
    vi.mocked(toolsetsApi.loginToolset).mockRejectedValue(
      new Error('network error'),
    );

    renderCallback('?code=auth-code-xyz');

    await waitFor(() => expect(mockClose).toHaveBeenCalledOnce());
  });

  it('removes the redirect state from sessionStorage after running', async () => {
    setRedirectState({
      toolsetId: 'toolsets/b/my__1.0.0',
    });
    vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });

    renderCallback('?code=any-code');

    await waitFor(() =>
      expect(sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY)).toBeNull(),
    );
  });
});
