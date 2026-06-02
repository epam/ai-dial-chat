import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as UserContextModule from '../../../context/auth/UserContext';
import * as ThemeContextModule from '../../../context/ThemeContext';
import * as BreakpointModule from '../../../hooks/breakpoint/useBreakpoint';
import { UserMenu } from '../UserMenu';

vi.mock('../../../context/auth/UserContext');
vi.mock('../../../context/ThemeContext');
vi.mock('../../../hooks/breakpoint/useBreakpoint');

const mockUseUser = vi.mocked(UserContextModule.useUser);
const mockUseTheme = vi.mocked(ThemeContextModule.useTheme);
const mockUseIsMobile = vi.mocked(BreakpointModule.useIsMobile);

const defaultTheme = {
  currentTheme: 'dark',
  themes: [
    { id: 'dark', displayName: 'Dark' },
    { id: 'light', displayName: 'Light' },
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
      status: 'loading',
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    const { container } = render(<UserMenu />);
    expect(container.firstChild).toBeNull();
  });

  it('renders avatar image when authenticated and image claim exists', () => {
    mockUseUser.mockReturnValue({
      status: 'authenticated',
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

    render(<UserMenu />);

    const avatar = screen.getByRole('img', { name: 'User avatar' });
    expect(avatar).not.toBeNull();
    expect(avatar.getAttribute('src')).toBe('https://example.com/avatar.png');
  });

  it('renders short name fallback when image is missing', () => {
    mockUseUser.mockReturnValue({
      status: 'authenticated',
      user: mockUser,
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    render(<UserMenu />);

    expect(screen.getByText('JD')).not.toBeNull();
    expect(screen.queryByRole('img', { name: 'User avatar' })).toBeNull();
  });

  it('switches to fallback when image fails to load', () => {
    mockUseUser.mockReturnValue({
      status: 'authenticated',
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

    render(<UserMenu />);

    const avatar = screen.getByRole('img', { name: 'User avatar' });
    fireEvent.error(avatar);

    expect(screen.getByText('JD')).not.toBeNull();
  });

  it('avatar button has an aria-label', () => {
    mockUseUser.mockReturnValue({
      status: 'authenticated',
      user: mockUser,
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    render(<UserMenu />);

    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-label')).toBeTruthy();
  });
});
