/** Domain codes on `POST /api/v1/projects` rejections, read by the New project page. */
export enum ProjectCreateErrorCode {
  InvalidName = 'invalid-name',
  NameTaken = 'name-taken',
  InvalidFileName = 'invalid-file-name',
  DuplicateFileName = 'duplicate-file-name',
  UnsupportedFileType = 'unsupported-file-type',
  FileTooLarge = 'file-too-large',
  CapacityExceeded = 'capacity-exceeded',
  TooManyFiles = 'too-many-files',
}
