/** Why {@link checkContextFiles} rejected a context file. */
export enum ContextFileRejection {
  /** The extension is not in the allowed list. */
  UnsupportedType = 'unsupported-type',
  /** The file is larger than the per-file limit. */
  TooLarge = 'too-large',
  /** Adding the file would push the total over the capacity. */
  CapacityExceeded = 'capacity-exceeded',
  /** A file with the same name is already added. */
  Duplicate = 'duplicate',
  /** The file name is not a valid DIAL resource name. */
  InvalidName = 'invalid-name',
}
