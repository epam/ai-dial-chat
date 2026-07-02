import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('renders provider links with callbackUrl forwarded to BFF login', async () => {
    mockGetProviders.mockResolvedValue([
      { id: 'keycloak', label: 'Keycloak' },
      { id: 'auth0', label: 'Auth0' },
    ]);

    renderLogin(
      '/login?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Fconversation%3Fx%3D1',
    );

    const keycloakLink = await screen.findByRole('link', { name: 'Keycloak' });
    const auth0Link = screen.getByRole('link', { name: 'Auth0' });

    expect(keycloakLink.getAttribute('href')).toBe(
      '/api/v1/auth/login/keycloak?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Fconversation%3Fx%3D1',
    );
    expect(auth0Link.getAttribute('href')).toBe(
      '/api/v1/auth/login/auth0?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Fconversation%3Fx%3D1',
    );
  });

  it('defaults callbackUrl to application root when it is absent', async () => {
    mockGetProviders.mockResolvedValue([{ id: 'keycloak', label: 'Keycloak' }]);

    renderLogin();

    const keycloakLink = await screen.findByRole('link', { name: 'Keycloak' });

    expect(keycloakLink.getAttribute('href')).toBe(
      `/api/v1/auth/login/keycloak?callbackUrl=${encodeURIComponent(
        `${window.location.origin}/`,
      )}`,
    );
  });

  it('renders loading state while providers are loading', () => {
    mockGetProviders.mockReturnValue(new Promise(() => {}));

    renderLogin();

    expect(screen.getByText(AuthI18nKeys.Loading)).toBeTruthy();
  });

  it('renders error message when getProviders rejects', async () => {
    mockGetProviders.mockRejectedValue(new Error('network error'));

    renderLogin();

    expect(await screen.findByText(AuthI18nKeys.ProvidersError)).toBeTruthy();
  });

  it('renders theme favicon when currentThemeFavicon is set', () => {
    mockUseTheme.mockReturnValue({
      currentTheme: ThemeId.Light,
      selectedTheme: ThemeId.Light,
      currentThemeFavicon: '/favicon.png',
      setTheme: vi.fn(),
      isLoading: false,
    });
    mockGetProviders.mockResolvedValue([]);

    const { container } = renderLogin();

    expect(container.querySelector('[style*="background-image"]')).toBeTruthy();
  });
});
