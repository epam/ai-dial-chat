import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as ThemeContext from '../../context/ThemeContext';
import * as UserContextModule from '../../context/UserContext';
import Header from './Header';

vi.mock('../../context/ThemeContext');
vi.mock('../../utils/icon-path');
vi.mock('../../context/UserContext');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      key === 'auth.signedInAs' ? `Signed in as ${params?.email}` : key,
  }),
}));

describe('Header', () => {
  const mockUseTheme = vi.mocked(ThemeContext.useTheme);
  const mockUseUser = vi.mocked(UserContextModule.useUser);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      currentThemeLogo: 'logo.svg',
      themes: [],
      setTheme: vi.fn(),
      isLoading: false,
    });
    mockUseUser.mockReturnValue({
      status: 'unauthenticated',
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });
  });

  it('should render Header component', () => {
    const { container } = render(<Header />);
    const header = container.querySelector('header');
    expect(header).toBeTruthy();
  });

  it('should render Logo component inside Header', () => {
    const { container } = render(<Header />);
    // Logo renders as an <a> element with aria-label="logo"
    const logo = container.querySelector('a[aria-label="logo"]');
    expect(logo).toBeTruthy();
  });

  it('should apply correct styling classes', () => {
    const { container } = render(<Header />);
    const header = container.querySelector('header');

    expect(header?.classList.contains('relative')).toBe(true);
    expect(header?.classList.contains('z-30')).toBe(true);
    expect(header?.classList.contains('flex')).toBe(true);
    expect(header?.classList.contains('min-h-[49px]')).toBe(true);
    expect(header?.classList.contains('w-full')).toBe(true);
  });

  it('should match snapshot', () => {
    const { container } = render(<Header />);
    expect(container).toMatchSnapshot();
  });

  it('renders UserMenu mount point when authenticated user is present', () => {
    mockUseUser.mockReturnValue({
      status: 'authenticated',
      user: { sub: 'u1', providerId: 'keycloak', claims: { email: 'u@x.io' } },
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    render(<Header />);

    expect(screen.getByRole('button', { name: /u@x\.io/ })).toBeTruthy();
  });
});
