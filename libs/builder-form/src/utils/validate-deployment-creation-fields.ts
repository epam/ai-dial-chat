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

/** Stricter version shape: one or more dot-separated numeric segments (e.g. `0.0.1`). */
export const SEMVER_VERSION_PATTERN = /^\d+(\.\d+)*$/;

/** Validates the General-step fields and returns untranslated error codes; has no side effects. */
export const validateDeploymentCreationFields = (
  values: DeploymentCreationFormValues,
  options: DeploymentCreationFormValidationOptions = {},
): DeploymentCreationFormErrorCodes => {
  const errors: DeploymentCreationFormErrorCodes = {};

  const trimmedName = values.name.trim();
  if (!trimmedName) {
    errors.name = DeploymentCreationFieldErrorCode.Required;
  } else if (options.validateNamePattern && !NAME_PATTERN.test(trimmedName)) {
    errors.name = DeploymentCreationFieldErrorCode.InvalidFormat;
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
