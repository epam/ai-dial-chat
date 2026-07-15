import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TOOLSET_REDIRECT_STATE_KEY } from '../../../constants/toolsets';
import * as toolsetsApi from '../../../server-api/toolsets';
import type {
  ToolsetOAuthChannelMessage,
  ToolsetRedirectState,
} from '../../../types/toolsets';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthFailureReason,
  ToolsetOAuthResultType,
} from '../../../types/toolsets';
import { getToolsetOAuthChannelName } from '../../../utils/toolsets';
import ToolsetEditorCallback from '../ToolsetEditorCallback';

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
    setRedirectState({
      toolsetId: 'toolsets/b/my__1.0.0',
      state: 'flow-1',
    });

    const resultPromise = listenForResult('flow-1');
    renderCallback('?code=auth-code-xyz&state=different-flow');

    await expect(resultPromise).resolves.toEqual({
      type: ToolsetOAuthResultType.Failure,
      reason: ToolsetOAuthFailureReason.StateMismatch,
    });
  });

  it('posts a failure message on the flow channel when the code query param is missing', async () => {
    setRedirectState({
      toolsetId: 'toolsets/b/my__1.0.0',
      state: 'flow-1',
    });

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
    setRedirectState({
      toolsetId: 'toolsets/b/my__1.0.0',
      state: 'flow-1',
    });
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
