import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as UserContextModule from '../context/UserContext';
import * as base from '../server-api/base';
import {
  AUTH_REDIRECT_ATTEMPT_STORAGE_KEY,
  useAuthRedirect,
} from './useAuthRedirect';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../context/UserContext');

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
      status: 'unauthenticated',
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    vi.spyOn(base, 'get').mockResolvedValue([
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
      status: 'unauthenticated',
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    const getSpy = vi.spyOn(base, 'get');
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
    expect(getSpy).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('multiple providers: navigate to /login when unauthenticated', async () => {
    mockUseUser.mockReturnValue({
      status: 'unauthenticated',
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    vi.spyOn(base, 'get').mockResolvedValue([
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
      status: 'loading',
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    const getSpy = vi.spyOn(base, 'get');

    renderHook(() => useAuthRedirect(), {
      wrapper: makeWrapper('/conversation'),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(assignSpy).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('authenticated on /login: navigate to same-origin callbackUrl', async () => {
    mockUseUser.mockReturnValue({
      status: 'authenticated',
      user: { sub: 'u1', providerId: 'keycloak', claims: {} },
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
      status: 'authenticated',
      user: { sub: 'u1', providerId: 'keycloak', claims: {} },
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
      status: 'unauthenticated',
      user: null,
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    const getSpy = vi.spyOn(base, 'get');

    renderHook(() => useAuthRedirect(), { wrapper: makeWrapper('/login') });

    await new Promise((r) => setTimeout(r, 50));
    expect(getSpy).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
  });
});
