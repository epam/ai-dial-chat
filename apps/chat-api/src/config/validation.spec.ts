import { describe, expect, it } from 'vitest';
import { validate } from './validation';

const validBaseConfig = {
  DIAL_CORE_URL: 'https://dial-core.example.com',
  AUTH_SESSION_SECRET: 'a'.repeat(64),
  AUTH_CALLBACK_BASE_URL: 'http://localhost:5000',
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

  it('accepts a leading-wildcard-label origin pattern', () => {
    const config = validate({
      ...validBaseConfig,
      ALLOWED_IFRAME_ORIGINS: 'https://*.example.com',
    });

    expect(config.ALLOWED_IFRAME_ORIGINS).toEqual(['https://*.example.com']);
  });

  it('accepts a mixed list of exact and wildcard origins', () => {
    const config = validate({
      ...validBaseConfig,
      ALLOWED_IFRAME_ORIGINS: 'https://quickapps.test,https://*.example.com',
    });

    expect(config.ALLOWED_IFRAME_ORIGINS).toEqual([
      'https://quickapps.test',
      'https://*.example.com',
    ]);
  });

  it('rejects a bare wildcard host', () => {
    expect(() =>
      validate({
        ...validBaseConfig,
        ALLOWED_IFRAME_ORIGINS: 'https://*',
      }),
    ).toThrow(/Environment validation failed/);
  });

  it('rejects a wildcard outside the leftmost label', () => {
    expect(() =>
      validate({
        ...validBaseConfig,
        ALLOWED_IFRAME_ORIGINS: 'https://foo.*.example.com',
      }),
    ).toThrow(/Environment validation failed/);
  });

  it('rejects a wildcard entry with a path', () => {
    expect(() =>
      validate({
        ...validBaseConfig,
        ALLOWED_IFRAME_ORIGINS: 'https://*.example.com/embed',
      }),
    ).toThrow(/Environment validation failed/);
  });
});
