import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  getSessionCookieMaxAge,
  resolveRefreshTokenExpiry,
} from '../session-expiration';
import type { SessionPayload } from '../session.types';

const now = 1700000000;
const payload: SessionPayload = {
  v: 2,
  sid: 'sid',
  sub: 'user',
  providerId: 'keycloak',
  at: 'at',
  rt: 'rt',
  at_exp: now + 300,
  session_exp: now + 28800,
  iat: now,
  csrf: 'csrf',
  claims: {},
  bucket: 'bucket',
};

describe('session expiration', () => {
  it('bounds an unknown refresh lifetime by the application deadline', () => {
    expect(getSessionCookieMaxAge(payload, now)).toBe(28800000);
  });

  it('uses the earlier application or known refresh deadline', () => {
    expect(getSessionCookieMaxAge({ ...payload, rt_exp: now + 600 }, now)).toBe(
      600000,
    );
    expect(
      getSessionCookieMaxAge({ ...payload, rt_exp: now + 90000 }, now),
    ).toBe(28800000);
  });

  it('bounds a session without a refresh token by access-token expiry', () => {
    expect(getSessionCookieMaxAge({ ...payload, rt: '' }, now)).toBe(300000);
  });

  it.each([
    undefined,
    null,
    '1700000010',
    NaN,
    Infinity,
    now + 0.5,
    now,
    now - 1,
  ])('rejects an invalid or expired application deadline %s', (session_exp) => {
    expect(() =>
      getSessionCookieMaxAge(
        { ...payload, session_exp } as SessionPayload,
        now,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects legacy sessions and transaction payloads', () => {
    expect(() =>
      getSessionCookieMaxAge(
        { ...payload, v: 1 } as unknown as SessionPayload,
        now,
      ),
    ).toThrow(UnauthorizedException);
    expect(() => getSessionCookieMaxAge({ ...payload, sub: '' }, now)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an expired refresh deadline even with a valid access token', () => {
    expect(() =>
      getSessionCookieMaxAge({ ...payload, rt_exp: now }, now),
    ).toThrow(UnauthorizedException);
  });

  it('rejects malformed token expiration timestamps', () => {
    expect(() =>
      getSessionCookieMaxAge({ ...payload, at_exp: NaN }, now),
    ).toThrow(UnauthorizedException);
    expect(() =>
      getSessionCookieMaxAge({ ...payload, rt_exp: Infinity }, now),
    ).toThrow(UnauthorizedException);
  });
});

describe('provider refresh expiry', () => {
  it('reads a positive Keycloak lifetime from the exchange start', () => {
    expect(
      resolveRefreshTokenExpiry(
        'keycloak',
        { refresh_token: 'rt', refresh_expires_in: 600 },
        now,
      ),
    ).toBe(now + 600);
  });

  it.each([
    0,
    undefined,
    null,
    '600',
    -1,
    NaN,
    Infinity,
    1.5,
    Number.MAX_SAFE_INTEGER,
  ])(
    'does not invent an expiry for Keycloak metadata %s',
    (refresh_expires_in) => {
      expect(
        resolveRefreshTokenExpiry(
          'keycloak',
          { refresh_token: 'rt', refresh_expires_in },
          now,
        ),
      ).toBeUndefined();
    },
  );

  it('does not infer a lifetime from another provider or a JWT-shaped refresh token', () => {
    expect(
      resolveRefreshTokenExpiry(
        'auth0',
        { refresh_token: 'a.b.c', refresh_expires_in: 600 },
        now,
      ),
    ).toBeUndefined();
  });

  it('ignores expiry metadata when no refresh token was issued', () => {
    expect(
      resolveRefreshTokenExpiry('keycloak', { refresh_expires_in: 600 }, now),
    ).toBeUndefined();
  });

  it('preserves expiry when the existing token is retained without new metadata', () => {
    expect(
      resolveRefreshTokenExpiry('keycloak', {}, now, {
        rt: 'old',
        rt_exp: now + 600,
      }),
    ).toBe(now + 600);
  });

  it('clears old expiry on rotation or an explicit Keycloak unbounded lifetime', () => {
    const previous = { rt: 'old', rt_exp: now + 600 };
    expect(
      resolveRefreshTokenExpiry(
        'keycloak',
        { refresh_token: 'new' },
        now,
        previous,
      ),
    ).toBeUndefined();
    expect(
      resolveRefreshTokenExpiry(
        'keycloak',
        { refresh_expires_in: 0 },
        now,
        previous,
      ),
    ).toBeUndefined();
  });
});
