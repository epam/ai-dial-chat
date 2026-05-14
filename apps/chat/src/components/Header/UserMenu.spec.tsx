import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as UserContextModule from '../../context/UserContext';
import { UserMenu } from './UserMenu';

vi.mock('../../context/UserContext');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      key === 'auth.signedInAs'
        ? `Signed in as ${params?.email}`
        : key === 'auth.signOut'
          ? 'Sign out'
          : key,
  }),
}));

const mockUseUser = vi.mocked(UserContextModule.useUser);

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('returns null when status is unauthenticated', () => {
    mockUseUser.mockReturnValue({
      status: 'unauthenticated',
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    const { container } = render(<UserMenu />);
    expect(container.firstChild).toBeNull();
  });

  it('renders trigger button with email-based accessible name when authenticated', () => {
    mockUseUser.mockReturnValue({
      status: 'authenticated',
      user: { sub: 'u1', providerId: 'keycloak', claims: { email: 'u@x.io' } },
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    render(<UserMenu />);

    expect(screen.getByRole('button', { name: /u@x\.io/ })).toBeTruthy();
  });

  it('clicking trigger reveals sign-out form with correct method and action', async () => {
    mockUseUser.mockReturnValue({
      status: 'authenticated',
      user: { sub: 'u1', providerId: 'keycloak', claims: { email: 'u@x.io' } },
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    render(<UserMenu />);

    const trigger = screen.getByRole('button', { name: /u@x\.io/ });
    await userEvent.click(trigger);

    const form = document.querySelector('form');
    expect(form).toBeTruthy();
    expect(form?.getAttribute('method')).toBe('POST');
    expect(form?.getAttribute('action')).toBe('/api/v1/auth/logout');
  });

  it('sign-out submit button is accessible by role and name', async () => {
    mockUseUser.mockReturnValue({
      status: 'authenticated',
      user: { sub: 'u1', providerId: 'keycloak', claims: { email: 'u@x.io' } },
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    render(<UserMenu />);

    const trigger = screen.getByRole('button', { name: /u@x\.io/ });
    await userEvent.click(trigger);

    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy();
  });
});
