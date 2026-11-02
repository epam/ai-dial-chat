import { describe, expect, it } from 'vitest';
import { CATALOG_CREATION_ROLES_ERROR } from '../catalog-creation.types';
import { validate } from '../validation';

const baseConfig: Record<string, unknown> = {
  DIAL_CORE_URL: 'https://dial-core.example.com',
  AUTH_SESSION_SECRET: 'a'.repeat(64),
  AUTH_CALLBACK_BASE_URL: 'http://localhost:5000',
};

const validateRoles = (value: unknown) =>
  validate({ ...baseConfig, CATALOG_CREATION_ROLES: value })
    .CATALOG_CREATION_ROLES;

const captureError = (value: unknown): string => {
  try {
    validateRoles(value);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('expected validation to fail');
};

describe('CATALOG_CREATION_ROLES', () => {
  it('defaults to empty maps when unset', () => {
    expect(validate({ ...baseConfig }).CATALOG_CREATION_ROLES).toEqual({
      types: {},
      schemas: {},
    });
  });

  it.each(['', '   '])('resolves %j to empty maps', (value) => {
    expect(validateRoles(value)).toEqual({ types: {}, schemas: {} });
  });

  it('accepts an empty object', () => {
    expect(validateRoles('{}')).toEqual({});
  });

  it('accepts type and schema rules without normalizing them', () => {
    const policy = {
      types: { 'schema-app': [' authors ', 'authors'], skill: [] },
      schemas: { 'https://example.test/schemas/Runner-A': ['team-A'] },
    };

    expect(validateRoles(JSON.stringify(policy))).toEqual(policy);
  });

  it('accepts a policy with only one of the two maps', () => {
    expect(validateRoles('{"schemas":{"schema-A":["team-A"]}}')).toEqual({
      schemas: { 'schema-A': ['team-A'] },
    });
  });

  it('preserves schema ids exactly, including surrounding punctuation', () => {
    const schemaId = ' https://example.test/schemas/runner%2FA?v=1 ';

    expect(
      validateRoles(JSON.stringify({ schemas: { [schemaId]: ['team-A'] } })),
    ).toEqual({ schemas: { [schemaId]: ['team-A'] } });
  });

  it.each([
    ['malformed JSON', '{"types":'],
    ['a JSON array', '[]'],
    ['JSON null', 'null'],
    ['a JSON string', '"skill"'],
    ['a JSON number', '7'],
    ['an unknown top-level field', '{"types":{},"roles":{}}'],
    ['a legacy-style type key', '{"types":{"skills":["a"]}}'],
    ['a UI-feature type key', '{"types":{"schema-apps":["a"]}}'],
    ['a null types map', '{"types":null}'],
    ['an array types map', '{"types":[]}'],
    ['an array schemas map', '{"schemas":[["schema-A",["a"]]]}'],
    ['a null rule', '{"types":{"skill":null}}'],
    ['a string rule', '{"types":{"skill":"secret-role"}}'],
    ['a non-string role', '{"types":{"prompt":["a",7]}}'],
    ['a null role', '{"schemas":{"schema-A":[null]}}'],
    ['an empty schema id', '{"schemas":{"":["a"]}}'],
    ['a whitespace-only schema id', '{"schemas":{"   ":["a"]}}'],
  ])('fails startup for %s', (_label, value) => {
    expect(captureError(value)).toContain(CATALOG_CREATION_ROLES_ERROR);
  });

  it('keeps raw values and role names out of the error', () => {
    const message = captureError(
      '{"types":{"skill":"secret-role"},"schemas":{"private-schema":[1]}}',
    );

    expect(message).not.toContain('secret-role');
    expect(message).not.toContain('private-schema');
  });

  it('keeps parser diagnostics out of the error', () => {
    const message = captureError('{"types": secret-role}');

    expect(message).not.toContain('secret-role');
    expect(message).not.toMatch(/Unexpected token|position/i);
  });

  it.each(['ENABLED_FEATURES_ROLES', 'ENABLED_UI_FEATURES_ROLES'])(
    'does not read the legacy %s variable',
    (legacyName) => {
      const config = validate({
        ...baseConfig,
        [legacyName]: '{"types":{"skill":["authors"]}}',
      });

      expect(config.CATALOG_CREATION_ROLES).toEqual({ types: {}, schemas: {} });
    },
  );

  it('leaves ENABLED_UI_FEATURES unchanged', () => {
    const config = validate({
      ...baseConfig,
      ENABLED_UI_FEATURES: 'header,custom-apps',
      CATALOG_CREATION_ROLES: '{"types":{"custom-app":["developers"]}}',
    });

    expect(config.ENABLED_UI_FEATURES).toEqual(['header', 'custom-apps']);
  });
});
