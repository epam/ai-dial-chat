import * as useUsageDataModule from '@epam/ai-dial-chat-hooks';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FC } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
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
import { useSettingsTabConfig } from '../../../hooks/useSettingsTabConfig';
import { ROUTES } from '../../../types/routes';
import { SettingsTabs } from '../../../types/settings-tabs';
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
 * Partially mocked so two cases can withhold tabs the real config always
 * returns; `beforeEach` restores the real implementation for everyone else.
 */
vi.mock('../../../hooks/useSettingsTabConfig', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../hooks/useSettingsTabConfig')
    >();

  return {
    ...actual,
    useSettingsTabConfig: vi.fn(actual.useSettingsTabConfig),
  };
});

/*
 * PreferencesTab renders as the default tab, so this suite has to satisfy its
 * dependencies even though it exercises none of them.
 */
vi.mock('../../../hooks/useUiFeature', () => ({
  useUiFeature: () => false,
}));

/*
 * `useThemeOptions` reaches ThemeProvider, which this suite does not mount.
 * An empty option set also keeps the theme row out of the way of the tab
 * assertions below; PreferencesTab's own spec covers the row.
 */
vi.mock('../../../hooks/theme/useThemeOptions', () => ({
  useThemeOptions: () => ({
    options: [],
    selectedTheme: 'light',
    setTheme: vi.fn(),
  }),
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

/*
 * The active tab is the URL, so each case mounts the real route pair: the bare
 * /settings entry and the per-tab one, exactly as `app.tsx` registers them.
 * `LocationProbe` lets a case assert where a redirect or a tab click landed
 * without reaching into history.
 */
const LOCATION_LABEL = 'location';

const LocationProbe: FC = () => (
  <span data-location={useLocation().pathname}>{LOCATION_LABEL}</span>
);

const currentPath = () =>
  screen.getByText(LOCATION_LABEL).getAttribute('data-location');

const renderAt = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LocationProbe />
      <Routes>
        {[ROUTES.Settings, ROUTES.SettingsTab].map((path) => (
          <Route key={path} path={path} element={<SettingsPage />} />
        ))}
      </Routes>
    </MemoryRouter>,
  );

const renderPreferences = () =>
  renderAt(`${ROUTES.Settings}/${SettingsTabs.Preferences}`);

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
    const actualTabConfig = await vi.importActual<
      typeof import('../../../hooks/useSettingsTabConfig')
    >('../../../hooks/useSettingsTabConfig');
    vi.mocked(useSettingsTabConfig).mockImplementation(
      actualTabConfig.useSettingsTabConfig,
    );
  });

  it('renders two tabs, Preferences then Usage, with Preferences selected by default', () => {
    renderPreferences();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].textContent).toContain(SettingsI18nKeys.Preferences);
    expect(tabs[1].textContent).toContain(BasicI18nKeys.Usage);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
  });

  it('renders the Preferences pane on mount', () => {
    renderPreferences();

    expect(
      screen.getByText(SettingsI18nKeys.PreferencesDescription),
    ).toBeTruthy();
  });

  it('swaps the pane and moves selection when Usage is activated', async () => {
    renderPreferences();

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
    renderPreferences();

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
    renderPreferences();

    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].getAttribute('tabindex')).toBe('0');
    expect(tabs[1].getAttribute('tabindex')).toBe('-1');
  });

  describe('the route decides the tab', () => {
    it('renders the tab named by the URL', () => {
      renderAt(`${ROUTES.Settings}/${SettingsTabs.Usage}`);

      const tabs = screen.getAllByRole('tab');
      expect(tabs[1].getAttribute('aria-selected')).toBe('true');
      expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    });

    it('moves the URL to the tab that was activated', async () => {
      renderPreferences();

      await userEvent.click(
        screen.getByRole('tab', { name: new RegExp(BasicI18nKeys.Usage) }),
      );

      expect(currentPath()).toBe(`${ROUTES.Settings}/${SettingsTabs.Usage}`);
    });

    it('redirects the bare settings URL to the first configured tab', () => {
      renderAt(ROUTES.Settings);

      expect(currentPath()).toBe(
        `${ROUTES.Settings}/${SettingsTabs.Preferences}`,
      );
    });

    it('redirects a tab whose config entry is withheld', () => {
      vi.mocked(useSettingsTabConfig).mockReturnValue({
        items: [{ id: SettingsTabs.Preferences, label: 'Preferences' }],
        tabComponents: { [SettingsTabs.Preferences]: () => <span /> },
      });

      renderAt(`${ROUTES.Settings}/${SettingsTabs.Usage}`);

      expect(currentPath()).toBe(
        `${ROUTES.Settings}/${SettingsTabs.Preferences}`,
      );
    });

    it('renders the empty shell without navigating when no tab is configured', () => {
      vi.mocked(useSettingsTabConfig).mockReturnValue({
        items: [],
        tabComponents: {},
      });

      renderAt(ROUTES.Settings);

      expect(screen.queryByRole('tab')).toBeNull();
      /* Still the URL it was given: a redirect with no valid target would loop. */
      expect(currentPath()).toBe(ROUTES.Settings);
    });

    it('redirects an unknown tab segment to the first configured tab', () => {
      renderAt(`${ROUTES.Settings}/does-not-exist`);

      expect(currentPath()).toBe(
        `${ROUTES.Settings}/${SettingsTabs.Preferences}`,
      );
      expect(screen.getAllByRole('tab')).toHaveLength(2);
    });
  });

  it('exposes a tablist for the panel', () => {
    renderPreferences();

    expect(screen.getByRole('tablist')).toBeTruthy();
  });

  /*
   * The Usage tab passes no `enabled` argument: mounting it is itself the
   * signal that the data is wanted, now that no flag gates reaching this page.
   * Preferences is the default tab, so the fetch must wait for the user to
   * open Usage — that deferral is the point of the next two tests.
   */
  it('does not fetch usage data until the Usage tab is opened', () => {
    renderPreferences();

    expect(useUsageDataModule.useUsageData).not.toHaveBeenCalled();
  });

  it('fetches usage data once the Usage tab is activated', async () => {
    renderPreferences();

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
