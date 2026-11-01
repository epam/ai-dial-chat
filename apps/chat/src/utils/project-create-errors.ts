import {
  getProjectFormError,
  ProjectFormErrorReason,
} from '@epam/ai-dial-chat-hooks/project';
import type { ProjectCreateFormErrors } from '@epam/ai-dial-projects';
import { ProjectsI18nKeys } from '../constants/translation-keys';

/** Where a rejected create request's message goes on the New project form. */
export interface ProjectCreateFieldError {
  field: keyof ProjectCreateFormErrors;
  key: ProjectsI18nKeys;
}

const REASON_MESSAGES: Record<ProjectFormErrorReason, ProjectsI18nKeys> = {
  [ProjectFormErrorReason.NameTaken]: ProjectsI18nKeys.CreateErrorNameTaken,
  [ProjectFormErrorReason.NameInvalid]: ProjectsI18nKeys.CreateErrorNameInvalid,
  [ProjectFormErrorReason.TooManyFiles]:
    ProjectsI18nKeys.CreateErrorTooManyFiles,
  [ProjectFormErrorReason.FilesRejected]:
    ProjectsI18nKeys.CreateErrorFilesRejected,
  [ProjectFormErrorReason.UnknownFile]: ProjectsI18nKeys.EditErrorUnknownFile,
};

/**
 * Returns the form field and message a `ProjectCreateErrorCode` maps to, or
 * `null` when the rejection belongs in a toast instead.
 */
export const mapProjectCreateError = (
  code: string | undefined,
): ProjectCreateFieldError | null => {
  const error = getProjectFormError(code);
  return error
    ? { field: error.field, key: REASON_MESSAGES[error.reason] }
    : null;
};
