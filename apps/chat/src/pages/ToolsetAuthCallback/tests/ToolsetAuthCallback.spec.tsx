import {
  OAuthResourceKind,
  TOOLSET_REDIRECT_STATE_KEY,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  type ToolsetRedirectState,
} from '@epam/ai-dial-chat-hooks';
import { encodeJsonToBase64 } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ButtonsI18nKeys,
  ToolsetSigninI18nKeys,
} from '../../../constants/translation-keys';
import * as externalServicesApi from '../../../server-api/external-services';
import * as offlineCredentialsApi from '../../../server-api/offline-credentials';
import * as toolsetsApi from '../../../server-api/toolsets';
import ToolsetAuthCallback from '../ToolsetAuthCallback';

const setRedirectState = (state: ToolsetRedirectState) =>
  sessionStorage.setItem(TOOLSET_REDIRECT_STATE_KEY, encodeJsonToBase64(state));

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
 * `@epam/ai-dial-chat-hooks`, and the per-resource-kind dispatch by
 * `createOAuthCallbackExchange`'s. What remains here is what this page owns:
 * that its server-api adapters are the ones dispatched to, and its rendering.
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
  it('announces the in-progress status politely while the exchange runs', () => {
    setRedirectState({ toolsetId: 'toolsets/b/my__1.0.0' });
    /* Never settles, so the page stays in progress for the assertion. */
    vi.mocked(toolsetsApi.loginToolset).mockReturnValue(
      new Promise(() => undefined),
    );
    renderCallback();

    const status = screen.getByRole('status');
    expect(
      screen.getByRole('img', {
        name: ToolsetSigninI18nKeys.CallbackInProgress,
      }),
    ).toBeTruthy();
    expect(status.contains(screen.getByRole('img'))).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows a polite success status with a close button once the exchange succeeds', async () => {
    setRedirectState({ toolsetId: 'toolsets/b/my__1.0.0' });
    vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });
    renderCallback();

    expect(
      await screen.findByText(ToolsetSigninI18nKeys.CallbackSuccess),
    ).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();

    mockClose.mockClear();
    fireEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Close }),
    );
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'the exchange rejects',
      { toolsetId: 'toolsets/b/my__1.0.0' },
      '?code=auth-code-xyz',
      ToolsetSigninI18nKeys.ErrorLoginFailed,
    ],
    [
      'the provider returned no code',
      { toolsetId: 'toolsets/b/my__1.0.0' },
      '',
      ToolsetSigninI18nKeys.CallbackMissingCode,
    ],
    [
      'the popup holds no redirect state',
      null,
      '?code=auth-code-xyz',
      ToolsetSigninI18nKeys.CallbackRequestUnverified,
    ],
    [
      'the returned state does not match',
      { toolsetId: 'toolsets/b/my__1.0.0', state: 'expected-state' },
      '?code=auth-code-xyz&state=other-state',
      ToolsetSigninI18nKeys.CallbackRequestUnverified,
    ],
  ] as const)(
    'shows a translated alert with a close button when %s',
    async (_case, redirectState, search, messageKey) => {
      if (redirectState) setRedirectState(redirectState);
      vi.mocked(toolsetsApi.loginToolset).mockRejectedValue(
        new Error('network error'),
      );
      renderCallback(search);

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain(
        ToolsetSigninI18nKeys.CallbackFailedTitle,
      );
      expect(alert.textContent).toContain(messageKey);
      expect(screen.queryByRole('status')).toBeNull();

      mockClose.mockClear();
      fireEvent.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.Close }),
      );
      expect(mockClose).toHaveBeenCalledTimes(1);
    },
  );

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
      offlineUsageConsent: true,
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
          offlineUsageConsent: true,
          redirectUri: 'http://localhost/auth/toolset-signin',
        }),
      ),
    );
    expect(toolsetsApi.loginToolset).not.toHaveBeenCalled();
    expect(
      offlineCredentialsApi.signInOfflineCredentials,
    ).not.toHaveBeenCalled();
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
