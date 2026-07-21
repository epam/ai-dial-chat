import { describe, expect, it } from 'vitest';
import { validate } from './validation';

const validBaseConfig = {
  DIAL_CORE_URL: 'https://dial-core.example.com',
  AUTH_SESSION_SECRET: 'a'.repeat(64),
  AUTH_CALLBACK_BASE_URL: 'http://localhost:3005',
};

describe('validate - ALLOWED_IFRAME_ORIGINS', () => {
  it('defaults to an empty array when unset', () => {
    const config = validate(validBaseConfig);

    expect(config.ALLOWED_IFRAME_ORIGINS).toEqual([]);
  });

  it('parses a comma-separated list of valid https/http origins', () => {
    const config = validate({
      ...validBaseConfig,
      ALLOWED_IFRAME_ORIGINS: 'https://quickapps.test, http://localhost:4300',
    });

    expect(config.ALLOWED_IFRAME_ORIGINS).toEqual([
      'https://quickapps.test',
      'http://localhost:4300',
    ]);
  });

  it('rejects an entry with no protocol', () => {
    expect(() =>
      validate({
        ...validBaseConfig,
        ALLOWED_IFRAME_ORIGINS: 'quickapps.aks.dev.dial.parts',
      }),
    ).toThrow(/Environment validation failed/);
  });

  it('rejects an entry with a disallowed protocol', () => {
    expect(() =>
      validate({
        ...validBaseConfig,
        ALLOWED_IFRAME_ORIGINS: 'ftp://quickapps.aks.dev.dial.parts',
      }),
    ).toThrow(/Environment validation failed/);
  });

  it('rejects an entry with a path', () => {
    expect(() =>
      validate({
        ...validBaseConfig,
        ALLOWED_IFRAME_ORIGINS: 'https://quickapps.test/embed',
      }),
    ).toThrow(/Environment validation failed/);
  });

  it('rejects an entry with a query string', () => {
    expect(() =>
      validate({
        ...validBaseConfig,
        ALLOWED_IFRAME_ORIGINS: 'https://quickapps.test?x=1',
      }),
    ).toThrow(/Environment validation failed/);
  });

  it('rejects an entry containing CSP-breaking characters', () => {
    expect(() =>
      validate({
        ...validBaseConfig,
        ALLOWED_IFRAME_ORIGINS: "https://evil.example.com; script-src 'none'",
      }),
    ).toThrow(/Environment validation failed/);
  });
});
