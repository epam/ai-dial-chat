import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AuthSource } from '../../auth-source.enum';
import { resolvePrincipalKey } from '../principal-key';
import type { SessionUser } from '../session.types';

const makeUser = (overrides: Partial<SessionUser>): SessionUser => ({
  sub: 'test-sub',
  providerId: 'keycloak',
  at: 'test-access-token',
  bucket: 'test-bucket',
  claims: {},
  ...overrides,
});

describe('resolvePrincipalKey', () => {
  it('derives a cookie principal from the session id', () => {
    expect(
      resolvePrincipalKey(makeUser({ sid: 'sid-1' }), AuthSource.Cookie),
    ).toBe('c:sid-1');
  });

  it('derives a header principal from providerId and sub', () => {
    expect(
      resolvePrincipalKey(
        makeUser({ providerId: 'keycloak', sub: 'subject-1' }),
        AuthSource.Header,
      ),
    ).toBe('h:keycloak:subject-1');
  });

  it('ignores the sid a header-authenticated user must never carry', () => {
    expect(
      resolvePrincipalKey(
        makeUser({ providerId: 'keycloak', sub: 'subject-1', sid: 'sid-1' }),
        AuthSource.Header,
      ),
    ).toBe('h:keycloak:subject-1');
  });

  /*
   * Injectivity: without per-component encoding both of these would flatten to
   * `h:a:b:c`, letting one principal address the other's generation.
   */
  it('keeps components that contain the separator distinct', () => {
    const first = resolvePrincipalKey(
      makeUser({ providerId: 'a', sub: 'b:c' }),
      AuthSource.Header,
    );
    const second = resolvePrincipalKey(
      makeUser({ providerId: 'a:b', sub: 'c' }),
      AuthSource.Header,
    );

    expect(first).toBe('h:a:b%3Ac');
    expect(second).toBe('h:a%3Ab:c');
    expect(first).not.toBe(second);
  });

  it('keeps a percent-encoded component distinct from its literal spelling', () => {
    expect(
      resolvePrincipalKey(
        makeUser({ providerId: 'a', sub: 'b%3Ac' }),
        AuthSource.Header,
      ),
    ).not.toBe(
      resolvePrincipalKey(
        makeUser({ providerId: 'a', sub: 'b:c' }),
        AuthSource.Header,
      ),
    );
  });

  it('never lets a cookie principal share a key with a header principal', () => {
    const cookieKey = resolvePrincipalKey(
      makeUser({ sid: 'shared-identity' }),
      AuthSource.Cookie,
    );
    const headerKey = resolvePrincipalKey(
      makeUser({ providerId: 'shared-identity', sub: 'shared-identity' }),
      AuthSource.Header,
    );

    expect(cookieKey).toBe('c:shared-identity');
    expect(headerKey).toBe('h:shared-identity:shared-identity');
    expect(cookieKey).not.toBe(headerKey);
  });

  it.each([
    ['an undefined authSource', makeUser({ sid: 'sid-1' }), undefined],
    [
      'a cookie user with no sid',
      makeUser({ sid: undefined }),
      AuthSource.Cookie,
    ],
    [
      'a cookie user with an empty sid',
      makeUser({ sid: '' }),
      AuthSource.Cookie,
    ],
    [
      'a header user with an empty sub',
      makeUser({ sub: '' }),
      AuthSource.Header,
    ],
    [
      'a header user with an empty providerId',
      makeUser({ providerId: '' }),
      AuthSource.Header,
    ],
  ])('throws UnauthorizedException for %s', (_case, user, authSource) => {
    expect(() => resolvePrincipalKey(user, authSource)).toThrow(
      UnauthorizedException,
    );
  });
});
