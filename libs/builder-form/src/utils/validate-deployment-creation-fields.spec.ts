import {
  ENTITY_DESCRIPTION_MAX_LENGTH,
  ENTITY_NAME_MAX_LENGTH,
} from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { DeploymentCreationFormValues } from '../models/deployment-creation-form';
import { DeploymentCreationFieldErrorCode } from '../models/validation';
import {
  SEMVER_VERSION_PATTERN,
  validateDeploymentCreationFields,
} from './validate-deployment-creation-fields';

const baseValues: DeploymentCreationFormValues = {
  name: 'My Entity',
  description: '',
  iconUrl: '',
  version: '',
  topics: [],
  otherLocales: [],
};

describe('validateDeploymentCreationFields', () => {
  it('returns no errors for valid values', () => {
    expect(validateDeploymentCreationFields(baseValues)).toEqual({});
  });

  it('returns a required error when name is empty', () => {
    const errors = validateDeploymentCreationFields({
      ...baseValues,
      name: '  ',
    });
    expect(errors.name).toBe(DeploymentCreationFieldErrorCode.Required);
  });

  it('returns an invalid-format error for a bad name when the pattern check is enabled', () => {
    const errors = validateDeploymentCreationFields(
      { ...baseValues, name: 'bad/name!' },
      { validateNamePattern: true },
    );
    expect(errors.name).toBe(DeploymentCreationFieldErrorCode.InvalidFormat);
  });

  it('does not check the name pattern unless enabled', () => {
    const errors = validateDeploymentCreationFields({
      ...baseValues,
      name: 'bad/name!',
    });
    expect(errors.name).toBeUndefined();
  });

  it('returns a too-long error for a name over the shared limit', () => {
    const errors = validateDeploymentCreationFields({
      ...baseValues,
      name: 'a'.repeat(ENTITY_NAME_MAX_LENGTH + 1),
    });
    expect(errors.name).toBe(DeploymentCreationFieldErrorCode.TooLong);
  });

  it('accepts a name exactly at the shared limit', () => {
    const errors = validateDeploymentCreationFields({
      ...baseValues,
      name: 'a'.repeat(ENTITY_NAME_MAX_LENGTH),
    });
    expect(errors.name).toBeUndefined();
  });

  it('returns a control-characters error for a name with a line break', () => {
    const errors = validateDeploymentCreationFields({
      ...baseValues,
      name: 'first\nsecond',
    });
    expect(errors.name).toBe(
      DeploymentCreationFieldErrorCode.ControlCharacters,
    );
  });

  it('returns a too-long error for a description over the shared limit', () => {
    const errors = validateDeploymentCreationFields({
      ...baseValues,
      description: 'a'.repeat(ENTITY_DESCRIPTION_MAX_LENGTH + 1),
    });
    expect(errors.description).toBe(DeploymentCreationFieldErrorCode.TooLong);
  });

  it('returns an invalid-format error for a bad version when the pattern check is enabled', () => {
    const errors = validateDeploymentCreationFields(
      { ...baseValues, version: 'bad version!' },
      { validateVersionPattern: true },
    );
    expect(errors.version).toBe(DeploymentCreationFieldErrorCode.InvalidFormat);
  });

  it('accepts a letters-only version when the default pattern check is enabled', () => {
    const errors = validateDeploymentCreationFields(
      { ...baseValues, version: 'abc' },
      { validateVersionPattern: true },
    );
    expect(errors.version).toBeUndefined();
  });

  it('returns an invalid-format error for a non-numeric version when a stricter pattern is passed', () => {
    const errors = validateDeploymentCreationFields(
      { ...baseValues, version: 'abc' },
      { validateVersionPattern: SEMVER_VERSION_PATTERN },
    );
    expect(errors.version).toBe(DeploymentCreationFieldErrorCode.InvalidFormat);
  });

  it.each([
    '0.0.1',
    '1.0.0',
    '9999.0.9999',
    '1.0.0-beta',
    '1.0.0-beta.1',
    '1.0.0-0.3.7',
    '1.0.0-x-y-z.--',
    '1.0.0+build',
    '1.0.0+20130313144700',
    '1.0.0-rc.1+build.5',
  ])('accepts the SemVer 2.0.0 version %s', (version) => {
    const errors = validateDeploymentCreationFields(
      { ...baseValues, version },
      { validateVersionPattern: SEMVER_VERSION_PATTERN },
    );
    expect(errors.version).toBeUndefined();
  });

  it.each([
    '1',
    '1.2',
    '1.0.0.0',
    '01.0.0',
    '1.00.0',
    '9999.0000.09999',
    'v1.0.0',
    '1.0.0-',
    '1.0.0-01',
    '1.0.0-beta..1',
    '1.0.0+',
    '1.0.0+build+1',
    '1.0.0_beta',
  ])('rejects the non-SemVer version %s', (version) => {
    const errors = validateDeploymentCreationFields(
      { ...baseValues, version },
      { validateVersionPattern: SEMVER_VERSION_PATTERN },
    );
    expect(errors.version).toBe(DeploymentCreationFieldErrorCode.InvalidFormat);
  });

  it('does not flag an empty version even when the pattern check is enabled', () => {
    const errors = validateDeploymentCreationFields(
      { ...baseValues, version: '' },
      { validateVersionPattern: true },
    );
    expect(errors.version).toBeUndefined();
  });

  it('does not check the version pattern unless enabled', () => {
    const errors = validateDeploymentCreationFields({
      ...baseValues,
      version: 'bad version!',
    });
    expect(errors.version).toBeUndefined();
  });
});
