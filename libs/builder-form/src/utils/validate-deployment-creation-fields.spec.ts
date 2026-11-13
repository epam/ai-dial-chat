import {
  ENTITY_DESCRIPTION_MAX_LENGTH,
  ENTITY_NAME_MAX_LENGTH,
} from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { DeploymentCreationFormValues } from '../models/deployment-creation-form';
import { DeploymentCreationFieldErrorCode } from '../models/validation';
import {
  DEFAULT_DEPLOYMENT_VERSION,
  STORED_VERSION_PATTERN,
  validateDeploymentCreationFields,
  withStoredVersionRule,
} from './validate-deployment-creation-fields';

const baseValues: DeploymentCreationFormValues = {
  name: 'My Entity',
  description: '',
  iconUrl: '',
  version: '',
  topics: [],
  otherLocales: [],
};

const NUMERIC_VERSION_PATTERN = /^\d+(\.\d+)*$/;

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

  it.each(['1.0.', '..', 'a'.repeat(65), '1/0'])(
    'rejects version "%s" under the default pattern',
    (version) => {
      const errors = validateDeploymentCreationFields(
        { ...baseValues, version },
        { validateVersionPattern: true },
      );
      expect(errors.version).toBe(
        DeploymentCreationFieldErrorCode.InvalidFormat,
      );
    },
  );

  it.each(['beta-2', '1.0+build5', '.hidden', 'a'.repeat(64)])(
    'accepts version "%s" under the default pattern',
    (version) => {
      const errors = validateDeploymentCreationFields(
        { ...baseValues, version },
        { validateVersionPattern: true },
      );
      expect(errors.version).toBeUndefined();
    },
  );

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
      { validateVersionPattern: NUMERIC_VERSION_PATTERN },
    );
    expect(errors.version).toBe(DeploymentCreationFieldErrorCode.InvalidFormat);
  });

  it('accepts a dot-separated numeric version when a stricter pattern is passed', () => {
    const errors = validateDeploymentCreationFields(
      { ...baseValues, version: '0.0.1' },
      { validateVersionPattern: NUMERIC_VERSION_PATTERN },
    );
    expect(errors.version).toBeUndefined();
  });

  it.each(['_beta', '1.0.', '1__2'])(
    'accepts the stored version "%s" with STORED_VERSION_PATTERN but not with the default rule',
    (version) => {
      expect(
        validateDeploymentCreationFields(
          { ...baseValues, version },
          { validateVersionPattern: STORED_VERSION_PATTERN },
        ).version,
      ).toBeUndefined();
      expect(
        validateDeploymentCreationFields(
          { ...baseValues, version },
          { validateVersionPattern: true },
        ).version,
      ).toBe(DeploymentCreationFieldErrorCode.InvalidFormat);
    },
  );

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

describe('DEFAULT_DEPLOYMENT_VERSION', () => {
  it('is 1.0.0', () => {
    expect(DEFAULT_DEPLOYMENT_VERSION).toBe('1.0.0');
  });

  it('passes the numeric version check', () => {
    const errors = validateDeploymentCreationFields(
      { ...baseValues, version: DEFAULT_DEPLOYMENT_VERSION },
      { validateVersionPattern: NUMERIC_VERSION_PATTERN },
    );
    expect(errors.version).toBeUndefined();
  });
});

describe('withStoredVersionRule', () => {
  it('switches the default version check to the stored rule in edit mode', () => {
    expect(
      withStoredVersionRule({ validateVersionPattern: true }, true),
    ).toEqual({ validateVersionPattern: STORED_VERSION_PATTERN });
  });

  it('keeps the options of a create form', () => {
    const options = { validateVersionPattern: true };

    expect(withStoredVersionRule(options, false)).toBe(options);
  });

  it('keeps a host regular expression and the other options in edit mode', () => {
    const options = {
      validateNamePattern: true,
      validateVersionPattern: NUMERIC_VERSION_PATTERN,
    };

    expect(withStoredVersionRule(options, true)).toBe(options);
  });
});
