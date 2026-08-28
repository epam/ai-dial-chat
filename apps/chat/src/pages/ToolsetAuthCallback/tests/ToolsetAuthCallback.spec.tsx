import {
  getToolsetOAuthChannelName,
  OAuthResourceKind,
  TOOLSET_REDIRECT_STATE_KEY,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthChannelControlType,
  type ToolsetOAuthChannelMessage,
  ToolsetOAuthFailureReason,
  ToolsetOAuthResultType,
  type ToolsetRedirectState,
} from '@epam/ai-dial-chat-hooks';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as externalServicesApi from '../../../server-api/external-services';
import * as offlineCredentialsApi from '../../../server-api/offline-credentials';
import * as toolsetsApi from '../../../server-api/toolsets';
import ToolsetAuthCallback from '../ToolsetAuthCallback';

const setRedirectState = (state: ToolsetRedirectState) =>
  sessionStorage.setItem(TOOLSET_REDIRECT_STATE_KEY, JSON.stringify(state));

/** Consumes the first result and acknowledges it so the callback can close. */
const listenForResult = (flowId: string): Promise<ToolsetOAuthChannelMessage> =>
  new Promise((resolve) => {
    const channel = new BroadcastChannel(getToolsetOAuthChannelName(flowId));
    channel.onmessage = (event) => {
      channel.postMessage({
        type: ToolsetOAuthChannelControlType.ResultAcknowledged,
      });
      resolve(event.data as ToolsetOAuthChannelMessage);
      channel.close();
    };
  });

vi.mock('../../../server-api/toolsets', () => ({
  loginToolset: vi.fn(),
}));

vi.mock('../../../server-api/external-services', () => ({
  ExternalServiceAuthType: { None: 'NONE', ApiKey: 'API_KEY', OAuth: 'OAUTH' },
  ExternalServiceCredentialsLevel: {
    Global: 'GLOBAL',
    Application: 'APPLICATION',
    User: 'USER',
  },
  signInExternalService: vi.fn(),
}));

vi.mock('../../../server-api/offline-credentials', () => ({
  signInOfflineCredentials: vi.fn(),
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
        <Route path="/auth/toolset-signin" element={<ToolsetAuthCallback />} />
        <Route
          path="/toolset-editor/callback"
          element={<ToolsetAuthCallback />}
        />
      </Routes>
    </MemoryRouter>,
  );

/*
 * The completion flow itself — redirect-state handling, code scrubbing, state
 * validation, the acknowledged `BroadcastChannel` report, and the popup close —
 * is covered by `useOAuthCallbackCompletion`'s own suite in
 * `@epam/ai-dial-chat-hooks`. What remains here is what this page owns: the
 * per-resource-kind dispatch of the exchange call, and its rendering.
 */
describe('ToolsetAuthCallback', () => {
  const mockClose = vi.fn();
  const mockReplaceState = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.spyOn(window, 'close').mockImplementation(mockClose);
    vi.spyOn(window.history, 'replaceState').mockImplementation(
      mockReplaceState,
    );
  });

  /*
   * `listenForResult` resolves before the popup's own channel has received the
   * acknowledgement, so its `window.close()` lands a task later. Drain it here
   * or it is counted against the next test's close assertions.
   */
  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  it('renders the route fallback while the flow runs', () => {
    setRedirectState({ toolsetId: 'toolsets/b/my__1.0.0' });
    renderCallback();

    expect(screen.getByText('Loading')).toBeTruthy();
  });

  it('dispatches to loginToolset when the redirect state names no resource kind', async () => {
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
          url: 'toolsets/b/my__1.0.0',
          credentialsLevel: ToolsetCredentialsLevel.User,
          authenticationType: ToolsetAuthTypes.OAuth,
          code: 'auth-code-xyz',
          redirectUri: 'http://localhost/auth/toolset-signin',
        }),
      ),
    );
    expect(externalServicesApi.signInExternalService).not.toHaveBeenCalled();
    expect(
      offlineCredentialsApi.signInOfflineCredentials,
    ).not.toHaveBeenCalled();
  });

  it('dispatches to signInExternalService with the appId/serviceId parsed from the scope id', async () => {
    setRedirectState({
      toolsetId:
        'applications/public/finhub-via-openapi__1.0.0/external_services/finhub-api2',
      credentialsLevel: ToolsetCredentialsLevel.User,
      redirectUri: 'http://localhost/auth/toolset-signin',
      resourceKind: OAuthResourceKind.ExternalService,
    });
    vi.mocked(externalServicesApi.signInExternalService).mockResolvedValue({
      success: true,
    });

    renderCallback('?code=auth-code-xyz');

    await waitFor(() =>
      expect(externalServicesApi.signInExternalService).toHaveBeenCalledWith(
        'applications/public/finhub-via-openapi__1.0.0',
        'finhub-api2',
        expect.objectContaining({
          credentialsLevel: 'USER',
          authenticationType: 'OAUTH',
          code: 'auth-code-xyz',
          redirectUri: 'http://localhost/auth/toolset-signin',
        }),
      ),
    );
    expect(toolsetsApi.loginToolset).not.toHaveBeenCalled();
    expect(
      offlineCredentialsApi.signInOfflineCredentials,
    ).not.toHaveBeenCalled();
  });

  it('reports a missing-redirect-state failure without an exchange when the external-service scope id is unparseable', async () => {
    setRedirectState({
      toolsetId: 'not-a-scope-id',
      state: 'flow-unparseable-scope',
      resourceKind: OAuthResourceKind.ExternalService,
    });
    const reported = listenForResult('flow-unparseable-scope');

    renderCallback('?code=auth-code-xyz&state=flow-unparseable-scope');

    await expect(reported).resolves.toEqual({
      type: ToolsetOAuthResultType.Failure,
      reason: ToolsetOAuthFailureReason.MissingRedirectState,
    });
    expect(externalServicesApi.signInExternalService).not.toHaveBeenCalled();
    expect(toolsetsApi.loginToolset).not.toHaveBeenCalled();
  });

  it('dispatches to signInOfflineCredentials for the offline-credentials resource kind', async () => {
    setRedirectState({
      toolsetId: 'offline-credentials',
      credentialsLevel: ToolsetCredentialsLevel.User,
      redirectUri: 'http://localhost/auth/toolset-signin',
      resourceKind: OAuthResourceKind.OfflineCredentials,
    });
    vi.mocked(offlineCredentialsApi.signInOfflineCredentials).mockResolvedValue(
      { success: true },
    );

    renderCallback('?code=auth-code-xyz');

    await waitFor(() =>
      expect(
        offlineCredentialsApi.signInOfflineCredentials,
      ).toHaveBeenCalledWith({
        code: 'auth-code-xyz',
        redirectUri: 'http://localhost/auth/toolset-signin',
      }),
    );
    expect(toolsetsApi.loginToolset).not.toHaveBeenCalled();
    expect(externalServicesApi.signInExternalService).not.toHaveBeenCalled();
  });

  it('reports a login-request failure and no sibling call when the offline-credentials exchange rejects', async () => {
    setRedirectState({
      toolsetId: 'offline-credentials',
      state: 'flow-offline-credentials-1',
      resourceKind: OAuthResourceKind.OfflineCredentials,
    });
    vi.mocked(offlineCredentialsApi.signInOfflineCredentials).mockRejectedValue(
      new Error('network error'),
    );
    const reported = listenForResult('flow-offline-credentials-1');

    renderCallback('?code=auth-code-xyz&state=flow-offline-credentials-1');

    await expect(reported).resolves.toEqual({
      type: ToolsetOAuthResultType.Failure,
      reason: ToolsetOAuthFailureReason.LoginRequestFailed,
    });
    expect(toolsetsApi.loginToolset).not.toHaveBeenCalled();
    expect(externalServicesApi.signInExternalService).not.toHaveBeenCalled();
  });

  it('falls back to the editor callback route for a redirect state that stored no redirect URI', async () => {
    setRedirectState({ toolsetId: 'toolsets/b/my__1.0.0' });
    vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });

    renderCallback('?code=auth-code-xyz');

    await waitFor(() =>
      expect(toolsetsApi.loginToolset).toHaveBeenCalledWith(
        'toolsets/b/my__1.0.0',
        expect.objectContaining({
          redirectUri: `${window.location.origin}/toolset-editor/callback`,
        }),
      ),
    );
  });
});
