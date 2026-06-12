import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthI18nKeys } from '../../constants/translation-keys';
import * as UserContextModule from '../../context/auth/UserContext';
import * as useAuthRedirectModule from '../../hooks/auth/useAuthRedirect';
import * as authApi from '../../server-api/auth.api';
import LoginPage from './Login';

vi.mock('../../context/auth/UserContext');
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
  const mockUseAuthRedirect = vi.mocked(useAuthRedirectModule.useAuthRedirect);
  const mockGetProviders = vi.mocked(authApi.getProviders);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({
      status: 'unauthenticated',
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
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

    const links = await screen.findAllByRole('link', {
      name: AuthI18nKeys.ProviderButtonLabel,
    });
    const [keycloakLink, auth0Link] = links;

    expect(keycloakLink.tagName).toBe('A');
    expect(keycloakLink.getAttribute('href')).toBe(
      '/api/v1/auth/login/keycloak?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Fconversation%3Fx%3D1',
    );
    expect(auth0Link?.getAttribute('href')).toBe(
      '/api/v1/auth/login/auth0?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Fconversation%3Fx%3D1',
    );
  });

  it('defaults callbackUrl to application root when it is absent', async () => {
    mockGetProviders.mockResolvedValue([{ id: 'keycloak', label: 'Keycloak' }]);

    renderLogin();

    const keycloakLink = await screen.findByRole('link', {
      name: AuthI18nKeys.ProviderButtonLabel,
    });

    expect(keycloakLink.getAttribute('href')).toBe(
      `/api/v1/auth/login/keycloak?callbackUrl=${encodeURIComponent(
        `${window.location.origin}/`,
      )}`,
    );
  });
});
