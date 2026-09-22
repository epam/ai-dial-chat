import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApplicationCredentialsI18nKeys as Labels,
  ButtonsI18nKeys,
  ToolsetSigninI18nKeys,
} from '../../../constants/translation-keys';
import { ExternalServiceLoginOutcomeType } from '../../../hooks/externalServices/useExternalServiceLogin';
import {
  externalServicesApi,
  offlineCredentialsApi,
} from '../../../server-api/api-client';
import {
  signOutExternalService,
  type ApplicationExternalServiceDto,
} from '../../../server-api/external-services';
import { ApplicationCredentials } from '../ApplicationCredentials';

const login = vi.hoisted(() => vi.fn());
vi.mock(
  '../../../hooks/externalServices/useExternalServiceLogin',
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    useExternalServiceLogin: () => ({ login }),
  }),
);
vi.mock('../../../server-api/external-services', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  signOutExternalService: vi.fn(),
}));
vi.mock('../../../server-api/api-client', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  externalServicesApi: { listExternalServices: vi.fn() },
  offlineCredentialsApi: { getOfflineCredentials: vi.fn() },
}));
const listExternalServices = externalServicesApi.listExternalServices;
const getOfflineCredentials = offlineCredentialsApi.getOfflineCredentials;

const apiKeyService: ApplicationExternalServiceDto = {
  id: 'finance',
  displayName: 'Finance',
  authenticationType: 'API_KEY',
  userLevelAuthStatus: 'SIGNED_OUT',
};
const oauthService: ApplicationExternalServiceDto = {
  id: 'git',
  displayName: 'Git',
  authenticationType: 'OAUTH',
  userLevelAuthStatus: 'SIGNED_OUT',
  clientId: 'client',
  authorizationEndpoint: 'https://provider.example/authorize',
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listExternalServices).mockResolvedValue([
    apiKeyService,
    oauthService,
  ]);
  login.mockResolvedValue({ type: ExternalServiceLoginOutcomeType.Success });
});

describe('ApplicationCredentials', () => {
  it('loads each authenticated service and omits services needing no credentials', async () => {
    vi.mocked(listExternalServices).mockResolvedValue([
      apiKeyService,
      oauthService,
      { id: 'public', displayName: 'Public', authenticationType: 'NONE' },
    ]);
    render(<ApplicationCredentials appId="applications/public/agent" />);
    expect(await screen.findByRole('group', { name: 'Finance' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Git' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Public' })).toBeNull();
    expect(listExternalServices).toHaveBeenCalledWith({
      appId: 'applications/public/agent',
    });
  });

  it('submits a personal API key with explicit offline consent and refreshes its status', async () => {
    const user = userEvent.setup();
    render(<ApplicationCredentials appId="agent" />);
    const row = within(await screen.findByRole('group', { name: 'Finance' }));
    expect(
      row
        .getByRole('button', { name: ButtonsI18nKeys.Add })
        .hasAttribute('disabled'),
    ).toBe(false);
    await user.type(
      row.getByLabelText(ToolsetSigninI18nKeys.ApiKeyLabel),
      'key',
    );
    await user.click(row.getByRole('checkbox'));
    vi.mocked(listExternalServices).mockResolvedValue([
      { ...apiKeyService, userLevelAuthStatus: 'SIGNED_IN' },
      oauthService,
    ]);
    await user.click(row.getByRole('button', { name: ButtonsI18nKeys.Add }));
    expect(login).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'agent',
        serviceId: 'finance',
        apiKey: 'key',
        credentialsLevel: 'USER',
        offlineUsageConsent: true,
      }),
    );
    expect(await row.findByText(Labels.SignedIn)).toBeTruthy();
    expect(row.queryByLabelText(ToolsetSigninI18nKeys.ApiKeyLabel)).toBeNull();
    expect(
      within(screen.getByRole('group', { name: 'Git' })).getByText(
        Labels.SignedOut,
      ),
    ).toBeTruthy();
  });

  it('preserves another service draft while refreshing after login', async () => {
    const user = userEvent.setup();
    render(<ApplicationCredentials appId="agent" />);
    const finance = within(
      await screen.findByRole('group', { name: 'Finance' }),
    );
    await user.type(
      finance.getByLabelText(ToolsetSigninI18nKeys.ApiKeyLabel),
      'draft-key',
    );
    let resolveRefresh!: (value: ApplicationExternalServiceDto[]) => void;
    vi.mocked(listExternalServices).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );
    await user.click(
      within(screen.getByRole('group', { name: 'Git' })).getByRole('button', {
        name: ButtonsI18nKeys.LogIn,
      }),
    );
    expect(
      screen.getByLabelText(ToolsetSigninI18nKeys.ApiKeyLabel),
    ).toHaveProperty('value', 'draft-key');
    await act(async () =>
      resolveRefresh([
        apiKeyService,
        { ...oauthService, userLevelAuthStatus: 'SIGNED_IN' },
      ]),
    );
    expect(
      screen.getByLabelText(ToolsetSigninI18nKeys.ApiKeyLabel),
    ).toHaveProperty('value', 'draft-key');
  });

  it('uses the shared OAuth flow and reports a blocked popup', async () => {
    login.mockResolvedValue({
      type: ExternalServiceLoginOutcomeType.PopupBlocked,
    });
    const user = userEvent.setup();
    render(<ApplicationCredentials appId="agent" />);
    const row = within(await screen.findByRole('group', { name: 'Git' }));
    await user.click(row.getByRole('button', { name: ButtonsI18nKeys.LogIn }));
    expect(login).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: 'git',
        authenticationType: 'OAUTH',
        offlineUsageConsent: false,
        oauthSettings: expect.objectContaining({ clientId: 'client' }),
      }),
    );
    expect(await row.findByRole('alert')).toHaveProperty(
      'textContent',
      ToolsetSigninI18nKeys.ErrorPopupBlocked,
    );
  });

  it('requires confirmation before revoking only personal credentials', async () => {
    vi.mocked(listExternalServices).mockResolvedValue([
      {
        ...apiKeyService,
        userLevelAuthStatus: 'SIGNED_IN',
        globalAuthStatus: 'SIGNED_IN',
      },
    ]);
    const user = userEvent.setup();
    render(<ApplicationCredentials appId="agent" />);
    const row = within(await screen.findByRole('group', { name: 'Finance' }));
    await user.click(row.getByRole('button', { name: ButtonsI18nKeys.Delete }));
    expect(signOutExternalService).not.toHaveBeenCalled();
    vi.mocked(listExternalServices).mockResolvedValue([
      { ...apiKeyService, globalAuthStatus: 'SIGNED_IN' },
    ]);
    const confirm = row
      .getAllByRole('button', { name: ButtonsI18nKeys.Delete })
      .find((button) => !button.hasAttribute('disabled'));
    if (!confirm) throw new Error('Missing delete confirmation');
    await user.click(confirm);
    expect(signOutExternalService).toHaveBeenCalledWith('agent', 'finance', {
      credentialsLevel: 'USER',
      authenticationType: 'API_KEY',
    });
    expect(await row.findByText(Labels.SharedCredentials)).toBeTruthy();
  });

  it('shows load errors and retries without requiring a conversation', async () => {
    vi.mocked(listExternalServices).mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    render(<ApplicationCredentials appId="agent" />);
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      Labels.LoadError,
    );
    await user.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Retry }),
    );
    expect(await screen.findByRole('group', { name: 'Finance' })).toBeTruthy();
  });

  it('does not let a late response show the previous application credentials', async () => {
    let resolveOld!: (value: ApplicationExternalServiceDto[]) => void;
    vi.mocked(listExternalServices).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    const { rerender } = render(<ApplicationCredentials appId="old" />);
    vi.mocked(listExternalServices).mockResolvedValue([oauthService]);
    rerender(<ApplicationCredentials appId="new" />);
    await screen.findByRole('group', { name: 'Git' });
    await act(async () => {
      resolveOld([apiKeyService]);
    });
    expect(screen.queryByRole('group', { name: 'Finance' })).toBeNull();
  });

  it('reuses DIAL-native offline consent and offers no revocation of shared offline credentials', async () => {
    vi.mocked(listExternalServices).mockResolvedValue([
      {
        id: 'dial',
        displayName: 'DIAL',
        authenticationType: 'DIAL_NATIVE',
        appLevelAuthStatus: 'SIGNED_IN',
      },
    ]);
    vi.mocked(getOfflineCredentials).mockResolvedValue({
      connected: true,
      available: true,
    });
    render(<ApplicationCredentials appId="agent" />);
    const row = within(await screen.findByRole('group', { name: 'DIAL' }));
    expect(row.getByText(Labels.SignedIn)).toBeTruthy();
    expect(
      row.queryByRole('button', { name: ButtonsI18nKeys.LogOut }),
    ).toBeNull();
  });

  it('keeps an empty catalog surface but explains no-auth applications in settings', async () => {
    vi.mocked(listExternalServices).mockResolvedValue([]);
    const { rerender } = render(<ApplicationCredentials appId="agent" />);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    rerender(<ApplicationCredentials appId="agent" showEmptyState />);
    expect(screen.getByRole('status').textContent).toBe(
      ToolsetSigninI18nKeys.NoCredentialsRequired,
    );
  });
});
