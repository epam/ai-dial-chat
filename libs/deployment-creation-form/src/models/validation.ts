/** Reason a shared field failed validation, for the host app to map to a translated message. */
export enum DeploymentCreationFieldErrorCode {
  /** The field is required and was left empty. */
  Required = 'required',
  /** The field's value does not match the required character pattern. */
  InvalidFormat = 'invalid-format',
  /** The field's value exceeds its maximum length. */
  TooLong = 'too-long',
}

/** Untranslated error codes returned by `validateDeploymentCreationFields`. */
export interface DeploymentCreationFormErrorCodes {
  /** Error code for the name field, if invalid. */
  name?: DeploymentCreationFieldErrorCode;
  /** Error code for the version field, if invalid. */
  version?: DeploymentCreationFieldErrorCode;
  /** Error code for the intro field, if invalid. */
  intro?: DeploymentCreationFieldErrorCode;
}

/**
 * Toggles for pattern checks that differ between Quick App and Toolset creation today.
 * Required-name and intro-length checks always run; pattern checks are opt-in so
 * extracting the shared field set does not silently add new validation to a flow
 * that did not previously enforce it.
 */
export interface DeploymentCreationFormValidationOptions {
  /** Whether to reject a name containing characters outside `NAME_PATTERN`. */
  validateNamePattern?: boolean;
  /** Whether to reject a non-empty version containing characters outside `VERSION_PATTERN`. */
  validateVersionPattern?: boolean;
  /** Maximum character length enforced on the intro field. Defaults to `90`. */
  introMaxLength?: number;
}
