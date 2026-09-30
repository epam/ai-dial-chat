/** Reason a shared field failed validation, for the host app to map to a translated message. */
export enum DeploymentCreationFieldErrorCode {
  /** The field is required and was left empty. */
  Required = 'required',
  /** The field's value does not match the required character pattern. */
  InvalidFormat = 'invalid-format',
  /** The field's value exceeds its maximum length. */
  TooLong = 'too-long',
  /** The name contains a control character (line break, tab, …). */
  ControlCharacters = 'control-characters',
}

/** Untranslated error codes returned by `validateDeploymentCreationFields`. */
export interface DeploymentCreationFormErrorCodes {
  /** Error code for the name field, if invalid. */
  name?: DeploymentCreationFieldErrorCode;
  /** Error code for the version field, if invalid. */
  version?: DeploymentCreationFieldErrorCode;
  /** Error code for the description field, if invalid. */
  description?: DeploymentCreationFieldErrorCode;
}

/** Optional pattern-check toggles for field validation. */
export interface DeploymentCreationFormValidationOptions {
  /** Whether to reject a name containing characters outside `NAME_PATTERN`. */
  validateNamePattern?: boolean;
  /**
   * Whether to reject a non-empty version that doesn't match a pattern.
   * `true` checks against the default `VERSION_PATTERN`; passing a `RegExp`
   * checks against that pattern instead (e.g. `SEMVER_VERSION_PATTERN` for a
   * host that requires a SemVer 2.0.0 version).
   */
  validateVersionPattern?: boolean | RegExp;
}
