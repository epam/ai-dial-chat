import { validate } from '../validation';

const baseConfig: Record<string, unknown> = {
  DIAL_CORE_URL: 'https://dial-core.example.com',
  AUTH_SESSION_SECRET: 'a'.repeat(64),
  AUTH_CALLBACK_BASE_URL: 'http://localhost:3005',
  AUTH_PROVIDERS: '[]',
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
});
