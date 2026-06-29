import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthI18nKeys } from '../../../constants/translation-keys';
import * as UserContextModule from '../../../context/auth/UserContext';
import * as ThemeContextModule from '../../../context/ThemeContext';
import * as BreakpointModule from '../../../hooks/breakpoint/useBreakpoint';
import { AuthStatus } from '../../../types/auth-status';
import { UserMenu } from '../UserMenu';

vi.mock('../../../context/auth/UserContext');
vi.mock('../../../context/ThemeContext');
vi.mock('../../../hooks/breakpoint/useBreakpoint');

const mockUseUser = vi.mocked(UserContextModule.useUser);
const mockUseTheme = vi.mocked(ThemeContextModule.useTheme);
const mockUseIsMobile = vi.mocked(BreakpointModule.useIsMobile);

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
};

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTheme.mockReturnValue(defaultTheme);
    mockUseIsMobile.mockReturnValue(false);
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
    expect(container.firstChild).toBeNull();
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
});
