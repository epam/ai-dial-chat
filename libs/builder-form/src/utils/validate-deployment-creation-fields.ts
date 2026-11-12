import {
  ENTITY_DESCRIPTION_MAX_LENGTH,
  ENTITY_NAME_MAX_LENGTH,
  exceedsMaxLength,
  hasControlCharacters,
  RESOURCE_VERSION_PATTERN,
} from '@epam/ai-dial-chat-shared';
import type { DeploymentCreationFormValues } from '../models/deployment-creation-form';
import type {
  DeploymentCreationFormErrorCodes,
  DeploymentCreationFormValidationOptions,
} from '../models/validation';
import { DeploymentCreationFieldErrorCode } from '../models/validation';

/** Allowed characters for the name field: letters, digits, spaces, underscores, dots, dashes. */
export const NAME_PATTERN = /^[a-zA-Z0-9 _.-]+$/;

/** Default version rule: `RESOURCE_VERSION_PATTERN` from `@epam/ai-dial-chat-shared` (1-64 of letters, digits, `_`, `.`, `+`, `-`, no trailing dot). */
export const VERSION_PATTERN = RESOURCE_VERSION_PATTERN;

/** Version a new deployment's create form opens with; a SemVer 2.0.0 value the host seeds into its create-mode metadata. */
export const DEFAULT_DEPLOYMENT_VERSION = '1.0.0';

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
