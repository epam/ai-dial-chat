import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as UserContextModule from '../../context/auth/UserContext';
import * as authApi from '../../server-api/auth.api';
import { AuthStatus } from '../../types/auth-status';
import {
  AUTH_REDIRECT_ATTEMPT_STORAGE_KEY,
  useAuthRedirect,
} from './useAuthRedirect';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../context/auth/UserContext');

const makeWrapper =
  (initialPath = '/conversation') =>
  ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={children} />
      </Routes>
    </MemoryRouter>
  );

describe('useAuthRedirect', () => {
  const mockUseUser = vi.mocked(UserContextModule.useUser);
  let assignSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    assignSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { assign: assignSpy, origin: 'http://localhost:4207' },
      writable: true,
    });
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('single provider: window.location.assign is called once with the correct URL', async () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Unauthenticated,
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    vi.spyOn(authApi, 'getProviders').mockResolvedValue([
      { id: 'keycloak', label: 'Keycloak' },
    ]);

    renderHook(() => useAuthRedirect(), {
      wrapper: makeWrapper('/conversation'),
    });

    await vi.waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith(
        '/api/v1/auth/login/keycloak?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Fconversation',
      );
    });
    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(
      window.sessionStorage.getItem(AUTH_REDIRECT_ATTEMPT_STORAGE_KEY),
    ).toContain('http://localhost:4207/conversation');
  });

  it('recent failed automatic attempt: falls back to /login without fetching providers again', async () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Unauthenticated,
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    const getProvidersSpy = vi.spyOn(authApi, 'getProviders');
    window.sessionStorage.setItem(
      AUTH_REDIRECT_ATTEMPT_STORAGE_KEY,
      JSON.stringify({
        callbackUrl: 'http://localhost:4207/conversation',
        createdAt: Date.now(),
      }),
    );

    renderHook(() => useAuthRedirect(), {
      wrapper: makeWrapper('/conversation'),
    });

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/login?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Fconversation',
        { replace: true },
      );
    });
    expect(getProvidersSpy).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('multiple providers: navigate to /login when unauthenticated', async () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Unauthenticated,
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    vi.spyOn(authApi, 'getProviders').mockResolvedValue([
      { id: 'keycloak', label: 'Keycloak' },
      { id: 'auth0', label: 'Auth0' },
    ]);

    renderHook(() => useAuthRedirect(), {
      wrapper: makeWrapper('/conversation'),
    });

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/login?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Fconversation',
        { replace: true },
      );
    });
  });

  it('no navigation when status is loading', async () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Loading,
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    const getProvidersSpy = vi.spyOn(authApi, 'getProviders');

    renderHook(() => useAuthRedirect(), {
      wrapper: makeWrapper('/conversation'),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(assignSpy).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getProvidersSpy).not.toHaveBeenCalled();
  });

  it('authenticated on /login: navigate to same-origin callbackUrl', async () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'keycloak', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    window.sessionStorage.setItem(
      AUTH_REDIRECT_ATTEMPT_STORAGE_KEY,
      JSON.stringify({
        callbackUrl: 'http://localhost:4207/conversation?x=1',
        createdAt: Date.now(),
      }),
    );

    renderHook(() => useAuthRedirect(), {
      wrapper: makeWrapper(
        '/login?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Fconversation%3Fx%3D1',
      ),
    });

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/conversation?x=1', {
        replace: true,
      });
    });
    expect(
      window.sessionStorage.getItem(AUTH_REDIRECT_ATTEMPT_STORAGE_KEY),
    ).toBeNull();
  });

  it('authenticated on /login: navigate to / when callbackUrl is missing', async () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'keycloak', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    renderHook(() => useAuthRedirect(), { wrapper: makeWrapper('/login') });

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('no provider fetch on /login route when unauthenticated', async () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Unauthenticated,
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    const getProvidersSpy = vi.spyOn(authApi, 'getProviders');

    renderHook(() => useAuthRedirect(), { wrapper: makeWrapper('/login') });

    await new Promise((r) => setTimeout(r, 50));
    expect(getProvidersSpy).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('disabled: true suppresses every automatic side effect when unauthenticated', async () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Unauthenticated,
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    const getProvidersSpy = vi.spyOn(authApi, 'getProviders');

    renderHook(() => useAuthRedirect({ disabled: true }), {
      wrapper: makeWrapper('/conversation'),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(getProvidersSpy).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(
      window.sessionStorage.getItem(AUTH_REDIRECT_ATTEMPT_STORAGE_KEY),
    ).toBeNull();
  });

  it('disabled: true suppresses the authenticated-on-/login redirect too', async () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'keycloak', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    renderHook(() => useAuthRedirect({ disabled: true }), {
      wrapper: makeWrapper('/login'),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('omitted options preserve default behavior (equivalent to disabled: false)', async () => {
    mockUseUser.mockReturnValue({
      status: AuthStatus.Unauthenticated,
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    vi.spyOn(authApi, 'getProviders').mockResolvedValue([
      { id: 'keycloak', label: 'Keycloak' },
    ]);

    renderHook(() => useAuthRedirect({ disabled: false }), {
      wrapper: makeWrapper('/conversation'),
    });

    await vi.waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith(
        '/api/v1/auth/login/keycloak?callbackUrl=http%3A%2F%2Flocalhost%3A4207%2Fconversation',
      );
    });
  });
});
