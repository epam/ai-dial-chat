import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as UserContextModule from '../../context/UserContext';
import * as useAuthRedirectModule from '../../hooks/useAuthRedirect';
import RequireAuth from './RequireAuth';

vi.mock('../../context/UserContext');
vi.mock('../../hooks/useAuthRedirect');

const mockUseUser = vi.mocked(UserContextModule.useUser);
const mockUseAuthRedirect = vi.mocked(useAuthRedirectModule.useAuthRedirect);

const renderWithRouter = (ui: React.ReactNode) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('RequireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthRedirect.mockReturnValue(undefined);
  });

  it('renders null when status is loading', () => {
    mockUseUser.mockReturnValue({
      status: 'loading',
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
    expect(screen.queryByText('Protected content')).toBeNull();
  });

  it('renders null when status is unauthenticated and invokes useAuthRedirect', () => {
    mockUseUser.mockReturnValue({
      status: 'unauthenticated',
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
      status: 'authenticated',
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
