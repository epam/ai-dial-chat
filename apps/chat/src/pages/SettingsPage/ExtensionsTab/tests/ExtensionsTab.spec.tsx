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
import {
  OfflineCredentialsGateStatus,
  useOfflineCredentialsGate,
} from '../../../../hooks/offlineCredentials/useOfflineCredentialsGate';
import { OfflineCredentialsLoginOutcomeType } from '../../../../hooks/offlineCredentials/useOfflineCredentialsLogin';
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

vi.mock(
  '../../../../hooks/offlineCredentials/useOfflineCredentialsLogin',
  () => ({
    OfflineCredentialsLoginOutcomeType: {
      Success: 'success',
      Failure: 'failure',
      PopupBlocked: 'popup-blocked',
      Cancelled: 'cancelled',
      TimedOut: 'timed-out',
    },
    useOfflineCredentialsLogin: () => ({ login: loginMock }),
  }),
);

vi.mock('../../../../server-api/offline-credentials', () => ({
  signOutOfflineCredentials: () => signOutOfflineCredentialsMock(),
}));

const useOfflineCredentialsGateMock = vi.mocked(useOfflineCredentialsGate);
const loginMock = vi.fn();
const signOutOfflineCredentialsMock = vi.fn();
const refetchCredentialsMock = vi.fn();

const CONNECT = {
  clientId: 'dial-apps',
  authorizationEndpoint: 'https://identity.example.com/authorize',
  scopes: ['openid', 'offline_access'],
};

const makeGateResult = (
  overrides?: Partial<{
    status: OfflineCredentialsGateStatus;
    connect: typeof CONNECT | undefined;
    connected: boolean;
  }>,
) => ({
  status: OfflineCredentialsGateStatus.Available,
  connect: CONNECT,
  connected: false,
  refetch: refetchCredentialsMock,
  ...overrides,
});

const renderTab = (gateResult?: ReturnType<typeof makeGateResult>) => {
  useOfflineCredentialsGateMock.mockReturnValue(gateResult ?? makeGateResult());
  render(<ExtensionsTab />);
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

  it('disables the Log in action and swaps its label while the flow is in flight', async () => {
    loginMock.mockReturnValue(
      new Promise(() => {
        /** */
      }),
    );
    renderTab();

    const logInButton = screen.getByRole('button', {
      name: ButtonsI18nKeys.LogIn,
    });
    await userEvent.click(logInButton);

    await waitFor(() => {
      const inFlightButton = screen.getByRole('button', {
        name: ScheduledTasksI18nKeys.OfflineCredentialsBannerLoggingInLabel,
      });
      expect(inFlightButton.hasAttribute('disabled')).toBe(true);
    });
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
    async (outcomeType, expectedAnnouncement) => {
      loginMock.mockResolvedValue({ type: outcomeType });
      renderTab();

      await userEvent.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
      );

      await waitFor(() => {
        expect(screen.getByRole('status').textContent).toBe(
          expectedAnnouncement,
        );
      });
    },
  );

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
    expect(signOutOfflineCredentialsMock).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Cancel }),
    );

    expect(
      screen.queryByText(ScheduledTasksI18nKeys.DisconnectConfirmTitle),
    ).toBeNull();
    expect(signOutOfflineCredentialsMock).not.toHaveBeenCalled();
  });

  it('revokes on confirm when the fresh check reports disconnected and announces the outcome', async () => {
    signOutOfflineCredentialsMock.mockResolvedValue({ success: true });
    refetchCredentialsMock.mockResolvedValue({
      available: true,
      connected: false,
    });
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
    expect(signOutOfflineCredentialsMock).toHaveBeenCalledOnce();
    expect(refetchCredentialsMock).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toBe(
      ScheduledTasksI18nKeys.DisconnectSuccessAnnouncement,
    );
  });

  it('keeps the dialog open with the failed message when the signout request fails', async () => {
    signOutOfflineCredentialsMock.mockRejectedValue(new Error('network'));
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
  });

  it('keeps the dialog open when the POST succeeds but the fresh check fails', async () => {
    signOutOfflineCredentialsMock.mockResolvedValue({ success: true });
    refetchCredentialsMock.mockResolvedValue(null);
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
  });

  it('does not duplicate the signout request on repeated confirms', async () => {
    signOutOfflineCredentialsMock.mockReturnValue(
      new Promise(() => {
        /** */
      }),
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
    const confirmButton = within(screen.getByRole('dialog')).getByRole(
      'button',
      { name: ButtonsI18nKeys.LogOut },
    );
    await userEvent.click(confirmButton);
    await userEvent.click(confirmButton);

    expect(signOutOfflineCredentialsMock).toHaveBeenCalledOnce();
  });
});
