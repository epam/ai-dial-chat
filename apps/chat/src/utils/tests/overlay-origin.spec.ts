import { describe, expect, it } from 'vitest';
import { matchesAllowedOrigin } from '../overlay-origin';

describe('matchesAllowedOrigin', () => {
  it.each([
    [
      'matches an exact origin entry',
      {
        origin: 'https://portal.example.com',
        allowlist: ['https://portal.example.com'],
        expected: true,
      },
    ],
    [
      'matches a direct subdomain against a wildcard entry',
      {
        origin: 'https://portal.example.com',
        allowlist: ['https://*.example.com'],
        expected: true,
      },
    ],
    [
      'matches a nested subdomain against a wildcard entry',
      {
        origin: 'https://a.b.example.com',
        allowlist: ['https://*.example.com'],
        expected: true,
      },
    ],
    [
      'does not match the bare apex domain against a wildcard entry',
      {
        origin: 'https://example.com',
        allowlist: ['https://*.example.com'],
        expected: false,
      },
    ],
    [
      'does not match a different scheme against a wildcard entry',
      {
        origin: 'http://portal.example.com',
        allowlist: ['https://*.example.com'],
        expected: false,
      },
    ],
    [
      'does not match an origin absent from the allowlist',
      {
        origin: 'https://evil.example.com',
        allowlist: ['https://portal.example.com'],
        expected: false,
      },
    ],
    [
      'returns false for an empty allowlist',
      { origin: 'https://portal.example.com', allowlist: [], expected: false },
    ],
  ])('%s', (_name, { origin, allowlist, expected }) => {
    expect(matchesAllowedOrigin(origin, allowlist)).toBe(expected);
  });
});
