import { validate } from '../validation';

const baseConfig: Record<string, unknown> = {
  DIAL_CORE_URL: 'https://dial-core.example.com',
  AUTH_SESSION_SECRET: 'a'.repeat(64),
  AUTH_CALLBACK_BASE_URL: 'http://localhost:5000',
};

describe('validate', () => {
  it('boots successfully with a minimal valid config', () => {
    expect(() => validate({ ...baseConfig })).not.toThrow();
  });

  it.each([
    'ARCHIVE_UPLOAD_MAX_BYTES',
    'ARCHIVE_UPLOAD_MAX_FILES',
    'ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES',
    'ARCHIVE_UPLOAD_TIMEOUT_MS',
  ])('fails fast at boot when %s is set to a non-numeric value', (key) => {
    expect(() => validate({ ...baseConfig, [key]: 'not-a-number' })).toThrow(
      /Environment validation failed/,
    );
  });

  it('accepts a supported log level', () => {
    expect(() => validate({ ...baseConfig, LOG_LEVEL: 'debug' })).not.toThrow();
  });

  it('fails fast at boot when LOG_LEVEL is unsupported', () => {
    expect(() => validate({ ...baseConfig, LOG_LEVEL: 'trace' })).toThrow(
      /Environment validation failed/,
    );
  });

  it('defaults ADMIN_ROLE_NAMES to ["admin"] when unset', () => {
    const config = validate({ ...baseConfig });
    expect(config.ADMIN_ROLE_NAMES).toEqual(['admin']);
  });

  it('parses a comma-separated ADMIN_ROLE_NAMES list', () => {
    const config = validate({
      ...baseConfig,
      ADMIN_ROLE_NAMES: 'super-admin, admin',
    });
    expect(config.ADMIN_ROLE_NAMES).toEqual(['super-admin', 'admin']);
  });

  it('defaults DIAL_ROLES_FIELD to "dial_roles" when unset', () => {
    const config = validate({ ...baseConfig });
    expect(config.DIAL_ROLES_FIELD).toBe('dial_roles');
  });

  it('parses a comma-separated AUTH_AUTH0_ADMIN_ROLE_NAMES list', () => {
    const config = validate({
      ...baseConfig,
      AUTH_AUTH0_ADMIN_ROLE_NAMES: 'super-admin, admin',
    });
    expect(config.AUTH_AUTH0_ADMIN_ROLE_NAMES).toEqual([
      'super-admin',
      'admin',
    ]);
  });

  it('accepts a valid AUTH_POST_LOGOUT_REDIRECT_URI', () => {
    expect(() =>
      validate({
        ...baseConfig,
        AUTH_POST_LOGOUT_REDIRECT_URI: 'https://chat.example.com',
      }),
    ).not.toThrow();
  });

  it('parses AUTH_COOKIE_SECURE=false as false', () => {
    const config = validate({
      ...baseConfig,
      AUTH_COOKIE_SECURE: 'false',
    });

    expect(config.AUTH_COOKIE_SECURE).toBe(false);
  });

  it('defaults OVERLAY_ENABLED to false when unset', () => {
    const config = validate({ ...baseConfig });
    expect(config.OVERLAY_ENABLED).toBe(false);
  });

  it.each([
    ['true', true],
    ['false', false],
  ])('parses OVERLAY_ENABLED=%s as %s', (rawValue, expected) => {
    const config = validate({ ...baseConfig, OVERLAY_ENABLED: rawValue });
    expect(config.OVERLAY_ENABLED).toBe(expected);
  });

  it('treats any non-"false"/"0"/"no" string as OVERLAY_ENABLED=true', () => {
    const config = validate({ ...baseConfig, OVERLAY_ENABLED: 'yes' });
    expect(config.OVERLAY_ENABLED).toBe(true);
  });

  it('defaults RESPONSES_API_ENABLED to false when unset', () => {
    const config = validate({ ...baseConfig });
    expect(config.RESPONSES_API_ENABLED).toBe(false);
  });

  it.each([
    ['true', true],
    ['false', false],
    ['0', false],
    ['no', false],
  ])('parses RESPONSES_API_ENABLED=%s as %s', (rawValue, expected) => {
    const config = validate({ ...baseConfig, RESPONSES_API_ENABLED: rawValue });
    expect(config.RESPONSES_API_ENABLED).toBe(expected);
  });

  it('defaults OVERLAY_SANDBOX_ENABLED to false when unset', () => {
    const config = validate({ ...baseConfig });
    expect(config.OVERLAY_SANDBOX_ENABLED).toBe(false);
  });

  it.each([
    ['true', true],
    ['false', false],
  ])('parses OVERLAY_SANDBOX_ENABLED=%s as %s', (rawValue, expected) => {
    const config = validate({
      ...baseConfig,
      OVERLAY_SANDBOX_ENABLED: rawValue,
    });
    expect(config.OVERLAY_SANDBOX_ENABLED).toBe(expected);
  });

  it('parses publication filter sources up to 200 characters', () => {
    const source = 'a'.repeat(200);
    const config = validate({
      ...baseConfig,
      PUBLICATION_FILTER_SOURCES: `${source}, role`,
    });

    expect(config.PUBLICATION_FILTER_SOURCES).toEqual([source, 'role']);
  });

  it('fails fast when a publication filter source exceeds 200 characters', () => {
    expect(() =>
      validate({
        ...baseConfig,
        PUBLICATION_FILTER_SOURCES: 'a'.repeat(201),
      }),
    ).toThrow(/Environment validation failed/);
  });

  describe('header bearer-token auth env vars', () => {
    it('defaults AUTH_HEADER_TOKEN_ENABLED to false when unset', () => {
      const config = validate({ ...baseConfig });
      expect(config.AUTH_HEADER_TOKEN_ENABLED).toBe(false);
    });

    it.each([
      ['true', true],
      ['false', false],
    ])('parses AUTH_HEADER_TOKEN_ENABLED=%s as %s', (rawValue, expected) => {
      const config = validate({
        ...baseConfig,
        AUTH_HEADER_TOKEN_ENABLED: rawValue,
      });
      expect(config.AUTH_HEADER_TOKEN_ENABLED).toBe(expected);
    });

    it('leaves AUTH_HEADER_TOKEN_ALLOWED_ISSUERS undefined when unset', () => {
      const config = validate({ ...baseConfig });
      expect(config.AUTH_HEADER_TOKEN_ALLOWED_ISSUERS).toBeUndefined();
    });

    it('parses a comma-separated AUTH_HEADER_TOKEN_ALLOWED_ISSUERS list', () => {
      const config = validate({
        ...baseConfig,
        AUTH_HEADER_TOKEN_ALLOWED_ISSUERS:
          'https://accounts.google.com, https://issuer.example.com',
      });
      expect(config.AUTH_HEADER_TOKEN_ALLOWED_ISSUERS).toEqual([
        'https://accounts.google.com',
        'https://issuer.example.com',
      ]);
    });

    it('defaults AUTH_HEADER_TOKEN_CLOCK_TOLERANCE_SECONDS to 30 when unset', () => {
      const config = validate({ ...baseConfig });
      expect(config.AUTH_HEADER_TOKEN_CLOCK_TOLERANCE_SECONDS).toBe(30);
    });

    it('defaults AUTH_HEADER_TOKEN_JWKS_CACHE_TTL_SECONDS to 600 when unset', () => {
      const config = validate({ ...baseConfig });
      expect(config.AUTH_HEADER_TOKEN_JWKS_CACHE_TTL_SECONDS).toBe(600);
    });

    it('defaults AUTH_HEADER_TOKEN_BUCKET_CACHE_TTL_SECONDS to 60 when unset', () => {
      const config = validate({ ...baseConfig });
      expect(config.AUTH_HEADER_TOKEN_BUCKET_CACHE_TTL_SECONDS).toBe(60);
    });

    it('fails fast when AUTH_HEADER_TOKEN_CLOCK_TOLERANCE_SECONDS is not numeric', () => {
      expect(() =>
        validate({
          ...baseConfig,
          AUTH_HEADER_TOKEN_CLOCK_TOLERANCE_SECONDS: 'not-a-number',
        }),
      ).toThrow(/Environment validation failed/);
    });
  });
});
