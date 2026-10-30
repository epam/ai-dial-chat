import { ProjectCreateErrorCode } from '@epam/ai-dial-chat-api-client';

/** Why the BFF rejected a project create or edit, as the form explains it. */
export enum ProjectFormErrorReason {
  NameTaken = 'name-taken',
  NameInvalid = 'name-invalid',
  TooManyFiles = 'too-many-files',
  FilesRejected = 'files-rejected',
  UnknownFile = 'unknown-file',
}

/** The project form field a rejection belongs to. */
export enum ProjectFormErrorField {
  Name = 'name',
  Context = 'context',
}

/** Where a rejected create or edit request's message goes on the project form. */
export interface ProjectFormError {
  /** Field the message is shown under. */
  field: ProjectFormErrorField;
  /** Why the request was rejected; the host resolves the message. */
  reason: ProjectFormErrorReason;
}

const FIELD_ERRORS: Partial<Record<string, ProjectFormError>> = {
  [ProjectCreateErrorCode.NameTaken]: {
    field: ProjectFormErrorField.Name,
    reason: ProjectFormErrorReason.NameTaken,
  },
  [ProjectCreateErrorCode.InvalidName]: {
    field: ProjectFormErrorField.Name,
    reason: ProjectFormErrorReason.NameInvalid,
  },
  [ProjectCreateErrorCode.TooManyFiles]: {
    field: ProjectFormErrorField.Context,
    reason: ProjectFormErrorReason.TooManyFiles,
  },
  [ProjectCreateErrorCode.UnsupportedFileType]: {
    field: ProjectFormErrorField.Context,
    reason: ProjectFormErrorReason.FilesRejected,
  },
  [ProjectCreateErrorCode.FileTooLarge]: {
    field: ProjectFormErrorField.Context,
    reason: ProjectFormErrorReason.FilesRejected,
  },
  [ProjectCreateErrorCode.CapacityExceeded]: {
    field: ProjectFormErrorField.Context,
    reason: ProjectFormErrorReason.FilesRejected,
  },
  [ProjectCreateErrorCode.InvalidFileName]: {
    field: ProjectFormErrorField.Context,
    reason: ProjectFormErrorReason.FilesRejected,
  },
  [ProjectCreateErrorCode.DuplicateFileName]: {
    field: ProjectFormErrorField.Context,
    reason: ProjectFormErrorReason.FilesRejected,
  },
  [ProjectCreateErrorCode.UnknownFile]: {
    field: ProjectFormErrorField.Context,
    reason: ProjectFormErrorReason.UnknownFile,
  },
};

/** Returns the form field and reason a `ProjectCreateErrorCode` maps to, or `null` when the rejection belongs in a toast. */
export const getProjectFormError = (
  code: string | undefined,
): ProjectFormError | null =>
  (code != null ? FIELD_ERRORS[code] : undefined) ?? null;
