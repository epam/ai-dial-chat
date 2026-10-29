/** Why {@link validateProjectName} rejected a project name. */
export enum ProjectNameError {
  /** The name is empty or whitespace only. */
  Required = 'required',
  /** The name contains a forbidden or control character. */
  InvalidCharacters = 'invalid-characters',
  /** The name is one DIAL Core reserves (`v`, `files`, `.dial-resource`, …). */
  Reserved = 'reserved',
  /** The name is longer than 255 UTF-8 bytes. */
  TooLong = 'too-long',
}
