import { render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as UserContextModule from '../../../context/auth/UserContext';
import * as useAuthRedirectModule from '../../../hooks/auth/useAuthRedirect';
import { AuthStatus } from '../../../types/auth-status';
import RequireAuth from '../RequireAuth';

vi.mock('../../../context/auth/UserContext');
vi.mock('../../../hooks/auth/useAuthRedirect');

const mockUseUser = vi.mocked(UserContextModule.useUser);
const mockUseAuthRedirect = vi.mocked(useAuthRedirectModule.useAuthRedirect);

const renderWithRouter = (ui: ReactNode) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('RequireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthRedirect.mockReturnValue(undefined);
  });

  it('renders a loading spinner when status is loading', () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Loading,
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    const { container } = renderWithRouter(
      <RequireAuth>
        <p>Protected content</p>
      </RequireAuth>,
    );

    expect(container.firstChild).not.toBeNull();
    expect(screen.queryByText('Protected content')).toBeNull();
  });

  it('renders null when status is unauthenticated and invokes useAuthRedirect', () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Unauthenticated,
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    const { container } = renderWithRouter(
      <RequireAuth>
        <p>Protected content</p>
      </RequireAuth>,
    );

    expect(container.firstChild).toBeNull();
    expect(mockUseAuthRedirect).toHaveBeenCalled();
  });

  it('renders children when status is authenticated', () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'keycloak', claims: {} },
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    renderWithRouter(
      <RequireAuth>
        <p>Protected content</p>
      </RequireAuth>,
    );

    expect(screen.getByText('Protected content')).toBeTruthy();
  });
});
