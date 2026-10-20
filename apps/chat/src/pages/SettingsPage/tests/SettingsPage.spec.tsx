import { render, screen } from '@testing-library/react';
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
    mockUseAppConfig.mockReturnValue({
      status: UserConfigStatus.Ready,
      config: { activeEventId: null },
    });
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

  it('renders two tabs, Preferences then Extensions, with Preferences selected by default', () => {
    renderPreferences();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].textContent).toContain(SettingsI18nKeys.Preferences);
    expect(tabs[1].textContent).toContain(SettingsI18nKeys.Extensions);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
  });

  it('renders the Preferences pane on mount', () => {
    renderPreferences();

    expect(
      screen.getByText(SettingsI18nKeys.PreferencesDescription),
    ).toBeTruthy();
  });

  it('does not offer a Usage tab', () => {
    renderPreferences();

    expect(
      screen.queryByRole('tab', { name: new RegExp(BasicI18nKeys.Usage) }),
    ).toBeNull();
  });

  describe('the route decides the tab', () => {
    it('renders the tab named by the URL', () => {
      renderAt(`${ROUTES.Settings}/${SettingsTabs.Preferences}`);

      expect(
        screen
          .getByRole('tab', { name: new RegExp(SettingsI18nKeys.Preferences) })
          .getAttribute('aria-selected'),
      ).toBe('true');
    });

    it('redirects the bare settings URL to the first configured tab', () => {
      renderAt(ROUTES.Settings);

      expect(currentPath()).toBe(
        `${ROUTES.Settings}/${SettingsTabs.Preferences}`,
      );
    });

    it('lands an old /settings/usage link on the standalone Usage page', () => {
      renderAt(`${ROUTES.Settings}/${SettingsTabs.Usage}`);

      expect(currentPath()).toBe(ROUTES.Usage);
    });

    it('redirects a tab whose config entry is withheld', () => {
      vi.mocked(useSettingsTabConfig).mockReturnValue({
        items: [{ id: SettingsTabs.Preferences, label: 'Preferences' }],
        tabComponents: { [SettingsTabs.Preferences]: () => <span /> },
      });

      renderAt(`${ROUTES.Settings}/does-not-exist`);

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

  /*
   * The Extensions entry is withheld unless `scheduledTasksEnabled` is on: the
   * BFF endpoints behind its whole domain 403 without that feature, so an
   * always-rendered tab would show a permanently dead section.
   */
  describe('the Extensions tab is gated on scheduledTasksEnabled', () => {
    it('renders the Extensions tab and pane on its URL when the flag is on', () => {
      renderAt(`${ROUTES.Settings}/${SettingsTabs.Extensions}`);

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(2);
      expect(tabs[1].textContent).toContain(SettingsI18nKeys.Extensions);
      expect(tabs[1].getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('heading', { level: 2 }).textContent).toContain(
        SettingsI18nKeys.Extensions,
      );
    });

    it('withholds the Extensions tab when the flag is off and redirects its URL', () => {
      mockUseFeatureFlag.mockImplementation(
        (key?: string) => key !== 'scheduledTasksEnabled',
      );

      renderAt(`${ROUTES.Settings}/${SettingsTabs.Extensions}`);

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(1);
      expect(tabs.map((tab) => tab.textContent)).not.toContain(
        SettingsI18nKeys.Extensions,
      );
      expect(currentPath()).toBe(
        `${ROUTES.Settings}/${SettingsTabs.Preferences}`,
      );
    });
  });

  it('exposes a tablist for the panel', () => {
    renderPreferences();

    expect(screen.getByRole('tablist')).toBeTruthy();
  });
});
