import { validate } from '../validation';

const baseConfig: Record<string, unknown> = {
  DIAL_CORE_URL: 'https://dial-core.example.com',
  AUTH_SESSION_SECRET: 'a'.repeat(64),
  AUTH_CALLBACK_BASE_URL: 'http://localhost:3005',
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
});
