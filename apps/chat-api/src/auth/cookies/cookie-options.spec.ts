import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import {
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
