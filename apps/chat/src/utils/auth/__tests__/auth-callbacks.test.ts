import { beforeEach, describe, expect, it, vi } from 'vitest';

import { callbacks } from '../auth-callbacks';

const {
  mockGetOrDiscoverClient,
  mockGetRefreshToken,
  mockSetIsRefreshTokenStart,
  mockResetRefreshingState,
  mockClientRefresh,
  mockGetAuthAdditionalParamsExchangeBody,
} = vi.hoisted(() => ({
  mockGetOrDiscoverClient: vi.fn(),
  mockGetRefreshToken: vi.fn(),
  mockSetIsRefreshTokenStart: vi.fn(),
  mockResetRefreshingState: vi.fn(),
  mockClientRefresh: vi.fn(),
  mockGetAuthAdditionalParamsExchangeBody: vi.fn(),
}));

vi.mock('@/src/utils/auth/nextauth-client', () => ({
  default: {
    getOrDiscoverClient: mockGetOrDiscoverClient,
    getRefreshToken: mockGetRefreshToken,
    setIsRefreshTokenStart: mockSetIsRefreshTokenStart,
    resetRefreshingState: mockResetRefreshingState,
    delay: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('openid-client', () => ({ TokenSet: class {} }));

vi.mock('jose', () => ({
  decodeJwt: () => ({ exp: Math.floor(Date.now() / 1000) + 3600 }),
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

// safeParseJSON is imported as '../json' in auth-callbacks.ts which resolves
// to apps/chat/src/utils/json.ts; we mock via the @/ alias.
vi.mock('@/src/utils/json', () => ({ safeParseJSON: () => ({}) }));

vi.mock('@/src/utils/server/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../auth-additional-params', () => ({
  getAuthAdditionalParamsExchangeBody: mockGetAuthAdditionalParamsExchangeBody,
}));

vi.mock('@epam/ai-dial-shared', () => ({ Feature: {} }));

vi.mock('../auth-providers', () => ({
  CREDENTIALS_PROVIDER_ID: 'credentials',
  getProviderConfigById: vi.fn(),
  isCredentialsProvider: (id: string | undefined) => id === 'credentials',
}));

vi.mock('../auth-token-utils', () => ({
  getTokenExpirationMs: vi.fn(),
  validateProviderAccessToken: vi.fn(),
}));

vi.mock('lodash-es/get', () => ({ default: () => [] }));
vi.mock('lodash-es/intersection', () => ({ default: () => [] }));
vi.mock('lodash-es/snakeCase', () => ({ default: (s: string) => s }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAST_EXPIRY_MS = Date.now() - 60_000;
const FUTURE_EXPIRY_MS = Date.now() + 60_000;

const makeExpiredToken = (overrides = {}) => ({
  userId: 'u1',
  providerId: 'auth0',
  sub: 'sub-1',
  access_token: 'old-access-token',
  refreshToken: 'rt-old',
  idToken: 'old-id-token',
  accessTokenExpires: PAST_EXPIRY_MS,
  ...overrides,
});

const makeValidRefreshResponse = () => ({
  access_token: 'fresh-access-token',
  id_token: 'fresh-id-token',
  refresh_token: 'rt-new',
  expires_in: 3600,
});

// ---------------------------------------------------------------------------
// Tests – refresh lock lifecycle
// ---------------------------------------------------------------------------

describe('callbacks.jwt – refresh lock lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing refresh state → this request acquires the lock
    mockGetRefreshToken.mockReturnValue(undefined);
    mockGetAuthAdditionalParamsExchangeBody.mockReturnValue(undefined);
  });

  describe('successful refresh', () => {
    it('acquires the lock, calls client.refresh, and stores the refreshed token', async () => {
      const client = {
        refresh: mockClientRefresh.mockResolvedValue(
          makeValidRefreshResponse(),
        ),
      };
      mockGetOrDiscoverClient.mockResolvedValue(client);

      const token = makeExpiredToken();
      await callbacks.jwt!({
        token,
        trigger: undefined as never,
        account: null,
      } as never);

      // Lock acquired
      expect(mockSetIsRefreshTokenStart).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ isRefreshing: true }),
      );
      expect(mockClientRefresh).toHaveBeenCalledWith('rt-old', undefined);
      // Lock released with fresh token
      expect(mockSetIsRefreshTokenStart).toHaveBeenLastCalledWith(
        'u1',
        expect.objectContaining({ isRefreshing: false }),
      );
      // Never cleared (no failure)
      expect(mockResetRefreshingState).not.toHaveBeenCalled();
    });

    it('returns the refreshed token without an error field', async () => {
      const client = {
        refresh: mockClientRefresh.mockResolvedValue(
          makeValidRefreshResponse(),
        ),
      };
      mockGetOrDiscoverClient.mockResolvedValue(client);

      const result = await callbacks.jwt!({
        token: makeExpiredToken(),
        trigger: undefined as never,
        account: null,
      } as never);

      expect((result as { error?: string }).error).toBeUndefined();
    });

    it('passes AUTH_ADDITIONAL_PARAMS into the refresh exchange body', async () => {
      const client = {
        refresh: mockClientRefresh.mockResolvedValue(
          makeValidRefreshResponse(),
        ),
      };
      mockGetOrDiscoverClient.mockResolvedValue(client);
      mockGetAuthAdditionalParamsExchangeBody.mockReturnValue({
        organization_id: 'org-1',
        tenant_id: 'tenant-1',
      });

      await callbacks.jwt!({
        token: makeExpiredToken(),
        trigger: undefined as never,
        account: null,
      } as never);

      expect(mockClientRefresh).toHaveBeenCalledWith('rt-old', {
        exchangeBody: {
          organization_id: 'org-1',
          tenant_id: 'tenant-1',
        },
      });
    });
  });

  describe('failed refresh – lock cleanup', () => {
    it('calls resetRefreshingState when client.refresh() throws', async () => {
      const client = {
        refresh: mockClientRefresh.mockRejectedValue(
          new Error('invalid_grant'),
        ),
      };
      mockGetOrDiscoverClient.mockResolvedValue(client);

      const result = await callbacks.jwt!({
        token: makeExpiredToken(),
        trigger: undefined as never,
        account: null,
      } as never);

      expect((result as { error?: string }).error).toBe(
        'RefreshAccessTokenError',
      );
      // Lock must be cleared so the next request can retry
      expect(mockResetRefreshingState).toHaveBeenCalledWith('u1');
    });

    it('calls resetRefreshingState when the provider returns a response missing expiry fields', async () => {
      const client = {
        refresh: mockClientRefresh.mockResolvedValue({
          access_token: 'tok',
          // missing expires_in and expires_at
        }),
      };
      mockGetOrDiscoverClient.mockResolvedValue(client);

      const result = await callbacks.jwt!({
        token: makeExpiredToken(),
        trigger: undefined as never,
        account: null,
      } as never);

      expect((result as { error?: string }).error).toBe(
        'RefreshAccessTokenError',
      );
      expect(mockResetRefreshingState).toHaveBeenCalledWith('u1');
    });

    it('does NOT call resetRefreshingState when no OIDC client is found (lock was never acquired)', async () => {
      mockGetOrDiscoverClient.mockResolvedValue(null);

      const result = await callbacks.jwt!({
        token: makeExpiredToken(),
        trigger: undefined as never,
        account: null,
      } as never);

      expect((result as { error?: string }).error).toBe(
        'RefreshAccessTokenError',
      );
      // Lock was never set because we exited before the while loop's break
      expect(mockResetRefreshingState).not.toHaveBeenCalled();
      // Ensure we also never set the lock
      expect(mockSetIsRefreshTokenStart).not.toHaveBeenCalled();
    });

    it('does NOT call resetRefreshingState for a waiter that times out', async () => {
      // Simulate another request already holding the lock
      mockGetRefreshToken.mockReturnValue({
        isRefreshing: true,
        token: makeExpiredToken(),
      });

      // Waiter will poll and eventually time out (5 * 1000 / 50 = 100 iterations)
      // delay is mocked to return immediately, so this will loop quickly
      const result = await callbacks.jwt!({
        token: makeExpiredToken(),
        trigger: undefined as never,
        account: null,
      } as never);

      expect((result as { error?: string }).error).toBe(
        'RefreshAccessTokenError',
      );
      // The waiter must NOT clear the lock – that belongs to the refresher
      expect(mockResetRefreshingState).not.toHaveBeenCalled();
      // The waiter must NOT set the lock either
      expect(mockSetIsRefreshTokenStart).not.toHaveBeenCalled();
    });
  });

  describe('cached valid token in refresh map', () => {
    it('returns the cached map token without calling client.refresh()', async () => {
      const cachedToken = makeExpiredToken({
        accessTokenExpires: FUTURE_EXPIRY_MS,
      });
      // Map already has a valid token
      mockGetRefreshToken.mockReturnValue({
        isRefreshing: false,
        token: cachedToken,
      });
      mockGetOrDiscoverClient.mockResolvedValue({ refresh: mockClientRefresh });

      await callbacks.jwt!({
        token: makeExpiredToken(),
        trigger: undefined as never,
        account: null,
      } as never);

      expect(mockClientRefresh).not.toHaveBeenCalled();
    });
  });

  describe('token still valid (not expired)', () => {
    it('returns the token without triggering a refresh', async () => {
      const token = makeExpiredToken({ accessTokenExpires: FUTURE_EXPIRY_MS });

      const result = await callbacks.jwt!({
        token,
        trigger: undefined as never,
        account: null,
      } as never);

      expect(mockGetOrDiscoverClient).not.toHaveBeenCalled();
      expect((result as { error?: string }).error).toBeUndefined();
    });
  });
});
