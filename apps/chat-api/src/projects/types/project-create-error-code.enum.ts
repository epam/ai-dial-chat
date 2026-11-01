/**
 * Domain codes on project write rejections — `POST /api/v1/projects`,
 * `PUT /api/v1/projects/:id` and `DELETE /api/v1/projects/:id` — read by the
 * New project, Edit project and project view pages. The name predates the
 * edit endpoints and is kept because the generated client already exports it.
 */
export enum ProjectCreateErrorCode {
  InvalidName = 'invalid-name',
  NameTaken = 'name-taken',
  InvalidFileName = 'invalid-file-name',
  DuplicateFileName = 'duplicate-file-name',
  UnsupportedFileType = 'unsupported-file-type',
  FileTooLarge = 'file-too-large',
  CapacityExceeded = 'capacity-exceeded',
  TooManyFiles = 'too-many-files',
  /** The project changed since the caller read it (stale `If-Match`). */
  ProjectChanged = 'project-changed',
  /** A conditional write was sent without `If-Match`. */
  IfMatchRequired = 'if-match-required',
  /** The project archive, or on save its stored `PROJECT.md`, exceeds the BFF's read limit. */
  ProjectTooLarge = 'project-too-large',
  /** `removedFileNames` names a context file the project does not have. */
  UnknownFile = 'unknown-file',
  /** A project conversation write hit Core's file-size or total-size limit for the project. */
  ProjectStorageFull = 'project-storage-full',
}
