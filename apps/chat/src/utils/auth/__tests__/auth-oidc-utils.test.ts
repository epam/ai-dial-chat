import { describe, expect, it } from 'vitest';

import { normalizeOidcWellKnownUrl } from '../auth-oidc-utils';

describe('normalizeOidcWellKnownUrl', () => {
  it('removes a duplicate separator before the discovery path', () => {
    expect(
      normalizeOidcWellKnownUrl(
        'https://idp.example.com//.well-known/openid-configuration',
      ),
    ).toBe('https://idp.example.com/.well-known/openid-configuration');
  });

  it('normalizes an issuer containing a path', () => {
    expect(
      normalizeOidcWellKnownUrl(
        'https://idp.example.com/realms/example//.well-known/openid-configuration',
      ),
    ).toBe(
      'https://idp.example.com/realms/example/.well-known/openid-configuration',
    );
  });

  it('preserves a correctly formed discovery URL', () => {
    const wellKnown =
      'https://idp.example.com/.well-known/openid-configuration';

    expect(normalizeOidcWellKnownUrl(wellKnown)).toBe(wellKnown);
  });

  it('preserves query parameters', () => {
    expect(
      normalizeOidcWellKnownUrl(
        'https://idp.example.com//.well-known/openid-configuration?client_id=test',
      ),
    ).toBe(
      'https://idp.example.com/.well-known/openid-configuration?client_id=test',
    );
  });

  it('does not normalize unrelated duplicate path separators', () => {
    const wellKnown =
      'https://idp.example.com/tenant//metadata/.well-known/openid-configuration';

    expect(normalizeOidcWellKnownUrl(wellKnown)).toBe(wellKnown);
  });

  it('returns an invalid URL unchanged', () => {
    const wellKnown = 'not a valid URL';

    expect(normalizeOidcWellKnownUrl(wellKnown)).toBe(wellKnown);
  });
});
