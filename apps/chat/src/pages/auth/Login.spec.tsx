import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthI18nKeys } from '../../constants/translation-keys';
import * as UserContextModule from '../../context/auth/UserContext';
import * as ThemeContextModule from '../../context/ThemeContext';
import * as useAuthRedirectModule from '../../hooks/auth/useAuthRedirect';
import * as authApi from '../../server-api/auth.api';
import { AuthStatus } from '../../types/auth-status';
import { ThemeId } from '../../types/theme-id';
import LoginPage from './Login';

vi.mock('../../context/auth/UserContext');
vi.mock('../../context/ThemeContext');
vi.mock('../../hooks/auth/useAuthRedirect');
vi.mock('../../server-api/auth.api');

const renderLogin = (initialPath = '/login') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LoginPage />
    </MemoryRouter>,
  );

describe('LoginPage', () => {
  const mockUseUser = vi.mocked(UserContextModule.useUser);
  const mockUseTheme = vi.mocked(ThemeContextModule.useTheme);
  const mockUseAuthRedirect = vi.mocked(useAuthRedirectModule.useAuthRedirect);
  const mockGetProviders = vi.mocked(authApi.getProviders);
  const neverResolvingProviders = new Promise<never>(() => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({
      status: AuthStatus.Unauthenticated,
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      currentTheme: ThemeId.Light,
      selectedTheme: ThemeId.Light,
      setTheme: vi.fn(),
      isLoading: false,
    });
    mockUseAuthRedirect.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('navigates to BFF login with callbackUrl forwarded when a provider button is clicked', async () => {
    mockGetProviders.mockResolvedValue([
      { id: 'keycloak', label: 'Keycloak' },
      { id: 'auth0', label: 'Auth0' },
    ]);

    vi.stubGlobal('location', {
      ...window.location,
      origin: 'http://localhost:4207',
    });

    renderLogin(
      '/login?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Fconversation%3Fx%3D1',
    );

    const keycloakAnchor = (
      await screen.findByRole('button', { name: 'Keycloak' })
    ).closest('a');
    expect(keycloakAnchor?.getAttribute('href')).toBe(
      '/api/v1/auth/login/keycloak?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Fconversation%3Fx%3D1',
    );

    const auth0Anchor = screen
      .getByRole('button', { name: 'Auth0' })
      .closest('a');
    expect(auth0Anchor?.getAttribute('href')).toBe(
      '/api/v1/auth/login/auth0?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Fconversation%3Fx%3D1',
    );
  });

  it('defaults callbackUrl to application root when it is absent', async () => {
    mockGetProviders.mockResolvedValue([{ id: 'keycloak', label: 'Keycloak' }]);

    vi.stubGlobal('location', {
      ...window.location,
      origin: 'http://localhost',
    });

    renderLogin();

    const keycloakAnchor = (
      await screen.findByRole('button', { name: 'Keycloak' })
    ).closest('a');
    expect(keycloakAnchor?.getAttribute('href')).toBe(
      `/api/v1/auth/login/keycloak?callbackUrl=${encodeURIComponent('http://localhost/')}`,
    );
  });

  it('renders loading state while providers are loading', () => {
    mockGetProviders.mockReturnValue(new Promise(() => undefined));

    renderLogin();

    expect(screen.getByText(AuthI18nKeys.Loading)).toBeTruthy();
  });

  it('renders error message when getProviders rejects', async () => {
    mockGetProviders.mockRejectedValue(new Error('network error'));

    renderLogin();

    expect(await screen.findByText(AuthI18nKeys.ProvidersError)).toBeTruthy();
  });

  it('replaces an external callbackUrl with the app root', async () => {
    mockGetProviders.mockResolvedValue([{ id: 'keycloak', label: 'Keycloak' }]);

    vi.stubGlobal('location', {
      ...window.location,
      origin: 'http://localhost',
    });

    renderLogin('/login?callbackUrl=https%3A%2F%2Fevil.example.com%2Fsteal');

    const keycloakAnchor = (
      await screen.findByRole('button', { name: 'Keycloak' })
    ).closest('a');
    const href = keycloakAnchor?.getAttribute('href') ?? '';

    expect(href).toContain(
      `callbackUrl=${encodeURIComponent('http://localhost/')}`,
    );
    expect(href).not.toContain('evil.example.com');
  });

  it('calls useAuthRedirect with no arguments, preserving the default (non-disabled) redirect policy', () => {
    mockGetProviders.mockReturnValue(neverResolvingProviders);

    renderLogin();

    expect(mockUseAuthRedirect).toHaveBeenCalledWith();
  });

  it('renders theme favicon when currentThemeFavicon is set', () => {
    mockUseTheme.mockReturnValue({
      currentTheme: ThemeId.Light,
      selectedTheme: ThemeId.Light,
      currentThemeFavicon: '/favicon.png',
      setTheme: vi.fn(),
      isLoading: false,
    });
    mockGetProviders.mockReturnValue(neverResolvingProviders);

    const { container } = renderLogin();

    const faviconEl = container.querySelector('[style*="background-image"]');
    expect(faviconEl).toBeTruthy();
    expect(faviconEl?.getAttribute('style')).toContain('favicon.png');
  });
});
