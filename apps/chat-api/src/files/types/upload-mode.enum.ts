/** How a file upload treats an existing file at the target path. */
export enum UploadMode {
  /** Replace any existing file (the default). */
  Overwrite = 'overwrite',
  /** Fail with 409 when a file already exists. */
  CreateOnly = 'create-only',
}
