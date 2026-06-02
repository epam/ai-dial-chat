import { beforeEach, describe, expect, it } from 'vitest';

import { Token } from '@/src/types/auth';

import NextClient from '../nextauth-client';

// Helper to build a minimal Token for testing
const makeToken = (overrides: Partial<Token> = {}): Token => ({
  userId: 'user-1',
  refreshToken: 'rt-abc',
  ...overrides,
});

describe('NextClient – refresh token map', () => {
  beforeEach(() => {
    // Reset the global refresh map between tests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any)._refreshTokenMap = undefined;
  });

  describe('getRefreshToken', () => {
    it('returns undefined when no entry exists for the userId', () => {
      expect(NextClient.getRefreshToken('unknown-user')).toBeUndefined();
    });

    it('returns the stored entry after setIsRefreshTokenStart', () => {
      const token = makeToken();
      NextClient.setIsRefreshTokenStart('user-1', {
        isRefreshing: true,
        token,
      });
      const result = NextClient.getRefreshToken('user-1');
      expect(result).toEqual({ isRefreshing: true, token });
    });
  });

  describe('resetRefreshingState', () => {
    it('is a no-op when no entry exists', () => {
      expect(() => NextClient.resetRefreshingState('ghost-user')).not.toThrow();
      expect(NextClient.getRefreshToken('ghost-user')).toBeUndefined();
    });

    it('resets isRefreshing to false and preserves the token', () => {
      const token = makeToken({ userId: 'user-2' });
      NextClient.setIsRefreshTokenStart('user-2', {
        isRefreshing: true,
        token,
      });

      NextClient.resetRefreshingState('user-2');

      const result = NextClient.getRefreshToken('user-2');
      expect(result?.isRefreshing).toBe(false);
      expect(result?.token).toEqual(token);
    });

    it('preserves the last known token so a subsequent refresh attempt can retry', () => {
      const expiredToken = makeToken({ accessTokenExpires: Date.now() - 1000 });
      NextClient.setIsRefreshTokenStart('user-3', {
        isRefreshing: true,
        token: expiredToken,
      });

      NextClient.resetRefreshingState('user-3');

      const result = NextClient.getRefreshToken('user-3');
      // isRefreshing cleared so the next caller can acquire the lock
      expect(result?.isRefreshing).toBe(false);
      // Original token retained so the lock-acquisition check can evaluate expiry
      expect(result?.token).toBe(expiredToken);
    });
  });

  describe('setIsRefreshTokenStart', () => {
    it('stores a refreshing entry', () => {
      const token = makeToken();
      NextClient.setIsRefreshTokenStart('user-4', {
        isRefreshing: true,
        token,
      });
      expect(NextClient.getRefreshToken('user-4')).toEqual({
        isRefreshing: true,
        token,
      });
    });

    it('overwrites an existing entry', () => {
      const oldToken = makeToken({ userId: 'user-5' });
      const newToken = makeToken({ userId: 'user-5', refreshToken: 'rt-new' });

      NextClient.setIsRefreshTokenStart('user-5', {
        isRefreshing: true,
        token: oldToken,
      });
      NextClient.setIsRefreshTokenStart('user-5', {
        isRefreshing: false,
        token: newToken,
      });

      expect(NextClient.getRefreshToken('user-5')).toEqual({
        isRefreshing: false,
        token: newToken,
      });
    });
  });
});
