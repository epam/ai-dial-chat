import {
  ENTITY_DESCRIPTION_MAX_LENGTH,
  ENTITY_NAME_MAX_LENGTH,
  exceedsMaxLength,
  hasControlCharacters,
} from '@epam/ai-dial-chat-shared';
import type { DeploymentCreationFormValues } from '../models/deployment-creation-form';
import type {
  DeploymentCreationFormErrorCodes,
  DeploymentCreationFormValidationOptions,
} from '../models/validation';
import { DeploymentCreationFieldErrorCode } from '../models/validation';

/** Allowed characters for the name field: letters, digits, spaces, underscores, dots, dashes. */
export const NAME_PATTERN = /^[a-zA-Z0-9 _.-]+$/;

/** Allowed characters for the version field: letters, digits, dots, underscores, dashes. */
export const VERSION_PATTERN = /^[a-zA-Z0-9._-]+$/;

/**
 * SemVer 2.0.0 version (https://semver.org): `MAJOR.MINOR.PATCH` without
 * leading zeros, with an optional pre-release (`-beta.1`) and build metadata
 * (`+build.5`). DIAL Admin checks versions with `semver.valid()`, so a value
 * accepted here is accepted when the same entity is edited there.
 */
export const SEMVER_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;

/** Validates the General-step fields and returns untranslated error codes; has no side effects. */
export const validateDeploymentCreationFields = (
  values: DeploymentCreationFormValues,
  options: DeploymentCreationFormValidationOptions = {},
): DeploymentCreationFormErrorCodes => {
  const errors: DeploymentCreationFormErrorCodes = {};

  const trimmedName = values.name.trim();
  if (!trimmedName) {
    errors.name = DeploymentCreationFieldErrorCode.Required;
  } else if (exceedsMaxLength(trimmedName, ENTITY_NAME_MAX_LENGTH)) {
    errors.name = DeploymentCreationFieldErrorCode.TooLong;
  } else if (options.validateNamePattern && !NAME_PATTERN.test(trimmedName)) {
    errors.name = DeploymentCreationFieldErrorCode.InvalidFormat;
  } else if (hasControlCharacters(trimmedName)) {
    errors.name = DeploymentCreationFieldErrorCode.ControlCharacters;
  }

  if (exceedsMaxLength(values.description, ENTITY_DESCRIPTION_MAX_LENGTH)) {
    errors.description = DeploymentCreationFieldErrorCode.TooLong;
  }

  const trimmedVersion = values.version.trim();
  if (options.validateVersionPattern && trimmedVersion) {
    const pattern =
      options.validateVersionPattern instanceof RegExp
        ? options.validateVersionPattern
        : VERSION_PATTERN;
    if (!pattern.test(trimmedVersion)) {
      errors.version = DeploymentCreationFieldErrorCode.InvalidFormat;
    }
  }

  return errors;
};
