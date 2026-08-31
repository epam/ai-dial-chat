/** Result of validating files before upload. */
export interface FileUploadValidationResult {
  /** Whether the files passed validation. */
  valid: boolean;
  /** Human-readable validation error message when `valid` is false. */
  message?: string;
}
