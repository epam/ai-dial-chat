import { describe, expect, it } from 'vitest';
import { matchesAllowedOrigin } from '../overlay-origin';

describe('matchesAllowedOrigin', () => {
  it('matches an exact origin entry', () => {
    expect(
      matchesAllowedOrigin('https://portal.example.com', [
        'https://portal.example.com',
      ]),
    ).toBe(true);
  });

  it('matches a direct subdomain against a wildcard entry', () => {
    expect(
      matchesAllowedOrigin('https://portal.example.com', [
        'https://*.example.com',
      ]),
    ).toBe(true);
  });

  it('matches a nested subdomain against a wildcard entry', () => {
    expect(
      matchesAllowedOrigin('https://a.b.example.com', [
        'https://*.example.com',
      ]),
    ).toBe(true);
  });

  it('does not match the bare apex domain against a wildcard entry', () => {
    expect(
      matchesAllowedOrigin('https://example.com', ['https://*.example.com']),
    ).toBe(false);
  });

  it('does not match a different scheme against a wildcard entry', () => {
    expect(
      matchesAllowedOrigin('http://portal.example.com', [
        'https://*.example.com',
      ]),
    ).toBe(false);
  });

  it('does not match an origin absent from the allowlist', () => {
    expect(
      matchesAllowedOrigin('https://evil.example.com', [
        'https://portal.example.com',
      ]),
    ).toBe(false);
  });

  it('returns false for an empty allowlist', () => {
    expect(matchesAllowedOrigin('https://portal.example.com', [])).toBe(false);
  });
});
