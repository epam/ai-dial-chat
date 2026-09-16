import * as useUsageDataModule from '@epam/ai-dial-chat-hooks';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BasicI18nKeys,
  SettingsI18nKeys,
} from '../../../constants/translation-keys';
import {
  useAppConfig as mockUseAppConfig,
  useFeatureFlag as mockUseFeatureFlag,
} from '../../../context/tests/app-config-context-mock';
import { createDeploymentsContextValue } from '../../../context/tests/deployments-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { UserConfigStatus } from '../../../types/user-config-status';
import SettingsPage from '../SettingsPage';

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: vi.fn(),
}));

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: vi.fn(),
}));

/*
 * PreferencesTab renders as the default tab, so this suite has to satisfy its
 * dependencies even though it exercises none of them.
 */
vi.mock('../../../hooks/useUiFeature', () => ({
  useUiFeature: () => false,
}));

vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return {
    ...actual,
    useUsageData: vi.fn(),
  };
});

vi.mocked(useUsageDataModule.useUsageData).mockReturnValue({
  usage: undefined,
  isLoading: true,
  usageError: undefined,
});

describe('SettingsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockUseFeatureFlag.mockReturnValue(true);
    /*
     * PreferencesTab holds its rows behind a spinner until the app config is
     * Ready, so this suite has to report a settled config even though it
     * exercises none of the flags.
     */
    mockUseAppConfig.mockReturnValue({ status: UserConfigStatus.Ready });
    const { useDeployments } =
      await import('../../../context/DeploymentsContext');
    vi.mocked(useDeployments).mockReturnValue(createDeploymentsContextValue());
    const { useNotification } =
      await import('../../../context/NotificationContext');
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(vi.fn()),
    );
  });

  it('renders two tabs, Preferences then Usage, with Preferences selected by default', () => {
    render(<SettingsPage />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].textContent).toContain(SettingsI18nKeys.Preferences);
    expect(tabs[1].textContent).toContain(BasicI18nKeys.Usage);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
  });

  it('renders the Preferences pane on mount', () => {
    render(<SettingsPage />);

    expect(
      screen.getByText(SettingsI18nKeys.PreferencesDescription),
    ).toBeTruthy();
  });

  it('swaps the pane and moves selection when Usage is activated', async () => {
    render(<SettingsPage />);

    await userEvent.click(
      screen.getByRole('tab', { name: new RegExp(BasicI18nKeys.Usage) }),
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(
      screen.queryByText(SettingsI18nKeys.PreferencesDescription),
    ).toBeNull();
  });

  it('moves focus and selection to Usage on ArrowDown from Preferences', async () => {
    render(<SettingsPage />);

    screen.getAllByRole('tab')[0].focus();
    await userEvent.keyboard('{ArrowDown}');

    /*
     * The roving-tabindex pattern carries focus placement in tabindex, so
     * asserting it covers both halves of "arrow keys move focus and selection"
     * without reaching into document.activeElement.
     */
    const tabs = screen.getAllByRole('tab');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('tabindex')).toBe('0');
    expect(tabs[0].getAttribute('tabindex')).toBe('-1');
  });

  it('puts only the active tab in the tab order', () => {
    render(<SettingsPage />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].getAttribute('tabindex')).toBe('0');
    expect(tabs[1].getAttribute('tabindex')).toBe('-1');
  });

  it('exposes a tablist for the panel', () => {
    render(<SettingsPage />);

    expect(screen.getByRole('tablist')).toBeTruthy();
  });

  /*
   * The Usage tab passes no `enabled` argument: mounting it is itself the
   * signal that the data is wanted, now that no flag gates reaching this page.
   * Preferences is the default tab, so the fetch must wait for the user to
   * open Usage — that deferral is the point of the next two tests.
   */
  it('does not fetch usage data until the Usage tab is opened', () => {
    render(<SettingsPage />);

    expect(useUsageDataModule.useUsageData).not.toHaveBeenCalled();
  });

  it('fetches usage data once the Usage tab is activated', async () => {
    render(<SettingsPage />);

    await userEvent.click(
      screen.getByRole('tab', { name: new RegExp(BasicI18nKeys.Usage) }),
    );

    expect(useUsageDataModule.useUsageData).toHaveBeenCalledWith(
      expect.any(Function),
      true,
      /* The initial refresh token; the Usage tab bumps it on a reset boundary. */
      0,
    );
  });
});
