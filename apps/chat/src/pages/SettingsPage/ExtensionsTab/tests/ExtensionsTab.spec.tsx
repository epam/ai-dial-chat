import {
  OfflineCredentialsConnectSettings,
  OfflineCredentialsGateStatus,
  OfflineCredentialsLoginOutcomeType,
  OfflineCredentialsLogoutOutcomeType,
} from '@epam/ai-dial-chat-hooks';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ExtensionsI18nKeys,
  ScheduledTasksI18nKeys,
  SettingsI18nKeys,
} from '../../../../constants/translation-keys';
import { useOfflineCredentialsAuth as useAppOfflineCredentialsAuth } from '../../../../hooks/offlineCredentials/useOfflineCredentialsAuth';
import { useOfflineCredentialsGate } from '../../../../hooks/offlineCredentials/useOfflineCredentialsGate';
import ExtensionsTab from '../ExtensionsTab';

vi.mock(
  '../../../../hooks/offlineCredentials/useOfflineCredentialsGate',
  () => ({
    OfflineCredentialsGateStatus: {
      Checking: 'checking',
      Hidden: 'hidden',
      Available: 'available',
      Unavailable: 'unavailable',
      Error: 'error',
    },
    useOfflineCredentialsGate: vi.fn(),
  }),
);

/*
 * The app auth wiring is the test seam: the shared hook is outcome-based, so
 * the tab spec drives login/logout outcomes directly instead of the OAuth
 * popup flow (covered by the lib's own spec).
 */
vi.mock(
  '../../../../hooks/offlineCredentials/useOfflineCredentialsAuth',
  () => ({
    useOfflineCredentialsAuth: vi.fn(),
  }),
);

const useOfflineCredentialsGateMock = vi.mocked(useOfflineCredentialsGate);
const useOfflineCredentialsAuthMock = vi.mocked(useAppOfflineCredentialsAuth);
const logInMock = vi.fn();
const logOutMock = vi.fn();

const makeGateResult = (
  overrides?: Partial<{
    status: OfflineCredentialsGateStatus;
    connect: OfflineCredentialsConnectSettings | undefined;
    connected: boolean;
  }>,
) => ({
  status: OfflineCredentialsGateStatus.Available,
  connect: {
    clientId: 'dial-apps',
    authorizationEndpoint: 'https://identity.example.com/authorize',
    scopes: ['openid', 'offline_access'],
  } satisfies OfflineCredentialsConnectSettings,
  connected: false,
  refetch: vi.fn(),
  ...overrides,
});

const makeAuthResult = (
  overrides?: Partial<{
    isLoggingIn: boolean;
    loginOutcome: OfflineCredentialsLoginOutcomeType | undefined;
    isLoggingOut: boolean;
  }>,
) => ({
  isLoggingIn: false,
  loginOutcome: undefined,
  isLoggingOut: false,
  logIn: logInMock,
  logOut: logOutMock,
  ...overrides,
});

const renderTab = (
  gateResult?: ReturnType<typeof makeGateResult>,
  authResult?: ReturnType<typeof makeAuthResult>,
) => {
  useOfflineCredentialsGateMock.mockReturnValue(gateResult ?? makeGateResult());
  useOfflineCredentialsAuthMock.mockReturnValue(authResult ?? makeAuthResult());
  return render(<ExtensionsTab />);
};

describe('ExtensionsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the section heading and description', () => {
    renderTab();

    expect(
      screen.getByRole('heading', { name: SettingsI18nKeys.Extensions }),
    ).toBeTruthy();
    expect(screen.getByText(ExtensionsI18nKeys.Description)).toBeTruthy();
  });

  it('renders the Name and Description column headers and the sr-only action header', () => {
    renderTab();

    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders).toHaveLength(3);
    expect(screen.getByText(ExtensionsI18nKeys.NameColumnLabel)).toBeTruthy();
    expect(
      screen.getByText(ExtensionsI18nKeys.DescriptionColumnLabel),
    ).toBeTruthy();
    /* Visually empty column header: no visible text, but the sr-only label
       keeps it announced to screen readers. */
    expect(
      screen.getByText(ExtensionsI18nKeys.ActionsColumnLabel),
    ).toBeTruthy();
  });

  it('renders the service row while the service is connected', () => {
    renderTab(
      makeGateResult({
        status: OfflineCredentialsGateStatus.Hidden,
        connected: true,
      }),
    );

    expect(
      screen.getByRole('cell', { name: ExtensionsI18nKeys.ServiceDefaultName }),
    ).toBeTruthy();
  });

  it('renders no service row while the check reports the service unavailable', () => {
    renderTab(
      makeGateResult({
        status: OfflineCredentialsGateStatus.Unavailable,
        connect: undefined,
      }),
    );

    expect(screen.queryByRole('cell')).toBeNull();
  });

  it('shows the loading spinner and no table while the check is in flight', () => {
    renderTab(
      makeGateResult({ status: OfflineCredentialsGateStatus.Checking }),
    );

    expect(screen.queryByRole('table')).toBeNull();
    expect(
      screen.getByRole('img', { name: BasicI18nKeys.Loading }),
    ).toBeTruthy();
  });

  it('renders the localized service display name regardless of the Core-reported client id', () => {
    renderTab();

    expect(
      screen.getByText(ExtensionsI18nKeys.ServiceDefaultName),
    ).toBeTruthy();
  });

  it('renders the service description in the Description cell', () => {
    renderTab();

    expect(
      screen.getByText(ExtensionsI18nKeys.ServiceDescription),
    ).toBeTruthy();
  });

  it('renders the warning badge with its localized accessible name while disconnected', () => {
    renderTab();

    expect(
      screen.getByRole('img', {
        name: ExtensionsI18nKeys.ServiceAuthorizeTooltip,
      }),
    ).toBeTruthy();
  });

  it('renders no warning badge while connected', () => {
    renderTab(
      makeGateResult({
        status: OfflineCredentialsGateStatus.Hidden,
        connected: true,
      }),
    );

    expect(
      screen.queryByRole('img', {
        name: ExtensionsI18nKeys.ServiceAuthorizeTooltip,
      }),
    ).toBeNull();
  });

  it('renders the Log out action while connected', () => {
    renderTab(
      makeGateResult({
        status: OfflineCredentialsGateStatus.Hidden,
        connected: true,
      }),
    );

    expect(
      screen.getByRole('button', { name: ButtonsI18nKeys.LogOut }),
    ).toBeTruthy();
  });

  it('renders the Log in action while disconnected and the service is available', () => {
    renderTab();

    expect(
      screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
    ).toBeTruthy();
  });

  it('renders no row action while the check is in flight, unavailable, or errored', () => {
    renderTab(makeGateResult({ status: OfflineCredentialsGateStatus.Error }));
    expect(
      screen.queryByRole('button', { name: ButtonsI18nKeys.LogOut }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: ButtonsI18nKeys.LogIn }),
    ).toBeNull();

    renderTab(
      makeGateResult({
        status: OfflineCredentialsGateStatus.Unavailable,
        connect: undefined,
      }),
    );
    expect(screen.queryByRole('button')).toBeNull();

    renderTab(
      makeGateResult({ status: OfflineCredentialsGateStatus.Checking }),
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('starts the auth flow login when the Log in action is activated', async () => {
    renderTab();

    await userEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
    );

    expect(logInMock).toHaveBeenCalledOnce();
  });

  it('renders the Log in action disabled with its in-flight label while a login is in flight', () => {
    renderTab(undefined, makeAuthResult({ isLoggingIn: true }));

    const inFlightButton = screen.getByRole('button', {
      name: ScheduledTasksI18nKeys.OfflineCredentialsBannerLoggingInLabel,
    });
    expect(inFlightButton.hasAttribute('disabled')).toBe(true);
  });

  it.each([
    [
      OfflineCredentialsLoginOutcomeType.Success,
      ScheduledTasksI18nKeys.OfflineCredentialsBannerSuccessAnnouncement,
    ],
    [
      OfflineCredentialsLoginOutcomeType.PopupBlocked,
      ScheduledTasksI18nKeys.OfflineCredentialsBannerPopupBlockedMessage,
    ],
    [
      OfflineCredentialsLoginOutcomeType.Cancelled,
      ScheduledTasksI18nKeys.OfflineCredentialsBannerCancelledMessage,
    ],
    [
      OfflineCredentialsLoginOutcomeType.TimedOut,
      ScheduledTasksI18nKeys.OfflineCredentialsBannerTimeoutMessage,
    ],
    [
      OfflineCredentialsLoginOutcomeType.Failure,
      ScheduledTasksI18nKeys.OfflineCredentialsBannerFailedMessage,
    ],
  ])(
    'announces the login outcome through the polite live region (%s)',
    (outcomeType, expectedAnnouncement) => {
      /* The tab is memoized with no props, so outcomes are driven through
         fresh renders — the effect maps the outcome on mount. */
      renderTab(undefined, makeAuthResult({ loginOutcome: outcomeType }));

      expect(screen.getByRole('status').textContent).toBe(expectedAnnouncement);
    },
  );

  it('renders no announcement while a new login attempt is in flight', () => {
    renderTab(undefined, makeAuthResult({ isLoggingIn: true }));

    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('requires an explicit confirmation before revoking', async () => {
    renderTab(
      makeGateResult({
        status: OfflineCredentialsGateStatus.Hidden,
        connected: true,
      }),
    );

    await userEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.LogOut }),
    );

    expect(
      screen.getByText(ScheduledTasksI18nKeys.DisconnectConfirmTitle),
    ).toBeTruthy();
    expect(logOutMock).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Cancel }),
    );

    expect(
      screen.queryByText(ScheduledTasksI18nKeys.DisconnectConfirmTitle),
    ).toBeNull();
    expect(logOutMock).not.toHaveBeenCalled();
  });

  it('closes the dialog and announces success when the logout is confirmed as disconnected', async () => {
    logOutMock.mockResolvedValue(
      OfflineCredentialsLogoutOutcomeType.Disconnected,
    );
    renderTab(
      makeGateResult({
        status: OfflineCredentialsGateStatus.Hidden,
        connected: true,
      }),
    );

    await userEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.LogOut }),
    );
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: ButtonsI18nKeys.LogOut,
      }),
    );

    await waitFor(() => {
      expect(
        screen.queryByText(ScheduledTasksI18nKeys.DisconnectConfirmTitle),
      ).toBeNull();
    });
    expect(logOutMock).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toBe(
      ScheduledTasksI18nKeys.DisconnectSuccessAnnouncement,
    );
  });

  it.each([
    OfflineCredentialsLogoutOutcomeType.NotDisconnected,
    OfflineCredentialsLogoutOutcomeType.Failed,
  ])(
    'keeps the dialog open with the failed message when the logout resolves %s',
    async (outcome) => {
      logOutMock.mockResolvedValue(outcome);
      renderTab(
        makeGateResult({
          status: OfflineCredentialsGateStatus.Hidden,
          connected: true,
        }),
      );

      await userEvent.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.LogOut }),
      );
      await userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: ButtonsI18nKeys.LogOut,
        }),
      );

      const dialog = screen.getByRole('dialog');
      await waitFor(() => {
        expect(
          within(dialog).getByText(
            ScheduledTasksI18nKeys.DisconnectFailedMessage,
          ),
        ).toBeTruthy();
      });
      expect(
        within(dialog).getByText(ScheduledTasksI18nKeys.DisconnectConfirmTitle),
      ).toBeTruthy();
    },
  );

  it('drops the confirm control from the dialog while a logout is in flight, so a revoke cannot be duplicated', async () => {
    renderTab(
      makeGateResult({
        status: OfflineCredentialsGateStatus.Hidden,
        connected: true,
      }),
      makeAuthResult({ isLoggingOut: true }),
    );

    await userEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.LogOut }),
    );

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).queryByRole('button', { name: ButtonsI18nKeys.LogOut }),
    ).toBeNull();
    expect(logOutMock).not.toHaveBeenCalled();
  });
});
