import { describe, expect, it } from 'vitest';
import type { DeploymentCreationFormValues } from '../models/deployment-creation-form';
import { DeploymentCreationFieldErrorCode } from '../models/validation';
import { validateDeploymentCreationFields } from './validate-deployment-creation-fields';

const baseValues: DeploymentCreationFormValues = {
  name: 'My Entity',
  description: '',
  iconUrl: '',
  version: '',
  topics: [],
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

  it('returns an invalid-format error for a bad version when the pattern check is enabled', () => {
    const errors = validateDeploymentCreationFields(
      { ...baseValues, version: 'bad version!' },
      { validateVersionPattern: true },
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
