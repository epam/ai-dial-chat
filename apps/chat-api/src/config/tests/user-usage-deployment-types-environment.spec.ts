import { describe, expect, it } from 'vitest';
import { DeploymentType } from '../../deployments/dto/deployment-type';
import { validate } from '../validation';

const baseConfig: Record<string, unknown> = {
  DIAL_CORE_URL: 'https://dial-core.example.com',
  AUTH_SESSION_SECRET: 'a'.repeat(64),
  AUTH_CALLBACK_BASE_URL: 'http://localhost:5000',
};

const BOTH = [DeploymentType.Model, DeploymentType.Application];

describe('USER_USAGE_DEPLOYMENT_TYPES', () => {
  it('defaults to models and applications when unset', () => {
    expect(validate({ ...baseConfig }).USER_USAGE_DEPLOYMENT_TYPES).toEqual(
      BOTH,
    );
  });

  it.each(['', '  ', ','])('defaults to both kinds when set to %j', (value) => {
    expect(
      validate({ ...baseConfig, USER_USAGE_DEPLOYMENT_TYPES: value })
        .USER_USAGE_DEPLOYMENT_TYPES,
    ).toEqual(BOTH);
  });

  it('narrows the report to models', () => {
    expect(
      validate({ ...baseConfig, USER_USAGE_DEPLOYMENT_TYPES: 'model' })
        .USER_USAGE_DEPLOYMENT_TYPES,
    ).toEqual([DeploymentType.Model]);
  });

  it('normalizes padding, empty entries, and duplicates', () => {
    expect(
      validate({
        ...baseConfig,
        USER_USAGE_DEPLOYMENT_TYPES: ' model , application ,model,',
      }).USER_USAGE_DEPLOYMENT_TYPES,
    ).toEqual(BOTH);
  });

  it.each(['route', 'model,route', 'Model'])(
    'fails startup for %j',
    (value) => {
      expect(() =>
        validate({ ...baseConfig, USER_USAGE_DEPLOYMENT_TYPES: value }),
      ).toThrow(/deployment|USER_USAGE_DEPLOYMENT_TYPES|each value/i);
    },
  );
});
