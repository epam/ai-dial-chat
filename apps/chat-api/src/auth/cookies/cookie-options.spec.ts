import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import {
  clearLegacyCookies,
  getCookieOptions,
  getCookieSameSite,
  getSessionCookieName,
} from './cookie-options';

const makeConfig = (
  overrides: Partial<EnvironmentVariables> = {},
): ConfigService<EnvironmentVariables, true> =>
  ({
    get: vi.fn((key: keyof EnvironmentVariables) => overrides[key]),
  }) as unknown as ConfigService<EnvironmentVariables, true>;

describe('cookie options', () => {
  it('uses SameSite=Lax by default', () => {
    expect(getCookieSameSite(makeConfig())).toBe('lax');
  });

  it('uses SameSite=None for secure overlay embedding', () => {
    const config = makeConfig({
      AUTH_COOKIE_SECURE: true,
      OVERLAY_ENABLED: true,
      ALLOWED_IFRAME_ORIGINS: ['https://host.example.com'],
    });

    expect(getCookieOptions(config)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    });
  });

  it('keeps SameSite=Lax when local insecure cookies are enabled', () => {
    const config = makeConfig({
      AUTH_COOKIE_SECURE: false,
      OVERLAY_ENABLED: true,
      ALLOWED_IFRAME_ORIGINS: ['http://localhost:3005'],
    });

    expect(getCookieOptions(config)).toMatchObject({
      secure: false,
      sameSite: 'lax',
    });
    expect(getSessionCookieName(config)).toBe('chat.sess');
  });
});

describe('clearLegacyCookies', () => {
  const makeRes = (): Response => ({ cookie: vi.fn() }) as unknown as Response;

  it('does nothing when AUTH_LEGACY_COOKIE_NAMES is unset', () => {
    const config = makeConfig();
    const res = makeRes();
    const req = { cookies: { 'next-auth.session-token': 'value' } } as Request;

    clearLegacyCookies(req, res, config);

    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('expires only legacy cookies actually present on the request', () => {
    const config = makeConfig({
      AUTH_LEGACY_COOKIE_NAMES: [
        '__Secure-next-auth.session-token',
        '__Host-next-auth.csrf-token',
      ],
    });
    const res = makeRes();
    const req = {
      cookies: { '__Secure-next-auth.session-token': 'stale' },
    } as Request;

    clearLegacyCookies(req, res, config);

    expect(res.cookie).toHaveBeenCalledOnce();
    expect(res.cookie).toHaveBeenCalledWith(
      '__Secure-next-auth.session-token',
      '',
      expect.objectContaining({ maxAge: 0 }),
    );
  });

  it('does nothing when the request has no cookies at all', () => {
    const config = makeConfig({
      AUTH_LEGACY_COOKIE_NAMES: ['__Secure-next-auth.session-token'],
    });
    const res = makeRes();
    const req = {} as Request;

    clearLegacyCookies(req, res, config);

    expect(res.cookie).not.toHaveBeenCalled();
  });
});
