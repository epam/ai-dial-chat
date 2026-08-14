import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { render, screen } from '@testing-library/react';
import type { AriaAttributes } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NAVIGATION_CONFIG } from '../../../constants/navigation';
import { NavigationI18nKeys } from '../../../constants/translation-keys';
import * as useUiFeatureModule from '../../../hooks/useUiFeature';
import { UserConfigStatus } from '../../../types/user-config-status';
import Navigation from '../Navigation';

vi.mock('../../../hooks/useUiFeature');

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: {
    LG: 24,
  },
  mergeClasses: (...classes: (string | undefined)[]) =>
    classes.filter(Boolean).join(' '),
  IconButton: ({
    'aria-label': ariaLabel,
    'aria-current': ariaCurrent,
  }: {
    'aria-label': string;
    'aria-current'?: AriaAttributes['aria-current'];
  }) => (
    <button type="button" aria-label={ariaLabel} aria-current={ariaCurrent} />
  ),
}));

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ currentThemeFavicon: undefined }),
}));

const useAppConfigMock = vi.fn();
vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => useAppConfigMock(),
}));

vi.mock('../UserMenu', () => ({
  default: () => <div>User menu</div>,
}));

vi.mock('../../LogoutConfirmation/LogoutConfirmationModal', () => ({
  default: () => null,
}));

const renderNavigation = (initialPath = '/') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Navigation />
    </MemoryRouter>,
  );

describe('Navigation', () => {
  const mockUseUiFeature = vi.mocked(useUiFeatureModule.useUiFeature);

  beforeEach(() => {
    useAppConfigMock.mockReturnValue({
      status: UserConfigStatus.Ready,
      features: { scheduledTasksEnabled: true },
    });
    mockUseUiFeature.mockImplementation(
      (feature) => feature !== OverlayFeature.HideUserMenu,
    );
  });

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
    renderNavigation('/');
    expect(
      screen
        .getByRole('button', { name: NavigationI18nKeys.Home })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('marks Catalog as active on the /catalog route', () => {
    renderNavigation('/catalog');
    expect(
      screen
        .getByRole('button', { name: NavigationI18nKeys.Catalog })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('does not mark Home as active on /catalog', () => {
    renderNavigation('/catalog');
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

  it('Home nav item has href="/"', () => {
    renderNavigation();
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/');
  });

  it('Catalog nav item has href="/catalog"', () => {
    renderNavigation();
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/catalog');
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
    useAppConfigMock.mockReturnValue({
      status: UserConfigStatus.Ready,
      features: { scheduledTasksEnabled: true },
    });
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
    expect(
      screen.getByRole('button', { name: NavigationI18nKeys.FileManager }),
    ).toBeTruthy();
  });

  it('keeps other nav items when file-manager is disabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature !== OverlayFeature.FileManager,
    );
    renderNavigation();
    expect(
      screen.getByRole('button', { name: NavigationI18nKeys.Catalog }),
    ).toBeTruthy();
  });

  it('keeps other nav items when catalog is disabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature !== OverlayFeature.Catalog,
    );
    renderNavigation();
    expect(
      screen.getByRole('button', { name: NavigationI18nKeys.Home }),
    ).toBeTruthy();
  });

  it('hides the user menu when hide-user-menu is enabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.HideUserMenu,
    );
    renderNavigation();
    expect(screen.queryByText('User menu')).toBeNull();
  });

  it('shows the user menu by default', () => {
    renderNavigation();
    expect(screen.getByText('User menu')).toBeTruthy();
  });
});
