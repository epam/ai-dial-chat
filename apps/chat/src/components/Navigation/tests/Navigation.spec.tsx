import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AriaAttributes, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NAVIGATION_CONFIG } from '../../../constants/navigation';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  NavigationI18nKeys,
  SettingsI18nKeys,
} from '../../../constants/translation-keys';
import * as useUiFeatureModule from '../../../hooks/useUiFeature';
import { AuthStatus } from '../../../types/auth-status';
import { UserConfigStatus } from '../../../types/user-config-status';
import Navigation from '../Navigation';

vi.mock('../../../hooks/useUiFeature');

/* The shipped locale list is data, not behaviour under test: the app ships
   English only today, which hides the language group outright. Two locales
   keep the group renderable so its feature gating stays observable; the
   single-locale case gets its own test by trimming this array. */
const { supportedLanguages } = vi.hoisted(() => ({
  supportedLanguages: [] as { code: string; nativeName: string }[],
}));

const resetSupportedLanguages = () =>
  supportedLanguages.splice(
    0,
    supportedLanguages.length,
    { code: 'en', nativeName: 'English' },
    { code: 'de', nativeName: 'Deutsch' },
  );

vi.mock('../../../hooks/language/useLanguage', () => ({
  SUPPORTED_LANGUAGES: supportedLanguages,
  useLanguage: () => ({ language: 'en', changeLanguage: vi.fn() }),
}));

interface MockDropdownItem {
  key: string;
  label?: ReactNode;
  onClick?: () => void;
  children?: MockDropdownItem[];
}

/* The real Dropdown renders into a floating overlay; the mock renders items
   inline so the assertions stay about menu content, not positioning. */
vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  BASE_ICON_SIZE: 20,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ElementSize: { Standard: 'standard' },
  DropdownItemType: { PlainText: 'plainText', Divider: 'divider' },
  mergeClasses: (...classes: (string | undefined)[]) =>
    classes.filter(Boolean).join(' '),
  Tooltip: ({ children }: { children: ReactNode }) => children,
  EllipsisTooltip: ({ text }: { text: ReactNode }) => <span>{text}</span>,
  IconButton: ({
    'aria-label': ariaLabel,
    'aria-current': ariaCurrent,
  }: {
    'aria-label': string;
    'aria-current'?: AriaAttributes['aria-current'];
  }) => (
    <button type="button" aria-label={ariaLabel} aria-current={ariaCurrent} />
  ),
  GhostIconButton: ({
    'aria-label': ariaLabel,
    onClick,
  }: {
    'aria-label': string;
    onClick?: () => void;
  }) => <button type="button" aria-label={ariaLabel} onClick={onClick} />,
  CloseButton: ({
    ariaLabel,
    onClose,
  }: {
    ariaLabel: string;
    onClose: () => void;
  }) => <button type="button" aria-label={ariaLabel} onClick={onClose} />,
  Dropdown: ({
    children,
    items,
  }: {
    children: ReactNode;
    items: MockDropdownItem[];
  }) => (
    <>
      {children}
      <ul>
        {items.map(({ children: subItems, ...item }) => (
          <li key={item.key}>
            <button type="button" onClick={item.onClick}>
              {item.label}
            </button>
            {subItems && (
              <ul>
                {subItems.map((child) => (
                  <li key={child.key}>
                    <button type="button" onClick={child.onClick}>
                      {child.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </>
  ),
}));

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ currentThemeFavicon: undefined }),
}));

const useAppConfigMock = vi.fn();
const useFeatureFlagMock = vi.fn();
vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => useAppConfigMock(),
  useFeatureFlag: (key: string) => useFeatureFlagMock(key),
}));

const useUserMock = vi.fn();
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => useUserMock(),
}));

vi.mock('../../LogoutConfirmation/LogoutConfirmationModal', () => ({
  default: () => null,
}));

vi.mock('../../FooterMessage/FooterMessage', () => ({
  default: () => <div>Footer message</div>,
}));

const authenticatedUser = {
  status: AuthStatus.Authenticated,
  user: {
    sub: 'user-123',
    providerId: 'keycloak',
    claims: { email: 'john.doe@example.com', name: 'John Doe' },
    isAdmin: false,
  },
  refresh: vi.fn(),
  reset: vi.fn(),
};

const renderNavigation = ({
  initialPath = '/',
  isOpen = false,
}: { initialPath?: string; isOpen?: boolean } = {}) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Navigation isOpen={isOpen} onClose={vi.fn()} />
    </MemoryRouter>,
  );

const setDefaults = (
  mockUseUiFeature: ReturnType<
    typeof vi.mocked<typeof useUiFeatureModule.useUiFeature>
  >,
) => {
  vi.clearAllMocks();
  resetSupportedLanguages();
  useAppConfigMock.mockReturnValue({
    status: UserConfigStatus.Ready,
    features: { scheduledTasksEnabled: true },
  });
  useFeatureFlagMock.mockReturnValue(false);
  useUserMock.mockReturnValue(authenticatedUser);
  /* Default posture: every route feature on, every `Hide*` opt-out off. */
  mockUseUiFeature.mockImplementation(
    (feature) =>
      feature !== OverlayFeature.HideUserMenu &&
      feature !== OverlayFeature.HideUserSettings &&
      feature !== OverlayFeature.HideKeyboardShortcuts &&
      feature !== OverlayFeature.HideNavigationMenu,
  );
};

describe('Navigation rail', () => {
  const mockUseUiFeature = vi.mocked(useUiFeatureModule.useUiFeature);

  beforeEach(() => setDefaults(mockUseUiFeature));

  it('renders the nav landmark with aria-label', () => {
    renderNavigation();
    expect(
      screen.getByRole('navigation', { name: NavigationI18nKeys.AriaLabel }),
    ).toBeTruthy();
  });

  it('renders a Home button', () => {
    renderNavigation();
    expect(
      screen.getByRole('button', { name: NavigationI18nKeys.Home }),
    ).toBeTruthy();
  });

  it('marks Home as active on the / route', () => {
    renderNavigation({ initialPath: '/' });
    expect(
      screen
        .getByRole('button', { name: NavigationI18nKeys.Home })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('marks Catalog as active on the /catalog route', () => {
    renderNavigation({ initialPath: '/catalog' });
    expect(
      screen
        .getByRole('button', { name: NavigationI18nKeys.Catalog })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('does not mark Home as active on /catalog', () => {
    renderNavigation({ initialPath: '/catalog' });
    expect(
      screen
        .queryByRole('button', { name: NavigationI18nKeys.Home })
        ?.getAttribute('aria-current'),
    ).toBeNull();
  });

  it('renders each nav item as a link with the correct href', () => {
    renderNavigation();
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    for (const { path } of NAVIGATION_CONFIG) {
      expect(hrefs).toContain(path);
    }
  });

  it('hides a feature-flag-gated nav item when the flag is off', () => {
    useAppConfigMock.mockReturnValue({
      status: UserConfigStatus.Ready,
      features: { scheduledTasksEnabled: false },
    });
    renderNavigation();
    expect(
      screen.queryByRole('button', {
        name: NavigationI18nKeys.ScheduledTasks,
      }),
    ).toBeNull();
  });

  it('shows a feature-flag-gated nav item when the flag is on', () => {
    renderNavigation();
    expect(
      screen.getByRole('button', { name: NavigationI18nKeys.ScheduledTasks }),
    ).toBeTruthy();
  });

  it('always renders ungated nav items regardless of flag values', () => {
    useAppConfigMock.mockReturnValue({
      status: UserConfigStatus.Ready,
      features: { scheduledTasksEnabled: false },
    });
    renderNavigation();
    expect(
      screen.getByRole('button', { name: NavigationI18nKeys.Home }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: NavigationI18nKeys.Catalog }),
    ).toBeTruthy();
  });

  it('hides the Catalog nav item when catalog is disabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature !== OverlayFeature.Catalog,
    );
    renderNavigation();
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).not.toContain('/catalog');
    expect(
      screen.queryByRole('button', { name: NavigationI18nKeys.Catalog }),
    ).toBeNull();
  });

  it('hides the File Manager nav item when file-manager is disabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature !== OverlayFeature.FileManager,
    );
    renderNavigation();
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).not.toContain('/files');
    expect(
      screen.queryByRole('button', { name: NavigationI18nKeys.FileManager }),
    ).toBeNull();
  });

  it('shows the File Manager nav item when file-manager is enabled', () => {
    renderNavigation();
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/files');
  });
});

describe('Navigation user menu', () => {
  const mockUseUiFeature = vi.mocked(useUiFeatureModule.useUiFeature);

  beforeEach(() => setDefaults(mockUseUiFeature));

  it('shows the user menu by default', () => {
    renderNavigation();
    expect(screen.getByText(ButtonsI18nKeys.LogOut)).toBeTruthy();
  });

  it('hides the user menu when hide-user-menu is enabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.HideUserMenu,
    );
    renderNavigation();
    expect(screen.queryByText(ButtonsI18nKeys.LogOut)).toBeNull();
  });

  it('hides the user menu while authentication is still loading', () => {
    useUserMock.mockReturnValue({
      status: AuthStatus.Loading,
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    renderNavigation();
    expect(screen.queryByText(ButtonsI18nKeys.LogOut)).toBeNull();
  });

  it('offers the language and keyboard-shortcut settings groups by default', () => {
    renderNavigation();
    expect(screen.getByText(SettingsI18nKeys.Language)).toBeTruthy();
    expect(screen.getByText(SettingsI18nKeys.KeyboardShortcuts)).toBeTruthy();
  });

  it('drops both settings groups when hide-user-settings is enabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.HideUserSettings,
    );
    renderNavigation();
    expect(screen.queryByText(SettingsI18nKeys.Language)).toBeNull();
    expect(screen.queryByText(SettingsI18nKeys.KeyboardShortcuts)).toBeNull();
  });

  it('keeps the language group when only hide-keyboard-shortcuts is enabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.HideKeyboardShortcuts,
    );
    renderNavigation();
    expect(screen.getByText(SettingsI18nKeys.Language)).toBeTruthy();
    expect(screen.queryByText(SettingsI18nKeys.KeyboardShortcuts)).toBeNull();
  });

  it('drops the language group when only one locale ships', () => {
    supportedLanguages.splice(1);
    renderNavigation();
    expect(screen.queryByText(SettingsI18nKeys.Language)).toBeNull();
    expect(screen.getByText(SettingsI18nKeys.KeyboardShortcuts)).toBeTruthy();
  });

  it('hides the Settings entry when the Settings page flag is off', () => {
    renderNavigation();

    expect(screen.queryByText(BasicI18nKeys.Settings)).toBeNull();
    expect(useFeatureFlagMock).toHaveBeenCalledWith('settingsPageEnabled');
  });

  it('shows the Settings entry when the Settings page flag is on', () => {
    useFeatureFlagMock.mockReturnValue(true);

    renderNavigation();

    expect(screen.getByText(BasicI18nKeys.Settings)).toBeTruthy();
  });
});

describe('Navigation mobile sheet', () => {
  const mockUseUiFeature = vi.mocked(useUiFeatureModule.useUiFeature);

  beforeEach(() => setDefaults(mockUseUiFeature));

  it('is not rendered while closed', () => {
    renderNavigation();
    expect(
      screen.queryByRole('button', { name: NavigationI18nKeys.Profile }),
    ).toBeNull();
  });

  it('lists the profile row and the footer when open', () => {
    renderNavigation({ isOpen: true });
    expect(
      screen.getByRole('button', { name: NavigationI18nKeys.Profile }),
    ).toBeTruthy();
    expect(screen.getByText('Footer message')).toBeTruthy();
  });

  it('is not mounted when hide-navigation-menu is enabled, even when asked to open', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.HideNavigationMenu,
    );
    renderNavigation({ isOpen: true });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.queryByRole('button', { name: NavigationI18nKeys.Profile }),
    ).toBeNull();
  });

  it('reaches the keyboard-shortcut options through the profile page', async () => {
    const user = userEvent.setup();
    renderNavigation({ isOpen: true });
    /* The rail's user menu carries the same group labels, so scope the queries
       to the sheet dialog. */
    const sheet = within(screen.getByRole('dialog'));

    await user.click(
      sheet.getByRole('button', { name: NavigationI18nKeys.Profile }),
    );
    await user.click(
      sheet.getByRole('button', { name: SettingsI18nKeys.KeyboardShortcuts }),
    );
    expect(
      sheet.getByRole('button', { name: SettingsI18nKeys.ShortcutEnter }),
    ).toBeTruthy();
  });
});
