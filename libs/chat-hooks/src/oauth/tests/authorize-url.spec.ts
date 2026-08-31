import { describe, expect, it } from 'vitest';
import {
  buildToolsetAuthorizeUrl,
  getToolsetRedirectUri,
} from '../authorize-url';

const REDIRECT_URI = 'http://localhost/auth/toolset-signin';

const validOAuthConfig = {
  clientId: 'client',
  authorizationEndpoint: 'https://auth.example.com/authorize',
};

describe('getToolsetRedirectUri', () => {
  it('resolves the caller-supplied callback path against the current origin', () => {
    expect(getToolsetRedirectUri('/auth/toolset-signin')).toBe(
      `${window.location.origin}/auth/toolset-signin`,
    );
  });

  it('resolves a different callback path for a host that serves more than one', () => {
    expect(getToolsetRedirectUri('/toolsets/editor-callback')).toBe(
      `${window.location.origin}/toolsets/editor-callback`,
    );
  });
});

describe('buildToolsetAuthorizeUrl', () => {
  it('builds an OAuth authorize URL with the given state and scopes', () => {
    const result = buildToolsetAuthorizeUrl(
      { ...validOAuthConfig, scopes: ['read', 'write'] },
      REDIRECT_URI,
      'encoded-state',
    );

    expect(result).not.toBeNull();
    const url = new URL(result ?? '');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('client');
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(url.searchParams.get('scope')).toBe('read write');
    expect(url.searchParams.get('state')).toBe('encoded-state');
  });

  it('trims the client id and authorization endpoint', () => {
    const url = new URL(
      buildToolsetAuthorizeUrl(
        {
          clientId: '  client  ',
          authorizationEndpoint: '  https://auth.example.com/authorize  ',
        },
        REDIRECT_URI,
        'encoded-state',
      ) ?? '',
    );

    expect(url.origin).toBe('https://auth.example.com');
    expect(url.searchParams.get('client_id')).toBe('client');
  });

  it('forwards PKCE parameters when the config carries them', () => {
    const url = new URL(
      buildToolsetAuthorizeUrl(
        {
          ...validOAuthConfig,
          codeChallenge: 'challenge',
          codeChallengeMethod: 'S256',
        },
        REDIRECT_URI,
        'encoded-state',
      ) ?? '',
    );

    expect(url.searchParams.get('code_challenge')).toBe('challenge');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('omits PKCE and scope parameters when their source values are absent or empty', () => {
    const url = new URL(
      buildToolsetAuthorizeUrl(
        { ...validOAuthConfig, scopes: [] },
        REDIRECT_URI,
        'encoded-state',
      ) ?? '',
    );

    expect(url.searchParams.has('code_challenge')).toBe(false);
    expect(url.searchParams.has('code_challenge_method')).toBe(false);
    expect(url.searchParams.has('scope')).toBe(false);
  });

  it('returns null when the auth config is missing a client id', () => {
    expect(
      buildToolsetAuthorizeUrl(
        { authorizationEndpoint: 'https://auth.example.com/authorize' },
        REDIRECT_URI,
        'encoded-state',
      ),
    ).toBeNull();
  });

  it('returns null when the auth config is missing an authorization endpoint', () => {
    expect(
      buildToolsetAuthorizeUrl({ clientId: 'client' }, REDIRECT_URI, 'state'),
    ).toBeNull();
  });

  it('returns null for a blank client id or authorization endpoint', () => {
    expect(
      buildToolsetAuthorizeUrl(
        { clientId: '   ', authorizationEndpoint: '   ' },
        REDIRECT_URI,
        'state',
      ),
    ).toBeNull();
  });

  it('returns null without throwing for an unparseable authorization endpoint', () => {
    expect(
      buildToolsetAuthorizeUrl(
        { clientId: 'client', authorizationEndpoint: 'not-a-url' },
        REDIRECT_URI,
        'state',
      ),
    ).toBeNull();
  });

  it('returns null for a protocol other than http: or https:', () => {
    expect(
      buildToolsetAuthorizeUrl(
        {
          clientId: 'client',
          authorizationEndpoint: 'javascript:alert(1)',
        },
        REDIRECT_URI,
        'state',
      ),
    ).toBeNull();
  });

  /*
   * A remote plain-HTTP authorization endpoint leaks the code the provider
   * returns in the redirect URL to any passive observer, so it is refused
   * outright rather than downgraded.
   */
  describe('transport security', () => {
    const build = (authorizationEndpoint: string) =>
      buildToolsetAuthorizeUrl(
        { clientId: 'client', authorizationEndpoint },
        REDIRECT_URI,
        'state',
      );

    it('accepts an https: authorization endpoint', () => {
      expect(build('https://auth.example.com/authorize')).not.toBeNull();
    });

    it('returns null for a remote http: authorization endpoint', () => {
      expect(build('http://auth.example.com/authorize')).toBeNull();
    });

    it.each([
      'http://localhost/authorize',
      'http://localhost:8080/authorize',
      'http://127.0.0.1:8080/authorize',
      'http://127.1.2.3/authorize',
      'http://[::1]:8080/authorize',
    ])('allows plain http: on the loopback interface (%s)', (endpoint) => {
      expect(build(endpoint)).not.toBeNull();
    });

    it.each([
      'http://localhost.evil.com/authorize',
      'http://notlocalhost/authorize',
      'http://127.0.0.1.evil.com/authorize',
      'http://1270.0.0.1/authorize',
    ])('does not mistake a public host for loopback (%s)', (endpoint) => {
      expect(build(endpoint)).toBeNull();
    });
  });
});
