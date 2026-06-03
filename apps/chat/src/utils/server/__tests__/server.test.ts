import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFullToken } from '../server';

const { mockGetJWTToken, mockGetRefreshToken } = vi.hoisted(() => ({
  mockGetJWTToken: vi.fn(),
  mockGetRefreshToken: vi.fn(),
}));

vi.mock('next-auth/jwt', () => ({ getToken: mockGetJWTToken }));

vi.mock('@/src/utils/auth/nextauth-client', () => ({
  default: { getRefreshToken: mockGetRefreshToken },
}));

vi.mock('@/src/utils/app/common', () => ({
  parseCommaSeparatedList: (val: string | undefined) =>
    val
      ? val
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [],
}));

vi.mock('@/src/utils/auth/auth-providers', () => ({
  isAuthDisabled: false,
  authProviders: [],
}));

vi.mock('@/src/utils/app/file', () => ({
  constructPath: (...parts: string[]) => parts.filter(Boolean).join('/'),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FUTURE_EXPIRY = Date.now() + 60_000;
const PAST_EXPIRY = Date.now() - 60_000;

const makeJWT = (overrides = {}) => ({
  userId: 'u1',
  providerId: 'auth0',
  access_token: 'stale-access-token',
  idToken: 'stale-id-token',
  ...overrides,
});

const makeRefreshState = (overrides = {}) => ({
  isRefreshing: false,
  token: {
    userId: 'u1',
    providerId: 'auth0',
    access_token: 'fresh-access-token',
    idToken: 'fresh-id-token',
    accessTokenExpires: FUTURE_EXPIRY,
    ...overrides,
  },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getFullToken', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.AUTH_IDTOKEN_PROVIDERS;
  });

  it('returns undefined when getJWTToken returns null', async () => {
    mockGetJWTToken.mockResolvedValue(null);
    expect(await getFullToken({ req: {} as never })).toBeUndefined();
  });

  it('returns the stale cookie token when no refresh state exists', async () => {
    mockGetJWTToken.mockResolvedValue(makeJWT());
    mockGetRefreshToken.mockReturnValue(undefined);

    const result = await getFullToken({ req: {} as never });
    expect(result?.token).toBe('stale-access-token');
  });

  it('returns the stale token when refresh is still in progress (isRefreshing=true)', async () => {
    mockGetJWTToken.mockResolvedValue(makeJWT());
    mockGetRefreshToken.mockReturnValue({
      isRefreshing: true,
      token: {
        access_token: 'fresh-access-token',
        accessTokenExpires: FUTURE_EXPIRY,
      },
    });

    // Should NOT use the map entry while a refresh is in flight
    const result = await getFullToken({ req: {} as never });
    expect(result?.token).toBe('stale-access-token');
  });

  it('returns the stale token when the refresh map entry is expired', async () => {
    mockGetJWTToken.mockResolvedValue(makeJWT());
    mockGetRefreshToken.mockReturnValue(
      makeRefreshState({
        access_token: 'old-fresh-token',
        accessTokenExpires: PAST_EXPIRY,
      }),
    );

    const result = await getFullToken({ req: {} as never });
    expect(result?.token).toBe('stale-access-token');
  });

  it('returns the fresh token from the refresh map when a valid refreshed token exists', async () => {
    mockGetJWTToken.mockResolvedValue(makeJWT());
    mockGetRefreshToken.mockReturnValue(makeRefreshState());

    const result = await getFullToken({ req: {} as never });
    // Must use the token from the refresh map, not the stale cookie
    expect(result?.token).toBe('fresh-access-token');
  });

  it('includes fresh token metadata in the returned object', async () => {
    const freshState = makeRefreshState({ jobTitle: 'Engineer' });
    mockGetJWTToken.mockResolvedValue(makeJWT());
    mockGetRefreshToken.mockReturnValue(freshState);

    const result = await getFullToken({ req: {} as never });
    expect(result?.token).toBe('fresh-access-token');
    expect(result?.jobTitle).toBe('Engineer');
    expect(result?.accessTokenExpires).toBe(FUTURE_EXPIRY);
  });

  it('uses idToken from the refresh map when provider is in AUTH_IDTOKEN_PROVIDERS', async () => {
    process.env.AUTH_IDTOKEN_PROVIDERS = 'auth0';
    mockGetJWTToken.mockResolvedValue(makeJWT());
    mockGetRefreshToken.mockReturnValue(makeRefreshState());

    const result = await getFullToken({ req: {} as never });
    expect(result?.token).toBe('fresh-id-token');
  });

  it('falls back to cookie token when userId is not a string', async () => {
    mockGetJWTToken.mockResolvedValue(makeJWT({ userId: undefined }));
    mockGetRefreshToken.mockReturnValue(makeRefreshState());

    const result = await getFullToken({ req: {} as never });
    // No userId → cannot look up the refresh map
    expect(result?.token).toBe('stale-access-token');
    expect(mockGetRefreshToken).not.toHaveBeenCalled();
  });
});
