import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserProfile } from '../useUserProfile';

const useUserMock = vi.fn();
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => useUserMock(),
}));

const AVATAR_URL = 'https://keycloak.example.com/avatars/user-1.png';

const withClaims = (claims: Record<string, unknown> | null) => ({
  user: claims && { sub: 'user-1', providerId: 'keycloak', claims },
});

describe('useUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the OIDC picture claim as the avatar image', () => {
    useUserMock.mockReturnValue(
      withClaims({ name: 'Jane Doe', picture: AVATAR_URL }),
    );

    const { result } = renderHook(() => useUserProfile());

    expect(result.current.image).toBe(AVATAR_URL);
    expect(result.current.isFallbackIconShown).toBe(false);
    expect(result.current.shortName).toBe('JD');
  });

  it('shows the initials fallback when the user has no picture', () => {
    useUserMock.mockReturnValue(withClaims({ name: 'Jane Doe' }));

    const { result } = renderHook(() => useUserProfile());

    expect(result.current.isFallbackIconShown).toBe(true);
  });

  it('shows the avatar once the profile loads after the first render', () => {
    useUserMock.mockReturnValue(withClaims(null));
    const { result, rerender } = renderHook(() => useUserProfile());
    expect(result.current.isFallbackIconShown).toBe(true);

    useUserMock.mockReturnValue(withClaims({ picture: AVATAR_URL }));
    rerender();

    expect(result.current.isFallbackIconShown).toBe(false);
  });

  it('falls back to initials after the avatar fails to load and retries a new URL', () => {
    useUserMock.mockReturnValue(withClaims({ picture: AVATAR_URL }));
    const { result, rerender } = renderHook(() => useUserProfile());

    act(() => result.current.setIsFallbackIconShown(true));
    expect(result.current.isFallbackIconShown).toBe(true);

    useUserMock.mockReturnValue(
      withClaims({ picture: 'https://keycloak.example.com/avatars/new.png' }),
    );
    rerender();

    expect(result.current.isFallbackIconShown).toBe(false);
  });
});
