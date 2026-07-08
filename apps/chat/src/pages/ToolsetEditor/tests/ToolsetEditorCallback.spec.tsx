import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TOOLSET_REDIRECT_STATE_KEY } from '../../../constants/toolsets';
import * as toolsetsApi from '../../../server-api/toolsets';
import { ROUTES } from '../../../types/routes';
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

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const setRedirectState = (state: ToolsetRedirectState) =>
  sessionStorage.setItem(TOOLSET_REDIRECT_STATE_KEY, JSON.stringify(state));

const renderCallback = (search = '?code=test-code') =>
  render(
    <MemoryRouter initialEntries={[`/toolset-editor/callback${search}`]}>
      <Routes>
        <Route
          path="/toolset-editor/callback"
          element={<ToolsetEditorCallback />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe('ToolsetEditorCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('navigates to catalog when sessionStorage state is missing', async () => {
    renderCallback();
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.Catalog, {
        replace: true,
      }),
    );
  });

  it('navigates to catalog when the toolsetId in state is absent', async () => {
    setRedirectState({ toolsetId: '' });
    renderCallback();
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.Catalog, {
        replace: true,
      }),
    );
  });

  it('navigates to catalog when the code query param is absent', async () => {
    setRedirectState({ toolsetId: 'toolsets/b/my__1.0.0' });
    renderCallback('');
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.Catalog, {
        replace: true,
      }),
    );
  });

  it('calls loginToolset with code and redirectUri, then navigates to callbackUrl', async () => {
    const callbackUrl = `${ROUTES.ToolsetEditor}?id=toolsets%2Fb%2Fmy__1.0.0`;
    setRedirectState({
      toolsetId: 'toolsets/b/my__1.0.0',
      credentialsLevel: ToolsetCredentialsLevel.User,
      callbackUrl,
    });
    vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });

    renderCallback('?code=auth-code-xyz');

    await waitFor(() =>
      expect(toolsetsApi.loginToolset).toHaveBeenCalledWith(
        'toolsets/b/my__1.0.0',
        expect.objectContaining({
          authenticationType: ToolsetAuthTypes.OAuth,
          code: 'auth-code-xyz',
          redirectUri: expect.stringContaining(ROUTES.ToolsetEditorCallback),
        }),
      ),
    );
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(callbackUrl, { replace: true }),
    );
  });

  it('navigates to callbackUrl even when loginToolset throws', async () => {
    const callbackUrl = ROUTES.ToolsetEditor;
    setRedirectState({
      toolsetId: 'toolsets/b/my__1.0.0',
      callbackUrl,
    });
    vi.mocked(toolsetsApi.loginToolset).mockRejectedValue(
      new Error('network error'),
    );

    renderCallback('?code=auth-code-xyz');

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(callbackUrl, { replace: true }),
    );
  });

  it('removes the redirect state from sessionStorage after running', async () => {
    setRedirectState({
      toolsetId: 'toolsets/b/my__1.0.0',
      callbackUrl: ROUTES.ToolsetEditor,
    });
    vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });

    renderCallback('?code=any-code');

    await waitFor(() =>
      expect(sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY)).toBeNull(),
    );
  });
});
