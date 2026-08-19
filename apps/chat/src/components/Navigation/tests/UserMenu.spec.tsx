import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthI18nKeys,
  BasicI18nKeys,
  SettingsI18nKeys,
} from '../../../constants/translation-keys';
import * as UserContextModule from '../../../context/auth/UserContext';
import * as ThemeContextModule from '../../../context/ThemeContext';
import * as BreakpointModule from '../../../hooks/breakpoint/useBreakpoint';
import * as useUiFeatureModule from '../../../hooks/useUiFeature';
import { AuthStatus } from '../../../types/auth-status';
import { UserMenu } from '../UserMenu';

const mockNavigate = vi.fn();
const mockUseFeatureFlag = vi.fn();

vi.mock('../../../context/auth/UserContext');
vi.mock('../../../context/ThemeContext');
vi.mock('../../../hooks/breakpoint/useBreakpoint');
vi.mock('../../../hooks/useUiFeature');
vi.mock('../../../context/AppConfigContext', () => ({
  useFeatureFlag: (key: string) => mockUseFeatureFlag(key),
}));
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUseUser = vi.mocked(UserContextModule.useUser);
const mockUseTheme = vi.mocked(ThemeContextModule.useTheme);
const mockUseIsMobile = vi.mocked(BreakpointModule.useIsMobile);
const mockUseUiFeature = vi.mocked(useUiFeatureModule.useUiFeature);

const defaultTheme = {
  currentTheme: 'dark',
  selectedTheme: 'dark',
  themes: [
    {
      id: 'dark',
      displayName: 'Dark',
      colors: {},
      topicColors: {},
      authColors: {},
      'app-logo': '',
    },
    {
      id: 'light',
      displayName: 'Light',
      colors: {},
      topicColors: {},
      authColors: {},
      'app-logo': '',
    },
  ],
  setTheme: vi.fn(),
  isLoading: false,
};

const mockUser = {
  sub: 'user-123',
  providerId: 'keycloak',
  claims: {
    email: 'john.doe@example.com',
    name: 'John Doe',
  },
  isAdmin: false,
};

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTheme.mockReturnValue(defaultTheme);
    mockUseIsMobile.mockReturnValue(false);
    mockUseUiFeature.mockReturnValue(false);
    mockUseFeatureFlag.mockReturnValue(true);
  });

  it('returns null when status is loading', () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Loading,
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders avatar image when authenticated and image claim exists', () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: {
        ...mockUser,
        claims: {
          ...mockUser.claims,
          image: 'https://example.com/avatar.png',
        },
      },
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>,
    );

    const avatar = screen.getByRole('img', { name: AuthI18nKeys.UserAvatar });
    expect(avatar).not.toBeNull();
    expect(avatar.getAttribute('src')).toBe('https://example.com/avatar.png');
  });

  it('renders short name fallback when image is missing', () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: mockUser,
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>,
    );

    expect(screen.getByText('JD')).not.toBeNull();
    expect(
      screen.queryByRole('img', { name: AuthI18nKeys.UserAvatar }),
    ).toBeNull();
  });

  it('switches to fallback when image fails to load', () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: {
        ...mockUser,
        claims: {
          ...mockUser.claims,
          image: 'https://example.com/broken-avatar.png',
        },
      },
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>,
    );

    const avatar = screen.getByRole('img', { name: AuthI18nKeys.UserAvatar });
    fireEvent.error(avatar);

    expect(screen.getByText('JD')).not.toBeNull();
  });

  it('avatar button has an aria-label', () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: mockUser,
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-label')).toBeTruthy();
  });

  it('shows the keyboard-shortcuts settings item by default', () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: mockUser,
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText(SettingsI18nKeys.KeyboardShortcuts)).toBeTruthy();
  });

  it('hides the keyboard-shortcuts settings item when hide-user-settings is enabled', () => {
    mockUseUiFeature.mockReturnValue(true);
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: mockUser,
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button'));

    expect(screen.queryByText(SettingsI18nKeys.KeyboardShortcuts)).toBeNull();
  });

  it('hides the keyboard-shortcuts settings item when hide-keyboard-shortcuts is enabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.HideKeyboardShortcuts,
    );
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: mockUser,
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button'));

    expect(screen.queryByText(SettingsI18nKeys.KeyboardShortcuts)).toBeNull();
  });

  it('keeps the language settings item when only hide-keyboard-shortcuts is enabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.HideKeyboardShortcuts,
    );
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: mockUser,
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText(SettingsI18nKeys.Language)).toBeTruthy();
  });

  it('navigates to /settings when the Settings item is clicked', async () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: mockUser,
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(
      screen.getByRole('menuitem', { name: BasicI18nKeys.Settings }),
    );

    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('hides the Settings item when the settingsPageEnabled feature flag is disabled', async () => {
    mockUseFeatureFlag.mockReturnValue(false);
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: mockUser,
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button'));

    expect(
      screen.queryByRole('menuitem', { name: BasicI18nKeys.Settings }),
    ).toBeNull();
  });

  it('shows the Settings item when the settingsPageEnabled feature flag is enabled', async () => {
    mockUseFeatureFlag.mockReturnValue(true);
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: mockUser,
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button'));

    expect(
      screen.getByRole('menuitem', { name: BasicI18nKeys.Settings }),
    ).toBeTruthy();
  });

  it('navigates to /settings when the Settings item is activated via keyboard', async () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: mockUser,
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button'));
    screen.getByRole('menuitem', { name: BasicI18nKeys.Settings }).focus();
    await userEvent.keyboard('{Enter}');

    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });
});
