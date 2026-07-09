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

/** Default maximum character length for the intro field. */
export const DEFAULT_INTRO_MAX_LENGTH = 90;

/**
 * Pure validation of the shared General-step fields. Returns untranslated error
 * codes only — the host app maps each code to a translated message. Has no side
 * effects and does not depend on i18n, routing, or network state.
 */
export const validateDeploymentCreationFields = (
  values: DeploymentCreationFormValues,
  options: DeploymentCreationFormValidationOptions = {},
): DeploymentCreationFormErrorCodes => {
  const errors: DeploymentCreationFormErrorCodes = {};
  const introMaxLength = options.introMaxLength ?? DEFAULT_INTRO_MAX_LENGTH;

  const trimmedName = values.name.trim();
  if (!trimmedName) {
    errors.name = DeploymentCreationFieldErrorCode.Required;
  } else if (options.validateNamePattern && !NAME_PATTERN.test(trimmedName)) {
    errors.name = DeploymentCreationFieldErrorCode.InvalidFormat;
  }

  const trimmedVersion = values.version.trim();
  if (
    options.validateVersionPattern &&
    trimmedVersion &&
    !VERSION_PATTERN.test(trimmedVersion)
  ) {
    errors.version = DeploymentCreationFieldErrorCode.InvalidFormat;
  }

  if (values.intro.length > introMaxLength) {
    errors.intro = DeploymentCreationFieldErrorCode.TooLong;
  }

  return errors;
};
