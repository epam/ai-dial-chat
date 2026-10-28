import { ProjectCreateErrorCode } from '@epam/ai-dial-chat-api-client';
import type { ProjectCreateFormErrors } from '@epam/ai-dial-projects';
import { ProjectsI18nKeys } from '../constants/translation-keys';

/** Where a rejected create request's message goes on the New project form. */
export interface ProjectCreateFieldError {
  field: keyof ProjectCreateFormErrors;
  key: ProjectsI18nKeys;
}

const FIELD_ERRORS: Partial<Record<string, ProjectCreateFieldError>> = {
  [ProjectCreateErrorCode.NameTaken]: {
    field: 'name',
    key: ProjectsI18nKeys.CreateErrorNameTaken,
  },
  [ProjectCreateErrorCode.InvalidName]: {
    field: 'name',
    key: ProjectsI18nKeys.CreateErrorNameInvalid,
  },
  [ProjectCreateErrorCode.TooManyFiles]: {
    field: 'context',
    key: ProjectsI18nKeys.CreateErrorTooManyFiles,
  },
  [ProjectCreateErrorCode.UnsupportedFileType]: {
    field: 'context',
    key: ProjectsI18nKeys.CreateErrorFilesRejected,
  },
  [ProjectCreateErrorCode.FileTooLarge]: {
    field: 'context',
    key: ProjectsI18nKeys.CreateErrorFilesRejected,
  },
  [ProjectCreateErrorCode.CapacityExceeded]: {
    field: 'context',
    key: ProjectsI18nKeys.CreateErrorFilesRejected,
  },
  [ProjectCreateErrorCode.InvalidFileName]: {
    field: 'context',
    key: ProjectsI18nKeys.CreateErrorFilesRejected,
  },
  [ProjectCreateErrorCode.DuplicateFileName]: {
    field: 'context',
    key: ProjectsI18nKeys.CreateErrorFilesRejected,
  },
};

/**
 * Returns the form field and message a `ProjectCreateErrorCode` maps to, or
 * `null` when the rejection belongs in a toast instead.
 */
export const mapProjectCreateError = (
  code: string | undefined,
): ProjectCreateFieldError | null =>
  (code != null ? FIELD_ERRORS[code] : undefined) ?? null;
