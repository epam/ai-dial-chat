import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserProfile } from '../useUserProfile';

const useUserMock = vi.fn();
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => useUserMock(),
}));

const AVATAR_URL = 'https://keycloak.example.com/avatars/user-1.png';

const withProfile = (
  profile: { pictureUrl?: string; claims?: Record<string, unknown> } | null,
) => ({
  user: profile && {
    sub: 'user-1',
    providerId: 'keycloak',
    isAdmin: false,
    claims: {},
    ...profile,
  },
});

describe('useUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the profile pictureUrl as the avatar image', () => {
    useUserMock.mockReturnValue(
      withProfile({ pictureUrl: AVATAR_URL, claims: { name: 'Jane Doe' } }),
    );

    const { result } = renderHook(() => useUserProfile());

    expect(result.current.image).toBe(AVATAR_URL);
    expect(result.current.isFallbackIconShown).toBe(false);
    expect(result.current.shortName).toBe('JD');
  });

  it('uses the same-origin picture endpoint for an inline IdP picture', () => {
    useUserMock.mockReturnValue(
      withProfile({ pictureUrl: '/api/v1/auth/me/picture' }),
    );

    const { result } = renderHook(() => useUserProfile());

    expect(result.current.image).toBe('/api/v1/auth/me/picture');
    expect(result.current.isFallbackIconShown).toBe(false);
  });

  it('shows the initials fallback when the user has no picture', () => {
    useUserMock.mockReturnValue(withProfile({ claims: { name: 'Jane Doe' } }));

    const { result } = renderHook(() => useUserProfile());

    expect(result.current.isFallbackIconShown).toBe(true);
  });

  it('shows the avatar once the profile loads after the first render', () => {
    useUserMock.mockReturnValue(withProfile(null));
    const { result, rerender } = renderHook(() => useUserProfile());
    expect(result.current.isFallbackIconShown).toBe(true);

    useUserMock.mockReturnValue(withProfile({ pictureUrl: AVATAR_URL }));
    rerender();

    expect(result.current.isFallbackIconShown).toBe(false);
  });

  it('falls back to initials after the avatar fails to load and retries a new URL', () => {
    useUserMock.mockReturnValue(withProfile({ pictureUrl: AVATAR_URL }));
    const { result, rerender } = renderHook(() => useUserProfile());

    act(() => result.current.setIsFallbackIconShown(true));
    expect(result.current.isFallbackIconShown).toBe(true);

    useUserMock.mockReturnValue(
      withProfile({
        pictureUrl: 'https://keycloak.example.com/avatars/new.png',
      }),
    );
    rerender();

    expect(result.current.isFallbackIconShown).toBe(false);
  });
});
